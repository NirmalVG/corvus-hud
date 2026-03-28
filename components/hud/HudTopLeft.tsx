"use client"

import { CornerBrackets } from "@/components/hud/CornerBrackets"
import { BootStage } from "@/hooks/useBootSequence"

interface HudTopLeftProps {
  bootStage?: BootStage
  status?: string
  signalStrength?: number
}

export function HudTopLeft({
  bootStage = "online",
  status = "NOMINAL",
  signalStrength = 98,
}: HudTopLeftProps) {
  const visible =
    bootStage === "panels" || bootStage === "reticle" || bootStage === "online"

  return (
    <div
      className="relative p-2 sm:p-3 w-[44vw] sm:w-[42vw] md:w-[38vw] lg:w-[280px]"
      style={{
        fontFamily: "Share Tech Mono, monospace",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <CornerBrackets />

      <div className="flex items-center gap-1.5 mb-1">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0"
        >
          <circle cx="12" cy="12" r="2" fill="#00D4FF" />
          <path
            d="M8 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4"
            stroke="#00D4FF"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 8 8"
            stroke="#00D4FF"
            strokeWidth="1.5"
            fill="none"
            opacity="0.5"
          />
        </svg>
        <span
          className="text-hud-cyan font-orbitron text-[10px] sm:text-xs font-bold leading-tight truncate"
          style={{ textShadow: "0 0 10px #00D4FF" }}
        >
          HUD v1.0 // CAMERA_FEED_ACT
        </span>
      </div>

      <div className="text-hud-cyan/60 text-[9px] sm:text-[10px] mb-1 uppercase tracking-widest">
        System Status: <span className="text-hud-cyan font-bold">{status}</span>
      </div>

      <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-hud-cyan/60 uppercase tracking-widest">
        <span className="text-hud-cyan">●</span>
        Signal_Strength:{" "}
        <span className="text-hud-cyan">{signalStrength}%</span>
      </div>
    </div>
  )
}
