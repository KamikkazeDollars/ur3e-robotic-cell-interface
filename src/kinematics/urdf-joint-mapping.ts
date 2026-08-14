// Reconciles this project's DH/"controller" joint convention (the frame
// `forward-kinematics.ts` and `inverse-kinematics.ts` both compute in,
// sourced from Universal Robots' own DH parameters / `default_kinematics.yaml`)
// against `urdf-loader`'s actual rendered joint chain, which hangs off a
// DIFFERENT root frame — a real, documented divergence baked into the
// official `Universal_Robots_ROS2_Description` URDF, not a bug in either
// side individually.
//
// Root cause (verified empirically this session by reading a live Three.js
// scene graph's world matrices and comparing them to `forwardKinematics`,
// then confirmed against the shipped URDF's own inline documentation at
// `public/robots/ur3e/ur3e.urdf`, the `base_link-base_link_inertia` joint):
//
//   <joint name="base_link-base_link_inertia" type="fixed">
//     <!-- 'base_link' is REP-103 aligned (so X+ forward), while the
//          internal frames of the robot/controller have X+ pointing
//          backwards. Use the joint between 'base_link' and
//          'base_link_inertia' (a dummy link/frame) to introduce the
//          necessary rotation over Z (of pi rad). -->
//     <origin rpy="0 0 3.141592653589793" xyz="0 0 0"/>
//   </joint>
//
// `shoulder_pan_joint`'s parent is `base_link_inertia`, NOT `base_link` —
// so every joint value `setJointValue` applies is expressed relative to a
// frame that is already rotated 180 degrees about Z from `base_link` (the
// frame `RobotModel.tsx`'s `rotation.x = -Math.PI / 2` is applied to). This
// project's DH table is sourced from the manufacturer's "controller/Base
// Coordinates" convention, which the SAME URDF file documents (a few lines
// below, on the `base_link-base_fixed_joint`) as ALSO 180 degrees off
// `base_link` — i.e. the DH convention this project computes in already
// matches `base_link_inertia`'s orientation in principle, but
// `forwardKinematics`/`solveUR6IK` never apply that 180-degree Z rotation
// themselves (they are pure DH chains rooted at an implicit, un-rotated
// "joint 1 frame"), so it must be reconciled at the render hand-off.
//
// Algebraic proof this reduces to a single-joint offset (not a whole-chain
// correction): the DH composition per joint is
//   T_i = Rot_z(theta_i) . Trans_z(d_i) . Trans_x(a_i) . Rot_x(alpha_i)
// A pre-multiplied Rot_z(pi) at the root commutes directly into joint 1's
// own Rot_z(theta_1) term — Rot_z(pi) . Rot_z(theta_1) = Rot_z(theta_1 + pi)
// — and touches nothing else in the chain (T_2 .. T_6 are unaffected,
// because the extra rotation is fully absorbed before any translation or
// off-axis rotation occurs). So the ENTIRE correction is: add pi to joint
// 1's (`shoulder_pan_joint`) commanded value only, at the exact point a
// solved `JointAngles` tuple is handed to `urdf-loader`'s `setJointValue` —
// never inside `forwardKinematics.ts` or `inverse-kinematics.ts`, which
// stay pure DH math in the manufacturer/controller convention.
//
// This was verified end-to-end by comparing `urdf-loader`'s actual
// `tool0` link world matrix (via `robot.updateMatrixWorld(true)` +
// `link.matrixWorld.elements`) against this project's own
// `forwardKinematics` + scene frame conversion for a real compiled
// trajectory sample: without this offset the rendered flange landed 180
// degrees around the vertical axis from the intended toolpath point;
// with it, the two agree.
import type { JointAngles } from './ur3e-dh'

/** The `base_link_inertia` vs. DH/controller frame divergence, in radians —
 * see this file's header comment for the exact URDF joint that bakes it in. */
export const URDF_SHOULDER_PAN_OFFSET = Math.PI

/** Wraps an angle into the half-open interval (-pi, pi]. Mirrors
 * `inverse-kinematics.ts`'s own normalisation so a `+pi` offset can never
 * push a value outside a joint's declared URDF limit. */
function normalizeAngle(angle: number): number {
  let a = angle
  while (a <= -Math.PI) a += 2 * Math.PI
  while (a > Math.PI) a -= 2 * Math.PI
  return a
}

/**
 * Converts a solved `JointAngles` tuple (DH/controller convention) into the
 * values `urdf-loader`'s `setJointValue` must receive to render the SAME
 * physical pose — this is the single call site every `setJointValue` call
 * site in `src/scene/` must route through, so the correction lives in
 * exactly one place rather than being re-derived (or forgotten) per caller.
 */
export function toUrdfJointAngles(joints: JointAngles): JointAngles {
  return [
    normalizeAngle(joints[0] + URDF_SHOULDER_PAN_OFFSET),
    joints[1],
    joints[2],
    joints[3],
    joints[4],
    joints[5],
  ]
}
