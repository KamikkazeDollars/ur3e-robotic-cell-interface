// D-04 trajectory compiler — the only module in the codebase permitted to
// convert a toolpath point into an IK target. It orchestrates every layer
// this phase touches: arc-length parameterisation, the scene<->DH frame
// conversion, rail-relative targeting, per-sample closed-form IK, and D-03
// branch continuity — producing the `CompiledTrajectory` contract Phase 4
// (playback), Phase 5 (telemetry) and Phase 6 (operations tree) all read.
import type { ParsedToolpath } from '../gcode/parseToolpath'
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor'
import {
  RAIL_CENTER_X,
  resolveRailPosition,
  solveUR6IK,
  buildToolDownTarget,
  validBranches,
  pickClosestBranch,
  forwardKinematics,
  UR3E_READY_POSE,
  type JointAngles,
} from '../kinematics'
import { flattenToolpathPoints, buildArcLengthTable, pointAtFraction } from './arc-length'

/**
 * Converts a scene-space point into this project's raw DH frame, relative
 * to `mount`. Encodes `toolpath-anchor.ts`'s documented axis composition
 * (scene-local x is DH x, scene-local y is DH z, scene-local z is the
 * negated DH y) and `RobotModel.tsx`'s `rotation.x = -Math.PI / 2` frame
 * rotation. This — together with `dhFrameToScene` below — is the single
 * conversion site in the whole codebase: solving IK against raw scene
 * coordinates would produce a confidently wrong pose, because both frames
 * are metric and roughly co-located (03-RESEARCH.md Pitfall A's exact
 * failure mode).
 */
export function sceneToDhFrame(
  point: readonly [number, number, number],
  mount: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return { x: point[0] - mount.x, y: -(point[2] - mount.z), z: point[1] - mount.y }
}

/** The exact inverse of `sceneToDhFrame` — see that function's doc comment. */
export function dhFrameToScene(
  dh: { x: number; y: number; z: number },
  mount: { x: number; y: number; z: number },
): [number, number, number] {
  return [dh.x + mount.x, dh.z + mount.y, mount.z - dh.y]
}

/** One IK solve per this many metres of path (2mm) — keeps the flange
 * visibly on the drawn line at the bundled samples' roughly 150mm scale. */
export const TRAJECTORY_SAMPLE_SPACING_M = 0.002

/** Ceiling on compiled sample count, independent of Phase 2's own
 * `MAX_TOOLPATH_SEGMENTS` ceiling — bounds compile cost even for a toolpath
 * that maximises Phase 2's own segment budget (T-03-02). */
export const MAX_TRAJECTORY_SAMPLES = 4000

/** `'ready'` — every requested sample solved. `'frozen-at-unreachable'` —
 * the walk stopped at the first sample with no valid branch; `samples`
 * holds everything solved before that point (D-06). Never a substituted
 * approximate pose. */
export type TrajectoryStatus = 'ready' | 'frozen-at-unreachable'

/** One compiled point along the trajectory. Note: plan 03-02 adds a
 * `singularityFlags` field — consumers should not assume this shape is
 * final within Phase 3. */
export interface TrajectorySample {
  /** Cumulative arc-length fraction in [0, 1], monotonically non-decreasing
   * across `CompiledTrajectory.samples`. */
  scrubFraction: number
  /** The scene-space toolpath point this sample was solved against. */
  point: [number, number, number]
  /** The chosen IK solution for `point`, continuous with the previous
   * sample's joints (D-03). */
  joints: JointAngles
  /** The single rail position resolved for the whole toolpath (D-01) — the
   * same value on every sample. */
  railPos: number
  /** `forwardKinematics(joints, railPos - RAIL_CENTER_X).tcpPosition` — an
   * FK-verified readout, never a re-derivation. */
  tcpPosition: { x: number; y: number; z: number }
}

export interface CompiledTrajectory {
  samples: TrajectorySample[]
  /** The single rail position resolved for the whole toolpath (D-01). */
  railPos: number
  status: TrajectoryStatus
  /** The sample count the compiler intended to produce — equals
   * `samples.length` when `status === 'ready'`, and is larger than
   * `samples.length` when frozen, so a consumer can tell a complete
   * trajectory from a truncated one (D-06). */
  requestedSampleCount: number
}

/**
 * Compiles a parsed toolpath into a scrubbable IK trajectory. Pure and
 * synchronous — never throws.
 *
 * Anti-pattern this module must never adopt: sampling density comes from
 * solving MORE task-space points, never from blending two already-solved
 * joint tuples — a blended joint value traces a bowed path in task space
 * even when both endpoints are individually correct (03-RESEARCH.md
 * Pitfall 13). Every sample below is an independent `solveUR6IK` call
 * against its own task-space point.
 */
export function compileTrajectory(toolpath: ParsedToolpath): CompiledTrajectory {
  const points = flattenToolpathPoints(toolpath.segments)

  if (points.length < 2) {
    return { samples: [], railPos: RAIL_CENTER_X, status: 'ready', requestedSampleCount: 0 }
  }

  const table = buildArcLengthTable(points)

  // One rail position for the whole toolpath, resolved once before any
  // solve runs (D-01).
  const railPos = resolveRailPosition(points, ROBOT_MOUNT_WORLD)
  const railOffsetFromCenter = railPos - RAIL_CENTER_X

  const rawSampleCount = Math.ceil(table.totalLength / TRAJECTORY_SAMPLE_SPACING_M) + 1
  const sampleCount = Math.min(MAX_TRAJECTORY_SAMPLES, Math.max(2, rawSampleCount))

  const samples: TrajectorySample[] = []
  let previousJoints: JointAngles = UR3E_READY_POSE
  let status: TrajectoryStatus = 'ready'

  for (let i = 0; i < sampleCount; i++) {
    const scrubFraction = i / (sampleCount - 1)
    const point = pointAtFraction(points, table, scrubFraction)

    const dh = sceneToDhFrame(point, ROBOT_MOUNT_WORLD)
    // Arm-relative target: subtract the rail's own offset from centre off
    // the x component only, mirroring the pure prepended `transX(railPos)`
    // translation `forwardKinematics` composes the rail as — so solving
    // against this point and then re-applying that same translation via
    // `forwardKinematics(joints, railOffsetFromCenter)` reproduces `dh`.
    const armRelative = { x: dh.x - railOffsetFromCenter, y: dh.y, z: dh.z }

    const target = buildToolDownTarget(armRelative)
    const candidates = solveUR6IK(target)
    const inLimit = validBranches(candidates)
    const chosen = pickClosestBranch(inLimit, previousJoints)

    if (!chosen) {
      // D-06: freeze at the last valid pose rather than substituting an
      // approximate one — never presented as a pose the robot actually
      // achieves.
      status = 'frozen-at-unreachable'
      break
    }

    const tcpPosition = forwardKinematics(chosen, railOffsetFromCenter).tcpPosition

    samples.push({ scrubFraction, point, joints: chosen, railPos, tcpPosition })
    previousJoints = chosen
  }

  return { samples, railPos, status, requestedSampleCount: sampleCount }
}
