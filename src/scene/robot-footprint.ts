// Quick 260816-qym (U-2): the robot's REAL, MEASURED rendered footprint,
// derived from the shipped UR3e collision meshes and a forward-kinematics
// keypoint sweep — replacing the previous fix attempt's assumption that
// `CARRIAGE_BASE_WIDTH` (the mounting-plate box the robot is bolted to, not
// the robot's own extent) was a safe stand-in for how far the arm actually
// reaches. It was not: no amount of margin stacked on that constant could
// guarantee the arm stayed over the track, because the constant was
// measuring the wrong object entirely.
//
// Every constant below is measured and re-verified on every test run by
// `src/scene/robot-footprint.test.ts`, which:
//   (a) parses the seven binary STL collision meshes under
//       `public/robots/ur3e/meshes/ur3e/collision/` (base, shoulder,
//       upperarm, forearm, wrist1, wrist2, wrist3), verifying each parse
//       against the file's own byte size before trusting any extent;
//   (b) derives each link's maximum radial half-extent about its own mesh
//       origin — the measured stand-in for `COLLISION_LINK_RADIUS_M`
//       (`src/collision/pose-collision.ts`), itself documented there as a
//       chosen figure, not a datasheet value;
//   (c) SCALE-CHECKS the base mesh's radius against the published ~128mm
//       UR3e base diameter (a ~0.04-0.12m band) — PASSED: the shipped
//       meshes are metres-native, agreeing with this project's
//       metres-native rail/kinematics geometry (`src/kinematics/rail.ts`,
//       `ur3e-dh.ts`). No unit-scale defect exists in the shipped assets.
//   (d) sweeps joints 0-3 (base, shoulder, elbow, wrist_1) over
//       `UR3E_JOINT_LIMITS` on a 9-steps-per-joint grid, wrists 2/3 held at
//       `UR3E_PARKED_POSE`'s own values, calling `poseKeypointsWorld` for
//       every combination and tracking the largest
//       `|keypoint.x - ROBOT_MOUNT_WORLD.x|` seen across the whole sweep.
//
// HARD RULE: this module declares NO module-level imports. `RailRig.tsx`
// consumes `ROBOT_FOOTPRINT_HALF_WIDTH_X` at module scope
// (`TRACK_OVERHANG`'s derivation), and `RailRig` already sits inside the
// pre-existing `RailRig -> cellStore -> compile -> toolpath-anchor ->
// RailRig` module cycle — an import here would add a new edge into that
// cycle and could leave `TRACK_OVERHANG` evaluating against an
// uninitialised binding at load time. The measuring test does all the
// importing (`poseKeypointsWorld`, the kinematics barrel, the toolpath
// anchor) — it runs outside the browser bundle and outside the cycle.
// `robot-footprint.test.ts` asserts this file's source contains no
// `import` statement, so this constraint cannot silently regress.

/** Measured radial half-extent (metres) of the base link's collision mesh
 * (`base.stl`) about its own local origin. Measured by
 * `robot-footprint.test.ts`; SCALE-CHECKED against the published ~128mm
 * UR3e base diameter. */
export const UR3E_BASE_MESH_RADIUS_M = 0.10499331070699057

/** The largest measured radial half-extent (metres) across all seven UR3e
 * collision link meshes — the real, measured stand-in for
 * `COLLISION_LINK_RADIUS_M` (`src/collision/pose-collision.ts`'s own
 * chosen figure). */
export const UR3E_MAX_LINK_HALF_EXTENT_M = 0.28589462096533896

/** The robot's worst-case footprint half-width along world X, mount-
 * relative: the largest `|keypoint.x - ROBOT_MOUNT_WORLD.x|` seen across
 * `robot-footprint.test.ts`'s joints-0-3 sweep (wrists 2/3 parked), plus
 * `UR3E_MAX_LINK_HALF_EXTENT_M`. This is what `RailRig.tsx`'s
 * `TRACK_OVERHANG` derives from — the real measured reach of the arm about
 * the rail's travel axis, not an assumption about the carriage box it
 * stands on. */
export const ROBOT_FOOTPRINT_HALF_WIDTH_X = 0.8347446209653391
