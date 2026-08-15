// Unit coverage of D-01/D-05/D-06/D-07 (the pure clock core) plus a headless
// end-to-end playback run — this tracer task's runnable proof that the
// whole "press Play, the robot runs the toolpath" path actually works,
// exercised without a browser/DOM (this project's Vitest config runs in a
// `node` environment — see `04-RESEARCH.md`'s Validation Architecture).
import { describe, it, expect, beforeEach } from 'vitest'
import {
  PLAYBACK_TOTAL_DURATION_SECONDS,
  MAX_FRAME_DELTA_S,
  RESUME_EPSILON,
  STORE_SYNC_INTERVAL_S,
  UNIFORM_FRACTION_MAPPING,
  resumeElapsedSeconds,
  stepClock,
  type ClockState,
} from './clock-step'
import { useCellStore } from '../store/cellStore'
import { compileTrajectory } from '../trajectory/compile'
import { TOOLPATH_ANCHOR_OFFSET } from '../gcode/toolpath-anchor'
import type { ClassifiedSegment, ParsedToolpath } from '../gcode/parseToolpath'

/** Same closed, 150mm-side square perimeter fixture as
 * `compile.test.ts`'s `buildSquareToolpath` — reproduced here rather than
 * imported so this test file has no dependency on `compile.test.ts` itself. */
function buildSquareToolpath(): ParsedToolpath {
  const halfSide = 0.075
  const cx = TOOLPATH_ANCHOR_OFFSET.x
  const cy = TOOLPATH_ANCHOR_OFFSET.y
  const cz = TOOLPATH_ANCHOR_OFFSET.z

  const corners: [number, number, number][] = [
    [cx - halfSide, cy, cz - halfSide],
    [cx + halfSide, cy, cz - halfSide],
    [cx + halfSide, cy, cz + halfSide],
    [cx - halfSide, cy, cz + halfSide],
    [cx - halfSide, cy, cz - halfSide],
  ]

  const segments: ClassifiedSegment[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    segments.push({
      type: 'cut',
      motion: 'G1',
      source: 'line',
      points: [corners[i], corners[i + 1]],
      feedRate: 600,
    })
  }

  return {
    segments,
    unit: 'mm',
    skippedMotionCount: 0,
    appliedAnchorTranslation: [0, 0, 0],
    bounds: null,
  }
}

const freshState = (): ClockState => ({ elapsedSeconds: 0, sinceSyncSeconds: 0 })

describe('clock-step — pure clock behavior', () => {
  it('PLAYBACK_TOTAL_DURATION_SECONDS equals 10 (D-01)', () => {
    expect(PLAYBACK_TOTAL_DURATION_SECONDS).toBe(10)
  })

  it('stepClock with a raw delta of 5 seconds advances elapsed by exactly MAX_FRAME_DELTA_S, not by 5', () => {
    const step = stepClock(freshState(), 5, UNIFORM_FRACTION_MAPPING)
    expect(step.elapsedSeconds).toBe(MAX_FRAME_DELTA_S)
  })

  it('stepClock with a raw delta of NaN advances elapsed by 0 and returns a finite fraction', () => {
    const step = stepClock(freshState(), NaN, UNIFORM_FRACTION_MAPPING)
    expect(step.elapsedSeconds).toBe(0)
    expect(Number.isFinite(step.fraction)).toBe(true)
  })

  it('stepClock with a negative raw delta advances elapsed by 0 (time never runs backwards)', () => {
    const step = stepClock(freshState(), -3, UNIFORM_FRACTION_MAPPING)
    expect(step.elapsedSeconds).toBe(0)
  })

  it('stepping from just under PLAYBACK_TOTAL_DURATION_SECONDS returns finished, fraction exactly 1, and shouldSync (D-06)', () => {
    const almostDone: ClockState = { elapsedSeconds: PLAYBACK_TOTAL_DURATION_SECONDS - 0.01, sinceSyncSeconds: 0 }
    const step = stepClock(almostDone, 1 / 60, UNIFORM_FRACTION_MAPPING)
    expect(step.finished).toBe(true)
    expect(step.fraction).toBe(1)
    expect(step.shouldSync).toBe(true)
  })

  it('repeated stepClock calls below the total duration return shouldSync:false until STORE_SYNC_INTERVAL_S accumulates, then true with the accumulator reset', () => {
    let state = freshState()
    const delta = STORE_SYNC_INTERVAL_S / 3

    const first = stepClock(state, delta, UNIFORM_FRACTION_MAPPING)
    expect(first.shouldSync).toBe(false)
    state = { elapsedSeconds: first.elapsedSeconds, sinceSyncSeconds: first.sinceSyncSeconds }

    const second = stepClock(state, delta, UNIFORM_FRACTION_MAPPING)
    expect(second.shouldSync).toBe(false)
    state = { elapsedSeconds: second.elapsedSeconds, sinceSyncSeconds: second.sinceSyncSeconds }

    const third = stepClock(state, delta, UNIFORM_FRACTION_MAPPING)
    expect(third.shouldSync).toBe(true)
    expect(third.sinceSyncSeconds).toBe(0)
  })

  it('resumeElapsedSeconds(0.5, UNIFORM_FRACTION_MAPPING) returns 5 (D-05: resume from the current position)', () => {
    expect(resumeElapsedSeconds(0.5, UNIFORM_FRACTION_MAPPING)).toBe(5)
  })

  it('resumeElapsedSeconds(1, ...) and resumeElapsedSeconds(0.9999997, ...) both return 0 (D-07: restart, not a zero-duration resume)', () => {
    expect(resumeElapsedSeconds(1, UNIFORM_FRACTION_MAPPING)).toBe(0)
    expect(resumeElapsedSeconds(0.9999997, UNIFORM_FRACTION_MAPPING)).toBe(0)
    // Sanity check the epsilon boundary itself is honored, not accidental.
    expect(1 - 0.9999997).toBeLessThan(RESUME_EPSILON)
  })

  it('resumeElapsedSeconds(NaN, ...) returns 0', () => {
    expect(resumeElapsedSeconds(NaN, UNIFORM_FRACTION_MAPPING)).toBe(0)
  })

  it('the fraction returned by stepClock is always finite and within [0, 1] across every scenario above', () => {
    const scenarios: [ClockState, number][] = [
      [freshState(), 5],
      [freshState(), NaN],
      [freshState(), -3],
      [{ elapsedSeconds: PLAYBACK_TOTAL_DURATION_SECONDS - 0.01, sinceSyncSeconds: 0 }, 1 / 60],
      [{ elapsedSeconds: 4, sinceSyncSeconds: 0 }, 1 / 60],
      [{ elapsedSeconds: PLAYBACK_TOTAL_DURATION_SECONDS + 50, sinceSyncSeconds: 0 }, 1 / 60],
    ]
    for (const [state, delta] of scenarios) {
      const step = stepClock(state, delta, UNIFORM_FRACTION_MAPPING)
      expect(Number.isFinite(step.fraction)).toBe(true)
      expect(step.fraction).toBeGreaterThanOrEqual(0)
      expect(step.fraction).toBeLessThanOrEqual(1)
    }
  })
})

describe('clock-step — headless end-to-end playback run', () => {
  beforeEach(() => {
    useCellStore.setState({
      toolpath: null,
      trajectory: null,
      scrubFraction: 0,
      isPlaying: false,
      livePlayback: { fraction: 0 },
    })
  })

  it('a full play run reaches fraction 1, is monotonically non-decreasing, and throttles setScrubFraction (proving the split is real)', () => {
    const toolpath = buildSquareToolpath()
    const trajectory = compileTrajectory(toolpath)
    expect(trajectory.status).toBe('ready')
    expect(trajectory.samples.length).toBeGreaterThan(0)

    useCellStore.setState({ toolpath, trajectory, scrubFraction: 0 })
    useCellStore.getState().play()

    let syncCount = 0
    const originalSetScrubFraction = useCellStore.getState().setScrubFraction
    // Wrap the real setter so this test can count how many times it fires
    // without changing its behavior — the store's own lockstep write
    // (livePlayback.fraction assignment, then set({ scrubFraction })) must
    // still run exactly as it does in production.
    useCellStore.setState({
      setScrubFraction: (fraction: number) => {
        syncCount += 1
        originalSetScrubFraction(fraction)
      },
    })

    const mapping = UNIFORM_FRACTION_MAPPING
    let clockState: ClockState = {
      elapsedSeconds: resumeElapsedSeconds(useCellStore.getState().scrubFraction, mapping),
      sinceSyncSeconds: 0,
    }

    const frameDelta = 1 / 60
    const maxSteps = Math.ceil(PLAYBACK_TOTAL_DURATION_SECONDS / frameDelta) + 30 // small margin
    const fractions: number[] = []
    let finished = false
    let steps = 0

    for (steps = 0; steps < maxSteps && !finished; steps++) {
      const step = stepClock(clockState, frameDelta, mapping)
      clockState = { elapsedSeconds: step.elapsedSeconds, sinceSyncSeconds: step.sinceSyncSeconds }

      // 60fps, non-reactive write — every step, exactly as usePlaybackClock does.
      useCellStore.getState().livePlayback.fraction = step.fraction
      fractions.push(step.fraction)

      if (step.shouldSync) {
        useCellStore.getState().setScrubFraction(step.fraction)
      }

      if (step.finished) {
        useCellStore.getState().pause()
        finished = true
      }
    }

    expect(finished).toBe(true)
    expect(steps).toBeLessThanOrEqual(maxSteps)

    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1])
    }

    expect(fractions[fractions.length - 1]).toBe(1)
    expect(useCellStore.getState().livePlayback.fraction).toBe(fractions[fractions.length - 1])
    expect(useCellStore.getState().isPlaying).toBe(false)

    // The throttle is real: far fewer syncs than animation steps.
    expect(syncCount).toBeGreaterThan(0)
    expect(syncCount).toBeLessThan(fractions.length)
  })

  it('livePlayback is the same object reference before and after play(), pause(), and setScrubFraction()', () => {
    const before = useCellStore.getState().livePlayback
    useCellStore.getState().play()
    expect(useCellStore.getState().livePlayback).toBe(before)
    useCellStore.getState().pause()
    expect(useCellStore.getState().livePlayback).toBe(before)
    useCellStore.getState().setScrubFraction(0.3)
    expect(useCellStore.getState().livePlayback).toBe(before)
  })

  it('setScrubFraction(NaN) leaves both scrubFraction and livePlayback.fraction at 0', () => {
    useCellStore.getState().setScrubFraction(0.6)
    expect(useCellStore.getState().scrubFraction).toBe(0.6)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0.6)

    useCellStore.getState().setScrubFraction(NaN)
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })
})
