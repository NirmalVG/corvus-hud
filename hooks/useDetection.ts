"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"

function getAdaptiveFrameSkip(currentFps: number): number {
  if (currentFps === 0) return 3
  if (currentFps >= 20) return 2
  if (currentFps >= 12) return 3
  return 5
}

export function useDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
) {
  const workerRef = useRef<Worker | null>(null)
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const inferenceRunning = useRef(false)
  const lastFpsTime = useRef(performance.now())
  const fpsFrameCount = useRef(0)
  const workerFailed = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainThreadModel = useRef<any>(null)
  const loopStarted = useRef(false)

  const { setDetections, setFps, setModelLoaded, setModelLoading } =
    useHudStore()

  useEffect(() => {
    console.log("[CORVUS Detection] useEffect fired — enabled:", enabled)

    if (!enabled) {
      console.log("[CORVUS Detection] Not enabled, skipping")
      return
    }

    if (loopStarted.current) {
      console.log("[CORVUS Detection] Loop already started, skipping")
      return
    }

    loopStarted.current = true
    let cancelled = false

    // ── Try Worker first ───────────────────────────────────────────────
    function tryWorker() {
      console.log("[CORVUS Detection] Testing OffscreenCanvas support...")

      try {
        const test = new OffscreenCanvas(1, 1)
        test.getContext("2d")
        console.log(
          "[CORVUS Detection] OffscreenCanvas supported — spawning worker",
        )
      } catch {
        console.warn(
          "[CORVUS Detection] OffscreenCanvas NOT supported — using main thread",
        )
        workerFailed.current = true
        loadMainThreadModel()
        return
      }

      try {
        const worker = new Worker("/detection.worker.js")
        workerRef.current = worker

        worker.onmessage = (e) => {
          if (cancelled) return
          const { type, detections, error } = e.data
          console.log("[CORVUS Detection] Worker message:", type)

          if (type === "MODEL_READY") {
            console.log("[CORVUS Detection] ✅ Worker model ready")
            setModelLoaded(true)
            setModelLoading(false)
          }

          if (type === "MODEL_ERROR") {
            console.warn("[CORVUS Detection] ❌ Worker model error:", error)
            workerFailed.current = true
            worker.terminate()
            loadMainThreadModel()
          }

          if (type === "DETECTIONS") {
            inferenceRunning.current = false
            const typed = detections as Detection[]
            if (typed.length > 0) {
              console.log(
                "[CORVUS Detection] Detections:",
                typed.map((d) => d.class),
              )
            }
            setDetections(typed)
            const canvas = canvasRef.current
            const video = videoRef.current
            if (canvas && video) drawBoxes(canvas, video, typed)
          }
        }

        worker.onerror = (e) => {
          console.warn("[CORVUS Detection] Worker runtime error:", e.message)
          workerFailed.current = true
          workerRef.current = null
          loadMainThreadModel()
        }

        console.log("[CORVUS Detection] Sending LOAD to worker...")
        setModelLoading(true)
        worker.postMessage({ type: "LOAD" })
      } catch (err) {
        console.error("[CORVUS Detection] Failed to spawn worker:", err)
        workerFailed.current = true
        loadMainThreadModel()
      }
    }

    // ── Main thread fallback ───────────────────────────────────────────
    async function loadMainThreadModel() {
      if (cancelled) return
      console.log("[CORVUS Detection] Loading model on main thread...")
      setModelLoading(true)

      try {
        console.log("[CORVUS Detection] Importing TF.js...")
        const tf = await import("@tensorflow/tfjs")

        console.log("[CORVUS Detection] Waiting for TF ready...")
        await tf.ready()
        console.log("[CORVUS Detection] TF ready — backend:", tf.getBackend())

        console.log("[CORVUS Detection] Importing COCO-SSD...")
        const cocoSsd = await import("@tensorflow-models/coco-ssd")

        console.log("[CORVUS Detection] Loading model weights...")
        mainThreadModel.current = await cocoSsd.load({
          base: "lite_mobilenet_v2",
        })

        console.log("[CORVUS Detection] ✅ Main thread model loaded")

        if (!cancelled) {
          setModelLoaded(true)
          setModelLoading(false)
        }

        // ONE-SHOT TEST — logs raw predictions to console
        setTimeout(async () => {
          const video = videoRef.current
          if (!video) {
            console.log("[CORVUS TEST] No video element")
            return
          }
          console.log(
            "[CORVUS TEST] Video dimensions:",
            video.videoWidth,
            "x",
            video.videoHeight,
          )
          console.log("[CORVUS TEST] Video readyState:", video.readyState)
          console.log("[CORVUS TEST] Video paused:", video.paused)

          try {
            const raw = await mainThreadModel.current.detect(video)
            console.log(
              "[CORVUS TEST] Raw predictions (no threshold):",
              JSON.stringify(raw),
            )
          } catch (err) {
            console.error("[CORVUS TEST] detect() threw:", err)
          }
        }, 3000)
      } catch (err) {
        console.error("[CORVUS Detection] ❌ Main thread model failed:", err)
        setModelLoading(false)
      }
    }

    // ── RAF detection loop ─────────────────────────────────────────────
    let frameLogCount = 0

    function loop() {
      rafRef.current = requestAnimationFrame(loop)

      const video = videoRef.current
      if (!video) {
        if (frameLogCount < 5) {
          console.log("[CORVUS Detection] No video ref yet")
          frameLogCount++
        }
        return
      }

      if (video.readyState < 2) {
        if (frameLogCount < 5) {
          console.log(
            "[CORVUS Detection] Video not ready, readyState:",
            video.readyState,
          )
          frameLogCount++
        }
        return
      }

      // Guard zero dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        if (frameLogCount < 5) {
          console.log(
            "[CORVUS Detection] Video dimensions zero:",
            video.videoWidth,
            "x",
            video.videoHeight,
          )
          frameLogCount++
        }
        return
      }

      // FPS counter
      fpsFrameCount.current++
      const now = performance.now()
      const elapsed = now - lastFpsTime.current
      if (elapsed >= 1000) {
        setFps(Math.round((fpsFrameCount.current * 1000) / elapsed))
        fpsFrameCount.current = 0
        lastFpsTime.current = now
      }

      frameCountRef.current++
      const { fps, lowPowerMode } = useHudStore.getState()
      const skip = lowPowerMode ? 8 : getAdaptiveFrameSkip(fps)
      if (frameCountRef.current % skip !== 0) return
      if (inferenceRunning.current) return

      // Log first few detection attempts
      if (frameLogCount < 3) {
        console.log(
          "[CORVUS Detection] Attempting detection —",
          "workerFailed:",
          workerFailed.current,
          "workerRef:",
          !!workerRef.current,
          "mainModel:",
          !!mainThreadModel.current,
        )
        frameLogCount++
      }

      // ── Worker path ──────────────────────────────────────────────────
      if (!workerFailed.current && workerRef.current) {
        createImageBitmap(video)
          .then((bitmap) => {
            if (cancelled) {
              bitmap.close()
              return
            }
            inferenceRunning.current = true
            workerRef.current!.postMessage(
              {
                type: "DETECT",
                bitmap,
                width: video.videoWidth,
                height: video.videoHeight,
                threshold: 0.35,
              },
              [bitmap],
            )
          })
          .catch((err) => {
            console.warn("[CORVUS Detection] createImageBitmap failed:", err)
            inferenceRunning.current = false
          })
        return
      }

      // ── Main thread path ─────────────────────────────────────────────
      if (mainThreadModel.current) {
        inferenceRunning.current = true
        mainThreadModel.current
          .detect(video)
          .then(
            (
              predictions: Array<{
                class: string
                score: number
                bbox: number[]
              }>,
            ) => {
              if (cancelled) return
              inferenceRunning.current = false

              const filtered: Detection[] = predictions
                .filter((p) => p.score >= 0.35)
                .map((p) => ({
                  class: p.class,
                  score: p.score,
                  bbox: p.bbox as [number, number, number, number],
                }))

              setDetections(filtered)
              const canvas = canvasRef.current
              if (canvas && video) drawBoxes(canvas, video, filtered)
            },
          )
          .catch((err: Error) => {
            console.error("[CORVUS Detection] Main thread detect error:", err)
            inferenceRunning.current = false
          })
        return
      }

      if (frameLogCount < 10) {
        console.log("[CORVUS Detection] Waiting for model...")
        frameLogCount++
      }
    }

    tryWorker()
    loop()

    return () => {
      console.log("[CORVUS Detection] Cleanup")
      cancelled = true
      loopStarted.current = false
      cancelAnimationFrame(rafRef.current)
      workerRef.current?.terminate()
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Canvas Drawing ────────────────────────────────────────────────────────────

function drawBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  // Match canvas buffer to screen size — not video size
  const displayW = canvas.clientWidth || window.innerWidth
  const displayH = canvas.clientHeight || window.innerHeight

  if (canvas.width !== displayW || canvas.height !== displayH) {
    canvas.width = displayW
    canvas.height = displayH
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.clearRect(0, 0, displayW, displayH)

  // Scale factors — map video coords to screen coords
  // Matches objectFit: cover behaviour of the video element
  const videoAspect = vw / vh
  const screenAspect = displayW / displayH

  let scaleX: number
  let scaleY: number
  let offsetX = 0
  let offsetY = 0

  if (videoAspect > screenAspect) {
    // Video wider — pillarbox
    scaleY = displayH / vh
    scaleX = scaleY
    offsetX = (displayW - vw * scaleX) / 2
  } else {
    // Video taller — letterbox
    scaleX = displayW / vw
    scaleY = scaleX
    offsetY = (displayH - vh * scaleY) / 2
  }

  for (const det of detections) {
    const [x, y, w, h] = det.bbox

    // Translate to screen coordinates
    const sx = x * scaleX + offsetX
    const sy = y * scaleY + offsetY
    const sw = w * scaleX
    const sh = h * scaleY

    const label = `${det.class.toUpperCase()} ${Math.round(det.score * 100)}%`

    // Glow box
    ctx.shadowColor = "#00D4FF"
    ctx.shadowBlur = 12
    ctx.strokeStyle = "#00D4FF"
    ctx.lineWidth = 1.5
    ctx.strokeRect(sx, sy, sw, sh)

    // Corner brackets
    ctx.shadowBlur = 0
    drawCornerBrackets(ctx, sx, sy, sw, sh)

    // Label background
    const labelY = sy > 24 ? sy - 6 : sy + sh + 16
    ctx.font = '600 13px "Share Tech Mono", monospace'
    const textWidth = ctx.measureText(label).width
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
    ctx.fillRect(sx, labelY - 14, textWidth + 10, 18)

    // Label text
    ctx.fillStyle = "#00D4FF"
    ctx.shadowColor = "#00D4FF"
    ctx.shadowBlur = 8
    ctx.fillText(label, sx + 5, labelY)
    ctx.shadowBlur = 0
  }
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const size = Math.min(w, h) * 0.2
  ctx.strokeStyle = "#00D4FF"
  ctx.lineWidth = 2
  ctx.shadowColor = "#00D4FF"
  ctx.shadowBlur = 6

  ctx.beginPath()
  ctx.moveTo(x, y + size)
  ctx.lineTo(x, y)
  ctx.lineTo(x + size, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w - size, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + size)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + h - size)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + size, y + h)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w - size, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y + h - size)
  ctx.stroke()
}
