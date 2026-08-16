// U-2: mirrors singularity.test.ts's own discipline: pure module, no
// rendering, reference values derived from the real forward-kinematics/
// scene-composition modules rather than hand-guessed. Every collision-case
// joint tuple below was located by scanning the real `classifyPoseCollision`
// output (not asserted from an assumed geometric intuition), so each test
// exercises a genuinely intruding (or genuinely clear) configuration.
import { describe, it, expect } from 'vitest'
import {
  poseKeypointsWorld,
  classifyPoseCollision,
  COLLISION_LINK_SUBDIVISIONS,
} from './pose-collision'
import {
  UR3E_PARKED_POSE,
  UR3E_READY_POSE,
  RAIL_CENTER_X,
  RAIL_TRAVEL,
  railStartXForMode,
  type JointAngles,
} from '../kinematics'

describe('poseKeypointsWorld', () => {
  it('returns exactly 5 * COLLISION_LINK_SUBDIVISIONS + 1 points', () => {
    const points = poseKeypointsWorld(UR3E_PARKED_POSE, RAIL_CENTER_X)
    expect(points.length).toBe(5 * COLLISION_LINK_SUBDIVISIONS + 1)
  })

  it("frame 1's own world origin is invariant across wildly different joint tuples at a fixed rail position", () => {
    const a = poseKeypointsWorld(UR3E_PARKED_POSE, RAIL_CENTER_X)
    const b = poseKeypointsWorld(UR3E_READY_POSE, RAIL_CENTER_X)
    const c = poseKeypointsWorld([1.2, -2.1, 0.4, 3.0, -1.5, 0.9] as JointAngles, RAIL_CENTER_X)
    expect(a[0]).toEqual(b[0])
    expect(a[0]).toEqual(c[0])
  })

  it("frame 1's world origin shifts by exactly the rail delta when the rail moves", () => {
    const atCenter = poseKeypointsWorld(UR3E_PARKED_POSE, RAIL_CENTER_X)
    const shifted = poseKeypointsWorld(UR3E_PARKED_POSE, RAIL_CENTER_X + 0.4)
    expect(shifted[0][0] - atCenter[0][0]).toBeCloseTo(0.4, 9)
    expect(shifted[0][1]).toBeCloseTo(atCenter[0][1], 9)
    expect(shifted[0][2]).toBeCloseTo(atCenter[0][2], 9)
  })

  it('frame 6 of UR3E_READY_POSE at RAIL_CENTER_X lands at the documented world anchor to 4dp', () => {
    const points = poseKeypointsWorld(UR3E_READY_POSE, RAIL_CENTER_X)
    const frame6 = points[points.length - 1]
    expect(frame6[0]).toBeCloseTo(-0.1839, 4)
    expect(frame6[1]).toBeCloseTo(0.8263, 4)
    expect(frame6[2]).toBeCloseTo(0.631, 4)
  })
})

describe('classifyPoseCollision: UR3E_PARKED_POSE is the collision-free seed pose', () => {
  it('is collision-free at RAIL_CENTER_X', () => {
    const flags = classifyPoseCollision(UR3E_PARKED_POSE, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags).toEqual({ floor: false, workbench: false, rig: false, any: false })
  })

  it('is collision-free at railStartXForMode("printing")', () => {
    const railPos = railStartXForMode('printing')
    const flags = classifyPoseCollision(UR3E_PARKED_POSE, railPos, railPos)
    expect(flags.any).toBe(false)
  })

  it('is collision-free at railStartXForMode("milling")', () => {
    const railPos = railStartXForMode('milling')
    const flags = classifyPoseCollision(UR3E_PARKED_POSE, railPos, railPos)
    expect(flags.any).toBe(false)
  })

  it('is collision-free at RAIL_TRAVEL.max', () => {
    const flags = classifyPoseCollision(UR3E_PARKED_POSE, RAIL_TRAVEL.max, RAIL_TRAVEL.max)
    expect(flags.any).toBe(false)
  })
})

describe('classifyPoseCollision: floor', () => {
  it('reports floor: true for a pose whose keypoints drop below the floor plane', () => {
    const joints: JointAngles = [0, Math.PI / 2, -0.05, 0, 0, 0]
    const flags = classifyPoseCollision(joints, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags.floor).toBe(true)
  })

  it('a clean pose is floor: false', () => {
    const flags = classifyPoseCollision(UR3E_PARKED_POSE, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags.floor).toBe(false)
  })
})

describe('classifyPoseCollision: workbench', () => {
  const intrudingPose: JointAngles = [0, -Math.PI / 4, Math.PI / 2, 0, 0, 0]
  // Same shoulder_lift, a shallower elbow bend — keeps the same reaching
  // shape but stops short of dipping through the bench surface.
  const liftedPose: JointAngles = [0, -Math.PI / 4, 1.4, 0, 0, 0]

  it('reports workbench: true for a pose whose keypoints enter the bench footprint below its top surface', () => {
    const flags = classifyPoseCollision(intrudingPose, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags.workbench).toBe(true)
  })

  it('the same reaching shape lifted (shallower elbow bend) above WORKBENCH_TOP_Y is workbench: false', () => {
    const flags = classifyPoseCollision(liftedPose, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags.workbench).toBe(false)
  })
})

describe('classifyPoseCollision: rig', () => {
  it('reports rig: true for a pose whose keypoints enter the carriage/rail-track/end-stop envelope', () => {
    const joints: JointAngles = [0, 0.61, -0.2, 0, 0, 0]
    const flags = classifyPoseCollision(joints, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags.rig).toBe(true)
    expect(flags.floor).toBe(false)
  })

  it('a clean pose is rig: false', () => {
    const flags = classifyPoseCollision(UR3E_PARKED_POSE, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(flags.rig).toBe(false)
  })
})

describe('classifyPoseCollision: any', () => {
  it('is the OR of floor, workbench, and rig, mirroring SingularityFlags.any', () => {
    const clean = classifyPoseCollision(UR3E_PARKED_POSE, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(clean.any).toBe(clean.floor || clean.workbench || clean.rig)
    expect(clean.any).toBe(false)

    const dirty = classifyPoseCollision(
      [0, Math.PI / 2, -0.05, 0, 0, 0] as JointAngles,
      RAIL_CENTER_X,
      RAIL_CENTER_X,
    )
    expect(dirty.any).toBe(dirty.floor || dirty.workbench || dirty.rig)
    expect(dirty.any).toBe(true)
  })
})
