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
 * D-08: Phase 1's originally-displayed static pose. Retained UNCHANGED —
 * `src/gcode/toolpath-anchor.ts` derives `WORKBENCH_TOP_Y` (the workbench's
 * own world-space height) from this exact pose's FK'd TCP height, so
 * changing its values would silently shift the whole rendered table.
 * Never asserted against in the FK reference-pose test.
 *
 * Phase 3 (03-01) stopped using this as the robot's actually-displayed
 * pose — see `UR3E_PARKED_POSE` below — because this pose's own TCP sits
 * up over the workbench (only discovered once Phase 3 introduced a
 * position-accurate visual cross-check; Phase 1/2 never rendered this pose
 * against a table, since the table didn't exist yet). It survives purely
 * as the `WORKBENCH_TOP_Y` derivation input.
 */
export const UR3E_READY_POSE: JointAngles = [
  0,
  -Math.PI / 4,
  -Math.PI / 3,
  -Math.PI / 2,
  -Math.PI / 2,
  0,
];

/**
 * D-08 (revised, Phase 3 03-01): the robot's actually-displayed idle/parked
 * stance — visibly OFF the workbench, not overlapping the work area, a
 * genuine "stowed" configuration rather than a pose that happens to rest
 * over the table. Chosen empirically (rendered and visually inspected
 * against the real workbench geometry this session) rather than derived:
 * shoulder_pan swung to the side (away from the table's forward-Z
 * direction), a folded, compact shoulder/elbow bend that keeps the whole
 * arm low and close to its own mount rather than reaching outward.
 *
 * This is BOTH `RobotModel.tsx`'s initial static pose (replacing
 * `UR3E_READY_POSE` there) AND `src/trajectory/compile.ts`'s continuity
 * seed / literal first sample for the prepended home-to-toolpath travel
 * move (D-0x) — the same stance the user sees before selecting a sample is
 * exactly where the compiled trajectory's scrub fraction 0 starts, so
 * there is no visual snap between "nothing selected" and "sample just
 * selected, scrub at 0".
 */
export const UR3E_PARKED_POSE: JointAngles = [
  Math.PI,
  -0.35,
  0.7,
  -Math.PI / 2,
  -Math.PI / 2,
  0,
];
