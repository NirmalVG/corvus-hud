import type {
  TrackedObject,
  ApproachState,
  TrendState,
  ThreatLevel,
  ObjectCategory,
} from "./objectTracker"

// ─── Colour System ────────────────────────────────────────────────────────────

function threatColor(threat: ThreatLevel): string {
  if (threat === "HIGH") return "#FF2222"
  if (threat === "MEDIUM") return "#FF8800"
  if (threat === "LOW") return "#FFDD00"
  return "#00D4FF" // default cyan
}

function categoryIcon(cat: ObjectCategory): string {
  if (cat === "PERSON") return "👤"
  if (cat === "VEHICLE") return "🚗"
  if (cat === "ANIMAL") return "🐾"
  if (cat === "FURNITURE") return "🪑"
  if (cat === "TECH") return "💻"
  if (cat === "FOOD") return "🍎"
  if (cat === "TOOL") return "🔧"
  return "◈"
}

function approachText(a: ApproachState): string {
  if (a === "APPROACHING") return "▼ APPROACHING"
  if (a === "RETREATING") return "▲ RETREATING"
  return "■ STATIC"
}

function approachColor(a: ApproachState): string {
  if (a === "APPROACHING") return "#FF4444"
  if (a === "RETREATING") return "#44FF88"
  return "#666666"
}

function trendText(t: TrendState): string {
  if (t === "RISING") return "↑ RISING"
  if (t === "FALLING") return "↓ FALLING"
  return "→ STABLE"
}

function trendColor(t: TrendState): string {
  if (t === "RISING") return "#44FF88"
  if (t === "FALLING") return "#FF6666"
  return "#666666"
}

function confColor(c: number): string {
  if (c >= 0.75) return "#44FF88" // green
  if (c >= 0.55) return "#FFAA00" // amber
  return "#FF6666" // red
}

function formatDwell(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

// ─── Main Draw Function ───────────────────────────────────────────────────────

export function drawDetections(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  objects: TrackedObject[],
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  const dw = canvas.clientWidth || window.innerWidth
  const dh = canvas.clientHeight || window.innerHeight

  if (canvas.width !== dw || canvas.height !== dh) {
    canvas.width = dw
    canvas.height = dh
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, dw, dh)

  // Scale video coords → screen coords matching objectFit: cover
  const va = vw / vh
  const sa = dw / dh
  let sx0 = 0,
    sy0 = 0,
    scX: number,
    scY: number

  if (va > sa) {
    scY = dh / vh
    scX = scY
    sx0 = (dw - vw * scX) / 2
  } else {
    scX = dw / vw
    scY = scX
    sy0 = (dh - vh * scY) / 2
  }

  for (const obj of objects) {
    drawObject(ctx, obj, scX, scY, sx0, sy0, dw, dh)
  }
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: TrackedObject,
  scX: number,
  scY: number,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
) {
  const [x, y, w, h] = obj.bbox
  const sx = x * scX + ox
  const sy = y * scY + oy
  const sw = w * scX
  const sh = h * scY

  const boxCol = threatColor(obj.threat)
  const conf = obj.confidence

  // ── Bounding box ────────────────────────────────────────────────────
  ctx.shadowColor = boxCol
  ctx.shadowBlur = obj.threat !== "NONE" ? 20 : 10
  ctx.strokeStyle = boxCol
  ctx.lineWidth = obj.threat === "HIGH" ? 2.5 : 1.5
  ctx.strokeRect(sx, sy, sw, sh)
  ctx.shadowBlur = 0

  // ── Corner brackets ─────────────────────────────────────────────────
  brackets(ctx, sx, sy, sw, sh, boxCol)

  // ── Approach vector ──────────────────────────────────────────────────
  if (obj.approach !== "STATIC") {
    const cx = sx + sw / 2
    const cy = sy + sh / 2
    const len = obj.approach === "APPROACHING" ? 18 : -18
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy + len)
    ctx.strokeStyle = approachColor(obj.approach)
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ── Threat banner (HIGH/MEDIUM only) ────────────────────────────────
  if (obj.threat === "HIGH" || obj.threat === "MEDIUM") {
    ctx.font = 'bold 9px "Share Tech Mono", monospace'
    ctx.fillStyle = boxCol
    ctx.shadowColor = boxCol
    ctx.shadowBlur = 8
    ctx.fillText(`⚠ ${obj.threatReason}`, sx + 4, sy - 5)
    ctx.shadowBlur = 0
  }

  // ── Object ID badge ──────────────────────────────────────────────────
  ctx.font = 'bold 9px "Share Tech Mono", monospace'
  ctx.fillStyle = boxCol
  ctx.fillText(`#${String(obj.uid).padStart(2, "0")}`, sx + 4, sy + 11)

  // ── Class count badge (top-right if multiple) ────────────────────────
  if (obj.classCount > 1) {
    const badge = `×${obj.classCount}`
    ctx.font = 'bold 9px "Share Tech Mono", monospace'
    const bw = ctx.measureText(badge).width
    ctx.fillStyle = boxCol
    ctx.fillText(badge, sx + sw - bw - 4, sy + 11)
  }

  // ── Stats panel ──────────────────────────────────────────────────────
  drawPanel(ctx, obj, sx, sy, sw, sh, boxCol, conf, dw, dh)
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

const PANEL_W = 162
const LINE_H = 13
const PAD = 5
const N_LINES = 6 // content lines
const PANEL_H = N_LINES * LINE_H + PAD * 2 + 10 // +10 for conf bar

function drawPanel(
  ctx: CanvasRenderingContext2D,
  obj: TrackedObject,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  boxCol: string,
  conf: number,
  dw: number,
  dh: number,
) {
  // Position — prefer above, fall to below, clamp to screen
  let px = Math.min(Math.max(sx, 2), dw - PANEL_W - 2)
  let py = sy > PANEL_H + 8 ? sy - PANEL_H - 6 : sy + sh + 6

  // Clamp vertically
  if (py + PANEL_H > dh) py = dh - PANEL_H - 2
  if (py < 0) py = 2

  // Background
  ctx.fillStyle = "rgba(4, 5, 14, 0.90)"
  ctx.fillRect(px, py, PANEL_W, PANEL_H)

  // Border
  ctx.strokeStyle = boxCol
  ctx.lineWidth = 0.8
  ctx.shadowColor = boxCol
  ctx.shadowBlur = 3
  ctx.strokeRect(px, py, PANEL_W, PANEL_H)
  ctx.shadowBlur = 0

  // Top accent bar — colour by threat
  ctx.fillStyle = boxCol
  ctx.fillRect(px, py, PANEL_W, 2)

  let ly = py + PAD + LINE_H

  // ── Row 0: Category icon + class + ID ───────────────────────────────
  ctx.font = 'bold 11px "Share Tech Mono", monospace'
  ctx.fillStyle = boxCol
  ctx.shadowColor = boxCol
  ctx.shadowBlur = 5
  ctx.fillText(
    `${categoryIcon(obj.category)} ${obj.class.toUpperCase()}  #${String(obj.uid).padStart(2, "0")}`,
    px + PAD,
    ly,
  )
  ctx.shadowBlur = 0

  // Divider
  ly += 3
  ctx.fillStyle = "rgba(0,212,255,0.1)"
  ctx.fillRect(px + PAD, ly, PANEL_W - PAD * 2, 1)
  ly += LINE_H - 2

  // ── Row 1: Distance + approach ───────────────────────────────────────
  col(ctx, "rgba(0,212,255,0.55)", "DST", px + PAD, ly)
  col(ctx, "#FFFFFF", `~${obj.metres}m`, px + PAD + 28, ly)
  if (obj.closingSpeed > 0.3 && obj.approach !== "STATIC") {
    col(
      ctx,
      approachColor(obj.approach),
      `${approachText(obj.approach)} ${obj.closingSpeed}m/s`,
      px + PAD + 68,
      ly,
    )
  } else {
    col(
      ctx,
      approachColor(obj.approach),
      approachText(obj.approach),
      px + PAD + 68,
      ly,
    )
  }
  ly += LINE_H

  // ── Row 2: Position + compass ────────────────────────────────────────
  col(ctx, "rgba(0,212,255,0.55)", "POS", px + PAD, ly)
  col(ctx, "#FFFFFF", obj.screenZone, px + PAD + 28, ly)
  col(ctx, "rgba(0,212,255,0.8)", `→ ${obj.compass}`, px + PANEL_W - 36, ly)
  ly += LINE_H

  // ── Row 3: Size + confidence % ───────────────────────────────────────
  col(ctx, "rgba(0,212,255,0.55)", "SIZ", px + PAD, ly)
  col(ctx, "#FFFFFF", obj.size, px + PAD + 28, ly)
  col(ctx, "rgba(0,212,255,0.55)", "CNF", px + PAD + 82, ly)
  col(ctx, confColor(conf), `${Math.round(conf * 100)}%`, px + PAD + 110, ly)
  ly += LINE_H

  // ── Row 4: Dwell + trend ─────────────────────────────────────────────
  col(ctx, "rgba(0,212,255,0.55)", "DWL", px + PAD, ly)
  col(ctx, "#FFFFFF", formatDwell(obj.dwellSeconds), px + PAD + 28, ly)
  col(ctx, trendColor(obj.trend), trendText(obj.trend), px + PAD + 82, ly)
  ly += LINE_H + 4

  // ── Confidence bar ───────────────────────────────────────────────────
  const barW = PANEL_W - PAD * 2
  const barH = 5
  const fill = barW * conf
  const bCol = confColor(conf)

  ctx.fillStyle = "rgba(255,255,255,0.07)"
  ctx.fillRect(px + PAD, ly, barW, barH)

  ctx.fillStyle = bCol
  ctx.shadowColor = bCol
  ctx.shadowBlur = 4
  ctx.fillRect(px + PAD, ly, fill, barH)
  ctx.shadowBlur = 0

  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 0.5
  ctx.strokeRect(px + PAD, ly, barW, barH)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function col(
  ctx: CanvasRenderingContext2D,
  color: string,
  text: string,
  x: number,
  y: number,
) {
  ctx.font = '10px "Share Tech Mono", monospace'
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function brackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const s = Math.min(w, h) * 0.22
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.shadowColor = color
  ctx.shadowBlur = 10

  ctx.beginPath()
  ctx.moveTo(x, y + s)
  ctx.lineTo(x, y)
  ctx.lineTo(x + s, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w - s, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + s)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + h - s)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + s, y + h)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w - s, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y + h - s)
  ctx.stroke()
}
