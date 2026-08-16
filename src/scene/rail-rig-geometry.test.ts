// U-4 / quick 260816-qym U-2: mechanical proof that the rail track's
// visible length genuinely carries the carriage AND the robot standing on
// it at both travel extremes, not just a prose claim. Reads the real scene
// module (same import-a-tsx-module-under-node-env pattern
// `src/gcode/toolpath-anchor.test.ts` already relies on — this repo's
// Vitest runs `environment: 'node'`, so a plain module import is enough;
// nothing here needs jsdom/canvas).
import { describe, it, expect } from 'vitest'
import { RAIL_TRAVEL } from '../kinematics'
import { TRACK_LENGTH, TRACK_END_MARGIN, TRACK_OVERHANG, CARRIAGE_BASE_WIDTH, RIG_FOOTPRINT_WIDTH } from './RailRig'
import { ROBOT_FOOTPRINT_HALF_WIDTH_X } from './robot-footprint'

describe('U-4: rail track length carries the carriage at both travel extremes', () => {
  it('RAIL_TRAVEL is unchanged — the logical ±1.5m travel range did not move', () => {
    expect(RAIL_TRAVEL.min).toBe(-1.5)
    expect(RAIL_TRAVEL.max).toBe(1.5)
  })

  // Quick 260816-qym (U-2): the two assertions below replace the previous
  // carriage-derived ones (`CARRIAGE_BASE_WIDTH / 2 + TRACK_END_MARGIN`),
  // which described the mounting PLATE's own half-width, not the robot's
  // real reach — the root cause of the still-reported overhang defect after
  // the first fix attempt. `TRACK_OVERHANG` now derives from the robot's
  // measured worst-case footprint (`ROBOT_FOOTPRINT_HALF_WIDTH_X`,
  // `./robot-footprint.ts`) instead.

  it('at the travel extreme, the track extends at least ROBOT_FOOTPRINT_HALF_WIDTH_X + TRACK_END_MARGIN past the limit — the robot itself, not just the carriage plate, stays over the track', () => {
    expect(TRACK_LENGTH / 2 - RAIL_TRAVEL.max).toBeGreaterThanOrEqual(
      ROBOT_FOOTPRINT_HALF_WIDTH_X + TRACK_END_MARGIN,
    )
  })

  it('TRACK_OVERHANG is strictly greater than the superseded carriage-derived figure (CARRIAGE_BASE_WIDTH/2 + 0.3) — this specific regression cannot come back', () => {
    const supersededOverhang = CARRIAGE_BASE_WIDTH / 2 + 0.3
    expect(TRACK_OVERHANG).toBeGreaterThan(supersededOverhang)
  })

  it('TRACK_END_MARGIN sits on top of the measured footprint rather than standing alone', () => {
    expect(TRACK_OVERHANG - TRACK_END_MARGIN).toBeCloseTo(ROBOT_FOOTPRINT_HALF_WIDTH_X, 10)
  })

  it('TRACK_LENGTH is strictly longer than the "carriage only just fits" case that produced the reported defect', () => {
    expect(TRACK_LENGTH).toBeGreaterThan(
      RAIL_TRAVEL.max - RAIL_TRAVEL.min + 2 * (CARRIAGE_BASE_WIDTH / 2),
    )
  })

  it('the floor footprint still fully contains the track', () => {
    expect(RIG_FOOTPRINT_WIDTH).toBeGreaterThan(TRACK_LENGTH)
  })
})
