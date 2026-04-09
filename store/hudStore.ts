import { create } from "zustand"

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export interface DetectionIntel {
  sceneRisk: "CLEAR" | "ELEVATED" | "CRITICAL"
  dominantClass: string | null
  approachingCount: number
  stableTracks: number
  avgConfidence: number
  activeTracks: number
}

export interface LocationData {
  lat: number
  lng: number
  heading: number | null
  accuracy?: number
}

export interface BatteryData {
  level: number
  charging: boolean
}

export type VoiceState = "idle" | "listening" | "processing" | "speaking"

export interface ChatMessage {
  role: "user" | "corvus"
  text: string
  timestamp: number
}

export interface HudState {
  modelLoaded: boolean
  setModelLoaded: (loaded: boolean) => void
  modelLoading: boolean
  setModelLoading: (loading: boolean) => void

  detections: Detection[]
  setDetections: (detections: Detection[]) => void
  detectionIntel: DetectionIntel
  setDetectionIntel: (intel: DetectionIntel) => void
  fps: number
  setFps: (fps: number) => void

  location: LocationData | null
  setLocation: (loc: LocationData | null) => void
  locationLabel: string
  setLocationLabel: (label: string) => void
  battery: BatteryData | null
  setBattery: (battery: BatteryData | null) => void
  lowPowerMode: boolean
  toggleLowPowerMode: () => void

  voiceState: VoiceState
  setVoiceState: (state: VoiceState) => void
  lastCommand: string | null
  setLastCommand: (cmd: string | null) => void
  lastResponse: string | null
  setLastResponse: (res: string | null) => void

  conversationOpen: boolean
  setConversationOpen: (open: boolean) => void
  conversationHistory: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  clearConversation: () => void
}

export const useHudStore = create<HudState>()((set) => ({
  modelLoaded: false,
  setModelLoaded: (loaded) => set({ modelLoaded: loaded }),
  modelLoading: false,
  setModelLoading: (loading) => set({ modelLoading: loading }),

  detections: [],
  setDetections: (detections) => set({ detections }),
  detectionIntel: {
    sceneRisk: "CLEAR",
    dominantClass: null,
    approachingCount: 0,
    stableTracks: 0,
    avgConfidence: 0,
    activeTracks: 0,
  },
  setDetectionIntel: (intel) => set({ detectionIntel: intel }),
  fps: 0,
  setFps: (fps) => set({ fps }),

  location: null,
  setLocation: (loc) => set({ location: loc }),
  locationLabel: "ACQUIRING_GPS",
  setLocationLabel: (label) => set({ locationLabel: label }),
  battery: null,
  setBattery: (battery) => set({ battery }),
  lowPowerMode: false,
  toggleLowPowerMode: () =>
    set((state) => ({ lowPowerMode: !state.lowPowerMode })),

  voiceState: "idle",
  setVoiceState: (state) => set({ voiceState: state }),
  lastCommand: null,
  setLastCommand: (cmd) => set({ lastCommand: cmd }),
  lastResponse: null,
  setLastResponse: (res) => set({ lastResponse: res }),

  conversationOpen: false,
  setConversationOpen: (open) => set({ conversationOpen: open }),
  conversationHistory: [],
  addMessage: (msg) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, msg].slice(-50),
      conversationOpen: msg.role === "user" ? true : state.conversationOpen,
    })),
  clearConversation: () =>
    set({ conversationHistory: [], lastCommand: null, lastResponse: null }),
}))
