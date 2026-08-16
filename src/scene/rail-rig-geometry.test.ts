// U-4: mechanical proof that the rail track's visible length genuinely
// carries the carriage (and the robot standing on it) at both travel
// extremes, not just a prose claim. Reads the real scene module (same
// import-a-tsx-module-under-node-env pattern `src/gcode/toolpath-anchor.test.ts`
// already relies on — this repo's Vitest runs `environment: 'node'`, so a
// plain module import is enough; nothing here needs jsdom/canvas).
import { describe, it, expect } from 'vitest'
import { RAIL_TRAVEL } from '../kinematics'
import { TRACK_LENGTH, TRACK_END_MARGIN, CARRIAGE_BASE_WIDTH, RIG_FOOTPRINT_WIDTH } from './RailRig'

describe('U-4: rail track length carries the carriage at both travel extremes', () => {
  it('RAIL_TRAVEL is unchanged — the logical ±1.5m travel range did not move', () => {
    expect(RAIL_TRAVEL.min).toBe(-1.5)
    expect(RAIL_TRAVEL.max).toBe(1.5)
  })

  it('at the travel extreme, the carriage outer edge still has at least TRACK_END_MARGIN of track under it', () => {
    expect(TRACK_LENGTH / 2 - RAIL_TRAVEL.max).toBeGreaterThanOrEqual(
      CARRIAGE_BASE_WIDTH / 2 + TRACK_END_MARGIN,
    )
  })

  it('TRACK_END_MARGIN is generous, not the bare minimum U-4 rejected', () => {
    expect(TRACK_END_MARGIN).toBeGreaterThanOrEqual(0.25)
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
