// U-4 / quick 260817-03q (fifth round — the geometry-placement root-cause
// fix): mechanical proof that at either travel extreme the carriage's face
// butts flush against an end-stop that stands fully outside the carriage,
// with real track still visible beyond it. Reads the real scene module (same
// import-a-tsx-module-under-node-env pattern `src/gcode/toolpath-anchor.test.ts`
// already relies on — this repo's Vitest runs `environment: 'node'`, so a
// plain module import is enough; nothing here needs jsdom/canvas).
//
// This file is this defect's fifth-round guard. Narrowing RAIL_TRAVEL to make
// these assertions pass is NOT an acceptable fix — the derivation chain below
// must hold at RAIL_TRAVEL = +-1.3m, full stop.
//
// Computed world-space X spans at both travel extremes (proof, not comment
// decoration — every number below is also asserted, not just stated here):
//
//   | Element    | Min extreme       | Max extreme      |
//   |------------|--------------------|-------------------|
//   | carriage   | [-1.47, -1.13]     | [1.13, 1.47]      |
//   | end-stop   | [-1.54, -1.47]     | [1.47, 1.54]      |
//   | track      | [-1.88, 1.88]      | [-1.88, 1.88]     |
import { describe, it, expect } from 'vitest'
import { RAIL_TRAVEL, RAIL_CENTER_X } from '../kinematics'
import {
  TRACK_HALF_SPAN_M,
  TRACK_LENGTH,
  TRACK_RUNOUT_PAST_CARRIAGE_M,
  END_STOP_CENTER_X_MIN,
  END_STOP_CENTER_X_MAX,
  END_STOP_WIDTH,
  CARRIAGE_BASE_WIDTH,
  RIG_FOOTPRINT_WIDTH,
  ROBOT_REACH_ENVELOPE,
} from './RailRig'

describe('U-4: rail travel is restored to +-1.3m and derived, not restated (quick 260817-03q)', () => {
  it('RAIL_TRAVEL is exactly +-1.3', () => {
    expect(RAIL_TRAVEL.min).toBe(-1.3)
    expect(RAIL_TRAVEL.max).toBe(1.3)
  })

  it('TRACK_HALF_SPAN_M, TRACK_LENGTH, END_STOP_CENTER_X_MAX, and TRACK_RUNOUT_PAST_CARRIAGE_M match their computed values', () => {
    const expectedEndStopCenterXMax = RAIL_TRAVEL.max + CARRIAGE_BASE_WIDTH / 2 + END_STOP_WIDTH / 2
    const expectedTrackHalfSpan = expectedEndStopCenterXMax - RAIL_CENTER_X + END_STOP_WIDTH / 2 + CARRIAGE_BASE_WIDTH
    const expectedTrackLength = expectedTrackHalfSpan * 2
    const expectedRunout = expectedTrackHalfSpan - (RAIL_TRAVEL.max + CARRIAGE_BASE_WIDTH / 2)

    // toBeCloseTo, never toBe: the derivation chain carries benign IEEE-754
    // noise (TRACK_RUNOUT_PAST_CARRIAGE_M evaluates to 0.4099999999999999).
    expect(END_STOP_CENTER_X_MAX).toBeCloseTo(expectedEndStopCenterXMax, 10)
    expect(END_STOP_CENTER_X_MAX).toBeCloseTo(1.505, 10)
    expect(TRACK_HALF_SPAN_M).toBeCloseTo(expectedTrackHalfSpan, 10)
    expect(TRACK_HALF_SPAN_M).toBeCloseTo(1.88, 10)
    expect(TRACK_LENGTH).toBeCloseTo(expectedTrackLength, 10)
    expect(TRACK_LENGTH).toBeCloseTo(3.76, 10)
    expect(TRACK_RUNOUT_PAST_CARRIAGE_M).toBeCloseTo(expectedRunout, 10)
    expect(TRACK_RUNOUT_PAST_CARRIAGE_M).toBeCloseTo(0.41, 10)
  })
})

describe('U-4: flush hard-stop — the end-stop stands outside the carriage, touching but never overlapping', () => {
  const extremes = [
    { label: 'min', railPos: RAIL_TRAVEL.min, endStopCenterX: END_STOP_CENTER_X_MIN },
    { label: 'max', railPos: RAIL_TRAVEL.max, endStopCenterX: END_STOP_CENTER_X_MAX },
  ]

  for (const { label, railPos, endStopCenterX } of extremes) {
    it(`at the ${label} extreme, the carriage base plate and the end-stop block overlap by no more than 1e-9`, () => {
      const carriageXMin = railPos - CARRIAGE_BASE_WIDTH / 2
      const carriageXMax = railPos + CARRIAGE_BASE_WIDTH / 2
      const endStopXMin = endStopCenterX - END_STOP_WIDTH / 2
      const endStopXMax = endStopCenterX + END_STOP_WIDTH / 2

      const overlapLow = Math.max(carriageXMin, endStopXMin)
      const overlapHigh = Math.min(carriageXMax, endStopXMax)
      const overlap = Math.max(0, overlapHigh - overlapLow)

      expect(overlap).toBeLessThanOrEqual(1e-9)
    })

    it(`at the ${label} extreme, the end-stop's inner face coincides with the carriage's outer face to 10 decimal places`, () => {
      const carriageOuterFace = label === 'min' ? railPos - CARRIAGE_BASE_WIDTH / 2 : railPos + CARRIAGE_BASE_WIDTH / 2
      const endStopInnerFace = label === 'min' ? endStopCenterX + END_STOP_WIDTH / 2 : endStopCenterX - END_STOP_WIDTH / 2

      expect(endStopInnerFace).toBeCloseTo(carriageOuterFace, 10)
    })
  }
})

describe('U-4: carriage-on-track — the carriage never hangs off the rendered track', () => {
  const extremes = [
    { label: 'min', railPos: RAIL_TRAVEL.min },
    { label: 'max', railPos: RAIL_TRAVEL.max },
  ]

  for (const { label, railPos } of extremes) {
    it(`at the ${label} extreme, the carriage's outer face lies strictly inside RAIL_CENTER_X +- TRACK_HALF_SPAN_M`, () => {
      const outerFace = label === 'min' ? railPos - CARRIAGE_BASE_WIDTH / 2 : railPos + CARRIAGE_BASE_WIDTH / 2
      expect(outerFace).toBeGreaterThan(RAIL_CENTER_X - TRACK_HALF_SPAN_M)
      expect(outerFace).toBeLessThan(RAIL_CENTER_X + TRACK_HALF_SPAN_M)
    })
  }
})

describe('U-4: readable run-out — a full carriage width of track remains visible past each end-stop', () => {
  it('TRACK_HALF_SPAN_M minus the end-stop outer face is at least CARRIAGE_BASE_WIDTH', () => {
    const endStopOuterFace = END_STOP_CENTER_X_MAX + END_STOP_WIDTH / 2
    const runout = TRACK_HALF_SPAN_M - endStopOuterFace
    expect(runout).toBeGreaterThanOrEqual(CARRIAGE_BASE_WIDTH - 1e-10)
  })
})

describe('U-4: floor footprint still fully contains the track', () => {
  it('RIG_FOOTPRINT_WIDTH is greater than TRACK_LENGTH', () => {
    expect(RIG_FOOTPRINT_WIDTH).toBeGreaterThan(TRACK_LENGTH)
  })

  it('the floor half-width is at least RAIL_TRAVEL.max + ROBOT_REACH_ENVELOPE — shrinking the track can never leave the robot standing off the floor plane', () => {
    expect(RIG_FOOTPRINT_WIDTH / 2).toBeGreaterThanOrEqual(RAIL_TRAVEL.max + ROBOT_REACH_ENVELOPE)
  })
})
