"use client"

import { useHudStore } from "@/store/hudStore"
import { CornerBrackets } from "@/components/hud/CornerBrackets"

export function HudTopRight() {
  const { location, locationLabel } = useHudStore()

  const lat = location?.lat ?? null
  const heading = location?.heading ?? null

  return (
    <div
      className="relative p-2 sm:p-3 w-[38vw] sm:w-[36vw] md:w-[32vw] lg:w-[220px] text-right"
      style={{ fontFamily: "Share Tech Mono, monospace" }}
    >
      <CornerBrackets />

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
          <span className="animate-pulse-hud">ACQUIRING</span>
        )}
      </div>

      <div className="text-hud-cyan/70 text-[9px] sm:text-[10px] mb-1 uppercase tracking-wider">
        HDG: {heading !== null ? `${heading}°` : "--°"} &nbsp;|&nbsp; ZOOM: 1X
      </div>

      <div className="text-hud-cyan/50 text-[9px] sm:text-[10px] uppercase tracking-widest truncate">
        {locationLabel}
      </div>
    </div>
  )
}
