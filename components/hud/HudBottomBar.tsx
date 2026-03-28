"use client"

import { useHudStore } from "@/store/hudStore"
import { useEffect, useState } from "react"

function useLocalTime() {
  const [time, setTime] = useState("")

  useEffect(() => {
    function update() {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, "0")
      const m = String(now.getMinutes()).padStart(2, "0")
      const s = String(now.getSeconds()).padStart(2, "0")
      setTime(`${h}:${m}:${s}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return time
}

export function HudBottomBar() {
  const { fps, detections, battery } = useHudStore()
  const time = useLocalTime()

  const batteryLevel = battery?.level ?? 88
  const isCharging = battery?.charging ?? false
  const objectCount = detections.length

  const items = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L8 6H4v4l-2 2 2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z"
            stroke="#00D4FF"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
        </svg>
      ),
      label: `${fps > 0 ? fps : "--"} FPS`,
      active: false,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#00D4FF" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" fill="#00D4FF" />
          <line
            x1="12"
            y1="3"
            x2="12"
            y2="6"
            stroke="#00D4FF"
            strokeWidth="1.5"
          />
          <line
            x1="12"
            y1="18"
            x2="12"
            y2="21"
            stroke="#00D4FF"
            strokeWidth="1.5"
          />
          <line
            x1="3"
            y1="12"
            x2="6"
            y2="12"
            stroke="#00D4FF"
            strokeWidth="1.5"
          />
          <line
            x1="18"
            y1="12"
            x2="21"
            y2="12"
            stroke="#00D4FF"
            strokeWidth="1.5"
          />
        </svg>
      ),
      label: `OBJ_${String(objectCount).padStart(2, "0")}`,
      active: true,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect
            x="2"
            y="7"
            width="18"
            height="10"
            rx="2"
            stroke="#00D4FF"
            strokeWidth="1.5"
          />
          <path d="M20 10h2v4h-2v-4z" fill="#00D4FF" opacity="0.6" />
          <rect
            x="4"
            y="9"
            width={`${(batteryLevel / 100) * 12}`}
            height="6"
            rx="1"
            fill="#00D4FF"
            opacity="0.8"
          />
          {isCharging && <circle cx="11" cy="12" r="1.5" fill="#00D4FF" />}
        </svg>
      ),
      label: isCharging ? `CHG_${batteryLevel}%` : `BAT_${batteryLevel}%`,
      active: false,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <line
            x1="12"
            y1="7"
            x2="12"
            y2="12"
            stroke="#00D4FF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="12"
            x2="15"
            y2="14"
            stroke="#00D4FF"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="1.2" fill="#00D4FF" />
        </svg>
      ),
      label: time || "--:--:--",
      active: false,
    },
  ]

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex justify-around items-center py-3 sm:py-4 px-2 sm:px-6"
      style={{
        background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
        fontFamily: "Share Tech Mono, monospace",
      }}
    >
      {items.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className={`relative ${item.active ? "drop-shadow-[0_0_8px_#00D4FF]" : "opacity-60"}`}
          >
            {item.active && (
              <div className="absolute inset-0 rounded-full border border-hud-cyan opacity-40 scale-150" />
            )}
            {item.icon}
          </div>
          <span
            className={`text-[9px] sm:text-[10px] uppercase tracking-widest ${
              item.active ? "text-hud-cyan" : "text-hud-cyan/50"
            }`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
