// D-04 trajectory compiler — the only module in the codebase permitted to
// convert a toolpath point into an IK target. It orchestrates every layer
// this phase touches: arc-length parameterisation, the scene<->DH frame
// conversion, rail-relative targeting, per-sample closed-form IK, and D-03
// branch continuity — producing the `CompiledTrajectory` contract Phase 4
// (playback), Phase 5 (telemetry) and Phase 6 (operations tree) all read.
import type { ParsedToolpath } from '../gcode/parseToolpath'
import { ROBOT_MOUNT_WORLD, TOOLPATH_ANCHOR_OFFSET } from '../gcode/toolpath-anchor'
import {
  RAIL_CENTER_X,
  resolveRailPosition,
  solveUR6IK,
  buildToolDownTarget,
  validBranches,
  pickClosestBranch,
  forwardKinematics,
  UR3E_PARKED_POSE,
  type JointAngles,
} from '../kinematics'
import { flattenToolpathPoints, buildArcLengthTable, pointAtFraction, type ArcLengthTable } from './arc-length'

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

/**
 * Vertical clearance (metres) the prepended travel move's "up, over, down"
 * waypoints keep above the table surface (`TOOLPATH_ANCHOR_OFFSET.y`, the
 * workbench's own world-space top height) while it traverses horizontally
 * between the parked pose and the toolpath's first point.
 *
 * Checkpoint follow-up: `UR3E_PARKED_POSE`'s own TCP sits roughly 0.18m
 * BELOW the table surface (it is parked beside/behind the rig, not on top
 * of it), so a single straight line from the parked pose to a point above
 * the toolpath's first point would still dip below table height while its
 * horizontal (X/Z) position is still over the table's footprint — a real,
 * visible clip through the workbench. This is a deliberately simple
 * "lift, traverse at height, descend" shape, not a full collision-avoidance
 * system (there is exactly one obstacle in this scene, the flat table) —
 * see `compileTrajectory`'s doc comment for the full waypoint sequence.
 */
export const TRAVEL_CLEARANCE_ABOVE_TABLE_M = 0.08

/**
 * How far (as a fraction from 0 to 1) the travel move's LIFT waypoint's
 * X/Z is blended from the parked pose's own X/Z toward the toolpath's
 * first point's X/Z, at clearance height. 0 would lift straight up from
 * the parked pose (empirically unreachable — see `compileTrajectory`'s doc
 * comment); 0.5 keeps the lift well within reach and its approach segment
 * clear of the table footprint for both bundled samples.
 */
export const TRAVEL_LIFT_INSET_FRACTION = 0.5

/** `'ready'` — every requested sample solved. `'frozen-at-unreachable'` —
 * the walk stopped at the first sample with no valid branch; `samples`
 * holds everything solved before that point (D-06). Never a substituted
 * approximate pose. */
export type TrajectoryStatus = 'ready' | 'frozen-at-unreachable'

/** One compiled point along the trajectory — either a prepended
 * home-to-toolpath-start TRAVEL sample or a toolpath sample proper (see
 * `compileTrajectory`'s doc comment for the two-phase scrubFraction
 * layout). Note: plan 03-02 adds a `singularityFlags` field — consumers
 * should not assume this shape is final within Phase 3. */
export interface TrajectorySample {
  /** Cumulative arc-length fraction in [0, 1] over the WHOLE compiled
   * path (travel move + toolpath combined), monotonically non-decreasing
   * across `CompiledTrajectory.samples`. 0 is always `UR3E_PARKED_POSE`'s
   * own TCP point; the toolpath's own first point lands at whatever
   * fraction the travel move's length works out to, exactly (never
   * approximately — see `compileTrajectory`); 1 is always the toolpath's
   * own last point. */
  scrubFraction: number
  /** The scene-space point this sample was solved against — the parked
   * pose's own TCP position, a point along the straight travel line, or a
   * toolpath point, depending on which phase this sample belongs to. */
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
 * Solves one task-space scene point into an in-limit, continuity-selected
 * joint tuple — the single per-point solve step both the prepended travel
 * move and the toolpath proper reuse, so there is exactly one place that
 * performs a scene-point IK solve (mirrors `sceneToDhFrame`/
 * `buildToolDownTarget` each having exactly one call site in spirit).
 * Returns `null` when no in-limit branch exists (D-06 — the caller freezes
 * the walk rather than substituting an approximate pose).
 */
function solvePointToJoints(
  point: readonly [number, number, number],
  railOffsetFromCenter: number,
  previousJoints: JointAngles,
): JointAngles | null {
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
  return pickClosestBranch(inLimit, previousJoints)
}

/**
 * Compiles a parsed toolpath into a scrubbable IK trajectory. Pure and
 * synchronous — never throws.
 *
 * The compiled sample array is TWO phases sharing one monotonic
 * `scrubFraction` range: a prepended TRAVEL move from `UR3E_PARKED_POSE`
 * (the robot's off-table idle stance) to the toolpath's own first point,
 * then the toolpath itself. This is scope added after this plan's original
 * "scrub fraction 0 is the toolpath's exact first point" must-have — the
 * revised meaning is "the END of the home-to-start travel move lands
 * exactly at the toolpath's first point", which the two-phase arc-length
 * walk below guarantees exactly (never approximately) via `pointAtFraction`'s
 * own exact-endpoint guarantee, applied independently to each phase's own
 * sub-path before the two fraction ranges are stitched together.
 *
 * The travel phase's own sub-path is FOUR waypoints, not a direct line —
 * a checkpoint follow-up fix for the arm visibly clipping through the
 * workbench on a direct parked-pose-to-first-point line (the parked pose
 * sits below table height, off to the side — see
 * `TRAVEL_CLEARANCE_ABOVE_TABLE_M`'s doc comment): the parked pose itself;
 * a LIFT waypoint at clearance height, horizontally inset partway toward
 * the toolpath's first point (never directly above the parked pose's own
 * X/Z — that was tried and rejected, see below); a point directly above
 * the toolpath's first point at that same clearance height (a horizontal
 * traverse that never drops below the clearance plane); then the
 * toolpath's first point itself (a straight vertical descent, arriving
 * from directly above the workpiece, never sideways through the table).
 * Every waypoint is still an independent point in the SAME
 * arc-length-parameterised straight-segment walk the rest of this function
 * already uses — no special-casing beyond the point list itself.
 *
 * Two things were tried and rejected for the LIFT waypoint before this one,
 * both empirically verified rather than assumed:
 *   - Lifting straight up from the parked pose's OWN X/Z pushed the target
 *     beyond the UR3e's ~0.5m reach (the parked pose already sits near the
 *     edge of reach at its own low height; adding height with the SAME
 *     horizontal radius increases total 3D distance past what is
 *     reachable) — `compileTrajectory` returned `frozen-at-unreachable`
 *     partway through the lift.
 *   - Going directly from the parked pose to a point above the first
 *     toolpath point (skipping a separate lift entirely) IS reachable, but
 *     an analytical check of where that line crosses table height shows
 *     the crossing X/Z lands inside the table's own footprint — verified
 *     against a synthetic check reproducing `Workbench.tsx`'s exact
 *     footprint derivation, which found real (if small, ~1cm) clipping
 *     samples for the real print sample.
 * `TRAVEL_LIFT_INSET_FRACTION` below (blending the lift waypoint's X/Z
 * partway from the parked pose toward the target) resolves both: closer to
 * the mount keeps it within reach, and the resulting diagonal segment's
 * table-height crossing lands outside the table's X span (verified the
 * same way).
 *
 * Anti-pattern this module must never adopt: sampling density comes from
 * solving MORE task-space points, never from blending two already-solved
 * joint tuples — a blended joint value traces a bowed path in task space
 * even when both endpoints are individually correct (03-RESEARCH.md
 * Pitfall 13). Every sample below (other than the literal, authored
 * `UR3E_PARKED_POSE` waypoint at scrub fraction 0) is an independent
 * `solveUR6IK` call against its own task-space point — the travel move is
 * real IK-solved samples along a straight line, never an interpolated
 * shortcut between two already-solved joint tuples (SIM-05).
 */
export function compileTrajectory(toolpath: ParsedToolpath): CompiledTrajectory {
  const points = flattenToolpathPoints(toolpath.segments)

  if (points.length < 2) {
    return { samples: [], railPos: RAIL_CENTER_X, status: 'ready', requestedSampleCount: 0 }
  }

  const toolpathTable = buildArcLengthTable(points)

  // One rail position for the whole toolpath, resolved once before any
  // solve runs (D-01) — derived from the WORK the operation performs, not
  // from the parking manoeuvre either side of it.
  const railPos = resolveRailPosition(points, ROBOT_MOUNT_WORLD)
  const railOffsetFromCenter = railPos - RAIL_CENTER_X

  // The parked pose's own task-space TCP position, at this same rail
  // offset — the straight-line travel move's start point. Computed via
  // `forwardKinematics` (never hand-derived), so this is a genuine FK
  // readout of a genuinely authored joint tuple, not a synthesised point.
  const homeTcpPoint = dhFrameToScene(
    forwardKinematics(UR3E_PARKED_POSE, railOffsetFromCenter).tcpPosition,
    ROBOT_MOUNT_WORLD,
  )

  // "Lift, traverse, descend" clearance height — comfortably above the
  // table surface AND above both the parked pose's own height and the
  // toolpath's first point's own height (relevant for a milling sample,
  // whose points can sit at a cut depth BELOW the table surface, so
  // clearance can never be derived from the first point alone).
  const clearanceY =
    Math.max(homeTcpPoint[1], points[0][1], TOOLPATH_ANCHOR_OFFSET.y) + TRAVEL_CLEARANCE_ABOVE_TABLE_M
  const liftPoint: [number, number, number] = [
    homeTcpPoint[0] + TRAVEL_LIFT_INSET_FRACTION * (points[0][0] - homeTcpPoint[0]),
    clearanceY,
    homeTcpPoint[2] + TRAVEL_LIFT_INSET_FRACTION * (points[0][2] - homeTcpPoint[2]),
  ]
  const aboveFirstPoint: [number, number, number] = [points[0][0], clearanceY, points[0][2]]

  const travelPoints: [number, number, number][] = [homeTcpPoint, liftPoint, aboveFirstPoint, points[0]]
  const travelTable = buildArcLengthTable(travelPoints)

  const toolpathRawSampleCount = Math.ceil(toolpathTable.totalLength / TRAJECTORY_SAMPLE_SPACING_M) + 1
  const toolpathSampleCount = Math.min(MAX_TRAJECTORY_SAMPLES, Math.max(2, toolpathRawSampleCount))

  const travelRawSampleCount = Math.ceil(travelTable.totalLength / TRAJECTORY_SAMPLE_SPACING_M) + 1
  const travelSampleCount = Math.min(MAX_TRAJECTORY_SAMPLES, Math.max(2, travelRawSampleCount))

  const travelLength = travelTable.totalLength
  const toolpathLength = toolpathTable.totalLength
  const totalLength = travelLength + toolpathLength
  // Degenerate guard only (never actually hit given the >=2-distinct-point
  // guard above, which lower-bounds toolpathLength): avoids a divide by
  // zero rather than assuming it can't happen.
  const safeTotalLength = totalLength > 1e-9 ? totalLength : 1

  const samples: TrajectorySample[] = []
  let previousJoints: JointAngles = UR3E_PARKED_POSE
  let status: TrajectoryStatus = 'ready'

  type Phase = { isTravel: boolean; pts: [number, number, number][]; table: ArcLengthTable; sampleCount: number }
  const phases: Phase[] = [
    { isTravel: true, pts: travelPoints, table: travelTable, sampleCount: travelSampleCount },
    { isTravel: false, pts: points, table: toolpathTable, sampleCount: toolpathSampleCount },
  ]

  walk: for (const phase of phases) {
    // The toolpath phase's own local index 0 is exactly the travel phase's
    // final point (both resolve to `points[0]`) — skip it so that shared
    // point is never solved (and never appears in `samples`) twice.
    const startIndex = phase.isTravel ? 0 : 1

    for (let i = startIndex; i < phase.sampleCount; i++) {
      const localFraction = i / (phase.sampleCount - 1)
      const point = pointAtFraction(phase.pts, phase.table, localFraction)

      let chosen: JointAngles | null
      if (phase.isTravel && i === 0) {
        // The literal authored parked pose — not IK-solved. A genuine,
        // independently-authored waypoint, not one derived by blending
        // (SIM-05); its FK still round-trips `point` exactly below.
        chosen = UR3E_PARKED_POSE
      } else {
        chosen = solvePointToJoints(point, railOffsetFromCenter, previousJoints)
      }

      if (!chosen) {
        // D-06: freeze at the last valid pose rather than substituting an
        // approximate one — never presented as a pose the robot actually
        // achieves.
        status = 'frozen-at-unreachable'
        break walk
      }

      const localArcLength = phase.isTravel ? localFraction * travelLength : travelLength + localFraction * toolpathLength
      const scrubFraction = localArcLength / safeTotalLength

      const tcpPosition = forwardKinematics(chosen, railOffsetFromCenter).tcpPosition

      samples.push({ scrubFraction, point, joints: chosen, railPos, tcpPosition })
      previousJoints = chosen
    }
  }

  const requestedSampleCount = travelSampleCount + toolpathSampleCount - 1

  return { samples, railPos, status, requestedSampleCount }
}
