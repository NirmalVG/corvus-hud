"use client"

import { useEffect } from "react"
import { useHudStore } from "@/store/hudStore"

// Battery API is not in TypeScript's lib by default
interface BatteryManager extends EventTarget {
  level: number
  charging: boolean
}

export function useBattery() {
  const { setBattery } = useHudStore()

  useEffect(() => {
    let battery: BatteryManager | null = null

    function update() {
      if (!battery) return
      setBattery({
        level: Math.round(battery.level * 100),
        charging: battery.charging,
      })
    }

    // @ts-expect-error — getBattery is not in TS lib yet
    if (navigator.getBattery) {
      // @ts-expect-error
      navigator.getBattery().then((b: BatteryManager) => {
        battery = b
        update()
        b.addEventListener("levelchange", update)
        b.addEventListener("chargingchange", update)
      })
    } else {
      // Fallback — Battery API not supported (iOS Safari)
      setBattery({ level: 100, charging: false })
    }

    return () => {
      if (battery) {
        battery.removeEventListener("levelchange", update)
        battery.removeEventListener("chargingchange", update)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
