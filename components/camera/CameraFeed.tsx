"use client"

import { useCamera } from "@/hooks/useCamera"
import { useDetection } from "@/hooks/useDetection"
import { useHudStore } from "@/store/hudStore"
import { ScanlineOverlay } from "@/components/overlays/ScanlineOverlay"
import { GridOverlay } from "@/components/overlays/GridOverlay"
import { CornerBrackets } from "@/components/hud/CornerBrackets"
import { HudTopLeft } from "@/components/hud/HudTopLeft"
import { HudTopRight } from "@/components/hud/HudTopRight"
import { HudReticle } from "@/components/hud/HudReticle"
import { HudBottomBar } from "@/components/hud/HudBottomBar"
import { ModelLoadingOverlay } from "@/components/hud/ModelLoadingOverlay"

export function CameraFeed() {
  const { videoRef, canvasRef, status, error } = useCamera()
  useDetection(videoRef, canvasRef)

  const { detections, fps } = useHudStore()

  return (
    <div className="relative w-full h-dvh bg-hud-dark overflow-hidden">
      <GridOverlay />

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        aria-label="Camera feed"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover" }}
      />

      <ScanlineOverlay />

      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="absolute top-6 left-4">
          <HudTopLeft />
        </div>
        <div className="absolute top-6 right-4">
          <HudTopRight />
        </div>

        <HudReticle objectCount={detections.length} />

        <HudBottomBar
          fps={fps}
          objectCount={detections.length}
          battery={88}
          temperature={22}
        />
      </div>

      <ModelLoadingOverlay />

      {status === "requesting" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-hud-cyan font-orbitron text-xl animate-pulse-hud">
              INITIALISING CAMERA
            </div>
            <div className="text-hud-cyan/50 font-mono text-sm">
              Requesting sensor access...
            </div>
          </div>
        </div>
      )}

      {(status === "denied" || status === "error") && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8">
          <div className="relative border border-hud-border bg-hud-panel p-6 max-w-sm w-full">
            <CornerBrackets />
            <div className="text-red-400 font-orbitron text-sm mb-2">
              ⚠ SENSOR ERROR
            </div>
            <div className="text-hud-cyan/70 font-mono text-xs leading-relaxed">
              {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full border border-hud-border text-hud-cyan font-orbitron text-xs py-2 hover:bg-hud-panel transition-colors pointer-events-auto"
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
