"use client"

import { useHudStore } from "@/store/hudStore"

export function ModelLoadingOverlay() {
  const { modelLoading, modelLoaded } = useHudStore()

  if (!modelLoading && modelLoaded) return null
  if (!modelLoading && !modelLoaded) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div
        className="border border-hud-border bg-black/70 px-8 py-4 text-center"
        style={{ fontFamily: "Orbitron, sans-serif" }}
      >
        <div
          className="mb-2 animate-pulse-hud text-xs tracking-[0.3em] text-hud-cyan sm:text-sm"
          style={{ textShadow: "0 0 10px #00D4FF" }}
        >
          LOADING NEURAL NETWORK
        </div>
        <div
          className="text-[10px] tracking-widest text-hud-cyan/50"
          style={{ fontFamily: "Share Tech Mono, monospace" }}
        >
          COCO-SSD · MOBILENET_V2_LITE
        </div>
      </div>
    </div>
  )
}
