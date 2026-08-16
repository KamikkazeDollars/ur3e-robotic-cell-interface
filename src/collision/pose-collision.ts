// U-2: pure, framework-free pose-collision classifier — no React, no
// three.js, no urdf-loader, no store import, mirroring `singularity.ts`'s
// own discipline so this stays directly unit-testable and reusable
// independent of the renderer.
//
// Importing scene geometry constants from `src/scene/RailRig.tsx` is not a
// new coupling: `src/gcode/toolpath-anchor.ts` already imports
// RIG_Z_OFFSET/CARRIAGE_TOP_Y/CARRIAGE_BASE_DEPTH/CARRIAGE_BLOCK_DEPTH from
// that same file for the exact same reason. Every dimension below is
// IMPORTED from an existing constant — no number in this module is a
// retyped scene literal — so a real geometry change can never silently
// desync from the collision envelope.
import { dhFrameToScene } from '../trajectory/compile'
import { forwardKinematics, RAIL_CENTER_X, RAIL_TRAVEL, type JointAngles } from '../kinematics'
import {
  ROBOT_MOUNT_WORLD,
  WORKBENCH_TOP_Y,
  WORKBENCH_WIDTH_X,
  WORKBENCH_NEAR_Z,
  WORKBENCH_FAR_Z,
} from '../gcode/toolpath-anchor'
import {
  TRACK_LENGTH,
  RAIL_PROFILE_WIDTH,
  RAIL_PROFILE_HEIGHT,
  RAIL_GAP,
  RIG_Z_OFFSET,
  END_STOP_WIDTH,
  END_STOP_HEIGHT,
  END_STOP_DEPTH,
  CARRIAGE_BASE_WIDTH,
  CARRIAGE_BASE_DEPTH,
  CARRIAGE_TOP_Y,
} from '../scene/RailRig'

/** Chosen effective half-thickness of a UR3e link for a pragmatic keypoint
 * collision test — explicitly NOT a datasheet value (same honesty
 * `SINGULARITY_ANGLE_EPSILON` applies to its own chosen constant). */
export const COLLISION_LINK_RADIUS_M = 0.04

/** Interpolated samples per inter-frame segment, so a long link cannot
 * straddle an obstacle with both its endpoints clear. */
export const COLLISION_LINK_SUBDIVISIONS = 6

/** Floor-plane clearance tolerance (metres). */
export const FLOOR_CLEARANCE_EPSILON_M = 0.005

/** Workbench top-surface penetration tolerance (metres) — a flange resting
 * exactly on the surface is not a collision; penetrating past this depth
 * is. */
export const WORKBENCH_PENETRATION_EPSILON_M = 0.005

/** Deliberately the same shape as `SingularityFlags` (`../kinematics/singularity`). */
export interface CollisionFlags {
  floor: boolean
  workbench: boolean
  rig: boolean
  any: boolean
}

/**
 * Builds the six frame-origin world points via
 * `forwardKinematics(joints, railPos - RAIL_CENTER_X).frames`, mapped
 * through `dhFrameToScene(..., ROBOT_MOUNT_WORLD)` (imported from
 * `src/trajectory/compile.ts` — the one existing, already-proven
 * world-space composition, never restated here), then emits, for each of
 * the five consecutive-frame segments, `COLLISION_LINK_SUBDIVISIONS` points
 * from the segment start inclusive, finishing with frame 6's own origin —
 * `5 * COLLISION_LINK_SUBDIVISIONS + 1` points total.
 *
 * Deliberately STARTS at frame 1 and never includes the mount point itself:
 * the robot's base is bolted onto the carriage, so a chain that began at
 * the mount would report a permanent collision with the hardware it is
 * mounted on.
 */
export function poseKeypointsWorld(
  joints: JointAngles,
  railPos: number,
): [number, number, number][] {
  const { frames } = forwardKinematics(joints, railPos - RAIL_CENTER_X)
  const worldFrames: [number, number, number][] = frames.map((frame) =>
    dhFrameToScene({ x: frame[0][3], y: frame[1][3], z: frame[2][3] }, ROBOT_MOUNT_WORLD),
  )

  const keypoints: [number, number, number][] = []
  for (let i = 0; i < worldFrames.length - 1; i++) {
    const start = worldFrames[i]
    const end = worldFrames[i + 1]
    for (let s = 0; s < COLLISION_LINK_SUBDIVISIONS; s++) {
      const t = s / COLLISION_LINK_SUBDIVISIONS
      keypoints.push([
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t,
      ])
    }
  }
  keypoints.push(worldFrames[worldFrames.length - 1])
  return keypoints
}

/**
 * Tests every sampled keypoint of `joints` (at `railPos`) against the floor
 * plane, the workbench slab (anchored at `workbenchX`), and the rig
 * envelope (rail track + both end-stops + the carriage, which moves with
 * `railPos`). Every dimension traces to an imported scene constant.
 */
export function classifyPoseCollision(
  joints: JointAngles,
  railPos: number,
  workbenchX: number,
): CollisionFlags {
  const keypoints = poseKeypointsWorld(joints, railPos)

  // Workbench slab — deliberately solid all the way to the floor
  // (conservative: swallows the legs and under-table volume rather than
  // modelling four thin posts). X/Z faces inflated by the link radius; the
  // TOP face is not inflated and instead requires penetration past
  // WORKBENCH_PENETRATION_EPSILON_M below WORKBENCH_TOP_Y.
  const workbenchXMin = workbenchX - WORKBENCH_WIDTH_X / 2 - COLLISION_LINK_RADIUS_M
  const workbenchXMax = workbenchX + WORKBENCH_WIDTH_X / 2 + COLLISION_LINK_RADIUS_M
  const workbenchZMin = WORKBENCH_NEAR_Z - COLLISION_LINK_RADIUS_M
  const workbenchZMax = WORKBENCH_FAR_Z + COLLISION_LINK_RADIUS_M
  const workbenchYCeiling = WORKBENCH_TOP_Y - WORKBENCH_PENETRATION_EPSILON_M

  // Rail track — the whole track span, at its fixed Z position.
  const trackXMin = RAIL_CENTER_X - TRACK_LENGTH / 2
  const trackXMax = RAIL_CENTER_X + TRACK_LENGTH / 2
  const trackYMax = RAIL_PROFILE_HEIGHT
  const trackZMin = RIG_Z_OFFSET - (RAIL_GAP / 2 + RAIL_PROFILE_WIDTH / 2)
  const trackZMax = RIG_Z_OFFSET + (RAIL_GAP / 2 + RAIL_PROFILE_WIDTH / 2)

  // Two end-stop blocks, at each physical travel limit.
  const endStops = [RAIL_TRAVEL.min, RAIL_TRAVEL.max].map((x) => ({
    xMin: x - END_STOP_WIDTH / 2,
    xMax: x + END_STOP_WIDTH / 2,
    yMax: RAIL_PROFILE_HEIGHT + END_STOP_HEIGHT,
    zMin: RIG_Z_OFFSET - END_STOP_DEPTH / 2,
    zMax: RIG_Z_OFFSET + END_STOP_DEPTH / 2,
  }))

  // Carriage — MOVES with the commanded rail position.
  const carriageXMin = railPos - CARRIAGE_BASE_WIDTH / 2
  const carriageXMax = railPos + CARRIAGE_BASE_WIDTH / 2
  const carriageYMax = CARRIAGE_TOP_Y
  const carriageZMin = RIG_Z_OFFSET - CARRIAGE_BASE_DEPTH / 2
  const carriageZMax = RIG_Z_OFFSET + CARRIAGE_BASE_DEPTH / 2

  let floor = false
  let workbench = false
  let rig = false

  for (const [x, y, z] of keypoints) {
    if (y < COLLISION_LINK_RADIUS_M - FLOOR_CLEARANCE_EPSILON_M) {
      floor = true
    }

    if (
      x >= workbenchXMin &&
      x <= workbenchXMax &&
      z >= workbenchZMin &&
      z <= workbenchZMax &&
      y >= 0 &&
      y < workbenchYCeiling
    ) {
      workbench = true
    }

    if (
      x >= trackXMin &&
      x <= trackXMax &&
      y >= 0 &&
      y <= trackYMax &&
      z >= trackZMin &&
      z <= trackZMax
    ) {
      rig = true
    }

    for (const stop of endStops) {
      if (
        x >= stop.xMin &&
        x <= stop.xMax &&
        y >= 0 &&
        y <= stop.yMax &&
        z >= stop.zMin &&
        z <= stop.zMax
      ) {
        rig = true
      }
    }

    if (
      x >= carriageXMin &&
      x <= carriageXMax &&
      y >= 0 &&
      y <= carriageYMax &&
      z >= carriageZMin &&
      z <= carriageZMax
    ) {
      rig = true
    }
  }

  return { floor, workbench, rig, any: floor || workbench || rig }
}
