// D-06: the world-space anchor transform the parsed toolpath is translated
// onto, so it renders inside the robot's reach envelope instead of at the
// g-code file's own raw coordinates. Every component below is imported from
// the modules that already own it (RailRig.tsx's scene-composition constants,
// the kinematics barrel's rail constant) — nothing here is retyped as a
// literal number, so this file and the scene it describes can never drift
// apart (the same "single source of truth" discipline RailRig.tsx documents
// for RAIL_TRAVEL/RIG_Z_OFFSET).
//
// Phase 3 consumes both exports below as a stable, documented contract —
// read this whole comment before changing either constant's derivation.
import { RAIL_CENTER_X, forwardKinematics, UR3E_READY_POSE } from '../kinematics'
import {
  RIG_Z_OFFSET,
  CARRIAGE_TOP_Y,
  CARRIAGE_BASE_DEPTH,
  CARRIAGE_BLOCK_DEPTH,
} from '../scene/RailRig'

/**
 * The world-space point the robot is physically bolted to: the carriage
 * that rides the 7th-axis rail, at the rail's centre-of-travel X, the
 * carriage's own top-surface height (Y), and the whole rig's forward Z
 * offset off the world origin (CellScene.tsx's `rail-rig-mount` group).
 *
 * This is the correct origin for a reach-sphere check — NOT the ready-pose
 * TCP position. `forwardKinematics(UR3E_READY_POSE)` parks the flange
 * roughly 0.85m from this mounting point (the ready pose is simply resting
 * in the air), so measuring "reach" from the TCP would fail for a pose that
 * is doing nothing but parking. Reach is a property of where the arm is
 * MOUNTED, not of whatever pose it happens to be holding.
 *
 * For reference (Phase 3), the ready-pose TCP's own world-space position —
 * computed by taking `forwardKinematics(UR3E_READY_POSE).position` in the DH
 * module's z-up frame, applying the same `Rx(-90°)` frame rotation
 * `RobotModel.tsx` applies to the loaded robot (scene-local x is the DH x,
 * scene-local y is the DH z, scene-local z is the negated DH y), then adding
 * `RAIL_CENTER_X` / `CARRIAGE_TOP_Y` / `RIG_Z_OFFSET` component-wise — is
 * approximately `{ x: -0.184, y: 0.826, z: 0.631 }` metres (verified this
 * session by running the composition against the real `forward-kinematics.ts`
 * math, not just the research-session hand port).
 */
export const ROBOT_MOUNT_WORLD = {
  x: RAIL_CENTER_X,
  y: CARRIAGE_TOP_Y,
  z: RIG_Z_OFFSET,
} as const

/**
 * The world-space Z of the carriage's own forward-most physical face — the
 * greater of the base "shoe" plate's depth and the mounting block's depth
 * (both real rendered geometry from `RailRig.tsx`, never a fraction of
 * `ROBOT_REACH_ENVELOPE`, which has no relationship to the carriage's actual
 * footprint). This is the plane both the toolpath anchor (below) and the
 * workbench (`src/scene/Workbench.tsx`) must clear by a positive margin —
 * G-02-02: the toolpath must never overlap or read as underneath the
 * carriage.
 */
export const CARRIAGE_FRONT_FACE_Z =
  RIG_Z_OFFSET + Math.max(CARRIAGE_BASE_DEPTH, CARRIAGE_BLOCK_DEPTH) / 2

/**
 * The ready pose's own TCP world-space Y (vertical height), computed by
 * running the real `forwardKinematics`/`UR3E_READY_POSE` module — never
 * hand-transcribed — through the same frame-rotation composition documented
 * above (scene-local y is the DH z). Module-scope only: exists purely to
 * derive `WORKBENCH_TOP_Y` below without repeating the composition.
 */
const READY_POSE_TCP_WORLD_Y = CARRIAGE_TOP_Y + forwardKinematics(UR3E_READY_POSE).tcpPosition.z

/**
 * The world-space Y (vertical height) of the workbench's own top surface —
 * exactly half the ready pose's own parked TCP height. Comfortably above
 * `CARRIAGE_TOP_Y` (the robot's own ~0.19m mounting height) so the toolpath
 * reads as resting on a raised worktable rather than the bare floor
 * (G-02-01), while staying well clear of the ready pose's own parked
 * height. `src/scene/Workbench.tsx` renders its top surface at exactly this
 * value — never a second, independently guessed literal.
 */
export const WORKBENCH_TOP_Y = READY_POSE_TCP_WORLD_Y / 2

/**
 * Explicit clearance (metres) added beyond `CARRIAGE_FRONT_FACE_Z` to place
 * the toolpath anchor's Z — ~12cm, a clearly visible gap at this toolpath's
 * roughly 15cm scale. Replaces the previous derivation's use of a fraction
 * of `ROBOT_REACH_ENVELOPE`, which had no relationship to the rig's actual
 * footprint and produced a real overlap (G-02-02).
 */
export const TOOLPATH_CLEARANCE_MARGIN = 0.12

/**
 * The world-space point the toolpath is anchored at. X sits on the rail's
 * centre of travel; Y now sits on the workbench's own top surface (not the
 * floor plane, G-02-01), so a milling sample's cut depths read as resting
 * on/into the worktable rather than floating; Z now clears the carriage's
 * own measured forward face (`CARRIAGE_FRONT_FACE_Z`) by the named
 * `TOOLPATH_CLEARANCE_MARGIN` (G-02-02), rather than a flat fraction of the
 * reach envelope unrelated to the rig's actual footprint.
 *
 * How this offset is applied (`parseToolpath.ts`, Step 6): the toolpath's
 * own X/Z bounding-box centre is translated onto this anchor's X/Z, and the
 * toolpath's minimum Y (its deepest point) is translated onto this anchor's
 * Y — so a milling sample's negative cut depths rest at the workbench
 * surface rather than sinking below it, while a printing sample's flat base
 * layer sits directly on the workbench.
 */
export const TOOLPATH_ANCHOR_OFFSET = {
  x: RAIL_CENTER_X,
  y: WORKBENCH_TOP_Y,
  z: CARRIAGE_FRONT_FACE_Z + TOOLPATH_CLEARANCE_MARGIN,
} as const
