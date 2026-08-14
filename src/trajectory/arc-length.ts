// D-05 arc-length parameterisation over a flattened toolpath. Framework-free
// (no rendering engine, no store, no UI import) — operates only on
// `readonly [number, number, number][]` scene-space points, so it is
// directly unit-testable and independent of everything downstream of it.
//
// This is the module that makes "equal scrub-fraction deltas move an equal
// distance" true regardless of how densely a segment is g-code-pointed: the
// parameterisation below is cumulative ARC LENGTH, never segment index or
// point index.
import type { ClassifiedSegment } from '../gcode/parseToolpath'

/**
 * Concatenates every segment's `points` in original segment order, dropping
 * any point exactly equal to its immediate predecessor (consecutive
 * segments share a joint point, per `parseToolpath.ts`'s own composition).
 *
 * MUST consume `segments` in file order and MUST NEVER be fed
 * `toRenderBuckets`'s output: `toRenderBuckets` reorders points into two
 * class-separated buckets (rapid vs. cutting) for rendering, which would
 * corrupt the path ordering this module's cumulative-distance table depends
 * on — a "flattened" path built from reordered buckets would not trace the
 * g-code's actual tool motion.
 */
export function flattenToolpathPoints(
  segments: readonly ClassifiedSegment[],
): [number, number, number][] {
  const points: [number, number, number][] = []
  for (const segment of segments) {
    for (const point of segment.points) {
      const previous = points[points.length - 1]
      if (previous && previous[0] === point[0] && previous[1] === point[1] && previous[2] === point[2]) {
        continue
      }
      points.push(point)
    }
  }
  return points
}

/** Cumulative-distance table over a point sequence: `cumulative[i]` is the
 * arc length from `points[0]` to `points[i]`, and `totalLength` is the
 * whole path's length. `cumulative.length === points.length`, and
 * `cumulative[0]` is always 0. */
export interface ArcLengthTable {
  cumulative: number[]
  totalLength: number
}

/** Builds the cumulative arc-length table for a point sequence, in the same
 * order the points were given (never re-sorted or re-grouped). */
export function buildArcLengthTable(points: readonly [number, number, number][]): ArcLengthTable {
  const cumulative: number[] = points.length > 0 ? [0] : []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const [x0, y0, z0] = points[i - 1]
    const [x1, y1, z1] = points[i]
    const dx = x1 - x0
    const dy = y1 - y0
    const dz = z1 - z0
    total += Math.sqrt(dx * dx + dy * dy + dz * dz)
    cumulative.push(total)
  }
  return { cumulative, totalLength: total }
}

/**
 * Maps a scrub fraction in [0, 1] onto a scene-space point along the path,
 * by cumulative arc length (never by segment or point index — see this
 * file's header). `fraction` is clamped into the unit interval first.
 * Returns `points[0]` for fraction 0 and the final point for fraction 1
 * EXACTLY (not an interpolated near-point), and blends linearly between the
 * bracketing pair of points otherwise.
 */
export function pointAtFraction(
  points: readonly [number, number, number][],
  table: ArcLengthTable,
  fraction: number,
): [number, number, number] {
  if (points.length === 0) return [0, 0, 0]
  if (points.length === 1) return points[0]

  const clamped = Math.max(0, Math.min(1, fraction))
  if (clamped === 0) return points[0]
  if (clamped === 1) return points[points.length - 1]

  const targetLength = clamped * table.totalLength

  let hi = 1
  while (hi < table.cumulative.length - 1 && table.cumulative[hi] < targetLength) {
    hi++
  }
  const lo = hi - 1

  const segmentLength = table.cumulative[hi] - table.cumulative[lo]
  // Degenerate case: a zero-length bracketing pair (two coincident points)
  // — fall back to the earlier point rather than dividing by zero.
  const ratio = segmentLength < 1e-12 ? 0 : (targetLength - table.cumulative[lo]) / segmentLength

  const [x0, y0, z0] = points[lo]
  const [x1, y1, z1] = points[hi]
  return [x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio, z0 + (z1 - z0) * ratio]
}
