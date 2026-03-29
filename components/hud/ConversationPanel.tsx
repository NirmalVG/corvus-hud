"use client"

import { useEffect, useRef } from "react"
import { useHudStore } from "@/store/hudStore"

export function ConversationPanel() {
  const {
    conversationOpen,
    conversationHistory,
    setConversationOpen,
    clearConversation,
  } = useHudStore()

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversationHistory])

  return (
    <>
      {/* Backdrop — tap outside to close */}
      {conversationOpen && (
        <div
          className="absolute inset-0 z-30"
          onClick={() => setConversationOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className="absolute top-0 right-0 h-full z-40 flex flex-col"
        style={{
          width: "min(72vw, 300px)",
          transform: conversationOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          background: "rgba(10, 10, 15, 0.85)",
          backdropFilter: "blur(12px)",
          borderLeft: "1px solid rgba(0, 212, 255, 0.25)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(0,212,255,0.15)" }}
        >
          <div className="flex items-center gap-2">
            {/* Arc reactor icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="#00D4FF"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <circle
                cx="12"
                cy="12"
                r="5"
                stroke="#00D4FF"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="2" fill="#00D4FF" />
              <line
                x1="12"
                y1="2"
                x2="12"
                y2="7"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.5"
              />
              <line
                x1="12"
                y1="17"
                x2="12"
                y2="22"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.5"
              />
              <line
                x1="2"
                y1="12"
                x2="7"
                y2="12"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.5"
              />
              <line
                x1="17"
                y1="12"
                x2="22"
                y2="12"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.5"
              />
            </svg>
            <span
              className="text-hud-cyan text-[11px] font-bold tracking-[0.2em]"
              style={{
                fontFamily: "Orbitron, sans-serif",
                textShadow: "0 0 8px #00D4FF",
              }}
            >
              CORVUS
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear button */}
            {conversationHistory.length > 0 && (
              <button
                onClick={clearConversation}
                className="text-hud-cyan/30 hover:text-hud-cyan/60 transition-colors"
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                }}
              >
                CLR
              </button>
            )}

            {/* Close button */}
            <button
              onClick={() => setConversationOpen(false)}
              className="text-hud-cyan/40 hover:text-hud-cyan transition-colors"
              style={{ fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3"
          style={{
            scrollbarWidth: "none", // hide scrollbar — clean look
          }}
        >
          {conversationHistory.length === 0 && (
            <div
              className="text-hud-cyan/25 text-[10px] text-center mt-8 uppercase tracking-widest leading-relaxed"
              style={{ fontFamily: "Share Tech Mono, monospace" }}
            >
              Systems online.{"\n"}
              <br />
              Hold mic and speak{"\n"}
              <br />
              to activate CORVUS.
            </div>
          )}

          {conversationHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {/* Role label */}
              <div
                className="text-[8px] uppercase tracking-widest px-1"
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  color:
                    msg.role === "user"
                      ? "rgba(0,212,255,0.4)"
                      : "rgba(0,212,255,0.6)",
                }}
              >
                {msg.role === "user" ? "▸ you" : "◈ corvus"}
              </div>

              {/* Message bubble */}
              <div
                className="max-w-[90%] px-2.5 py-2 text-[11px] leading-relaxed"
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  background:
                    msg.role === "user"
                      ? "rgba(0,212,255,0.06)"
                      : "rgba(0,212,255,0.03)",
                  border:
                    msg.role === "user"
                      ? "1px solid rgba(0,212,255,0.2)"
                      : "1px solid rgba(0,212,255,0.1)",
                  color:
                    msg.role === "user"
                      ? "rgba(0,212,255,0.8)"
                      : "rgba(0,212,255,0.95)",
                  borderRadius: 2,
                  textShadow:
                    msg.role === "corvus"
                      ? "0 0 8px rgba(0,212,255,0.3)"
                      : "none",
                }}
              >
                {msg.text}
              </div>

              {/* Timestamp */}
              <div
                className="text-[7px] px-1 opacity-25"
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  color: "#00D4FF",
                }}
              >
                {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom scanline decoration */}
        <div
          className="shrink-0 h-6"
          style={{
            borderTop: "1px solid rgba(0,212,255,0.1)",
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.02) 2px, rgba(0,212,255,0.02) 4px)",
          }}
        />
      </div>
    </>
  )
}
