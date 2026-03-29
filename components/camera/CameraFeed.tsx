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
  useDetection(videoRef, canvasRef, status === "active")
  useLocation()
  useCompass()
  useBattery()

  const { detections, battery, modelLoaded, modelLoading } = useHudStore()
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
      {/* ── Layer 0 — Animated grid background ────────────────────────── */}
      <div
        style={{
          opacity: bootStage === "off" ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        <GridOverlay />
      </div>

      {/* ── Layer 1 — Live camera feed ─────────────────────────────────── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        aria-label="Camera feed"
      />

      {/* ── Layer 2 — Canvas for bounding boxes ───────────────────────── */}
      {/* No objectFit here — coordinate scaling handled in drawBoxes */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Layer 3 — Scanlines overlay ────────────────────────────────── */}
      <ScanlineOverlay />

      {/* ── Layer 4 — HUD panels (pointer-events-none by default) ─────── */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Top left — system status + low power toggle */}
        <div className="absolute top-6 left-4">
          <HudTopLeft bootStage={bootStage} />
        </div>

        {/* Top right — GPS coordinates + heading */}
        <div className="absolute top-6 right-4">
          <HudTopRight bootStage={bootStage} />
        </div>

        {/* Center — reticle + object label */}
        <HudReticle objectCount={detections.length} bootStage={bootStage} />

        {/* Bottom — FPS, objects, battery, clock */}
        <div
          style={{
            opacity: bootStage === "online" ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          <HudBottomBar />
        </div>

        {/* Voice button — only after boot completes */}
        {bootStage === "online" && (
          <div className="pointer-events-auto">
            <VoiceButton />
          </div>
        )}

        {/* ── DEBUG OVERLAY — remove after detection is working ─────── */}
        <div
          className="absolute bottom-24 left-4 pointer-events-none z-50"
          style={{ fontFamily: "Share Tech Mono, monospace" }}
        >
          <div className="text-[9px] leading-relaxed space-y-0.5">
            <div
              className={modelLoading ? "text-yellow-400" : "text-hud-cyan/30"}
            >
              MDL_LOADING: {modelLoading ? "YES" : "NO"}
            </div>
            <div className={modelLoaded ? "text-green-400" : "text-red-400"}>
              MDL_READY: {modelLoaded ? "YES" : "NO"}
            </div>
            <div className="text-hud-cyan/50">CAM_STATUS: {status}</div>
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
        {/* ── END DEBUG ──────────────────────────────────────────────── */}
      </div>

      {/* ── Layer 5 — Neural network loading overlay ───────────────────── */}
      <ModelLoadingOverlay />

      {/* ── Layer 6 — Battery critical warning ────────────────────────── */}
      {batteryLow && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-25 pointer-events-none"
          style={{ top: "45%" }}
        >
          <div
            className="text-red-400 font-orbitron text-xs tracking-widest animate-pulse-hud"
            style={{
              fontFamily: "Orbitron, sans-serif",
              textShadow: "0 0 10px red",
            }}
          >
            ⚠ POWER_CRITICAL
          </div>
        </div>
      )}

      {/* ── Layer 7 — Conversation panel (slides in from right) ────────── */}
      <ConversationPanel />

      {/* ── Layer 8 — Camera permission states ────────────────────────── */}
      {status === "requesting" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-hud-cyan font-orbitron text-xl animate-pulse-hud">
              INITIALISING CAMERA
            </div>
            <div
              className="text-hud-cyan/50 text-sm"
              style={{ fontFamily: "Share Tech Mono, monospace" }}
            >
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
            <div
              className="text-hud-cyan/70 text-xs leading-relaxed"
              style={{ fontFamily: "Share Tech Mono, monospace" }}
            >
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
