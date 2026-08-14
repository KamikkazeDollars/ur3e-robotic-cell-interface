// SIM-01 parse + classification pipeline. This is the module Phase 3 reads,
// so its contract is load-bearing: every classified segment carries its move
// type, its ordered scene-space points, and the modal feed rate in force at
// that line (or `null` if the file has issued no F word yet — never a
// substituted default, per this plan's transparency prohibition).
//
// Built on `gcode-toolpath` (modal-state G-code interpretation — battle
// tested against the cncjs ecosystem, not reimplemented here) plus an
// independent feed-rate pre-scan (Pattern 2), since gcode-toolpath's own
// addLine/addArcCurve callbacks never carry the F word (02-RESEARCH.md
// Pitfall A — `modal.feedrate` is a MODE flag, not a numeric rate, and is
// never read by this module).
import { parseStringSync } from 'gcode-parser'
import type { GCodeWord } from 'gcode-parser'
import Toolpath from 'gcode-toolpath'
import type { GCodeModal, GCodeVector, ToolpathInterpreter } from 'gcode-toolpath'
import { TOOLPATH_ANCHOR_OFFSET } from './toolpath-anchor'
import { tessellateArc } from './arcTessellation'

export type MoveClass = 'rapid' | 'cut'

export interface ClassifiedSegment {
  type: MoveClass
  motion: 'G0' | 'G1' | 'G2' | 'G3'
  source: 'line' | 'arc'
  /** Ordered scene-space points (metres, world space, post D-06 anchor
   * translation). A line segment has exactly two points; an arc segment
   * (tessellated starting plan 02-02) has more. */
  points: [number, number, number][]
  /** The modal F word in force in the file's own units (mm/min) at this
   * line, or `null` until the file's first F word. A rapid's real traverse
   * rate is a machine property the file never states — this field must
   * never be used to time a rapid. */
  feedRate: number | null
}

export interface ParsedToolpath {
  segments: ClassifiedSegment[]
  unit: 'mm'
  /** Commands the parser refused rather than rendered: a command carrying a
   * non-finite (NaN/Infinity) coordinate (T-02-02 — a single such value
   * would silently poison the bounding box and therefore the camera fit),
   * or a command received after `MAX_TOOLPATH_SEGMENTS` accepted segments
   * (the defensive ceiling). Never zero-length motion, which is dropped
   * silently as a normal no-op, not a refusal. Plan 02-03 should surface a
   * non-zero value here to the user instead of silently rendering a
   * partial path. */
  skippedMotionCount: number
  /** The exact D-06 anchor translation applied to every retained point
   * (scene metres), so the transform is inspectable rather than implicit. */
  appliedAnchorTranslation: [number, number, number]
  /** Post-translation world-space bounds over all retained points, or
   * `null` when the file produced no renderable segment at all. */
  bounds: { min: [number, number, number]; max: [number, number, number] } | null
}

const MM_TO_M = 1 / 1000

/** Defensive ceiling on the number of segments this parser will accept
 * (T-02-02, Security Domain V5): a four-figure bound is far above anything
 * either hand-authored bundled sample produces (D-08), while still bounding
 * a future upload feature's worst case so a runaway/malformed file is
 * truncated — reporting the drop count via `skippedMotionCount` — rather
 * than freezing the tab. */
export const MAX_TOOLPATH_SEGMENTS = 5000

/** Maps a g-code point (mm, g-code axes) to a scene point (metres, scene
 * axes), matching `RobotModel.tsx`'s `rotation.x = -Math.PI / 2` frame
 * convention: scene x is g-code x, scene y is g-code z, scene z is the
 * negated g-code y. This is the single, one-place unit conversion and axis
 * remap this module performs — no rounding, truncation or clamping. Reused
 * verbatim for both line endpoints and every tessellated arc point, so
 * there is exactly one conversion site regardless of segment source. */
function toScenePoint(v: readonly [number, number, number]): [number, number, number] {
  return [v[0] * MM_TO_M, v[2] * MM_TO_M, -v[1] * MM_TO_M]
}

/** True only if every component is a finite number — rejects NaN, +/-Infinity,
 * and (defensively) any non-numeric value a malformed line could produce.
 * Must run upstream of the bounds pass (T-02-02): one non-finite coordinate
 * would otherwise silently poison the bounding box and therefore the
 * camera fit. */
function isFiniteVector(v: GCodeVector): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}

/** Independent feed-rate pre-scan (02-RESEARCH.md Pattern 2): carries the
 * last-seen F word forward (feed rate is modal in real g-code) and pushes
 * one queue entry per line that fires an `addLine`/`addArcCurve` callback —
 * every line with a G0/G1/G2/G3 motion word, and every "bare coordinate"
 * line (a line with only X/Y/Z/I/J/K and no G word) that reuses the
 * previous motion mode and still fires a callback. This queue is consumed
 * strictly by call order in `parseToolpath`, since both passes walk the
 * same file top-to-bottom. */
function extractFeedRateQueue(gcodeText: string): (number | null)[] {
  const lines = parseStringSync(gcodeText)
  const queue: (number | null)[] = []
  let currentFeedRate: number | null = null

  for (const { words } of lines) {
    const fWord = words.find(([letter]: GCodeWord) => letter === 'F')
    if (fWord && typeof fWord[1] === 'number') {
      currentFeedRate = fWord[1]
    }

    const hasMotionWord = words.some(
      ([letter, value]: GCodeWord) => letter === 'G' && [0, 1, 2, 3].includes(Number(value)),
    )
    const hasBareCoordinateWord = words.some(([letter]: GCodeWord) =>
      ['X', 'Y', 'Z', 'I', 'J', 'K'].includes(letter),
    )
    if (hasMotionWord || hasBareCoordinateWord) {
      queue.push(currentFeedRate)
    }
  }

  return queue
}

interface RawSegment {
  type: MoveClass
  motion: 'G0' | 'G1' | 'G2' | 'G3'
  source: 'line' | 'arc'
  /** Raw mm, g-code-axis points (pre `toScenePoint`) — two for a line, the
   * whole tessellated polyline for an arc. */
  points: [number, number, number][]
  feedRate: number | null
}

/**
 * Parses raw g-code text into a classified, anchored toolpath. Runs the
 * feed-rate pre-scan first, then drives `gcode-toolpath`'s modal-state
 * interpreter (`new Toolpath({ addLine, addArcCurve }).loadFromStringSync`),
 * zipping the pre-scanned feed rate onto each callback by call order.
 */
export function parseToolpath(gcodeText: string): ParsedToolpath {
  const feedRateQueue = extractFeedRateQueue(gcodeText)
  let feedRateIndex = 0
  let skippedMotionCount = 0
  const rawSegments: RawSegment[] = []

  const addLine = (modal: GCodeModal, v1: GCodeVector, v2: GCodeVector) => {
    const feedRate = feedRateQueue[feedRateIndex] ?? null
    feedRateIndex += 1

    // Drop degenerate zero-length segments (a motion command that leaves
    // the tool position unchanged) rather than emitting a degenerate point.
    if (v1.x === v2.x && v1.y === v2.y && v1.z === v2.z) return

    // Reject non-finite coordinates upstream of the bounds pass (T-02-02) —
    // count the refusal, never throw, never let a NaN/Infinity reach a
    // Vector3 or the bounding-box computation.
    if (!isFiniteVector(v1) || !isFiniteVector(v2)) {
      skippedMotionCount += 1
      return
    }

    // Defensive segment ceiling (T-02-02): stop accepting new segments once
    // reached, counting every further command dropped instead of hanging.
    if (rawSegments.length >= MAX_TOOLPATH_SEGMENTS) {
      skippedMotionCount += 1
      return
    }

    // `modal` is a mutable object reference reused across every callback —
    // read `motion` synchronously, right now, never store the object itself.
    const motion = modal.motion === 'G0' ? 'G0' : 'G1'
    rawSegments.push({
      type: motion === 'G0' ? 'rapid' : 'cut',
      motion,
      source: 'line',
      points: [
        [v1.x, v1.y, v1.z],
        [v2.x, v2.y, v2.z],
      ],
      feedRate,
    })
  }

  const addArcCurve = (modal: GCodeModal, v1: GCodeVector, v2: GCodeVector, v0: GCodeVector) => {
    const feedRate = feedRateQueue[feedRateIndex] ?? null
    feedRateIndex += 1

    // Reject non-finite coordinates upstream of the bounds pass (T-02-02),
    // same discipline as addLine — v0 is the arc CENTER (verified via
    // source read, 02-RESEARCH.md Pattern 1; the library's own inline
    // comment calling it a "fixed point" is misleading).
    if (!isFiniteVector(v1) || !isFiniteVector(v2) || !isFiniteVector(v0)) {
      skippedMotionCount += 1
      return
    }

    if (rawSegments.length >= MAX_TOOLPATH_SEGMENTS) {
      skippedMotionCount += 1
      return
    }

    // Direction is read from modal.motion ('G2' clockwise / 'G3'
    // counter-clockwise), never inferred from a boolean — the interpreter
    // does not pass one (02-RESEARCH.md Pattern 1).
    const motion = modal.motion === 'G2' ? 'G2' : 'G3'
    const center: [number, number, number] = [v0.x, v0.y, v0.z]
    const start: [number, number, number] = [v1.x, v1.y, v1.z]
    const end: [number, number, number] = [v2.x, v2.y, v2.z]

    // One arc command yields one segment whose points array holds the
    // whole tessellated polyline — not one segment per tessellated chord —
    // so the segment count stays a count of g-code commands.
    const points = tessellateArc(center, start, end, motion)

    rawSegments.push({
      type: 'cut',
      motion,
      source: 'arc',
      points,
      feedRate,
    })
  }

  const toolpath = new Toolpath({ addLine, addArcCurve }) as ToolpathInterpreter
  toolpath.loadFromStringSync(gcodeText)

  const segments: ClassifiedSegment[] = rawSegments.map((raw) => ({
    type: raw.type,
    motion: raw.motion,
    source: raw.source,
    feedRate: raw.feedRate,
    points: raw.points.map(toScenePoint),
  }))

  const allPoints = segments.flatMap((segment) => segment.points)

  let appliedAnchorTranslation: [number, number, number] = [0, 0, 0]
  let bounds: ParsedToolpath['bounds'] = null

  if (allPoints.length > 0) {
    const min: [number, number, number] = [...allPoints[0]]
    const max: [number, number, number] = [...allPoints[0]]
    for (const [x, y, z] of allPoints) {
      if (x < min[0]) min[0] = x
      if (y < min[1]) min[1] = y
      if (z < min[2]) min[2] = z
      if (x > max[0]) max[0] = x
      if (y > max[1]) max[1] = y
      if (z > max[2]) max[2] = z
    }

    // D-06: the toolpath's own X/Z bounding-box centre lands on the anchor's
    // X/Z, and the toolpath's minimum Y (its deepest point) lands on the
    // anchor's Y, so a milling sample's negative cut depths rest at the
    // floor plane rather than sinking below it.
    const centerX = (min[0] + max[0]) / 2
    const centerZ = (min[2] + max[2]) / 2
    appliedAnchorTranslation = [
      TOOLPATH_ANCHOR_OFFSET.x - centerX,
      TOOLPATH_ANCHOR_OFFSET.y - min[1],
      TOOLPATH_ANCHOR_OFFSET.z - centerZ,
    ]

    const [tx, ty, tz] = appliedAnchorTranslation
    for (const segment of segments) {
      segment.points = segment.points.map(([x, y, z]) => [x + tx, y + ty, z + tz])
    }

    bounds = {
      min: [min[0] + tx, min[1] + ty, min[2] + tz],
      max: [max[0] + tx, max[1] + ty, max[2] + tz],
    }
  }

  return {
    segments,
    unit: 'mm',
    skippedMotionCount,
    appliedAnchorTranslation,
    bounds,
  }
}

/**
 * The pure, testable half of SIM-02: flattens each segment's `points`
 * polyline into consecutive disjoint pairs (a polyline of n points
 * contributes 2*(n-1) entries) and routes it into the rapid or cutting
 * bucket, ready for drei `<Line segments>` (Pattern 3).
 */
export function toRenderBuckets(segments: readonly ClassifiedSegment[]): {
  rapidPoints: [number, number, number][]
  cuttingPoints: [number, number, number][]
} {
  const rapidPoints: [number, number, number][] = []
  const cuttingPoints: [number, number, number][] = []

  for (const segment of segments) {
    const bucket = segment.type === 'rapid' ? rapidPoints : cuttingPoints
    for (let i = 0; i < segment.points.length - 1; i++) {
      bucket.push(segment.points[i], segment.points[i + 1])
    }
  }

  return { rapidPoints, cuttingPoints }
}
