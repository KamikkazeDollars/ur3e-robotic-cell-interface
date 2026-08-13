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
  /** Motion commands that produced no segment yet — this plan leaves arc
   * (G2/G3) tessellation for plan 02-02, so every G2/G3 line increments this
   * counter instead of emitting a segment. */
  skippedMotionCount: number
  /** The exact D-06 anchor translation applied to every retained point
   * (scene metres), so the transform is inspectable rather than implicit. */
  appliedAnchorTranslation: [number, number, number]
  /** Post-translation world-space bounds over all retained points, or
   * `null` when the file produced no renderable segment at all. */
  bounds: { min: [number, number, number]; max: [number, number, number] } | null
}

const MM_TO_M = 1 / 1000

/** Maps a g-code point (mm, g-code axes) to a scene point (metres, scene
 * axes), matching `RobotModel.tsx`'s `rotation.x = -Math.PI / 2` frame
 * convention: scene x is g-code x, scene y is g-code z, scene z is the
 * negated g-code y. This is the single, one-place unit conversion and axis
 * remap this module performs — no rounding, truncation or clamping. */
function toScenePoint(v: GCodeVector): [number, number, number] {
  return [v.x * MM_TO_M, v.z * MM_TO_M, -v.y * MM_TO_M]
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
  motion: 'G0' | 'G1'
  points: [GCodeVector, GCodeVector]
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

    // `modal` is a mutable object reference reused across every callback —
    // read `motion` synchronously, right now, never store the object itself.
    const motion = modal.motion === 'G0' ? 'G0' : 'G1'
    rawSegments.push({
      type: motion === 'G0' ? 'rapid' : 'cut',
      motion,
      points: [v1, v2],
      feedRate,
    })
  }

  const addArcCurve = () => {
    // Arc tessellation lands in plan 02-02; this plan only accounts for the
    // skipped motion so the queue stays aligned with subsequent addLine
    // calls and nothing is silently dropped without a trace.
    feedRateIndex += 1
    skippedMotionCount += 1
  }

  const toolpath = new Toolpath({ addLine, addArcCurve }) as ToolpathInterpreter
  toolpath.loadFromStringSync(gcodeText)

  const segments: ClassifiedSegment[] = rawSegments.map((raw) => ({
    type: raw.type,
    motion: raw.motion,
    source: 'line',
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
