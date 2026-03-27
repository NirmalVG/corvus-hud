"use client"

import { useEffect, useRef, useState } from "react"

export type CameraStatus = "idle" | "requesting" | "active" | "denied" | "error"

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status: CameraStatus
  error: string | null
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<CameraStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      setStatus("requesting")

      try {
        // First attempt — try exact back camera (works on mobile)
        let stream: MediaStream

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        } catch {
          // exact 'environment' failed — desktop or device with no back camera
          // fall back to any available camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus("active")
        }
      } catch (err) {
        if (cancelled) return

        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            setStatus("denied")
            setError(
              "Camera permission denied. Please allow camera access and reload.",
            )
          } else if (err.name === "NotFoundError") {
            setStatus("error")
            setError("No camera found on this device.")
          } else {
            setStatus("error")
            setError(`Camera error: ${err.message}`)
          }
        } else {
          setStatus("error")
          setError("Unexpected error starting camera.")
        }
      }
    }

    startCamera()

    // cleanup — stop camera when component unmounts
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, canvasRef, status, error }
}
