// UR3e DH parameter table, joint limits, joint names, and pose constants.
//
// Values independently cross-verified this research session (01-RESEARCH.md,
// "DH Parameters & FK Reference Pose") against two sources:
//   1. Universal Robots' official DH parameters page
//   2. The joint <origin> offsets baked into the flattened (non-xacro) UR3e
//      URDF (Daniella1/urdf_files_dataset)
// Both agree exactly. Do not substitute values from any other source.
//
// D-04: these are hardcoded TypeScript constants for this phase, not
// store-backed/configurable — Phase 8 owns the Setup/Calibrate tabs that
// would edit them.

/** A six-joint angle tuple, in radians, ordered shoulder_pan -> wrist_3. */
export type JointAngles = [number, number, number, number, number, number];

/**
 * Standard-DH parameters per joint, in joint order (1..6).
 * Convention: T_i = Rot_z(theta_i) . Trans_z(d_i) . Trans_x(a_i) . Rot_x(alpha_i)
 */
export const UR3E_DH = [
  { a: 0, d: 0.15185, alpha: Math.PI / 2 }, // 1 shoulder_pan
  { a: -0.24355, d: 0, alpha: 0 }, // 2 shoulder_lift
  { a: -0.2132, d: 0, alpha: 0 }, // 3 elbow
  { a: 0, d: 0.13105, alpha: Math.PI / 2 }, // 4 wrist_1
  { a: 0, d: 0.08535, alpha: -Math.PI / 2 }, // 5 wrist_2
  { a: 0, d: 0.0921, alpha: 0 }, // 6 wrist_3
] as const;

/**
 * Per-joint travel limits, in radians. Joints 1,2,4,5,6 are +/- 2*pi.
 * Joint 3 (elbow) is narrower, +/- pi — this is the URDF's own encoding
 * (Daniella1/urdf_files_dataset ur3e.urdf), and corrects the uniform
 * +/- 2*pi assumption in the placeholder architecture table (RESEARCH.md,
 * "Joint limits — a discrepancy worth flagging to the planner").
 */
export const UR3E_JOINT_LIMITS = [
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 1 shoulder_pan
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 2 shoulder_lift
  { min: -Math.PI, max: Math.PI }, // 3 elbow — narrower, URDF-verified (RESEARCH.md)
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 4 wrist_1
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 5 wrist_2
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 6 wrist_3
] as const;

/** URDF joint names, in the same order as UR3E_DH / UR3E_JOINT_LIMITS. */
export const UR3E_JOINT_NAMES = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
  'wrist_3_joint',
] as const;

/** The all-zero pose. This is the FK *verification* pose (Pitfall 1). */
export const UR3E_HOME_POSE: JointAngles = [0, 0, 0, 0, 0, 0];

/**
 * D-08: the *displayed* static pose — a slightly bent "ready" pose, never
 * asserted against in the FK reference-pose test. Shoulder lifted ~45deg,
 * elbow bent ~60deg, wrists set so the flange faces roughly forward.
 */
export const UR3E_READY_POSE: JointAngles = [
  0,
  -Math.PI / 4,
  -Math.PI / 3,
  -Math.PI / 2,
  -Math.PI / 2,
  0,
];
