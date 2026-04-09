"use client"

import { useHudStore } from "@/store/hudStore"

export function ModelLoadingOverlay() {
  const { modelLoading, modelLoaded, detectionEngine } = useHudStore()

  if (!modelLoading && modelLoaded) return null
  if (!modelLoading && !modelLoaded) return null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div
        className="border border-hud-border bg-black/70 px-8 py-4 text-center"
        style={{ fontFamily: "Orbitron, sans-serif" }}
      >
        <div
          className="text-hud-cyan text-xs sm:text-sm tracking-[0.3em] animate-pulse-hud mb-2"
          style={{ textShadow: "0 0 10px #00D4FF" }}
        >
          LOADING NEURAL NETWORK
        </div>
        <div
          className="text-hud-cyan/50 text-[10px] tracking-widest"
          style={{ fontFamily: "Share Tech Mono, monospace" }}
        >
          {detectionEngine === "yolo" ? "YOLOv8n · BACKEND LINK" : "COCO-SSD · MOBILENET_V2_LITE"}
        </div>
      </div>
    </div>
  )
}
