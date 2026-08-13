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
import { RAIL_CENTER_X } from '../kinematics'
import { ROBOT_REACH_ENVELOPE, RIG_Z_OFFSET, CARRIAGE_TOP_Y } from '../scene/RailRig'

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
 * The world-space point the toolpath is anchored at. X sits on the rail's
 * centre of travel; Y sits on the floor plane (world Y = 0), not at TCP
 * height, so a milling sample's cut depths read as resting on/into the
 * worktable rather than floating; Z is `RIG_Z_OFFSET` plus HALF the reach
 * envelope (not the whole envelope) so the work sits comfortably inside the
 * robot's reach rather than exactly at its limit.
 *
 * How this offset is applied (`parseToolpath.ts`, Step 6): the toolpath's
 * own X/Z bounding-box centre is translated onto this anchor's X/Z, and the
 * toolpath's minimum Y (its deepest point) is translated onto this anchor's
 * Y — so a milling sample's negative cut depths rest at the floor plane
 * rather than sinking below it, while a printing sample's flat base layer
 * sits directly on the floor.
 */
export const TOOLPATH_ANCHOR_OFFSET = {
  x: RAIL_CENTER_X,
  y: 0,
  z: RIG_Z_OFFSET + ROBOT_REACH_ENVELOPE / 2,
} as const
