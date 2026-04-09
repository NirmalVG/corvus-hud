"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"
import type { DetectionIntel } from "@/store/hudStore"
import { updateTracker, clearTracker } from "@/lib/objectTracker"
import type { TrackedObject } from "@/lib/objectTracker"
import { drawDetections } from "@/lib/drawDetections"

const BASE_LOOP_DELAY_MS = 120
const LOW_POWER_DELAY_MS = 380
const HIDDEN_TAB_DELAY_MS = 1500

function getAdaptiveFrameSkip(fps: number): number {
  if (fps === 0) return 3
  if (fps >= 20) return 2
  if (fps >= 12) return 3
  return 4
}

function getAdaptiveLoopDelay(fps: number, lowPowerMode: boolean): number {
  if (typeof document !== "undefined" && document.hidden) {
    return HIDDEN_TAB_DELAY_MS
  }
  if (lowPowerMode) return LOW_POWER_DELAY_MS
  if (fps >= 18) return BASE_LOOP_DELAY_MS
  if (fps >= 10) return 160
  return 220
}

function buildDetectionIntel(objects: TrackedObject[]): DetectionIntel {
  if (objects.length === 0) {
    return {
      sceneRisk: "CLEAR" as const,
      dominantClass: null,
      approachingCount: 0,
      stableTracks: 0,
      avgConfidence: 0,
      activeTracks: 0,
    }
  }

  const classCounts = new Map<string, number>()
  let critical = 0
  let elevated = 0
  let approaching = 0
  let stable = 0
  let confTotal = 0

  for (const obj of objects) {
    classCounts.set(obj.class, (classCounts.get(obj.class) ?? 0) + 1)
    confTotal += obj.confidence
    if (obj.approach === "APPROACHING") approaching++
    if (obj.dwellSeconds >= 3 && obj.trend !== "FALLING") stable++
    if (obj.threat === "HIGH") critical++
    else if (obj.threat === "MEDIUM" || obj.threat === "LOW") elevated++
  }

  let dominantClass: string | null = null
  let dominantCount = 0
  for (const [cls, count] of classCounts) {
    if (count > dominantCount) {
      dominantClass = cls
      dominantCount = count
    }
  }

  const sceneRisk =
    critical > 0 ? "CRITICAL" : elevated > 0 ? "ELEVATED" : "CLEAR"

  return {
    sceneRisk,
    dominantClass,
    approachingCount: approaching,
    stableTracks: stable,
    avgConfidence: Math.round((confTotal / objects.length) * 100),
    activeTracks: objects.length,
  }
}

export function useDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null)
  const running = useRef(false)
  const lastFps = useRef(performance.now())
  const fpsCount = useRef(0)

  const {
    setDetections,
    setFps,
    setModelLoaded,
    setModelLoading,
    setDetectionIntel,
  } = useHudStore()

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    clearTracker()

    const scheduleNext = (delay: number) => {
      if (cancelled) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(runLoop, delay)
    }

    async function init() {
      setModelLoading(true)
      console.log("[CORVUS] Loading TF.js...")

      const tf = await import("@tensorflow/tfjs")
      await tf.ready()
      console.log("[CORVUS] Backend:", tf.getBackend())

      const cocoSsd = await import("@tensorflow-models/coco-ssd")
      modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" })
      console.log("[CORVUS] COCO-SSD loaded")

      if (!cancelled) {
        setModelLoaded(true)
        setModelLoading(false)

        setTimeout(async () => {
          if (cancelled) return
          const v = videoRef.current
          if (!v || v.readyState < 2 || !modelRef.current) return

          try {
            const preds = await modelRef.current.detect(v)
            console.log(
              "[CORVUS] Warmup:",
              preds.length
                ? preds
                    .map(
                      (p: { class: string; score: number }) =>
                        `${p.class}(${Math.round(p.score * 100)}%)`,
                    )
                    .join(", ")
                : "nothing detected - point at an object",
            )
          } catch (err) {
            console.warn(
              "[CORVUS] Warmup failed:",
              err instanceof Error ? err.message : "unknown",
            )
          }
        }, 1500)

        scheduleNext(60)
      }
    }

    async function runLoop() {
      if (cancelled) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const { fps, lowPowerMode } = useHudStore.getState()
      const nextDelay = getAdaptiveLoopDelay(fps, lowPowerMode)

      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext(nextDelay)
        return
      }
      if (!video || !canvas || !modelRef.current || running.current) {
        scheduleNext(nextDelay)
        return
      }
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        scheduleNext(180)
        return
      }

      running.current = true
      const detectStartedAt = performance.now()

      try {
        const preds: Array<{ class: string; score: number; bbox: number[] }> =
          await modelRef.current.detect(video)
        if (cancelled) return

        const raw = preds
          .filter((p) => p.score >= 0.35)
          .map((p) => ({
            class: p.class,
            score: p.score,
            bbox: p.bbox as [number, number, number, number],
          }))

        const tracked = updateTracker(raw, video)

        setDetections(
          tracked.map((t) => ({
            class: t.class,
            score: t.confidence,
            bbox: t.bbox,
          })) as Detection[],
        )
        setDetectionIntel(buildDetectionIntel(tracked))
        drawDetections(canvas, video, tracked)

        const elapsed = performance.now() - detectStartedAt
        if (elapsed > 0) {
          fpsCount.current++
          const now = performance.now()
          if (now - lastFps.current >= 1000) {
            setFps(
              Math.max(
                1,
                Math.round((fpsCount.current * 1000) / (now - lastFps.current)),
              ),
            )
            fpsCount.current = 0
            lastFps.current = now
          }
        }
      } catch (err) {
        console.error(
          "[CORVUS] detect error:",
          err instanceof Error ? err.message : err,
        )
      } finally {
        running.current = false
        const { fps: latestFps, lowPowerMode: latestLowPower } =
          useHudStore.getState()
        const skip = latestLowPower ? 2 : getAdaptiveFrameSkip(latestFps)
        scheduleNext(getAdaptiveLoopDelay(latestFps, latestLowPower) * skip)
      }
    }

    const handleVisibilityChange = () => {
      const { fps, lowPowerMode } = useHudStore.getState()
      scheduleNext(getAdaptiveLoopDelay(fps, lowPowerMode))
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    init().catch((err) => {
      console.error("[CORVUS] Init failed:", err)
      setModelLoading(false)
    })

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      running.current = false
      clearTracker()
      setDetectionIntel({
        sceneRisk: "CLEAR",
        dominantClass: null,
        approachingCount: 0,
        stableTracks: 0,
        avgConfidence: 0,
        activeTracks: 0,
      })
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}
