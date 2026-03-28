import { create } from "zustand"

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number]
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

interface HudState {
  // Detection
  detections: Detection[]
  fps: number
  modelLoaded: boolean
  modelLoading: boolean

  // Location
  location: LocationData | null
  locationLabel: string

  // Battery
  battery: BatteryData | null

  // Actions
  setDetections: (d: Detection[]) => void
  setFps: (fps: number) => void
  setModelLoaded: (v: boolean) => void
  setModelLoading: (v: boolean) => void
  setLocation: (loc: LocationData) => void
  setLocationLabel: (label: string) => void
  setBattery: (b: BatteryData) => void
}

export const useHudStore = create<HudState>((set) => ({
  detections: [],
  fps: 0,
  modelLoaded: false,
  modelLoading: false,
  location: null,
  locationLabel: "ACQUIRING...",
  battery: null,

  setDetections: (detections) => set({ detections }),
  setFps: (fps) => set({ fps }),
  setModelLoaded: (modelLoaded) => set({ modelLoaded }),
  setModelLoading: (modelLoading) => set({ modelLoading }),
  setLocation: (location) => set({ location }),
  setLocationLabel: (locationLabel) => set({ locationLabel }),
  setBattery: (battery) => set({ battery }),
}))
