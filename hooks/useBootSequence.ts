"use client"

import { useEffect, useState } from "react"

export type BootStage =
  | "off" // nothing visible
  | "grid" // grid appears
  | "panels" // HUD panels fade in
  | "reticle" // reticle draws in
  | "online" // fully operational

export function useBootSequence(cameraActive: boolean) {
  const [stage, setStage] = useState<BootStage>("off")

  useEffect(() => {
    if (!cameraActive) return

    // Staggered boot — each stage triggers the next
    const timers = [
      setTimeout(() => setStage("grid"), 100),
      setTimeout(() => setStage("panels"), 600),
      setTimeout(() => setStage("reticle"), 1200),
      setTimeout(() => setStage("online"), 2000),
    ]

    return () => timers.forEach(clearTimeout)
  }, [cameraActive])

  return stage
}
