// Shared interpolated lookup over a `CompiledTrajectory`'s `samples` array.
// Pure and framework-free — no rendering engine, no store, no UI import —
// same discipline as `arc-length.ts`. This is the ONLY place playback and
// scrub position turn a fraction into a pose; both `RobotPose.tsx` and
// `ScrubMarker.tsx` call this same function on the same store field, so the
// two can never report different points on the path (04-03-PLAN.md's
// load-bearing must-have, superseding the Phase 3 decision to duplicate the
// index derivation verbatim — see those components' doc comments).
import type { CompiledTrajectory, TrajectorySample } from './compile'

/**
 * A blended pose between two immediately-adjacent compiled samples. Carries
 * exactly `point` and `joints` — deliberately omits `railPos` (constant
 * across every sample, nothing to blend), `tcpPosition`, and
 * `singularityFlags`. Those last two are per-sample OBSERVATIONS of a
 * solved, FK-verified pose; a blended value for either would be a fabricated
 * reading rather than an interpolated position, since no IK/FK solve was
 * ever run against the blended joint tuple.
 */
export interface InterpolatedSample {
  point: [number, number, number]
  joints: TrajectorySample['joints']
}

/**
 * Binary search for the first index whose `scrubFraction` is greater than or
 * equal to `fraction`. `compile.ts` guarantees `scrubFraction` is
 * monotonically non-decreasing across `samples`, which is what makes this
 * search valid. When every sample's `scrubFraction` is below `fraction`
 * (a truncated `frozen-at-unreachable` trajectory queried at fraction 1),
 * this converges on the last index instead — `sampleAtFraction`'s ratio
 * clamp below is what turns that into "return the last sample exactly"
 * rather than an extrapolated blend.
 */
function findUpperIndex(samples: TrajectorySample[], fraction: number): number {
  let lo = 0
  let hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].scrubFraction >= fraction) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return hi
}

function blendPoint(
  a: [number, number, number],
  b: [number, number, number],
  ratio: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio, a[2] + (b[2] - a[2]) * ratio]
}

function blendJoints(
  a: TrajectorySample['joints'],
  b: TrajectorySample['joints'],
  ratio: number,
): TrajectorySample['joints'] {
  return a.map((value, i) => value + (b[i] - value) * ratio) as unknown as TrajectorySample['joints']
}

/**
 * Maps a scrub/playback fraction in [0, 1] onto a blended pose between the
 * two immediately-adjacent compiled samples bracketing it. Returns `null`
 * only when `trajectory.samples` is empty.
 *
 * Fraction 0 and fraction 1 return the first and last sample's own values
 * EXACTLY (element-wise), never a near-value produced by interpolation — the
 * ratio the bracketing pair blends by degenerates to exactly 0 or exactly 1
 * at those endpoints by construction. A truncated trajectory (D-06,
 * `status: 'frozen-at-unreachable'`) whose last sample sits below
 * `scrubFraction` 1 returns that last solved sample for fraction 1 rather
 * than a pose extrapolated beyond it — the ratio clamp below is
 * load-bearing for that guarantee; without it, a fraction past the last
 * sample's own `scrubFraction` would blend past 1 and present a pose that
 * was never solved and that the robot cannot reach.
 *
 * Blending happens in JOINT SPACE, not task space, between the two chosen
 * samples. This is acceptable here specifically because adjacent compiled
 * samples are one IK solve every `TRAJECTORY_SAMPLE_SPACING_M` (2mm) and are
 * continuity-selected (D-03) — the difference between a joint-space blend
 * and a task-space blend between two poses this close together is
 * sub-visual. This is NOT the general case of blending two arbitrary solved
 * poses that are far apart, which traces a bowed path the arm never
 * follows and which `compile.ts`'s own doc comment forbids the compiler
 * itself from doing (SIM-05) — the lower and upper samples blended below
 * must always be immediate array neighbours, which `findUpperIndex`'s
 * binary search guarantees by construction.
 */
export function sampleAtFraction(trajectory: CompiledTrajectory, fraction: number): InterpolatedSample | null {
  const { samples } = trajectory
  if (samples.length === 0) return null

  // Same coercion/clamp shape as `cellStore.ts`'s `setScrubFraction`.
  const finiteFraction = Number.isFinite(fraction) ? fraction : 0
  const clamped = Math.min(1, Math.max(0, finiteFraction))

  const upperIndex = findUpperIndex(samples, clamped)
  const lowerIndex = Math.max(0, upperIndex - 1)
  const lower = samples[lowerIndex]
  const upper = samples[upperIndex]

  const span = upper.scrubFraction - lower.scrubFraction
  const rawRatio = span < 1e-12 ? 0 : (clamped - lower.scrubFraction) / span
  // Load-bearing clamp (see doc comment above): without this, a truncated
  // trajectory queried at fraction 1 would extrapolate past `upper` instead
  // of returning it exactly.
  const ratio = Math.min(1, Math.max(0, rawRatio))

  return {
    point: blendPoint(lower.point, upper.point, ratio),
    joints: blendJoints(lower.joints, upper.joints, ratio),
  }
}
