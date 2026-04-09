import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number] // [x, y, width, height]
}

export interface LocationData {
  lat: number
  lng: number
  heading: number | null
  accuracy: number
}

export interface BatteryData {
  level: number // 0–100
  charging: boolean
}

export type VoiceState = "idle" | "listening" | "processing" | "speaking"

export interface ConversationMessage {
  role: "user" | "corvus"
  text: string
  timestamp: number
}

// ─── State Interface ──────────────────────────────────────────────────────────

interface HudState {
  // ── Detection ──────────────────────────────────────────────────────────────
  detections: Detection[]
  fps: number
  modelLoaded: boolean
  modelLoading: boolean

  // ── Location ───────────────────────────────────────────────────────────────
  location: LocationData | null
  locationLabel: string

  // ── Battery ────────────────────────────────────────────────────────────────
  battery: BatteryData | null

  // ── Performance ────────────────────────────────────────────────────────────
  lowPowerMode: boolean

  // ── Voice ──────────────────────────────────────────────────────────────────
  voiceState: VoiceState
  lastCommand: string | null
  lastResponse: string | null

  // ── Conversation ───────────────────────────────────────────────────────────
  conversationHistory: ConversationMessage[]
  conversationOpen: boolean

  // ── Actions : Detection ────────────────────────────────────────────────────
  setDetections: (detections: Detection[]) => void
  setFps: (fps: number) => void
  setModelLoaded: (loaded: boolean) => void
  setModelLoading: (loading: boolean) => void

  // ── Actions : Location ─────────────────────────────────────────────────────
  setLocation: (location: LocationData) => void
  setLocationLabel: (label: string) => void

  // ── Actions : Battery ──────────────────────────────────────────────────────
  setBattery: (battery: BatteryData) => void

  // ── Actions : Performance ──────────────────────────────────────────────────
  toggleLowPowerMode: () => void

  // ── Actions : Voice ────────────────────────────────────────────────────────
  setVoiceState: (state: VoiceState) => void
  setLastCommand: (command: string | null) => void
  setLastResponse: (response: string | null) => void

  // ── Actions : Conversation ─────────────────────────────────────────────────
  addMessage: (message: ConversationMessage) => void
  clearConversation: () => void
  setConversationOpen: (open: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useHudStore = create<HudState>()(
  persist(
    (set) => ({
  // ── Detection ──────────────────────────────────────────────────────────────
  detections: [],
  fps: 0,
  modelLoaded: false,
  modelLoading: false,

  // ── Location ───────────────────────────────────────────────────────────────
  location: null,
  locationLabel: "ACQUIRING...",

  // ── Battery ────────────────────────────────────────────────────────────────
  battery: null,

  // ── Performance ────────────────────────────────────────────────────────────
  lowPowerMode: false,

  // ── Voice ──────────────────────────────────────────────────────────────────
  voiceState: "idle",
  lastCommand: null,
  lastResponse: null,

  // ── Conversation ───────────────────────────────────────────────────────────
  conversationHistory: [],
  conversationOpen: false,

  // ── Actions : Detection ────────────────────────────────────────────────────
  setDetections: (detections) => set({ detections }),
  setFps: (fps) => set({ fps }),
  setModelLoaded: (modelLoaded) => set({ modelLoaded }),
  setModelLoading: (modelLoading) => set({ modelLoading }),

  // ── Actions : Location ─────────────────────────────────────────────────────
  setLocation: (location) => set({ location }),
  setLocationLabel: (locationLabel) => set({ locationLabel }),

  // ── Actions : Battery ──────────────────────────────────────────────────────
  setBattery: (battery) => set({ battery }),

  // ── Actions : Performance ──────────────────────────────────────────────────
  toggleLowPowerMode: () =>
    set((state) => ({ lowPowerMode: !state.lowPowerMode })),

  // ── Actions : Voice ────────────────────────────────────────────────────────
  setVoiceState: (voiceState) => set({ voiceState }),
  setLastCommand: (lastCommand) => set({ lastCommand }),
  setLastResponse: (lastResponse) => set({ lastResponse }),

  // ── Actions : Conversation ─────────────────────────────────────────────────
      addMessage: (message) =>
        set((state) => ({
          // Keep a deeper rolling memory without unbounded growth.
          conversationHistory: [...state.conversationHistory, message].slice(-60),
          // Auto-open panel on every new message
          conversationOpen: true,
        })),

      clearConversation: () =>
        set({
          conversationHistory: [],
          lastCommand: null,
          lastResponse: null,
        }),

      setConversationOpen: (conversationOpen) => set({ conversationOpen }),
    }),
    {
      name: "corvus-hud-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversationHistory: state.conversationHistory,
        lastCommand: state.lastCommand,
        lastResponse: state.lastResponse,
      }),
    },
  ),
)
