"use client"

import { useCamera } from "@/hooks/useCamera"
import { useDetection } from "@/hooks/useDetection"
import { useLocation, useCompass } from "@/hooks/useLocation"
import { useBattery } from "@/hooks/useBattery"
import { useBootSequence } from "@/hooks/useBootSequence"
import { useGlitch } from "@/hooks/useGlitch"
import { useHudStore } from "@/store/hudStore"
import { ScanlineOverlay } from "@/components/overlays/ScanlineOverlay"
import { GridOverlay } from "@/components/overlays/GridOverlay"
import { CornerBrackets } from "@/components/hud/CornerBrackets"
import { HudTopLeft } from "@/components/hud/HudTopLeft"
import { HudTopRight } from "@/components/hud/HudTopRight"
import { HudReticle } from "@/components/hud/HudReticle"
import { HudBottomBar } from "@/components/hud/HudBottomBar"
import { ModelLoadingOverlay } from "@/components/hud/ModelLoadingOverlay"
import { VoiceButton } from "@/components/hud/VoiceButton"
import { ConversationPanel } from "@/components/hud/ConversationPanel"

export function CameraFeed() {
  const { videoRef, canvasRef, status, error } = useCamera()
  const { detections, battery, modelLoaded, modelLoading } = useHudStore()

  useDetection(videoRef, canvasRef, status === "active")
  useLocation()
  useCompass()
  useBattery()

  const bootStage = useBootSequence(status === "active")
  const glitching = useGlitch()
  const batteryLow = (battery?.level ?? 100) < 20

  return (
    <div
      className="relative w-full h-dvh bg-hud-dark overflow-hidden"
      style={{
        filter: glitching ? "hue-rotate(20deg) brightness(1.1)" : "none",
        transition: glitching ? "none" : "filter 0.3s ease",
      }}
    >
      <div
        style={{
          opacity: bootStage === "off" ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        <GridOverlay />
      </div>

      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        aria-label="Camera feed"
      />

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <ScanlineOverlay />

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-4 top-6">
          <HudTopLeft bootStage={bootStage} />
        </div>

        <div className="absolute right-4 top-6">
          <HudTopRight bootStage={bootStage} />
        </div>

        <HudReticle objectCount={detections.length} bootStage={bootStage} />

        <div
          style={{
            opacity: bootStage === "online" ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          <HudBottomBar />
        </div>

        {bootStage === "online" && (
          <div className="pointer-events-auto">
            <VoiceButton />
          </div>
        )}

        <div
          className="pointer-events-none absolute bottom-24 left-4 z-50"
          style={{ fontFamily: "Share Tech Mono, monospace" }}
        >
          <div className="space-y-0.5 text-[9px] leading-relaxed">
            <div
              className={modelLoading ? "text-yellow-400" : "text-hud-cyan/30"}
            >
              MDL_LOADING: {modelLoading ? "YES" : "NO"}
            </div>
            <div className={modelLoaded ? "text-green-400" : "text-red-400"}>
              MDL_READY: {modelLoaded ? "YES" : "NO"}
            </div>
            <div className="text-hud-cyan/50">CAM_STATUS: {status}</div>
            <div className="text-hud-cyan/50">ENGINE: COCO</div>
            <div
              className={
                detections.length > 0 ? "text-green-400" : "text-hud-cyan/50"
              }
            >
              DETECTIONS: {detections.length}
            </div>
            <div className="text-hud-cyan/50">
              DETECTION_ENABLED: {String(status === "active")}
            </div>
            <div
              className={
                bootStage === "online" ? "text-green-400" : "text-yellow-400"
              }
            >
              BOOT: {bootStage.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <ModelLoadingOverlay />

      {batteryLow && (
        <div
          className="pointer-events-none absolute left-1/2 z-25 -translate-x-1/2"
          style={{ top: "45%" }}
        >
          <div
            className="animate-pulse-hud text-xs font-orbitron tracking-widest text-red-400"
            style={{
              fontFamily: "Orbitron, sans-serif",
              textShadow: "0 0 10px red",
            }}
          >
            POWER_CRITICAL
          </div>
        </div>
      )}

      <ConversationPanel />

      {status === "requesting" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="animate-pulse-hud font-orbitron text-xl text-hud-cyan">
              INITIALISING CAMERA
            </div>
            <div
              className="text-sm text-hud-cyan/50"
              style={{ fontFamily: "Share Tech Mono, monospace" }}
            >
              Requesting sensor access...
            </div>
          </div>
        </div>
      )}

      {(status === "denied" || status === "error") && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8">
          <div className="relative w-full max-w-sm border border-hud-border bg-hud-panel p-6">
            <CornerBrackets />
            <div className="mb-2 font-orbitron text-sm text-red-400">
              SENSOR ERROR
            </div>
            <div
              className="text-xs leading-relaxed text-hud-cyan/70"
              style={{ fontFamily: "Share Tech Mono, monospace" }}
            >
              {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full border border-hud-border py-2 font-orbitron text-xs text-hud-cyan transition-colors hover:bg-hud-panel pointer-events-auto"
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
