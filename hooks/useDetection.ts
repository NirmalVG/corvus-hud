"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"

const CONFIDENCE_THRESHOLD = 0.6 // only show detections above 60% confidence
const FRAME_SKIP = 2 // run detection every N frames (performance)

export function useDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const lastFpsTime = useRef(performance.now())
  const fpsFrameCount = useRef(0)

  const { setDetections, setFps, setModelLoaded, setModelLoading } =
    useHudStore()

  useEffect(() => {
    let model: Awaited<
      ReturnType<typeof import("@tensorflow-models/coco-ssd").load>
    > | null = null
    let cancelled = false

    async function loadModel() {
      setModelLoading(true)

      // Dynamic import — keeps TF.js OUT of the initial bundle
      // Users don't download 3MB of ML code until the camera is ready
      const tf = await import("@tensorflow/tfjs")
      await tf.ready() // wait for WebGL/WASM backend to initialise

      const cocoSsd = await import("@tensorflow-models/coco-ssd")
      model = await cocoSsd.load({
        base: "lite_mobilenet_v2", // fastest variant, good for mobile
      })

      if (!cancelled) {
        setModelLoaded(true)
        setModelLoading(false)
        startLoop()
      }
    }

    function startLoop() {
      function loop() {
        if (cancelled) return

        rafRef.current = requestAnimationFrame(loop)

        const video = videoRef.current
        const canvas = canvasRef.current

        // Don't run if video isn't playing yet
        if (!video || !canvas || video.readyState < 2) return

        frameCountRef.current++

        // FPS calculation — update every second
        fpsFrameCount.current++
        const now = performance.now()
        const elapsed = now - lastFpsTime.current
        if (elapsed >= 1000) {
          setFps(Math.round((fpsFrameCount.current * 1000) / elapsed))
          fpsFrameCount.current = 0
          lastFpsTime.current = now
        }

        // Skip frames for performance — run detection every FRAME_SKIP frames
        if (frameCountRef.current % FRAME_SKIP !== 0) return
        if (!model) return

        // Run detection — this is async but we don't await it inside RAF
        // Instead we fire-and-forget and let the next frame pick up results
        model.detect(video).then((predictions) => {
          if (cancelled) return

          const filtered: Detection[] = predictions
            .filter((p) => p.score >= CONFIDENCE_THRESHOLD)
            .map((p) => ({
              class: p.class,
              score: p.score,
              bbox: p.bbox as [number, number, number, number],
            }))

          setDetections(filtered)
          drawBoxes(canvas, video, filtered)
        })
      }

      loop()
    }

    loadModel()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function drawBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
  // Sync canvas pixel buffer to video dimensions
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const det of detections) {
    const [x, y, w, h] = det.bbox
    const label = `${det.class.toUpperCase()} ${Math.round(det.score * 100)}%`

    // Glow effect — draw box twice, blurred then sharp
    ctx.shadowColor = "#00D4FF"
    ctx.shadowBlur = 12
    ctx.strokeStyle = "#00D4FF"
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)

    // Corner brackets on bounding box (Iron Man style)
    ctx.shadowBlur = 0
    drawCornerBrackets(ctx, x, y, w, h)

    // Label background
    const labelY = y > 24 ? y - 6 : y + h + 16
    ctx.font = '600 13px "Share Tech Mono", monospace'
    const textWidth = ctx.measureText(label).width
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
  const size = Math.min(w, h) * 0.2 // bracket size = 20% of box
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
