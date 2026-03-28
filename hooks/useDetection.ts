"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"

// ─── Adaptive Frame Skip ───────────────────────────────────────────────────────

function getAdaptiveFrameSkip(currentFps: number): number {
  if (currentFps === 0) return 3 // default on startup
  if (currentFps >= 20) return 2 // fast device — detect more often
  if (currentFps >= 12) return 3 // mid-range — comfortable
  return 5 // slow device — prioritise smoothness
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
) {
  const workerRef = useRef<Worker | null>(null)
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const inferenceRunning = useRef(false)
  const lastFpsTime = useRef(0)
  const fpsFrameCount = useRef(0)

  const { setDetections, setFps, setModelLoaded, setModelLoading } =
    useHudStore()

  useEffect(() => {
    if (!enabled) return

    lastFpsTime.current = performance.now()
    frameCountRef.current = 0
    fpsFrameCount.current = 0
    inferenceRunning.current = false

    // ── Spawn Worker ────────────────────────────────────────────────────────
    const worker = new Worker("/detection.worker.js")
    workerRef.current = worker

    worker.onmessage = (e) => {
      const { type, detections, error } = e.data

      if (type === "MODEL_READY") {
        setModelLoaded(true)
        setModelLoading(false)
      }

      if (type === "MODEL_ERROR") {
        console.error("Worker model error:", error)
        setModelLoading(false)
      }

      if (type === "DETECTIONS") {
        inferenceRunning.current = false

        const typed = detections as Detection[]
        setDetections(typed)

        // Draw boxes back on main thread — worker can't touch the DOM
        const canvas = canvasRef.current
        const video = videoRef.current
        if (canvas && video) {
          drawBoxes(canvas, video, typed)
        }
      }
    }

    worker.onerror = (e) => {
      console.error("Worker error:", e.message)
      setModelLoading(false)
    }

    // Tell worker to start loading the model immediately
    setModelLoading(true)
    worker.postMessage({ type: "LOAD" })

    // ── RAF Loop ────────────────────────────────────────────────────────────
    function loop() {
      rafRef.current = requestAnimationFrame(loop)

      const video = videoRef.current
      if (!video || video.readyState < 2) return

      // FPS counter — update once per second
      fpsFrameCount.current++
      const now = performance.now()
      const elapsed = now - lastFpsTime.current
      if (elapsed >= 1000) {
        setFps(Math.round((fpsFrameCount.current * 1000) / elapsed))
        fpsFrameCount.current = 0
        lastFpsTime.current = now
      }

      // Adaptive frame skip based on observed FPS
      frameCountRef.current++
      const { fps } = useHudStore.getState()
      const skip = getAdaptiveFrameSkip(fps)
      if (frameCountRef.current % skip !== 0) return

      // Don't stack inference calls — wait for previous to finish
      if (inferenceRunning.current) return

      // Capture frame as transferable ImageBitmap — zero copy to worker
      createImageBitmap(video)
        .then((bitmap) => {
          inferenceRunning.current = true
          worker.postMessage(
            {
              type: "DETECT",
              bitmap,
              width: video.videoWidth,
              height: video.videoHeight,
              threshold: 0.6,
            },
            [bitmap], // transfer ownership — bitmap is now owned by worker
          )
        })
        .catch(() => {
          // Video frame capture failed — skip this frame silently
          inferenceRunning.current = false
        })
    }

    loop()

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafRef.current)
      workerRef.current = null
      worker.terminate()
    }
  }, [
    canvasRef,
    enabled,
    setDetections,
    setFps,
    setModelLoaded,
    setModelLoading,
    videoRef,
  ])
}

// ─── Canvas Drawing ────────────────────────────────────────────────────────────

function drawBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
  // Only resize canvas if dimensions actually changed — avoids unnecessary clears
  if (
    canvas.width !== video.videoWidth ||
    canvas.height !== video.videoHeight
  ) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const det of detections) {
    const [x, y, w, h] = det.bbox
    const label = `${det.class.toUpperCase()} ${Math.round(det.score * 100)}%`

    // Outer glow box
    ctx.shadowColor = "#00D4FF"
    ctx.shadowBlur = 12
    ctx.strokeStyle = "#00D4FF"
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)

    // Corner brackets — Iron Man style
    ctx.shadowBlur = 0
    drawCornerBrackets(ctx, x, y, w, h)

    // Label — position above box, or below if too close to top
    const labelY = y > 24 ? y - 6 : y + h + 16
    ctx.font = '600 13px "Share Tech Mono", monospace'
    const textWidth = ctx.measureText(label).width

    // Label background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
    ctx.fillRect(x, labelY - 14, textWidth + 10, 18)

    // Label text
    ctx.fillStyle = "#00D4FF"
    ctx.shadowColor = "#00D4FF"
    ctx.shadowBlur = 8
    ctx.fillText(label, x + 5, labelY)
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

  // Top-left
  ctx.beginPath()
  ctx.moveTo(x, y + size)
  ctx.lineTo(x, y)
  ctx.lineTo(x + size, y)
  ctx.stroke()

  // Top-right
  ctx.beginPath()
  ctx.moveTo(x + w - size, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + size)
  ctx.stroke()

  // Bottom-left
  ctx.beginPath()
  ctx.moveTo(x, y + h - size)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + size, y + h)
  ctx.stroke()

  // Bottom-right
  ctx.beginPath()
  ctx.moveTo(x + w - size, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y + h - size)
  ctx.stroke()
}
