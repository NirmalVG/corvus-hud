import { create } from "zustand"

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number] // [x, y, width, height]
}

interface HudState {
  // Detection
  detections: Detection[]
  fps: number
  modelLoaded: boolean
  modelLoading: boolean

  // Actions
  setDetections: (detections: Detection[]) => void
  setFps: (fps: number) => void
  setModelLoaded: (loaded: boolean) => void
  setModelLoading: (loading: boolean) => void
}

export const useHudStore = create<HudState>((set) => ({
  detections: [],
  fps: 0,
  modelLoaded: false,
  modelLoading: false,

  setDetections: (detections) => set({ detections }),
  setFps: (fps) => set({ fps }),
  setModelLoaded: (loaded) => set({ modelLoaded: loaded }),
  setModelLoading: (loading) => set({ modelLoading: loading }),
}))
