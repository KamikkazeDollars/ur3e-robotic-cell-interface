// D-08: wrist/shoulder/elbow singularity classification, built now while the
// closed-form IK work is fresh, deliberately ahead of the Phase 5 Dashboard
// that will display these flags. `src/trajectory/compile.ts` is the only
// current caller — it stores the flags per sample without letting them
// affect branch selection or acceptance; nothing in Phase 3 renders them.
//
// Framework-free, mirroring `forward-kinematics.ts`'s own discipline: no
// rendering engine, no robot-loader, no UI framework import, so this stays
// directly unit-testable and reusable independent of the renderer
// (ARCHITECTURE.md "Structure Rationale").
import { forwardKinematics } from './forward-kinematics'
import { UR3E_DH, type JointAngles } from './ur3e-dh'

/**
 * Angle threshold (radians, ~3 degrees) for the wrist and elbow singular
 * families below. This is a chosen heuristic tuned for a visual proximity
 * warning, NOT a value sourced from a Universal Robots specification — the
 * same honesty `rail.ts` already applies to its own travel-range constant.
 * Do not mistake this for a datasheet value.
 */
export const SINGULARITY_ANGLE_EPSILON = 0.05

/**
 * Distance threshold (metres) for the shoulder singular family below. Also
 * a chosen heuristic for a visual proximity warning, not a sourced
 * specification value.
 */
export const SINGULARITY_DISTANCE_EPSILON = 0.02

export interface SingularityFlags {
  wrist: boolean
  shoulder: boolean
  elbow: boolean
  any: boolean
}

/**
 * Classifies a joint tuple against the three singular families from
 * ARCHITECTURE.md's Singularities table. Pure function of `joints` — no
 * store, no component, no side effect — mirroring `isWithinJointLimits`'s
 * own shape (`forward-kinematics.ts`).
 */
export function classifySingularity(joints: JointAngles): SingularityFlags {
  const theta3 = joints[2]
  const theta5 = joints[4]

  // Wrist: joint 4 and joint 6 axes become collinear (rotation about them
  // degenerate) when sin(theta5) is near zero — which happens at BOTH ends
  // of the (-pi, pi] range (theta5 near 0 AND theta5 near +/- pi), mirroring
  // the same two-branch check `elbow` performs three lines below for its
  // own analogous condition. `solveUR6IK` special-cases exactly this
  // condition via `Math.abs(s5) < ZERO_THRESH` (`inverse-kinematics.ts`).
  const wrist =
    Math.abs(theta5) < SINGULARITY_ANGLE_EPSILON ||
    Math.abs(Math.abs(theta5) - Math.PI) < SINGULARITY_ANGLE_EPSILON

  // Elbow: the arm is fully extended (theta3 near 0) or fully folded
  // (theta3 near +/- pi).
  const elbow =
    Math.abs(theta3) < SINGULARITY_ANGLE_EPSILON ||
    Math.abs(Math.abs(theta3) - Math.PI) < SINGULARITY_ANGLE_EPSILON

  // Shoulder: the wrist centre lies on the joint-1 rotation axis — the base
  // z axis in this DH chain, which is the very first transform
  // `forwardKinematics` composes, so "distance from the joint-1 axis" is
  // the planar magnitude of the wrist centre's x and y components (its z
  // component, height along that axis, is irrelevant to how far off-axis it
  // sits). The wrist centre is `forwardKinematics(joints).frames[3]`'s own
  // translation — the frame carried through joint 4, which is the point
  // ARCHITECTURE.md's table means by "wrist centre" for this non-spherical
  // wrist chain (`UR3E_DH[3].d` is the joint-4 offset that separates it
  // from a true spherical wrist).
  //
  // Correction applied here (deviation from the plan's literal "distance
  // below a threshold" wording, Rule 1 — a bug, not a judgment call): for
  // THIS chain, joint 4's own d-offset (~0.131m) means the wrist centre can
  // NEVER reach zero distance from the joint-1 axis, for ANY joint tuple —
  // verified numerically across the full joint-angle domain. The true UR
  // shoulder-singularity locus (standard result for a non-spherical-wrist
  // arm with a1=0) is where that planar distance reaches its own minimum,
  // which equals the joint-4 offset exactly: distance^2 = d4^2. Comparing
  // raw distance against a small epsilon near zero would make `shoulder`
  // permanently false for every reachable pose — dead code masquerading as
  // coverage. The fix: compare distance against its floor (d4), not zero.
  const wristCenter = forwardKinematics(joints).frames[3]
  const distanceFromAxis = Math.hypot(wristCenter[0][3], wristCenter[1][3])
  const wristOffset = UR3E_DH[3].d
  const shoulder = Math.abs(distanceFromAxis - wristOffset) < SINGULARITY_DISTANCE_EPSILON

  return { wrist, shoulder, elbow, any: wrist || shoulder || elbow }
}
