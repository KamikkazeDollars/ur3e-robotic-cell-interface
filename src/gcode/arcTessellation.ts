// Pure G2/G3 arc-to-polyline tessellation for the interpreter's own arc
// semantics (v0=center, v1=start, v2=end, direction read from `modal.motion`
// — see 02-RESEARCH.md Pattern 1, and `parseToolpath.ts`'s `addArcCurve`
// branch, the sole caller). Mirrors `forward-kinematics.ts`'s module shape:
// no React, no Zustand, no Three.js objects — a typed-input/typed-output
// pure-math module, directly unit-testable in isolation.
//
// Convention: all three inputs are in the interpreter's own coordinate
// convention, where the arc always lies in the XY plane (index 0 = x, index
// 1 = y) and Z (index 2) interpolates linearly from start to end (helical
// moves).
//
// Deliberately does NOT handle the ZX (G18) or YZ (G19) working-plane remap
// gcode-toolpath applies to v0/v1/v2 before calling addArcCurve — both
// bundled samples (D-08) stay on the default G17 (XY) plane by authoring
// constraint (02-RESEARCH.md Pitfall C, enforced by plan 02-02 Task 2's
// acceptance criteria), so a remap-aware branch here would be untested code
// guarding a case the bundled assets cannot produce. A future g-code upload
// feature accepting G18/G19 input must add that branch here, remapping the
// caller's x/y/z fields back to true XY before calling this function (or
// generalising this function to accept the active plane).

const TWO_PI = Math.PI * 2

/** Angular resolution: number of angular subdivisions per full 2*pi turn.
 * A fixed value (not derived from radius/arc length) keeps a 150mm-scale
 * arc visually smooth without letting a pathological input inflate the
 * vertex count unboundedly (T-02-08). */
export const ARC_SEGMENTS_PER_TURN = 64

/**
 * Tessellates a G2 (clockwise) or G3 (counter-clockwise) arc into an ordered
 * polyline. The first and last returned points are the caller's own
 * `start`/`end` tuples, copied verbatim — never recomputed from the angle —
 * so an arc's last point is bit-identical to the next segment's first
 * point and no seam appears at the junction. Does not clamp, round or
 * otherwise alter finite input values.
 */
export function tessellateArc(
  center: readonly [number, number, number],
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  direction: 'G2' | 'G3',
): [number, number, number][] {
  const dx0 = start[0] - center[0]
  const dy0 = start[1] - center[1]
  const radius = Math.hypot(dx0, dy0)

  // Degenerate arc (e.g. start, end and centre all coincide): the two
  // endpoints alone, no intermediate points — nothing to sweep around.
  if (radius === 0) {
    return [
      [start[0], start[1], start[2]],
      [end[0], end[1], end[2]],
    ]
  }

  const startAngle = Math.atan2(dy0, dx0)
  const dx1 = end[0] - center[0]
  const dy1 = end[1] - center[1]
  const endAngle = Math.atan2(dy1, dx1)

  const rawDelta = endAngle - startAngle

  // Normalise the swept angle into the open interval (0, 2*pi] in the
  // traversal direction, so a start angle equal to the end angle (a full
  // circle) sweeps a full turn instead of collapsing to nothing. G2 is
  // clockwise (decreasing angle); G3 is counter-clockwise (increasing
  // angle) — taken from the caller's `direction`, never inferred from a
  // boolean, because the interpreter does not pass one.
  let sweep: number
  if (direction === 'G3') {
    let magnitude = rawDelta % TWO_PI
    if (magnitude <= 0) magnitude += TWO_PI
    sweep = magnitude
  } else {
    let magnitude = -rawDelta % TWO_PI
    if (magnitude <= 0) magnitude += TWO_PI
    sweep = -magnitude
  }

  const steps = Math.max(1, Math.round((ARC_SEGMENTS_PER_TURN * Math.abs(sweep)) / TWO_PI))

  const points: [number, number, number][] = [[start[0], start[1], start[2]]]

  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const angle = startAngle + sweep * t
    const z = start[2] + (end[2] - start[2]) * t
    points.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle), z])
  }

  points.push([end[0], end[1], end[2]])

  return points
}
