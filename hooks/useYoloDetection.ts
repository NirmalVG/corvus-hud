"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"
import type { Detection } from "@/store/hudStore"

const BACKEND_URL = process.env.NEXT_PUBLIC_YOLO_BACKEND_URL ?? ""
const SEND_INTERVAL = 2000 // send a frame every 2 seconds
const JPEG_QUALITY = 0.75 // 75% JPEG — good balance of quality vs size
const CAPTURE_WIDTH = 640 // resize before sending — faster upload

export function useYoloDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const captureCanvas = useRef<HTMLCanvasElement | null>(null)
  const isSending = useRef(false)

  const { setDetections, modelLoaded } = useHudStore()

  useEffect(() => {
    if (!enabled || !BACKEND_URL || !modelLoaded) return

    // Create offscreen canvas for frame capture
    captureCanvas.current = document.createElement("canvas")
    const ctx = captureCanvas.current.getContext("2d")

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current
      const canvas = captureCanvas.current

      if (!video || !canvas || !ctx) return
      if (video.readyState < 2 || video.videoWidth === 0) return
      if (isSending.current) return // don't stack requests

      isSending.current = true

      // Scale down for faster upload
      const scale = CAPTURE_WIDTH / video.videoWidth
      canvas.width = CAPTURE_WIDTH
      canvas.height = Math.round(video.videoHeight * scale)

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            isSending.current = false
            return
          }

          try {
            const formData = new FormData()
            formData.append("file", blob, "frame.jpg")

            const res = await fetch(`${BACKEND_URL}/detect`, {
              method: "POST",
              body: formData,
              signal: AbortSignal.timeout(4000), // 4s timeout
            })

            if (!res.ok) {
              console.warn("[CORVUS YOLO] Backend error:", res.status)
              return
            }

            const data = await res.json()

            if (data.detections?.length > 0) {
              // Scale bbox back up to original video resolution
              const scaleBack = video.videoWidth / CAPTURE_WIDTH

              const scaled: Detection[] = data.detections.map(
                (d: {
                  class: string
                  confidence: number
                  bbox: [number, number, number, number]
                }) => ({
                  class: d.class,
                  score: d.confidence,
                  bbox: [
                    Math.round(d.bbox[0] * scaleBack),
                    Math.round(d.bbox[1] * scaleBack),
                    Math.round(d.bbox[2] * scaleBack),
                    Math.round(d.bbox[3] * scaleBack),
                  ] as [number, number, number, number],
                }),
              )

              setDetections(scaled)

              console.log(
                "[CORVUS YOLO]",
                scaled
                  .map((d) => `${d.class}(${Math.round(d.score * 100)}%)`)
                  .join(", "),
              )
            }
          } catch (err) {
            // Silently fail — COCO-SSD continues running on-device
            console.warn(
              "[CORVUS YOLO] Request failed, using on-device fallback",
            )
          } finally {
            isSending.current = false
          }
        },
        "image/jpeg",
        JPEG_QUALITY,
      )
    }, SEND_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      captureCanvas.current = null
    }
  }, [enabled, modelLoaded]) // eslint-disable-line react-hooks/exhaustive-deps
}
