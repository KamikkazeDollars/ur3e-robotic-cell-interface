// Gap closure G-04-1 (04-UAT.md, test 1). ROADMAP Phase 4 success criterion 2
// calls for a trajectory highlight AND a TCP marker tracking playback — only
// the marker was ever built (Phase 3's `ScrubMarker.tsx`); `Toolpath.tsx`
// renders a static, playback-agnostic line and never reads the playback
// fraction. This module is the pure, framework-free half of the fix: no
// React, no three.js, no store import — matching the discipline
// `src/scene/marker-scale.ts` already establishes for render-adjacent logic
// in this repo. The split keeps the math unit-testable under the repo's
// `environment: 'node'` Vitest setup, where no 3D render can be exercised.
import type { CompiledTrajectory } from '../trajectory/compile'

/** Tolerance subtracted from the travel/toolpath boundary fraction before
 * filtering samples — guards against a sample whose scrubFraction is the
 * boundary itself but lands a few ULPs below it due to floating-point
 * division, which would otherwise wrongly exclude the toolpath's own first
 * point. */
const BOUNDARY_TOLERANCE = 1e-9

/** Small nudge added before flooring in `traversedSegmentCount`, correcting
 * floating-point roundoff when `fraction` lands exactly on an interior
 * sample's own scrubFraction (both computed via division, so they should
 * agree to within a few ULPs). Far smaller than the gap between adjacent
 * segments for any trail with a sane sample count, so it never affects a
 * genuine midpoint-between-samples case. */
const FLOOR_EPSILON = 1e-9

/** The traversed-path highlight's geometry: the toolpath phase's own
 * ordered scene-space points (never the prepended travel phase's points —
 * see `buildTrailGeometry`'s doc comment), plus the fraction range those
 * points span. */
export interface TrailGeometry {
  points: [number, number, number][]
  /** The first toolpath-phase sample's own `scrubFraction`. */
  startFraction: number
  /** The last toolpath-phase sample's own `scrubFraction` — may be below 1
   * for a truncated (`frozen-at-unreachable`) trajectory. */
  endFraction: number
}

/**
 * Derives the traversed-path highlight's polyline from a compiled
 * trajectory. Returns `null` for a `null` trajectory, a trajectory with zero
 * samples, or a trajectory whose toolpath phase yields fewer than two
 * points — no degenerate one-point (or zero-point) line is ever
 * constructed.
 *
 * The compiler publishes `travelLength`/`toolpathLength` precisely so the
 * travel/toolpath boundary fraction can be COMPUTED
 * (`travelLength / (travelLength + toolpathLength)`) rather than
 * re-derived by matching point coordinates — see
 * `CompiledTrajectory.travelLength`'s own doc comment for the shared
 * contract this relies on. A non-positive total length (degenerate/empty
 * path) is guarded by treating the boundary as 0, so every sample is kept
 * rather than none.
 *
 * Deliberate exclusion: the prepended parked-pose travel move is NOT part
 * of the highlight. Its samples trace a path through open air where the
 * g-code file has no line at all, so highlighting them would draw a stroke
 * the user has no drawn reference for. The scrub marker (`ScrubMarker.tsx`)
 * remains the position indicator for that leg of the run.
 */
export function buildTrailGeometry(trajectory: CompiledTrajectory | null): TrailGeometry | null {
  if (!trajectory || trajectory.samples.length === 0) return null

  const { travelLength, toolpathLength, samples } = trajectory
  const totalLength = travelLength + toolpathLength
  const boundaryFraction = totalLength > 1e-9 ? travelLength / totalLength : 0

  const toolpathSamples = samples.filter((sample) => sample.scrubFraction >= boundaryFraction - BOUNDARY_TOLERANCE)

  if (toolpathSamples.length < 2) return null

  return {
    points: toolpathSamples.map((sample) => sample.point),
    startFraction: toolpathSamples[0].scrubFraction,
    endFraction: toolpathSamples[toolpathSamples.length - 1].scrubFraction,
  }
}

/**
 * Maps a scrub/playback fraction onto how many of `trail`'s `points.length -
 * 1` segments are fully traversed. A non-finite fraction is coerced to 0
 * first, mirroring `sampleAtFraction`'s own coercion shape (`sample-lookup
 * .ts`), then the fraction is mapped onto the trail's own
 * `[startFraction, endFraction]` span and the integer FLOOR of the progress
 * in segments is taken, clamped into `[0, points.length - 1]`.
 *
 * Floor, not round or ceil: a segment is highlighted only once the playback
 * position has passed its far endpoint, so the highlight's leading end is
 * always at or behind the scrub marker and can never claim traversal the arm
 * has not performed (T-04-14).
 *
 * The uniform fraction-to-segment mapping (linear over the trail's own
 * span) is valid because the compiler advances the toolpath phase in equal
 * arc-length steps (`compile.ts`'s two-phase walk, `localFraction = i /
 * (sampleCount - 1)`) — this premise is asserted directly against a real
 * compiled trajectory in `trail-progress.test.ts` rather than assumed here.
 *
 * A degenerate zero-width span (every toolpath sample sharing one fraction)
 * is treated as fully traversed once `fraction` reaches or passes
 * `startFraction`, mirroring the "already at or past the target" idiom
 * `pointAtFraction`/`sampleAtFraction` use for their own degenerate spans.
 */
export function traversedSegmentCount(trail: TrailGeometry, fraction: number): number {
  const segmentCount = trail.points.length - 1
  if (segmentCount <= 0) return 0

  const finiteFraction = Number.isFinite(fraction) ? fraction : 0
  const span = trail.endFraction - trail.startFraction

  if (span <= 1e-12) {
    return finiteFraction >= trail.startFraction ? segmentCount : 0
  }

  const rawProgress = (finiteFraction - trail.startFraction) / span
  const clampedProgress = Math.min(1, Math.max(0, rawProgress))
  const count = Math.floor(clampedProgress * segmentCount + FLOOR_EPSILON)
  return Math.min(segmentCount, Math.max(0, count))
}
