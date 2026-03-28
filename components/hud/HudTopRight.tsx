"use client"

import { useHudStore } from "@/store/hudStore"
import { CornerBrackets } from "@/components/hud/CornerBrackets"
import type { BootStage } from "@/hooks/useBootSequence"

interface HudTopRightProps {
  bootStage?: BootStage
}

export function HudTopRight({ bootStage = "online" }: HudTopRightProps) {
  const { location, locationLabel } = useHudStore()

  const lat = location?.lat ?? null
  const lng = location?.lng ?? null
  const heading = location?.heading ?? null

  const visible =
    bootStage === "panels" || bootStage === "reticle" || bootStage === "online"

  return (
    <div
      className="relative p-2 sm:p-3 w-[38vw] sm:w-[36vw] md:w-[32vw] lg:w-[220px] text-right"
      style={{
        fontFamily: "Share Tech Mono, monospace",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <CornerBrackets />

      {/* GPS Coordinates */}
      <div
        className="text-hud-cyan font-orbitron text-[10px] sm:text-xs font-bold leading-tight mb-1"
        style={{ textShadow: "0 0 10px #00D4FF" }}
      >
        GPS:
        <br />
        {lat !== null ? (
          <>
            {Math.abs(lat).toFixed(4)}° {lat >= 0 ? "N" : "S"}
          </>
        ) : (
          <span className="animate-pulse-hud opacity-60">ACQUIRING</span>
        )}
      </div>

      {/* Longitude */}
      {lng !== null && (
        <div className="text-hud-cyan/50 text-[9px] sm:text-[10px] mb-1 uppercase tracking-wider">
          {Math.abs(lng).toFixed(4)}° {lng >= 0 ? "E" : "W"}
        </div>
      )}

      {/* Heading and Zoom */}
      <div className="text-hud-cyan/70 text-[9px] sm:text-[10px] mb-1 uppercase tracking-wider">
        HDG: {heading !== null ? `${heading}°` : "--°"}
        &nbsp;|&nbsp; ZOOM: 1X
      </div>

      {/* Location label — computed locally from coords */}
      <div className="text-hud-cyan/50 text-[9px] sm:text-[10px] uppercase tracking-widest truncate">
        {locationLabel}
      </div>
    </div>
  )
}
