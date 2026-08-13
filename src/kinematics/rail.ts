// 7th-axis rail travel geometry.
//
// Provenance note (RESEARCH.md Assumption A4 / Open Question #1): no rail
// product spec was named anywhere in the source artifacts — CONTEXT.md
// leaves the exact travel range to implementation discretion. The 3-metre
// total travel below is a deliberately-chosen, plausible round number, NOT
// a sourced hardware spec. Do not mistake this for a datasheet value.
//
// This module is the single source of truth for the rail's travel range,
// centre position, clamping, and remaining-travel calculation: the 3D rail
// geometry (end-stop markers, D-07) and Phase 5's Dashboard "remaining
// travel" readout (DASH-03) both consume it, so they cannot disagree about
// where the limits are.

/** Rail travel range in metres, robot centred (3 m total travel). */
export const RAIL_TRAVEL = { min: -1.5, max: 1.5 } as const;

/** Centre of the travel range — computed from RAIL_TRAVEL, not restated. */
export const RAIL_CENTER_X = (RAIL_TRAVEL.min + RAIL_TRAVEL.max) / 2;

/** Clamps a rail position into [RAIL_TRAVEL.min, RAIL_TRAVEL.max]. */
export function clampRailPosition(x: number): number {
  return Math.min(RAIL_TRAVEL.max, Math.max(RAIL_TRAVEL.min, x));
}

/** Remaining travel distance in each direction from a given rail position. */
export function railRemainingTravel(x: number): { negative: number; positive: number } {
  return {
    negative: x - RAIL_TRAVEL.min,
    positive: RAIL_TRAVEL.max - x,
  };
}
