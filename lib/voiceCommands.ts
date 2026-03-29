import { useHudStore } from "@/store/hudStore"

export interface VoiceCommand {
  patterns: string[] // phrases that trigger this command
  response: (store: ReturnType<typeof useHudStore.getState>) => string
  action?: (store: ReturnType<typeof useHudStore.getState>) => void
}

export const VOICE_COMMANDS: VoiceCommand[] = [
  {
    patterns: ["status", "system status", "report"],
    response: (s) => {
      const fps = s.fps > 0 ? s.fps : 0
      const objs = s.detections.length
      const bat = s.battery?.level ?? 100
      return `All systems nominal. Running at ${fps} frames per second. ${objs} objects in view. Battery at ${bat} percent.`
    },
  },
  {
    patterns: ["how many", "objects", "what do you see", "scan"],
    response: (s) => {
      const detections = s.detections
      if (detections.length === 0)
        return "No objects detected in current field of view."
      const counts: Record<string, number> = {}
      detections.forEach((d) => {
        counts[d.class] = (counts[d.class] ?? 0) + 1
      })
      const summary = Object.entries(counts)
        .map(([cls, n]) => `${n} ${cls}${n > 1 ? "s" : ""}`)
        .join(", ")
      return `I can see ${summary}.`
    },
  },
  {
    patterns: ["location", "where am i", "coordinates", "position"],
    response: (s) => {
      const loc = s.location
      if (!loc) return "GPS signal not acquired yet."
      const lat = Math.abs(loc.lat).toFixed(4)
      const latDir = loc.lat >= 0 ? "North" : "South"
      const lng = Math.abs(loc.lng).toFixed(4)
      const lngDir = loc.lng >= 0 ? "East" : "West"
      return `Current position: ${lat} degrees ${latDir}, ${lng} degrees ${lngDir}.`
    },
  },
  {
    patterns: ["heading", "direction", "compass", "which way"],
    response: (s) => {
      const heading = s.location?.heading
      if (heading === null || heading === undefined)
        return "Compass data unavailable."
      const directions = [
        "North",
        "North-East",
        "East",
        "South-East",
        "South",
        "South-West",
        "West",
        "North-West",
      ]
      const dir = directions[Math.round(heading / 45) % 8]
      return `Heading ${heading} degrees. Facing ${dir}.`
    },
  },
  {
    patterns: ["battery", "power", "charge"],
    response: (s) => {
      const bat = s.battery
      if (!bat) return "Battery sensor unavailable."
      const status = bat.charging ? "charging" : "on battery"
      const warn = bat.level < 20 ? " Warning: power critical." : ""
      return `Battery at ${bat.level} percent, ${status}.${warn}`
    },
  },
  {
    patterns: ["fps", "performance", "frame rate", "speed"],
    response: (s) => {
      const fps = s.fps
      const mode = s.lowPowerMode ? "Low power mode active." : ""
      return `Running at ${fps} frames per second. ${mode}`
    },
  },
  {
    patterns: ["low power", "power mode", "save battery"],
    response: (s) => {
      const next = !s.lowPowerMode
      return next
        ? "Switching to low power mode. Reducing detection frequency."
        : "Resuming full performance mode."
    },
    action: (s) => s.toggleLowPowerMode(),
  },
  {
    patterns: ["hello", "hey corvus", "corvus", "wake up", "online"],
    response: () => "Online and operational. How can I assist you?",
  },
  {
    patterns: ["shutdown", "sleep", "standby", "go to sleep"],
    response: () => "Understood. Maintaining minimal systems.",
  },
  {
    patterns: ["thank you", "thanks"],
    response: () => "Of course.",
  },
]

export function matchCommand(transcript: string): VoiceCommand | null {
  const lower = transcript.toLowerCase().trim()
  // Find the first command whose patterns appear anywhere in the transcript
  return (
    VOICE_COMMANDS.find((cmd) => cmd.patterns.some((p) => lower.includes(p))) ??
    null
  )
}
