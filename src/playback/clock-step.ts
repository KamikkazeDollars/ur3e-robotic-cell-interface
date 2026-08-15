// Playback clock core (Phase 4, tracer plan 04-01). Framework-free (no
// rendering engine, no store, no UI import) — mirrors
// `src/trajectory/arc-length.ts`'s module discipline exactly, so this file
// is directly unit-testable and independent of React/Three/Zustand.
//
// `usePlaybackClock.ts` is the only caller: it holds the mutable
// `ClockState` in a ref, calls `stepClock` once per animation frame, and
// writes the result into the store's non-reactive `livePlayback.fraction`
// channel (every frame) and the reactive `scrubFraction` channel (only when
// `shouldSync` is true).

/** D-01: total playback duration is a single, fixed, normalized value for
 * every bundled sample — never derived from g-code feed rates or scaled by
 * toolpath complexity/segment count. */
export const PLAYBACK_TOTAL_DURATION_SECONDS = 10

/** Ceiling on a single frame's delta. A backgrounded/throttled tab's
 * resumed frame can carry a multi-second `rawDeltaSeconds` — without this
 * cap, that one frame would jump playback position forward visibly, or end
 * a run instantly on refocus. */
export const MAX_FRAME_DELTA_S = 0.1

/** D-07: how close to `scrubFraction === 1` counts as "the previous run
 * just completed" for `resumeElapsedSeconds`'s restart-from-0 branch.
 * Floating-point accumulation can land a "finished" fraction at
 * 0.9999997 instead of exactly 1, so this is checked with an epsilon, never
 * exact equality. */
export const RESUME_EPSILON = 1e-3

/** Throttle interval (seconds) for the reactive `scrubFraction` sync —
 * ~12.5Hz. Frequent enough that the slider reads as live, cheap enough that
 * it never approaches per-animation-frame re-render cost. */
export const STORE_SYNC_INTERVAL_S = 0.08

/**
 * The seam plan 04-02 replaces with the D-02 weighted (rapid-vs-cut)
 * mapping without changing this interface's signature or any caller.
 */
export interface FractionMapping {
  elapsedToFraction(elapsedSeconds: number): number
  fractionToElapsed(scrubFraction: number): number
}

/** Passes a raw fraction through the same finite-then-clamp guard the
 * store's `setScrubFraction` uses, so a degenerate mapping (or a
 * non-finite input) can never emit NaN or Infinity into the scene. */
function clampFraction(fraction: number): number {
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
}

function clampElapsed(elapsedSeconds: number): number {
  return Number.isFinite(elapsedSeconds)
    ? Math.min(PLAYBACK_TOTAL_DURATION_SECONDS, Math.max(0, elapsedSeconds))
    : 0
}

/** The arc-length-uniform case: `elapsedSeconds / PLAYBACK_TOTAL_DURATION_SECONDS`
 * and its inverse, both clamped into their respective ranges. Plan 04-02
 * swaps this out for a rapid/cut-weighted `FractionMapping` without
 * changing anything downstream of the `FractionMapping` interface. */
export const UNIFORM_FRACTION_MAPPING: FractionMapping = {
  elapsedToFraction: (elapsedSeconds) => clampFraction(elapsedSeconds / PLAYBACK_TOTAL_DURATION_SECONDS),
  fractionToElapsed: (scrubFraction) => clampElapsed(scrubFraction * PLAYBACK_TOTAL_DURATION_SECONDS),
}

/**
 * D-05/D-07: resume-from-here logic for the moment Play is pressed. Returns
 * 0 (a restart) when `scrubFraction` is non-finite or is at-or-beyond
 * `1 - RESUME_EPSILON` — this is the one case where Play does not resume
 * from the literal current fraction, because D-05 and D-06 together leave a
 * just-completed run ambiguous, and a literal resume from 1 would be a
 * zero-duration play that looks like nothing happened. Otherwise returns
 * `mapping.fractionToElapsed(scrubFraction)` clamped into
 * `[0, PLAYBACK_TOTAL_DURATION_SECONDS]` (D-05: resume from the current
 * position, not from 0).
 */
export function resumeElapsedSeconds(scrubFraction: number, mapping: FractionMapping): number {
  if (!Number.isFinite(scrubFraction) || scrubFraction >= 1 - RESUME_EPSILON) {
    return 0
  }
  return clampElapsed(mapping.fractionToElapsed(scrubFraction))
}

/** The playback clock's own accumulators, held in a ref by
 * `usePlaybackClock.ts` and passed into `stepClock` each frame. */
export interface ClockState {
  elapsedSeconds: number
  sinceSyncSeconds: number
}

/** One frame's worth of clock advance, returned by `stepClock`. */
export interface ClockStep {
  elapsedSeconds: number
  sinceSyncSeconds: number
  /** Always finite, always within [0, 1]. */
  fraction: number
  finished: boolean
  /** True on the finishing frame, or whenever `sinceSyncSeconds` has
   * accumulated at least `STORE_SYNC_INTERVAL_S` since the last sync —
   * the caller should call `setScrubFraction(fraction)` only when this is
   * true, never every frame. */
  shouldSync: boolean
}

/**
 * Advances the clock by one frame. Coerces a non-finite or negative
 * `rawDeltaSeconds` to 0 (time never runs backwards, and a `NaN` delta must
 * never poison the accumulators) and caps it at `MAX_FRAME_DELTA_S` before
 * accumulating into both `elapsedSeconds` and `sinceSyncSeconds`.
 */
export function stepClock(state: ClockState, rawDeltaSeconds: number, mapping: FractionMapping): ClockStep {
  const nonNegativeDelta = Number.isFinite(rawDeltaSeconds) && rawDeltaSeconds > 0 ? rawDeltaSeconds : 0
  const cappedDelta = Math.min(nonNegativeDelta, MAX_FRAME_DELTA_S)

  const elapsedSeconds = state.elapsedSeconds + cappedDelta
  const sinceSyncAccumulated = state.sinceSyncSeconds + cappedDelta

  const finished = elapsedSeconds >= PLAYBACK_TOTAL_DURATION_SECONDS
  // D-06: fraction is exactly 1 on the finishing frame, never a
  // near-1 value the weighted mapping might otherwise produce.
  const fraction = finished ? 1 : clampFraction(mapping.elapsedToFraction(elapsedSeconds))

  const shouldSync = finished || sinceSyncAccumulated >= STORE_SYNC_INTERVAL_S
  const sinceSyncSeconds = shouldSync ? 0 : sinceSyncAccumulated

  return { elapsedSeconds, sinceSyncSeconds, fraction, finished, shouldSync }
}
