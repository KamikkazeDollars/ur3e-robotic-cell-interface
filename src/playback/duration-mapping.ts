// D-02 move-type-weighted duration mapping. Framework-free (no rendering
// engine, no store, no UI import) — mirrors `src/trajectory/arc-length.ts`'s
// and `src/playback/clock-step.ts`'s module discipline exactly, so this file
// is directly unit-testable and independent of everything downstream of it.
// Exists so D-01's fixed duration and D-02's weighting are independently
// unit-testable: this module owns "how much of the fixed 10s does each
// stretch of path consume", `clock-step.ts` owns "advance one frame".
import type { ParsedToolpath } from '../gcode/parseToolpath'
import type { CompiledTrajectory } from '../trajectory/compile'
import { PLAYBACK_TOTAL_DURATION_SECONDS, UNIFORM_FRACTION_MAPPING, type FractionMapping } from './clock-step'

/**
 * Traverse-SPEED weights, not time weights: playback time for a stretch of
 * path is its arc length DIVIDED BY the weight in force, so the LARGER
 * weight produces LESS consumed time per unit distance — the larger weight
 * therefore belongs to rapids (D-02: rapids consume proportionally less of
 * the fixed playback duration than cuts). Reading these as time weights and
 * giving rapids the smaller number would silently invert D-02 while still
 * type-checking and still producing a monotone mapping — read the division
 * below, not just the constant names, before changing either value.
 *
 * The 4:1 ratio is a deliberately qualitative, tunable choice — D-01 already
 * establishes this phase does not aim for physical accuracy, since the
 * g-code's own feed rates are discarded — and can be retuned without
 * touching anything else in this module or its callers.
 */
export const RAPID_SPEED_WEIGHT = 4
export const CUT_SPEED_WEIGHT = 1

/** Floor for every divisor in this module (boundary denominator, running
 * toolpath real-length total, grand total weighted time, bracketing span) —
 * guards the whole chain against NaN/Infinity from a near-zero denominator
 * (T-04-05). Sub-floor point-pair distances are skipped entirely rather than
 * emitting a zero-width breakpoint. */
const MIN_DENOMINATOR = 1e-12

/** One point on the monotone scrubFraction <-> weightedTime breakpoint
 * table. `scrubFraction` is on the compiled trajectory's own axis (travel
 * phase + toolpath phase combined); `weightedFraction` is the normalized
 * ([0, 1]) weighted-time fraction at that same point. */
interface Breakpoint {
  scrubFraction: number
  weightedFraction: number
}

/** Coerces a non-finite value to 0 before any arithmetic touches it — both
 * `elapsedToFraction` and `fractionToElapsed` apply this to their argument
 * first, so a `NaN`/`Infinity` input can never poison a downstream division. */
function coerceFiniteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/**
 * Shared bracketing-pair search + linear blend, parameterized by which key
 * to search on (`keyOf`) and which key to read out (`readOf`) — used by both
 * `elapsedToFraction` (search `weightedFraction`, read out `scrubFraction`)
 * and `fractionToElapsed` (search `scrubFraction`, read out
 * `weightedFraction`), so there is exactly one bracketing implementation
 * rather than two near-identical search functions. `breakpoints` must be
 * non-decreasing in `keyOf` order (both axes are built monotonically below).
 */
function resolveBreakpoint(
  breakpoints: readonly Breakpoint[],
  target: number,
  keyOf: (bp: Breakpoint) => number,
  readOf: (bp: Breakpoint) => number,
): number {
  const first = breakpoints[0]
  const last = breakpoints[breakpoints.length - 1]
  if (target <= keyOf(first)) return readOf(first)
  if (target >= keyOf(last)) return readOf(last)

  // Binary search for the tightest bracketing pair: the largest `lo` whose
  // key is still <= target, and the `hi` immediately after it.
  let lo = 0
  let hi = breakpoints.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (keyOf(breakpoints[mid]) <= target) lo = mid
    else hi = mid
  }

  const a = breakpoints[lo]
  const b = breakpoints[hi]
  const span = keyOf(b) - keyOf(a)
  const ratio = span < MIN_DENOMINATOR ? 0 : (target - keyOf(a)) / span
  return readOf(a) + ratio * (readOf(b) - readOf(a))
}

/**
 * Builds the D-02 move-type-weighted `FractionMapping`, implementing the
 * `FractionMapping` interface imported from `./clock-step` (no competing
 * local interface). Reads move type from `toolpath.segments` (the original
 * classified segments — see `ClassifiedSegment.type`) and the
 * travel/toolpath boundary from `trajectory.travelLength`/`toolpathLength`
 * (Task 1's addition to `CompiledTrajectory`), never by re-deriving the
 * boundary from point coordinates.
 *
 * Falls back to `UNIFORM_FRACTION_MAPPING` — a degenerate toolpath still
 * plays, uniformly, instead of producing NaN — when the toolpath contributes
 * no real (non-zero-length) segment pairs, or the grand total weighted time
 * is below `MIN_DENOMINATOR`.
 */
export function buildDurationMapping(toolpath: ParsedToolpath, trajectory: CompiledTrajectory): FractionMapping {
  const travelLength = Number.isFinite(trajectory.travelLength) ? trajectory.travelLength : 0
  const toolpathLength = Number.isFinite(trajectory.toolpathLength) ? trajectory.toolpathLength : 0

  const lengthDenominator = travelLength + toolpathLength
  // The point on the scrubFraction axis where the prepended travel move ends
  // and the g-code's own path begins — read from the contract, never
  // re-derived by matching point coordinates.
  const boundaryFraction = lengthDenominator < MIN_DENOMINATOR ? 0 : travelLength / lengthDenominator

  // The travel phase is weighted at RAPID_SPEED_WEIGHT throughout: it is a
  // synthetic, non-cutting repositioning move that CONTEXT.md's decisions do
  // not address, and treating it as a rapid matches both its purpose and the
  // visual language it already borrows. A deliberate assumption, not a
  // derived fact.
  const travelWeightedTime = travelLength / RAPID_SPEED_WEIGHT

  // The toolpath phase walks `toolpath.segments` in file order, accumulating
  // real arc length and weighted time per accepted point pair. `realCumulative`
  // and `weightedCumulative` seed the toolpath phase's OWN running totals;
  // `weightedCumulative` starts at `travelWeightedTime` so it doubles as the
  // grand total once the walk finishes.
  let realCumulative = 0
  let weightedCumulative = travelWeightedTime
  const toolpathRaw: { realCumulative: number; weightedCumulative: number }[] = []

  for (const segment of toolpath.segments) {
    const weight = segment.type === 'rapid' ? RAPID_SPEED_WEIGHT : CUT_SPEED_WEIGHT
    for (let i = 0; i < segment.points.length - 1; i++) {
      const [x0, y0, z0] = segment.points[i]
      const [x1, y1, z1] = segment.points[i + 1]
      const distance = Math.hypot(x1 - x0, y1 - y0, z1 - z0)
      // Skip pairs whose distance is below the floor rather than emitting a
      // zero-width breakpoint.
      if (distance < MIN_DENOMINATOR) continue

      realCumulative += distance
      weightedCumulative += distance / weight
      toolpathRaw.push({ realCumulative, weightedCumulative })
    }
  }

  // Degenerate: no real toolpath movement, or nothing weighted at all (both
  // travel and toolpath contribute ~0). A uniform mapping still plays the
  // fixed duration end to end rather than producing NaN.
  if (toolpathRaw.length === 0 || weightedCumulative < MIN_DENOMINATOR) {
    return UNIFORM_FRACTION_MAPPING
  }

  const totalReal = realCumulative < MIN_DENOMINATOR ? 1 : realCumulative
  const totalWeighted = weightedCumulative < MIN_DENOMINATOR ? 1 : weightedCumulative

  const breakpoints: Breakpoint[] = [
    { scrubFraction: 0, weightedFraction: 0 },
    { scrubFraction: boundaryFraction, weightedFraction: travelWeightedTime / totalWeighted },
    ...toolpathRaw.map(({ realCumulative: real, weightedCumulative: weighted }) => ({
      // Rescale the toolpath phase's own [0, 1] real-fraction into the
      // compiled trajectory's overall scrubFraction range.
      scrubFraction: boundaryFraction + (real / totalReal) * (1 - boundaryFraction),
      weightedFraction: weighted / totalWeighted,
    })),
  ]

  function elapsedToFraction(elapsedSeconds: number): number {
    const clampedElapsed = Math.min(
      PLAYBACK_TOTAL_DURATION_SECONDS,
      Math.max(0, coerceFiniteOrZero(elapsedSeconds)),
    )
    // D-06: fraction is exactly 1 at (and beyond) the total duration, never
    // a near-1 value the bracketing search might otherwise produce.
    if (clampedElapsed >= PLAYBACK_TOTAL_DURATION_SECONDS) return 1
    const targetWeightedFraction = clampedElapsed / PLAYBACK_TOTAL_DURATION_SECONDS
    return resolveBreakpoint(
      breakpoints,
      targetWeightedFraction,
      (bp) => bp.weightedFraction,
      (bp) => bp.scrubFraction,
    )
  }

  function fractionToElapsed(scrubFraction: number): number {
    const clampedFraction = Math.min(1, Math.max(0, coerceFiniteOrZero(scrubFraction)))
    const weightedFraction = resolveBreakpoint(
      breakpoints,
      clampedFraction,
      (bp) => bp.scrubFraction,
      (bp) => bp.weightedFraction,
    )
    return weightedFraction * PLAYBACK_TOTAL_DURATION_SECONDS
  }

  return { elapsedToFraction, fractionToElapsed }
}
