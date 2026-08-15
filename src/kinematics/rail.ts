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
import type { CellMode } from '../cell-mode'

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

/**
 * Number of evenly spaced candidate rail positions `resolveRailPosition`
 * scans across `[RAIL_TRAVEL.min, RAIL_TRAVEL.max]`, inclusive of both
 * endpoints.
 */
export const RAIL_RESOLUTION_CANDIDATES = 201;

/**
 * D-02's 7th-axis redundancy resolution: picks the single rail position
 * (one per whole toolpath, per D-01) that minimises the worst-case reach
 * distance from the mounted robot to any point in `points`.
 *
 * Implemented as a brute-force scan over `RAIL_RESOLUTION_CANDIDATES` evenly
 * spaced candidates rather than the closed-form X-span-midpoint shortcut, so
 * this function implements D-02's "minimise the worst-case reach distance"
 * objective DIRECTLY — no optimality assumption about the shortcut is
 * carried forward (03-RESEARCH.md Assumption A2, retired rather than
 * inherited: `inverse-kinematics.test.ts`'s A2 cross-check asserts the two
 * approaches agree to within a millimetre for a centred cloud).
 *
 * Takes `mount` as a parameter rather than importing the robot's world-mount
 * constant from `src/gcode/toolpath-anchor.ts`: that module already imports
 * from this one (for `RAIL_CENTER_X`), so importing it back here would
 * close an import cycle.
 *
 * For both of this phase's bundled samples this resolves at or extremely
 * near `RAIL_CENTER_X`, because Phase 2's D-06 anchor already X-centres
 * every toolpath's bounding box there. PITFALLS.md Pitfall 5 flags exactly
 * this outcome as easy to mistake for "the rail is being ignored" — it is
 * not: the same toolpath translated a metre along X resolves to a visibly
 * different rail position (asserted in rail.test.ts), proving the
 * heuristic is live, not vestigial.
 */
/**
 * Distance (metres) each cell mode parks its work station from the rail's
 * own midpoint (`RAIL_CENTER_X`) — G-04-1 gap closure (04-06-PLAN.md).
 *
 * (a) Like `RAIL_TRAVEL` above, this is a chosen figure, not a sourced
 * hardware spec — CONTEXT.md leaves the rail's dimensions to implementation
 * discretion, and the UAT report that raised G-04-1 explicitly left the
 * distance to the implementer's judgement.
 * (b) 0.6m is 40% of the rail's half-travel (1.5m), so both mode stations
 * stay well inside the end-stops with usable travel remaining on both
 * sides — asserted in `rail.test.ts`.
 * (c) It is an exact multiple of `resolveRailPosition`'s own candidate
 * spacing (`(RAIL_TRAVEL.max - RAIL_TRAVEL.min) / (RAIL_RESOLUTION_CANDIDATES
 * - 1)` = 0.015m): 0.6 / 0.015 = 40 exactly. This is what makes the resolved
 * station for an off-centre-anchored toolpath land on exactly the centred
 * result plus the offset, rather than drifting by up to half a grid step.
 */
export const MODE_RAIL_START_OFFSET_M = 0.6

/**
 * The per-mode rail station a toolpath (and the workbench it rests on) is
 * anchored to — G-04-1 gap closure. Printing parks 0.6m right of centre,
 * milling 0.6m left, giving the 7th axis a visible reason to move between
 * modes instead of always resolving back to `RAIL_CENTER_X` (which happens
 * whenever the anchored work is itself centred — see `resolveRailPosition`'s
 * own doc comment and PITFALLS.md Pitfall 5).
 *
 * Sign convention is fixed against the scene's own default camera
 * (`src/scene/camera-defaults.ts` places it at positive X and positive Z,
 * looking at the origin — so world +X reads as screen-right from both the
 * initial and Reset View framings): printing parks right of centre, milling
 * left, exactly what the UAT report asked for.
 *
 * Routed through `clampRailPosition` rather than trusting the literal
 * offset directly, so a later increase to `MODE_RAIL_START_OFFSET_M`
 * degrades to an end-stop instead of producing a station off the rail
 * (T-04-19).
 */
export function railStartXForMode(mode: CellMode): number {
  const offset = mode === 'printing' ? MODE_RAIL_START_OFFSET_M : -MODE_RAIL_START_OFFSET_M
  return clampRailPosition(RAIL_CENTER_X + offset)
}

export function resolveRailPosition(
  points: readonly [number, number, number][],
  mount: { x: number; y: number; z: number },
): number {
  if (points.length === 0) return RAIL_CENTER_X;

  let bestCandidate = RAIL_CENTER_X;
  let bestWorstCaseDistance = Infinity;

  for (let i = 0; i < RAIL_RESOLUTION_CANDIDATES; i++) {
    const t = i / (RAIL_RESOLUTION_CANDIDATES - 1);
    const candidate = RAIL_TRAVEL.min + t * (RAIL_TRAVEL.max - RAIL_TRAVEL.min);
    // The candidate's own mount position: `mount` with its x replaced by
    // `mount.x + (candidate - RAIL_CENTER_X)`, so this stays correct even
    // if the mount ever stops coinciding with the travel centre.
    const candidateMountX = mount.x + (candidate - RAIL_CENTER_X);

    let worstCaseDistance = 0;
    for (const [px, py, pz] of points) {
      const dx = px - candidateMountX;
      const dy = py - mount.y;
      const dz = pz - mount.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > worstCaseDistance) worstCaseDistance = distance;
    }

    if (worstCaseDistance < bestWorstCaseDistance) {
      bestWorstCaseDistance = worstCaseDistance;
      bestCandidate = candidate;
    }
  }

  return clampRailPosition(bestCandidate);
}
