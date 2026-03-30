"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"
import { updateTracker, clearTracker } from "@/lib/objectTracker"
import { drawDetections } from "@/lib/drawDetections"

function getAdaptiveFrameSkip(fps: number): number {
  if (fps === 0) return 3
  if (fps >= 20) return 2
  if (fps >= 12) return 3
  return 4
}

export function useDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
) {
  const rafRef = useRef<number>(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null)
  const running = useRef(false)
  const lastFps = useRef(performance.now())
  const fpsCount = useRef(0)
  const frames = useRef(0)

  const { setDetections, setFps, setModelLoaded, setModelLoading } =
    useHudStore()

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    clearTracker()

    async function init() {
      setModelLoading(true)
      console.log("[CORVUS] Loading TF.js...")

      const tf = await import("@tensorflow/tfjs")
      await tf.ready()
      console.log("[CORVUS] Backend:", tf.getBackend())

      const cocoSsd = await import("@tensorflow-models/coco-ssd")
      modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" })
      console.log("[CORVUS] COCO-SSD loaded ✅")

      if (!cancelled) {
        setModelLoaded(true)
        setModelLoading(false)

        // Warmup
        setTimeout(async () => {
          const v = videoRef.current
          if (!v || v.readyState < 2) return
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
              : "nothing detected — point at an object",
          )
        }, 1500)

        startLoop()
      }
    }

    function startLoop() {
      function loop() {
        if (cancelled) return
        rafRef.current = requestAnimationFrame(loop)

        // FPS
        fpsCount.current++
        const now = performance.now()
        if (now - lastFps.current >= 1000) {
          setFps(
            Math.round((fpsCount.current * 1000) / (now - lastFps.current)),
          )
          fpsCount.current = 0
          lastFps.current = now
        }

        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return
        if (video.readyState < 2) return
        if (!video.videoWidth || !video.videoHeight) return
        if (!modelRef.current || running.current) return

        frames.current++
        const { fps, lowPowerMode } = useHudStore.getState()
        const skip = lowPowerMode ? 8 : getAdaptiveFrameSkip(fps)
        if (frames.current % skip !== 0) return

        running.current = true
        modelRef.current
          .detect(video)
          .then(
            (
              preds: Array<{ class: string; score: number; bbox: number[] }>,
            ) => {
              if (cancelled) return
              running.current = false

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

              drawDetections(canvas, video, tracked)
            },
          )
          .catch((err: Error) => {
            console.error("[CORVUS] detect error:", err.message)
            running.current = false
          })
      }

      loop()
    }

    init().catch((err) => {
      console.error("[CORVUS] Init failed:", err)
      setModelLoading(false)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      clearTracker()
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}
