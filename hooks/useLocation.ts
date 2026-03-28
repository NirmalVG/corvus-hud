"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"

const LOCATION_UPDATE_THRESHOLD = 10 // metres — update label after moving this far

export function useLocation() {
  const { setLocation, setLocationLabel } = useHudStore()
  const watchId = useRef<number | null>(null)
  const lastPos = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel("GPS_UNAVAILABLE")
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords

        setLocation({ lat, lng, heading: null, accuracy })

        // Only update label after meaningful movement
        const last = lastPos.current
        const moved = last
          ? haversineDistance(last.lat, last.lng, lat, lng)
          : Infinity

        if (moved > LOCATION_UPDATE_THRESHOLD) {
          lastPos.current = { lat, lng }
          // Format coords locally — zero external calls
          setLocationLabel(formatCoords(lat, lng))
        }
      },
      (err) => {
        console.warn("GPS error:", err.message)
        setLocationLabel("GPS_DENIED")
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    )

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useCompass() {
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      const heading = e.alpha !== null ? Math.round(360 - e.alpha) : null
      if (heading === null) return

      useHudStore.setState((state) => ({
        location: state.location ? { ...state.location, heading } : null,
      }))
    }

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      // @ts-expect-error — requestPermission is iOS-only
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      // @ts-expect-error
      DeviceOrientationEvent.requestPermission()
        .then((permission: string) => {
          if (permission === "granted") {
            window.addEventListener("deviceorientation", handleOrientation)
          }
        })
        .catch(console.warn)
    } else {
      window.addEventListener("deviceorientation", handleOrientation)
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation)
    }
  }, [])
}

// ─── Local Helpers — No Network Calls ─────────────────────────────────────────

function formatCoords(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}${lat >= 0 ? "N" : "S"}`
  const lngStr = `${Math.abs(lng).toFixed(4)}${lng >= 0 ? "E" : "W"}`
  return `${latStr}_${lngStr}`
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
