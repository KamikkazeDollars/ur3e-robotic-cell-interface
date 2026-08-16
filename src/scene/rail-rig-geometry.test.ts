// U-4 / quick 260816-s4e U-2: mechanical proof that the rail track's
// visible length is exactly the fixed, user-specified span — not a
// measurement of anything about the robot's rendered footprint. Reads the
// real scene module (same import-a-tsx-module-under-node-env pattern
// `src/gcode/toolpath-anchor.test.ts` already relies on — this repo's
// Vitest runs `environment: 'node'`, so a plain module import is enough;
// nothing here needs jsdom/canvas).
import { describe, it, expect } from 'vitest'
import { RAIL_TRAVEL, RAIL_CENTER_X } from '../kinematics'
import {
  TRACK_HALF_SPAN_M,
  TRACK_LENGTH,
  TRACK_OVERHANG,
  RIG_FOOTPRINT_WIDTH,
  ROBOT_REACH_ENVELOPE,
} from './RailRig'

describe('U-4: rail track is a fixed, user-specified span (quick 260816-s4e)', () => {
  it('RAIL_TRAVEL is capped at the new empirically-determined ±1.3m range', () => {
    expect(RAIL_TRAVEL.min).toBe(-1.3)
    expect(RAIL_TRAVEL.max).toBe(1.3)
  })

  it('TRACK_LENGTH is exactly 2.8 to 10 decimal places', () => {
    expect(TRACK_LENGTH).toBeCloseTo(2.8, 10)
  })

  it('the track ends at RAIL_CENTER_X ± TRACK_HALF_SPAN_M, matching RAIL_CENTER_X ∓ 1.4 to 10 decimal places', () => {
    const low = RAIL_CENTER_X - TRACK_HALF_SPAN_M
    const high = RAIL_CENTER_X + TRACK_HALF_SPAN_M
    expect(low).toBeCloseTo(RAIL_CENTER_X - 1.4, 10)
    expect(high).toBeCloseTo(RAIL_CENTER_X + 1.4, 10)
  })

  it('TRACK_OVERHANG is 0.1 to 10 decimal places and equals TRACK_HALF_SPAN_M minus half the travel span', () => {
    expect(TRACK_OVERHANG).toBeCloseTo(0.1, 10)
    expect(TRACK_OVERHANG).toBeCloseTo(TRACK_HALF_SPAN_M - (RAIL_TRAVEL.max - RAIL_TRAVEL.min) / 2, 10)
  })

  it('the floor footprint still fully contains the track', () => {
    expect(RIG_FOOTPRINT_WIDTH).toBeGreaterThan(TRACK_LENGTH)
  })

  it('the floor half-width is at least RAIL_TRAVEL.max + ROBOT_REACH_ENVELOPE — shrinking the track can never leave the robot standing off the floor plane', () => {
    expect(RIG_FOOTPRINT_WIDTH / 2).toBeGreaterThanOrEqual(RAIL_TRAVEL.max + ROBOT_REACH_ENVELOPE)
  })
})
