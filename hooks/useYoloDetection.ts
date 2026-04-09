"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"
import type { DetectionIntel } from "@/store/hudStore"
import { updateTracker, clearTracker } from "@/lib/objectTracker"
import type { TrackedObject } from "@/lib/objectTracker"
import { drawDetections } from "@/lib/drawDetections"

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_YOLO_BACKEND_URL ?? ""
).replace(/\/+$/, "")
/** Set to `true` to allow HTTPS public hosts (Railway, etc.). Camera frames are sent to that URL. */
const ALLOW_PUBLIC_YOLO_HOST =
  process.env.NEXT_PUBLIC_YOLO_ALLOW_PUBLIC_HOST === "true" ||
  process.env.NEXT_PUBLIC_YOLO_ALLOW_PUBLIC_HOST === "1"
const BASE_SEND_INTERVAL = 650
const FAILURE_BACKOFF_MS = 1800
const HIDDEN_TAB_DELAY_MS = 1800
const JPEG_QUALITY = 0.8
const CAPTURE_WIDTH = 512
const REQUEST_TIMEOUT_MS = 5000

function isPrivateBackendUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true
    }
    if (host.startsWith("192.168.")) return true
    if (host.startsWith("10.")) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
    return false
  } catch {
    return false
  }
}

function isAllowedYoloBackendUrl(rawUrl: string): boolean {
  if (!rawUrl.trim()) return false
  if (ALLOW_PUBLIC_YOLO_HOST) return true
  try {
    const url = new URL(rawUrl)
    if (url.protocol === "https:" && url.hostname.toLowerCase().endsWith(".hf.space")) {
      return true
    }
  } catch {
    return false
  }
  return isPrivateBackendUrl(rawUrl)
}

function getNextDelay(lowPowerMode: boolean, failureCount: number): number {
  if (typeof document !== "undefined" && document.hidden) {
    return HIDDEN_TAB_DELAY_MS
  }
  if (failureCount > 0) {
    return Math.min(FAILURE_BACKOFF_MS * failureCount, 6000)
  }
  return lowPowerMode ? 1400 : BASE_SEND_INTERVAL
}

type YoloResponse = {
  detections?: Array<{
    class: string
    confidence: number
    bbox: [number, number, number, number]
  }>
}

function buildDetectionIntel(objects: TrackedObject[]): DetectionIntel {
  if (objects.length === 0) {
    return {
      sceneRisk: "CLEAR" as const,
      dominantClass: null,
      approachingCount: 0,
      stableTracks: 0,
      avgConfidence: 0,
      activeTracks: 0,
    }
  }

  const classCounts = new Map<string, number>()
  let critical = 0
  let elevated = 0
  let approaching = 0
  let stable = 0
  let confTotal = 0

  for (const obj of objects) {
    classCounts.set(obj.class, (classCounts.get(obj.class) ?? 0) + 1)
    confTotal += obj.confidence
    if (obj.approach === "APPROACHING") approaching++
    if (obj.dwellSeconds >= 3 && obj.trend !== "FALLING") stable++
    if (obj.threat === "HIGH") critical++
    else if (obj.threat === "MEDIUM" || obj.threat === "LOW") elevated++
  }

  let dominantClass: string | null = null
  let dominantCount = 0
  for (const [cls, count] of classCounts) {
    if (count > dominantCount) {
      dominantClass = cls
      dominantCount = count
    }
  }

  const sceneRisk =
    critical > 0 ? "CRITICAL" : elevated > 0 ? "ELEVATED" : "CLEAR"

  return {
    sceneRisk,
    dominantClass,
    approachingCount: approaching,
    stableTracks: stable,
    avgConfidence: Math.round((confTotal / objects.length) * 100),
    activeTracks: objects.length,
  }
}

export function useYoloDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
) {
  const captureCanvas = useRef<HTMLCanvasElement | null>(null)
  const isSending = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqStartedAt = useRef<number>(0)
  const abortRef = useRef<AbortController | null>(null)
  const consecutiveFailures = useRef(0)

  const {
    setDetections,
    setModelLoaded,
    setModelLoading,
    setDetectionIntel,
    setFps,
    setYoloError,
    lowPowerMode,
  } = useHudStore()

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    clearTracker()
    setModelLoading(true)
    setYoloError(null)
    consecutiveFailures.current = 0

    if (!BACKEND_URL.trim()) {
      setModelLoading(false)
      setModelLoaded(false)
      setYoloError(
        "Set NEXT_PUBLIC_YOLO_BACKEND_URL (e.g. http://localhost:8000).",
      )
      return
    }
    if (!isAllowedYoloBackendUrl(BACKEND_URL)) {
      setModelLoading(false)
      setModelLoaded(false)
      setYoloError(
        "YOLO blocked: use localhost/LAN URL, or set NEXT_PUBLIC_YOLO_ALLOW_PUBLIC_HOST=true (frames leave device).",
      )
      console.warn(
        "[CORVUS YOLO] Non-private backend URL blocked unless NEXT_PUBLIC_YOLO_ALLOW_PUBLIC_HOST is enabled",
      )
      return
    }

    captureCanvas.current = document.createElement("canvas")
    const ctx = captureCanvas.current.getContext("2d")
    if (!ctx) {
      setModelLoading(false)
      setModelLoaded(false)
      setYoloError("Canvas 2D unavailable.")
      return
    }

    const scheduleNext = (delay: number) => {
      if (cancelled) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(poll, delay)
    }

    const poll = async () => {
      const video = videoRef.current
      const drawCanvas = canvasRef.current
      const canvas = captureCanvas.current

      if (cancelled) return
      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext(HIDDEN_TAB_DELAY_MS)
        return
      }
      if (!video || !canvas || !ctx || !drawCanvas) {
        scheduleNext(200)
        return
      }
      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        scheduleNext(200)
        return
      }
      if (isSending.current) {
        scheduleNext(getNextDelay(lowPowerMode, consecutiveFailures.current))
        return
      }

      isSending.current = true
      reqStartedAt.current = performance.now()
      abortRef.current = new AbortController()

      const timeoutId = setTimeout(() => {
        abortRef.current?.abort()
      }, REQUEST_TIMEOUT_MS)

      const scale = CAPTURE_WIDTH / video.videoWidth
      canvas.width = CAPTURE_WIDTH
      canvas.height = Math.round(video.videoHeight * scale)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            clearTimeout(timeoutId)
            isSending.current = false
            scheduleNext(getNextDelay(lowPowerMode, consecutiveFailures.current))
            return
          }

          try {
            const formData = new FormData()
            formData.append("file", blob, "frame.jpg")

            const res = await fetch(`${BACKEND_URL}/detect`, {
              method: "POST",
              body: formData,
              signal: abortRef.current?.signal,
            })

            if (!res.ok) {
              let errorDetail = `HTTP ${res.status}`
              try {
                const errorData = (await res.json()) as { detail?: string }
                if (errorData.detail) {
                  errorDetail = `${res.status} - ${errorData.detail}`
                }
              } catch {
                // Fall back to status text only when the backend does not return JSON.
              }
              console.warn("[CORVUS YOLO] Backend error:", res.status)
              setModelLoaded(false)
              setYoloError(`YOLO /detect failed: ${errorDetail}`)
              consecutiveFailures.current += 1
              return
            }

            const data = (await res.json()) as YoloResponse
            if (cancelled) return

            setModelLoaded(true)
            setModelLoading(false)
            setYoloError(null)
            consecutiveFailures.current = 0

            const dets = data.detections ?? []
            const scaleBack = video.videoWidth / CAPTURE_WIDTH

            const scaled: Detection[] = dets.map((d) => ({
              class: d.class,
              score: d.confidence,
              bbox: [
                Math.round(d.bbox[0] * scaleBack),
                Math.round(d.bbox[1] * scaleBack),
                Math.round(d.bbox[2] * scaleBack),
                Math.round(d.bbox[3] * scaleBack),
              ] as [number, number, number, number],
            }))

            const tracked = updateTracker(
              scaled.map((s) => ({
                class: s.class,
                score: s.score,
                bbox: s.bbox,
              })),
              video,
            )

            setDetections(
              tracked.map((t) => ({
                class: t.class,
                score: t.confidence,
                bbox: t.bbox,
              })),
            )
            setDetectionIntel(buildDetectionIntel(tracked))
            drawDetections(drawCanvas, video, tracked)

            const elapsed = performance.now() - reqStartedAt.current
            if (elapsed > 0) {
              setFps(Math.round(1000 / elapsed))
            }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              consecutiveFailures.current += 1
              return
            }

            setModelLoaded(false)
            consecutiveFailures.current += 1
            console.warn(
              "[CORVUS YOLO] Request failed:",
              err instanceof Error ? err.message : "unknown",
            )
            setYoloError(
              err instanceof Error ? err.message : "YOLO request failed",
            )
          } finally {
            clearTimeout(timeoutId)
            abortRef.current = null
            isSending.current = false
            scheduleNext(getNextDelay(lowPowerMode, consecutiveFailures.current))
          }
        },
        "image/jpeg",
        JPEG_QUALITY,
      )
    }

    const handleVisibilityChange = () => {
      scheduleNext(document.hidden ? HIDDEN_TAB_DELAY_MS : 120)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    fetch(`${BACKEND_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .catch(() => ({}))
            .then((data: { error?: string; detail?: string }) => {
              const detail = data.error ?? data.detail
              throw new Error(
                detail
                  ? `Health check failed: ${res.status} - ${detail}`
                  : `Health check failed: ${res.status}`,
              )
            })
        }
        setModelLoaded(true)
        setModelLoading(false)
        setYoloError(null)
        timeoutRef.current = setTimeout(poll, 50)
      })
      .catch((err: Error) => {
        setModelLoading(false)
        setModelLoaded(false)
        setYoloError(`Health check failed: ${err.message}`)
        console.warn("[CORVUS YOLO] Health check failed:", err.message)
      })

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      abortRef.current?.abort()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      captureCanvas.current = null
      clearTracker()
      setDetectionIntel({
        sceneRisk: "CLEAR",
        dominantClass: null,
        approachingCount: 0,
        stableTracks: 0,
        avgConfidence: 0,
        activeTracks: 0,
      })
      setYoloError(null)
    }
  }, [
    enabled,
    canvasRef,
    videoRef,
    setDetections,
    setDetectionIntel,
    setFps,
    setModelLoaded,
    setModelLoading,
    setYoloError,
    lowPowerMode,
  ])
}
