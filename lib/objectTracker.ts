// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawDetection {
  class: string
  score: number
  bbox: [number, number, number, number] // [x, y, w, h] in video coords
}

export type ApproachState  = 'APPROACHING' | 'RETREATING' | 'STATIC'
export type ScreenZone     = 'UPPER-LEFT' | 'UPPER-CENTER' | 'UPPER-RIGHT'
                           | 'MID-LEFT'   | 'CENTER'       | 'MID-RIGHT'
                           | 'LOWER-LEFT' | 'LOWER-CENTER' | 'LOWER-RIGHT'
export type CompassBearing = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'CENTER'
export type SizeClass      = 'SMALL' | 'MEDIUM' | 'LARGE'
export type TrendState     = 'RISING' | 'STABLE' | 'FALLING'
export type ObjectCategory = 'PERSON' | 'VEHICLE' | 'ANIMAL' | 'FURNITURE'
                           | 'TECH' | 'FOOD' | 'TOOL' | 'OTHER'
export type ThreatLevel    = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'

export interface TrackedObject {
  // Identity
  id:           string
  uid:          number
  class:        string
  category:     ObjectCategory
  bbox:         [number, number, number, number]

  // Confidence
  confidence:       number
  confidenceHistory: number[]
  trend:            TrendState

  // Distance
  metres:       number
  prevMetres:   number
  approach:     ApproachState
  closingSpeed: number        // metres per second estimate

  // Position
  screenZone:   ScreenZone
  compass:      CompassBearing

  // Size
  size:         SizeClass

  // Risk
  threat:       ThreatLevel
  threatReason: string

  // Time
  firstSeen:    number        // Date.now()
  dwellSeconds: number

  // Class grouping
  classCount:   number        // how many of same class in this frame
}

// ─── Category Map ─────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, ObjectCategory> = {
  person:        'PERSON',
  bicycle:       'VEHICLE', motorcycle: 'VEHICLE', car:     'VEHICLE',
  truck:         'VEHICLE', bus:        'VEHICLE', boat:    'VEHICLE',
  airplane:      'VEHICLE', train:      'VEHICLE',
  dog:           'ANIMAL',  cat:        'ANIMAL',  horse:   'ANIMAL',
  cow:           'ANIMAL',  sheep:      'ANIMAL',  bird:    'ANIMAL',
  elephant:      'ANIMAL',  bear:       'ANIMAL',  zebra:   'ANIMAL',
  giraffe:       'ANIMAL',
  chair:         'FURNITURE', couch:    'FURNITURE', bed:   'FURNITURE',
  diningtable:   'FURNITURE',
  laptop:        'TECH',    keyboard:   'TECH',    mouse:   'TECH',
  remote:        'TECH',    cell_phone: 'TECH',    tvmonitor:'TECH',
  bottle:        'FOOD',    cup:        'FOOD',    bowl:    'FOOD',
  banana:        'FOOD',    apple:      'FOOD',    pizza:   'FOOD',
  sandwich:      'FOOD',    cake:       'FOOD',    donut:   'FOOD',
  scissors:      'TOOL',    knife:      'TOOL',    fork:    'TOOL',
  spoon:         'TOOL',
}

// ─── Known Object Heights (metres) for Distance Estimation ───────────────────

const KNOWN_HEIGHTS: Record<string, number> = {
  person:       1.70,
  car:          1.50,  truck:      2.80,  bus:      3.20,
  motorcycle:   1.20,  bicycle:    1.00,  boat:     1.50,
  dog:          0.50,  cat:        0.30,  horse:    1.60,
  cow:          1.40,  sheep:      0.70,  bird:     0.20,
  elephant:     3.00,  bear:       1.20,
  chair:        0.90,  couch:      0.85,  bed:      0.60,
  diningtable:  0.75,
  laptop:       0.30,  tvmonitor:  0.60,  bottle:   0.25,
  cup:          0.12,  bowl:       0.10,  book:     0.22,
  default:      0.80,
}

// ─── Misdetection Corrections ─────────────────────────────────────────────────

const CORRECTION_MAP: Record<string, string> = {
  refrigerator: 'cabinet',
}

const HIGH_CONF_ONLY: Record<string, number> = {
  refrigerator: 0.80,
  airplane:     0.82,
  train:        0.82,
}

// ─── Tracker State ────────────────────────────────────────────────────────────

const trackers = new Map<string, { obj: TrackedObject; missing: number }>()
let uid = 0

const IOU_MATCH      = 0.25
const MAX_MISSING    = 2
const HISTORY_LEN    = 16
const FOCAL_LENGTH   = 600  // px baseline at 720p
const BBOX_SMOOTHING = 0.35
const METRE_SMOOTHING = 0.4
const CONF_SMOOTHING = 0.45

// ─── Public API ───────────────────────────────────────────────────────────────

export function updateTracker(
  raw: RawDetection[],
  video: HTMLVideoElement,
): TrackedObject[] {
  const matched  = new Set<string>()
  const result: TrackedObject[] = []

  // Class counts for this frame
  const counts: Record<string, number> = {}
  for (const d of raw) counts[d.class] = (counts[d.class] ?? 0) + 1

  for (const rawDet of raw) {
    const det = correct(rawDet)
    if (!det) continue

    // Match to existing tracker
    let bestId:  string | null = null
    let bestIou: number = IOU_MATCH

    for (const [id, entry] of trackers) {
      if (entry.obj.class !== det.class) continue
      const iou = computeIoU(det.bbox, entry.obj.bbox)
      if (iou > bestIou) { bestIou = iou; bestId = id }
    }

    const now     = Date.now()
    const metres  = estimateMetres(det.bbox, det.class, video)
    const cat     = CATEGORY_MAP[det.class] ?? 'OTHER'

    if (bestId) {
      // Update existing tracker
      matched.add(bestId)
      const prev    = trackers.get(bestId)!.obj
      const smoothedBox = smoothBbox(prev.bbox, det.bbox)
      const smoothedConfidence = smoothValue(prev.confidence, det.score, CONF_SMOOTHING)
      const smoothedMetres = smoothValue(prev.metres, metres, METRE_SMOOTHING)
      const history = [...prev.confidenceHistory, smoothedConfidence].slice(-HISTORY_LEN)
      const closing = closingSpeed(prev.metres, smoothedMetres)
      const approach = computeApproach(prev.metres, smoothedMetres)
      const threat  = assessThreat(det.class, cat, smoothedMetres, approach, closing)

      const updated: TrackedObject = {
        ...prev,
        bbox:              smoothedBox,
        confidence:        smoothedConfidence,
        confidenceHistory: history,
        trend:             computeTrend(history),
        metres:            smoothedMetres,
        prevMetres:        prev.metres,
        approach,
        closingSpeed:      closing,
        screenZone:        computeZone(smoothedBox, video),
        compass:           computeCompass(smoothedBox, video),
        size:              computeSize(smoothedBox, video),
        threat:            threat.level,
        threatReason:      threat.reason,
        dwellSeconds:      Math.round((now - prev.firstSeen) / 1000),
        classCount:        counts[det.class] ?? 1,
      }
      trackers.get(bestId)!.obj     = updated
      trackers.get(bestId)!.missing = 0
      result.push(updated)

    } else {
      // New tracker
      const id      = `t${uid}`
      matched.add(id)
      const approach = 'STATIC' as ApproachState
      const threat  = assessThreat(det.class, cat, metres, approach, 0)

      const obj: TrackedObject = {
        id,
        uid:               uid++,
        class:             det.class,
        category:          cat,
        bbox:              det.bbox,
        confidence:        det.score,
        confidenceHistory: [det.score],
        trend:             'STABLE',
        metres,
        prevMetres:        metres,
        approach,
        closingSpeed:      0,
        screenZone:        computeZone(det.bbox, video),
        compass:           computeCompass(det.bbox, video),
        size:              computeSize(det.bbox, video),
        threat:            threat.level,
        threatReason:      threat.reason,
        firstSeen:         now,
        dwellSeconds:      0,
        classCount:        counts[det.class] ?? 1,
      }
      trackers.set(id, { obj, missing: 0 })
      result.push(obj)
    }
  }

  // Age out missing trackers
  for (const [id, entry] of trackers) {
    if (matched.has(id)) continue
    entry.missing++
    if (entry.missing > MAX_MISSING) {
      trackers.delete(id)
    }
  }

  return result
}

export function clearTracker() {
  trackers.clear()
  uid = 0
}

// ─── Corrections ──────────────────────────────────────────────────────────────

function correct(det: RawDetection): RawDetection | null {
  const min = HIGH_CONF_ONLY[det.class]
  if (min && det.score < min) return null
  const fix = CORRECTION_MAP[det.class]
  return fix ? { ...det, class: fix } : det
}

// ─── Distance ─────────────────────────────────────────────────────────────────

function estimateMetres(
  bbox: [number, number, number, number],
  cls: string,
  video: HTMLVideoElement,
): number {
  const ph = bbox[3]
  if (!ph) return 99
  const rh     = KNOWN_HEIGHTS[cls] ?? KNOWN_HEIGHTS.default
  const focal  = FOCAL_LENGTH * (video.videoHeight / 720)
  const raw    = (rh * focal) / ph
  return Math.round(Math.min(Math.max(raw, 0.2), 60) * 10) / 10
}

function closingSpeed(prev: number, curr: number): number {
  // Rough m/s estimate — assumes ~15fps detection cadence
  return Math.round(Math.abs(prev - curr) * 15 * 10) / 10
}

// ─── Approach ─────────────────────────────────────────────────────────────────

function computeApproach(prev: number, curr: number): ApproachState {
  const delta = prev - curr
  if (delta >  0.2) return 'APPROACHING'
  if (delta < -0.2) return 'RETREATING'
  return 'STATIC'
}

// ─── Threat Assessment ────────────────────────────────────────────────────────

function assessThreat(
  cls: string,
  cat: ObjectCategory,
  metres: number,
  approach: ApproachState,
  speed: number,
): { level: ThreatLevel; reason: string } {
  // Vehicles approaching fast at close range
  if (cat === 'VEHICLE') {
    if (metres < 3 && approach === 'APPROACHING') {
      return { level: 'HIGH',   reason: 'VEHICLE CLOSE' }
    }
    if (metres < 8 && approach === 'APPROACHING' && speed > 1) {
      return { level: 'MEDIUM', reason: 'VEHICLE APPROACHING' }
    }
    if (metres < 15) {
      return { level: 'LOW',    reason: 'VEHICLE NEARBY' }
    }
  }

  // Person very close
  if (cls === 'person') {
    if (metres < 0.8) {
      return { level: 'MEDIUM', reason: 'PERSON VERY CLOSE' }
    }
    if (metres < 1.5 && approach === 'APPROACHING') {
      return { level: 'LOW',    reason: 'PERSON APPROACHING' }
    }
  }

  // Large animal close
  if (cat === 'ANIMAL' && metres < 3) {
    const large = ['elephant', 'bear', 'horse', 'cow'].includes(cls)
    if (large) return { level: 'MEDIUM', reason: 'LARGE ANIMAL CLOSE' }
    return { level: 'LOW', reason: 'ANIMAL NEARBY' }
  }

  // Knife/scissors close range
  if (cat === 'TOOL' && (cls === 'knife' || cls === 'scissors') && metres < 1.5) {
    return { level: 'MEDIUM', reason: 'SHARP OBJECT CLOSE' }
  }

  return { level: 'NONE', reason: '' }
}

// ─── Screen Zone ──────────────────────────────────────────────────────────────

function computeZone(
  bbox: [number, number, number, number],
  video: HTMLVideoElement,
): ScreenZone {
  const cx = (bbox[0] + bbox[2] / 2) / video.videoWidth
  const cy = (bbox[1] + bbox[3] / 2) / video.videoHeight
  const col = cx < 0.33 ? 'LEFT' : cx < 0.66 ? 'CENTER' : 'RIGHT'
  const row = cy < 0.33 ? 'UPPER' : cy < 0.66 ? 'MID'   : 'LOWER'
  if (row === 'MID' && col === 'CENTER') return 'CENTER'
  if (row === 'MID') return `MID-${col}` as ScreenZone
  return `${row}-${col}` as ScreenZone
}

function computeCompass(
  bbox: [number, number, number, number],
  video: HTMLVideoElement,
): CompassBearing {
  const cx  = (bbox[0] + bbox[2] / 2) / video.videoWidth
  const cy  = (bbox[1] + bbox[3] / 2) / video.videoHeight
  const dx  = cx - 0.5
  const dy  = cy - 0.5
  if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) return 'CENTER'
  const deg = ((Math.atan2(-dy, dx) * 180 / Math.PI) + 360) % 360
  if (deg >= 337.5 || deg < 22.5)  return 'E'
  if (deg < 67.5)   return 'NE'
  if (deg < 112.5)  return 'N'
  if (deg < 157.5)  return 'NW'
  if (deg < 202.5)  return 'W'
  if (deg < 247.5)  return 'SW'
  if (deg < 292.5)  return 'S'
  return 'SE'
}

// ─── Size ─────────────────────────────────────────────────────────────────────

function computeSize(
  bbox: [number, number, number, number],
  video: HTMLVideoElement,
): SizeClass {
  const area = (bbox[2] * bbox[3]) / (video.videoWidth * video.videoHeight)
  if (area > 0.15) return 'LARGE'
  if (area > 0.03) return 'MEDIUM'
  return 'SMALL'
}

// ─── Confidence Trend ─────────────────────────────────────────────────────────

function computeTrend(history: number[]): TrendState {
  if (history.length < 5) return 'STABLE'
  const recent = history.slice(-4)
  const older  = history.slice(-8, -4)
  if (!older.length) return 'STABLE'
  const r = recent.reduce((a, b) => a + b, 0) / recent.length
  const o = older.reduce((a, b) => a + b, 0)  / older.length
  if (r - o >  0.04) return 'RISING'
  if (r - o < -0.04) return 'FALLING'
  return 'STABLE'
}

// ─── IoU ──────────────────────────────────────────────────────────────────────

function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const ax2 = a[0] + a[2], ay2 = a[1] + a[3]
  const bx2 = b[0] + b[2], by2 = b[1] + b[3]
  const ix1 = Math.max(a[0], b[0]), iy1 = Math.max(a[1], b[1])
  const ix2 = Math.min(ax2, bx2),   iy2 = Math.min(ay2, by2)
  if (ix2 < ix1 || iy2 < iy1) return 0
  const inter = (ix2 - ix1) * (iy2 - iy1)
  return inter / (a[2] * a[3] + b[2] * b[3] - inter)
}

function smoothValue(previous: number, next: number, factor: number): number {
  return previous + (next - previous) * factor
}

function smoothBbox(
  previous: [number, number, number, number],
  next: [number, number, number, number],
): [number, number, number, number] {
  return [
    smoothValue(previous[0], next[0], BBOX_SMOOTHING),
    smoothValue(previous[1], next[1], BBOX_SMOOTHING),
    smoothValue(previous[2], next[2], BBOX_SMOOTHING),
    smoothValue(previous[3], next[3], BBOX_SMOOTHING),
  ]
}
