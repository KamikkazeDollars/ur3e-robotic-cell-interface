// D-02 move-type-weighted duration mapping — hand-computable unit coverage.
// Every case below is worked out by hand from a synthetic fixture (see this
// file's fixture helpers), never from the implementation's own output, so
// this is the load-bearing gate for the weighting DIRECTION (a swapped
// RAPID_SPEED_WEIGHT/CUT_SPEED_WEIGHT pair would still type-check and still
// produce a monotone mapping — only the hand-computed values below catch
// that inversion).
import { describe, it, expect } from 'vitest'
import { RAPID_SPEED_WEIGHT, CUT_SPEED_WEIGHT, buildDurationMapping } from './duration-mapping'
import { PLAYBACK_TOTAL_DURATION_SECONDS } from './clock-step'
import type { ClassifiedSegment, ParsedToolpath } from '../gcode/parseToolpath'
import type { CompiledTrajectory } from '../trajectory/compile'

/** Builds a `ParsedToolpath`-shaped fixture from a list of
 * `{ type, length }` segment specs, chained end-to-end along the X axis so
 * each segment's arc length is exactly its specified `length` (in metres). */
function buildToolpath(specs: { type: ClassifiedSegment['type']; length: number }[]): ParsedToolpath {
  const segments: ClassifiedSegment[] = []
  let x = 0
  for (const spec of specs) {
    const start: [number, number, number] = [x, 0, 0]
    x += spec.length
    const end: [number, number, number] = [x, 0, 0]
    segments.push({
      type: spec.type,
      motion: spec.type === 'rapid' ? 'G0' : 'G1',
      source: 'line',
      points: [start, end],
      feedRate: spec.type === 'rapid' ? null : 600,
    })
  }
  return { segments, unit: 'mm', skippedMotionCount: 0, appliedAnchorTranslation: [0, 0, 0], bounds: null }
}

/** Builds a `CompiledTrajectory`-shaped fixture carrying only the
 * `travelLength`/`toolpathLength` the mapping reads — the mapping never
 * touches `samples`, so the rest of the contract is filled with
 * placeholder, unread values. */
function buildTrajectory(travelLength: number, toolpathLength: number): CompiledTrajectory {
  return { samples: [], railPos: 0, status: 'ready', requestedSampleCount: 0, travelLength, toolpathLength }
}

// Fixture A: no travel phase, one rapid segment of length 1 followed by one
// cut segment of length 1 (toolpathLength: 2).
const fixtureAToolpath = buildToolpath([
  { type: 'rapid', length: 1 },
  { type: 'cut', length: 1 },
])
const fixtureATrajectory = buildTrajectory(0, 2)

// Fixture B: travel phase length 1, a single cut segment of length 1
// (toolpathLength: 1).
const fixtureBToolpath = buildToolpath([{ type: 'cut', length: 1 }])
const fixtureBTrajectory = buildTrajectory(1, 1)

describe('duration-mapping — weighting direction', () => {
  it('RAPID_SPEED_WEIGHT is strictly greater than CUT_SPEED_WEIGHT', () => {
    expect(RAPID_SPEED_WEIGHT).toBeGreaterThan(CUT_SPEED_WEIGHT)
  })
})

describe('duration-mapping — Fixture A (no travel, equal-length rapid + cut)', () => {
  const mapping = buildDurationMapping(fixtureAToolpath, fixtureATrajectory)

  it('fractionToElapsed(0.5) equals 2 exactly (the rapid half finishes after 2 of the 10 seconds)', () => {
    expect(mapping.fractionToElapsed(0.5)).toBe(2)
  })

  it('elapsedToFraction(2) equals 0.5 within 1e-9', () => {
    expect(mapping.elapsedToFraction(2)).toBeCloseTo(0.5, 9)
  })

  it('D-02: elapsed time crossing the rapid segment is strictly less than crossing the cut segment of the same arc length', () => {
    const rapidElapsed = mapping.fractionToElapsed(0.5) - mapping.fractionToElapsed(0)
    const cutElapsed = mapping.fractionToElapsed(1) - mapping.fractionToElapsed(0.5)
    expect(rapidElapsed).toBeLessThan(cutElapsed)
  })

  it('elapsedToFraction(5) is strictly greater than 0.5 (more than half the path is covered at the halfway point in time)', () => {
    expect(mapping.elapsedToFraction(5)).toBeGreaterThan(0.5)
  })
})

describe('duration-mapping — Fixture B (travel phase weighted at rapid speed)', () => {
  const mapping = buildDurationMapping(fixtureBToolpath, fixtureBTrajectory)

  it('fractionToElapsed(0.5) equals 2 exactly (the travel phase consumes 1/4 the time per unit length that the cut does)', () => {
    expect(mapping.fractionToElapsed(0.5)).toBe(2)
  })
})

describe('duration-mapping — boundary and monotonicity', () => {
  const mapping = buildDurationMapping(fixtureAToolpath, fixtureATrajectory)

  it('elapsedToFraction(0) is exactly 0', () => {
    expect(mapping.elapsedToFraction(0)).toBe(0)
  })

  it('elapsedToFraction(PLAYBACK_TOTAL_DURATION_SECONDS) and elapsedToFraction(999) are both exactly 1', () => {
    expect(mapping.elapsedToFraction(PLAYBACK_TOTAL_DURATION_SECONDS)).toBe(1)
    expect(mapping.elapsedToFraction(999)).toBe(1)
  })

  it('sweeping elapsed 0 through the total duration in 0.1s steps produces a monotonically non-decreasing, finite, in-range fraction sequence', () => {
    let previous = -Infinity
    for (let elapsed = 0; elapsed <= PLAYBACK_TOTAL_DURATION_SECONDS + 1e-9; elapsed += 0.1) {
      const fraction = mapping.elapsedToFraction(elapsed)
      expect(Number.isFinite(fraction)).toBe(true)
      expect(fraction).toBeGreaterThanOrEqual(0)
      expect(fraction).toBeLessThanOrEqual(1)
      expect(fraction).toBeGreaterThanOrEqual(previous)
      previous = fraction
    }
  })

  it('round-trips elapsedToFraction(fractionToElapsed(f)) to within 1e-9 for interior fractions', () => {
    for (const f of [0.05, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.95]) {
      const roundTripped = mapping.elapsedToFraction(mapping.fractionToElapsed(f))
      expect(roundTripped).toBeCloseTo(f, 9)
    }
  })
})

describe('duration-mapping — degenerate inputs never throw and stay finite', () => {
  it('a toolpath with no segments produces finite values in both directions', () => {
    const emptyToolpath: ParsedToolpath = {
      segments: [],
      unit: 'mm',
      skippedMotionCount: 0,
      appliedAnchorTranslation: [0, 0, 0],
      bounds: null,
    }
    const mapping = buildDurationMapping(emptyToolpath, buildTrajectory(0, 0))
    expect(Number.isFinite(mapping.elapsedToFraction(5))).toBe(true)
    expect(Number.isFinite(mapping.fractionToElapsed(0.5))).toBe(true)
  })

  it('a toolpath whose points are all coincident (zero total length) produces finite values', () => {
    const coincidentToolpath = buildToolpath([{ type: 'cut', length: 0 }])
    const mapping = buildDurationMapping(coincidentToolpath, buildTrajectory(0, 0))
    expect(Number.isFinite(mapping.elapsedToFraction(5))).toBe(true)
    expect(Number.isFinite(mapping.fractionToElapsed(0.5))).toBe(true)
  })

  it('a trajectory with travelLength: 0 and toolpathLength: 0 produces finite values', () => {
    const mapping = buildDurationMapping(fixtureAToolpath, buildTrajectory(0, 0))
    expect(Number.isFinite(mapping.elapsedToFraction(5))).toBe(true)
    expect(Number.isFinite(mapping.fractionToElapsed(0.5))).toBe(true)
  })

  it('non-finite arguments passed to either direction produce finite values, never throw', () => {
    const mapping = buildDurationMapping(fixtureAToolpath, fixtureATrajectory)
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => mapping.elapsedToFraction(bad)).not.toThrow()
      expect(() => mapping.fractionToElapsed(bad)).not.toThrow()
      expect(Number.isFinite(mapping.elapsedToFraction(bad))).toBe(true)
      expect(Number.isFinite(mapping.fractionToElapsed(bad))).toBe(true)
    }
  })
})
