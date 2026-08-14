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
 * Joint 3 (elbow) is narrower, +/- pi.
 *
 * Provenance (settled, plan 03-02): re-verified against Universal Robots'
 * own maintained `Universal_Robots_ROS2_Description` ROS 2 package, whose
 * UR3e `joint_limits.yaml` cites the UR3e user manual (e-Series, version
 * 5.8) as its source. The elbow's narrower range is not an arbitrary
 * choice — it exists because the arm's own geometry makes the
 * shoulder-lift joint collide with the elbow joint beyond a half turn, a
 * real mechanical constraint, not a modelling placeholder.
 *
 * WARNING (Pitfall B): this table's asymmetry — five joints at a full two
 * turns and the elbow at one — looks like an inconsistency at a glance.
 * "Tidying" it into a uniform range would silently reintroduce a real
 * mechanical impossibility. These values are confirmed correct against the
 * official source above and must NOT be normalised.
 */
export const UR3E_JOINT_LIMITS = [
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 1 shoulder_pan
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 2 shoulder_lift
  { min: -Math.PI, max: Math.PI }, // 3 elbow — narrower, URDF-verified (RESEARCH.md); see provenance note above
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
 * The stowed shoulder/elbow bend `UR3E_PARKED_POSE` below is built from —
 * kept as named constants rather than inline literals because `wrist_1` is
 * DERIVED from them (see below), so the three values can never drift apart.
 *
 * Provenance: these are the shoulder_lift/elbow angles of the tool-down
 * inverse-kinematics solution at the parked stance's own TCP point — i.e. the
 * arm holds exactly the position it always did, re-articulated so the flange
 * points down. They are a solver output recorded as a constant, not a
 * hand-tuned pair (03-UAT.md G-03-1, debug session
 * `table-clipping-singularities`).
 */
const PARKED_SHOULDER_LIFT = -0.4645740511122175;
const PARKED_ELBOW = 1.0760678431724195;

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
 *
 * HARD CONSTRAINT — this pose's flange must hold the SAME tool-down
 * orientation `buildToolDownTarget` (inverse-kinematics.ts) builds every
 * solved sample against. `compileTrajectory` emits this tuple VERBATIM as
 * scrub-fraction 0 while sample 1, a couple of millimetres later, is
 * IK-solved; if the two orientations disagree, that couple of millimetres has
 * to absorb the whole orientation difference as a wrist snap. The original
 * stance held the flange rotated 90 degrees about the tool axis
 * (wrist_3 = 0, wrist_1 = -pi/2), which is exactly what UAT saw as the arm
 * whipping the instant the scrub left 0: wrist_3 stepped 1.5732 rad and
 * wrist_1 0.616 rad over 1.2mm of travel. `inverse-kinematics.test.ts` now
 * asserts this constraint directly, so it cannot silently regress.
 *
 * The correction changed only how the arm HOLDS the point, never which point:
 * this is the tool-down IK branch at the previous stance's own TCP, so
 * `compileTrajectory`'s `homeTcpPoint` is bit-for-bit unchanged and every
 * empirically-verified claim in its doc comment about lift reachability and
 * where the travel line crosses table height still stands unmodified.
 *
 * `wrist_1` is DERIVED, not authored: with shoulder_pan at pi and both
 * wrist_2/wrist_3 at -pi/2, the flange points straight down exactly when
 * shoulder_lift + elbow + wrist_1 = -pi/2. Writing that closure as arithmetic
 * rather than a fourth magic number means re-posing the stowed bend (the two
 * constants above) keeps the pose tool-down automatically instead of silently
 * reintroducing the snap.
 */
export const UR3E_PARKED_POSE: JointAngles = [
  Math.PI,
  PARKED_SHOULDER_LIFT,
  PARKED_ELBOW,
  -Math.PI / 2 - PARKED_SHOULDER_LIFT - PARKED_ELBOW,
  -Math.PI / 2,
  -Math.PI / 2,
];
