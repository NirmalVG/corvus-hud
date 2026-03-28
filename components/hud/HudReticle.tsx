"use client"

import { BootStage } from "@/hooks/useBootSequence"

interface HudReticleProps {
  objectCount?: number
  bootStage?: BootStage
}

export function HudReticle({
  objectCount = 0,
  bootStage = "online",
}: HudReticleProps) {
  const visible = bootStage === "reticle" || bootStage === "online"
  const size = "min(80vw, 80vh, 340px)"

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s ease",
      }}
    >
      {/* Side accent bars */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 sm:w-8 h-[3px] bg-hud-cyan" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 sm:w-8 h-[3px] bg-hud-cyan" />

      {/* ALT / VEL labels */}
      <div
        className="absolute text-hud-cyan/60 text-[9px] sm:text-xs uppercase tracking-widest"
        style={{
          left: "calc(1.75rem + 4px)",
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "Share Tech Mono, monospace",
        }}
      >
        ALT_REF
      </div>
      <div
        className="absolute text-hud-cyan/60 text-[9px] sm:text-xs uppercase tracking-widest"
        style={{
          right: "calc(1.75rem + 4px)",
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "Share Tech Mono, monospace",
        }}
      >
        VEL_REF
      </div>

      {/* Reticle SVG */}
      <div
        style={{
          width: size,
          height: size,
          animation: visible ? "spin-slow 20s linear infinite" : "none",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 340 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="170"
            cy="170"
            r="160"
            stroke="#00D4FF"
            strokeWidth="1"
            strokeDasharray="6 4"
            opacity="0.5"
          />
          <circle
            cx="170"
            cy="170"
            r="120"
            stroke="#00D4FF"
            strokeWidth="0.5"
            strokeDasharray="3 6"
            opacity="0.25"
          />
          <line
            x1="170"
            y1="10"
            x2="170"
            y2="50"
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <line
            x1="170"
            y1="290"
            x2="170"
            y2="330"
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <line
            x1="10"
            y1="170"
            x2="50"
            y2="170"
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <line
            x1="290"
            y1="170"
            x2="330"
            y2="170"
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <circle cx="170" cy="170" r="3" fill="#00D4FF" opacity="0.9" />
          {[45, 135, 225, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180
            const x1 = 170 + 155 * Math.cos(rad)
            const y1 = 170 + 155 * Math.sin(rad)
            const x2 = 170 + 165 * Math.cos(rad)
            const y2 = 170 + 165 * Math.sin(rad)
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.4"
              />
            )
          })}
        </svg>
      </div>

      {/* Object label */}
      <div
        className="absolute border border-hud-border bg-hud-panel px-4 sm:px-6 py-1.5 sm:py-2 font-orbitron text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em]"
        style={{
          top: "63%",
          fontFamily: "Orbitron, sans-serif",
          color: objectCount > 0 ? "#00D4FF" : "rgba(0,212,255,0.4)",
          borderColor: objectCount > 0 ? "#00D4FF" : "rgba(0,212,255,0.3)",
          textShadow: objectCount > 0 ? "0 0 10px #00D4FF" : "none",
          transition: "all 0.3s ease",
        }}
      >
        {objectCount === 0
          ? "[ OBJECT_LABELS ]"
          : `[ ${objectCount} OBJECT${objectCount !== 1 ? "S" : ""} DETECTED ]`}
      </div>
    </div>
  )
}
