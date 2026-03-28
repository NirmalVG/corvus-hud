"use client"

import { useEffect, useRef, useState } from "react"
import { useHudStore } from "@/store/hudStore"

export function useGlitch() {
  const [glitching, setGlitching] = useState(false)
  const prevCount = useRef(0)
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { detections } = useHudStore()

  useEffect(() => {
    const currentCount = detections.length

    // Only glitch when detection count changes
    if (currentCount !== prevCount.current) {
      prevCount.current = currentCount

      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current)
      }
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current)
      }

      startTimerRef.current = setTimeout(() => {
        setGlitching(true)
        startTimerRef.current = null
      }, 0)

      endTimerRef.current = setTimeout(() => {
        setGlitching(false)
        endTimerRef.current = null
      }, 300)
    }

    return () => {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current)
        startTimerRef.current = null
      }

      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current)
        endTimerRef.current = null
      }
    }
  }, [detections])

  return glitching
}
