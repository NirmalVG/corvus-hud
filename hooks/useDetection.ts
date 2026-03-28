"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"

const CONFIDENCE_THRESHOLD = 0.6

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
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const inferenceRunning = useRef(false)
  const lastFpsTime = useRef(0)
  const fpsFrameCount = useRef(0)

  const { setDetections, setFps, setModelLoaded, setModelLoading } =
    useHudStore()

  useEffect(() => {
    if (!enabled) {
      setDetections([])
      setModelLoading(false)
      setModelLoaded(false)
      return
    }

    let cancelled = false
    let model: Awaited<
      ReturnType<typeof import("@tensorflow-models/coco-ssd").load>
    > | null = null

    lastFpsTime.current = performance.now()
    frameCountRef.current = 0
    fpsFrameCount.current = 0
    inferenceRunning.current = false

    async function loadModel() {
      setModelLoading(true)
      setModelLoaded(false)

      try {
        const tf = await import("@tensorflow/tfjs")
        await tf.ready()

        const cocoSsd = await import("@tensorflow-models/coco-ssd")
        model = await cocoSsd.load({
          base: "lite_mobilenet_v2",
        })

        if (cancelled) return

        setModelLoaded(true)
        setModelLoading(false)
        startLoop()
      } catch (error) {
        if (cancelled) return

        console.error("Failed to load detection model:", error)
        setModelLoading(false)
        setModelLoaded(false)
      }
    }

    function startLoop() {
      function loop() {
        if (cancelled) return

        rafRef.current = requestAnimationFrame(loop)

        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2 || !model) return

        fpsFrameCount.current++
        const now = performance.now()
        const elapsed = now - lastFpsTime.current
        if (elapsed >= 1000) {
          setFps(Math.round((fpsFrameCount.current * 1000) / elapsed))
          fpsFrameCount.current = 0
          lastFpsTime.current = now
        }

        frameCountRef.current++
        const { fps } = useHudStore.getState()
        const skip = getAdaptiveFrameSkip(fps)
        if (frameCountRef.current % skip !== 0) return

        if (inferenceRunning.current) return
        inferenceRunning.current = true

        model
          .detect(video)
          .then((predictions) => {
            if (cancelled) return

            const filtered: Detection[] = predictions
              .filter((prediction) => prediction.score >= CONFIDENCE_THRESHOLD)
              .map((prediction) => ({
                class: prediction.class,
                score: prediction.score,
                bbox: prediction.bbox as [number, number, number, number],
              }))

            setDetections(filtered)
            drawBoxes(canvas, video, filtered)
          })
          .catch((error) => {
            if (!cancelled) {
              console.error("Detection frame failed:", error)
            }
          })
          .finally(() => {
            inferenceRunning.current = false
          })
      }

      loop()
    }

    loadModel()

    return () => {
      cancelled = true
      inferenceRunning.current = false
      cancelAnimationFrame(rafRef.current)
      setDetections([])
      setFps(0)
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

function drawBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
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

  for (const detection of detections) {
    const [x, y, w, h] = detection.bbox
    const label = `${detection.class.toUpperCase()} ${Math.round(detection.score * 100)}%`

    ctx.shadowColor = "#00D4FF"
    ctx.shadowBlur = 12
    ctx.strokeStyle = "#00D4FF"
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)

    ctx.shadowBlur = 0
    drawCornerBrackets(ctx, x, y, w, h)

    const labelY = y > 24 ? y - 6 : y + h + 16
    ctx.font = '600 13px "Share Tech Mono", monospace'
    const textWidth = ctx.measureText(label).width

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
    ctx.fillRect(x, labelY - 14, textWidth + 10, 18)

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
