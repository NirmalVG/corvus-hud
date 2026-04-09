"use client"

import { useEffect, useRef, useCallback } from "react"
import { useHudStore } from "@/store/hudStore"

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error:
    | "aborted"
    | "audio-capture"
    | "bad-grammar"
    | "language-not-supported"
    | "network"
    | "no-speech"
    | "not-allowed"
    | "service-not-allowed"
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: ((event: Event) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

async function askCorvus(
  command: string,
  context: object,
  history: Array<{ role: string; text: string }>,
  memory: string,
): Promise<string> {
  try {
    const res = await fetch("/api/corvus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, context, history, memory }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.response ?? "Systems are processing, sir."
  } catch {
    return "Unable to reach systems. Standing by, sir."
  }
}

function buildLongTermMemory(
  history: Array<{ role: "user" | "corvus"; text: string }>,
): string {
  const recentUserLines = history
    .filter((m) => m.role === "user")
    .slice(-16)
    .map((m) => m.text.trim())
    .filter(Boolean)

  const unique = Array.from(new Set(recentUserLines))
  const compact = unique.slice(-8).join(" | ")
  return compact.slice(0, 900)
}

export function useVoice() {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const { setVoiceState, setLastCommand, setLastResponse, addMessage } =
    useHudStore()

  const speak = useCallback(
    (text: string) => {
      if (!synthRef.current) return

      synthRef.current.cancel()
      setVoiceState("speaking")
      setLastResponse(text)

      // Log CORVUS response to conversation panel
      addMessage({ role: "corvus", text, timestamp: Date.now() })

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.92
      utterance.pitch = 0.85
      utterance.volume = 1.0

      const voices = synthRef.current.getVoices()
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("daniel") ||
            v.name.toLowerCase().includes("alex") ||
            v.name.toLowerCase().includes("david") ||
            v.name.toLowerCase().includes("james")),
      )
      if (preferred) utterance.voice = preferred

      utterance.onend = () => setVoiceState("idle")
      utterance.onerror = () => setVoiceState("idle")

      synthRef.current.speak(utterance)
    },
    [setVoiceState, setLastResponse, addMessage],
  )

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) {
      speak("Voice recognition is not supported on this device.")
      return
    }
    const { voiceState } = useHudStore.getState()
    if (voiceState !== "idle") return
    try {
      recognition.start()
    } catch {
      // Already started
    }
  }, [speak])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  useEffect(() => {
    synthRef.current = window.speechSynthesis

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      console.warn("Speech Recognition not supported")
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"
    recognition.maxAlternatives = 3

    recognition.onstart = () => setVoiceState("listening")

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      setVoiceState("processing")

      const transcript = event.results[0][0].transcript
      setLastCommand(transcript)

      // Log user message to conversation panel
      addMessage({ role: "user", text: transcript, timestamp: Date.now() })

      const store = useHudStore.getState()

      // Build context — GPS never included
      const context = {
        detections: store.detections.map((d) => ({
          class: d.class,
          score: d.score,
        })),
        heading: store.location?.heading ?? null,
        battery: store.battery?.level ?? null,
        fps: store.fps,
        lowPowerMode: store.lowPowerMode,
      }

      // Local HUD control — handle without API call
      const lower = transcript.toLowerCase()
      if (lower.includes("low power") || lower.includes("power mode")) {
        store.toggleLowPowerMode()
        const active = useHudStore.getState().lowPowerMode
        speak(
          active
            ? "Low power mode activated, sir."
            : "Returning to full performance mode, sir.",
        )
        return
      }

      // Send deeper history plus compact long-term memory.
      const history = store.conversationHistory
        .slice(-24)
        .map((m) => ({ role: m.role, text: m.text }))
      const memory = buildLongTermMemory(store.conversationHistory)

      const response = await askCorvus(transcript, context, history, memory)
      speak(response)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        speak("No speech detected, sir.")
      } else if (event.error === "not-allowed") {
        speak("Microphone access denied.")
      }
      setVoiceState("idle")
    }

    recognition.onend = () => {
      const { voiceState } = useHudStore.getState()
      if (voiceState === "listening" || voiceState === "processing") {
        setVoiceState("idle")
      }
    }

    return () => {
      recognition.abort()
      synthRef.current?.cancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { startListening, stopListening }
}
