// Reference values below come from `forwardKinematics`, which is already
// independently tested against a known reference pose
// (forward-kinematics.test.ts) — NEVER from `solveUR6IK`'s own output. A
// solver validated only against itself is the single easiest way to ship a
// confidently wrong kinematics module (see this file's port-note history in
// inverse-kinematics.ts).
import { describe, it, expect } from 'vitest'
import {
  solveUR6IK,
  buildToolDownTarget,
  validBranches,
  pickClosestBranch,
  jointSpaceDistance,
} from './inverse-kinematics'
import { forwardKinematics, isWithinJointLimits } from './forward-kinematics'
import { UR3E_HOME_POSE, UR3E_READY_POSE, UR3E_PARKED_POSE, type JointAngles } from './ur3e-dh'
import { ROBOT_MOUNT_WORLD, TOOLPATH_ANCHOR_OFFSET } from '../gcode/toolpath-anchor'
import { sceneToDhFrame } from '../trajectory/compile'

describe('solveUR6IK — round trip against forwardKinematics', () => {
  const posesToTest: { name: string; pose: JointAngles }[] = [
    { name: 'home pose', pose: UR3E_HOME_POSE },
    { name: 'ready pose', pose: UR3E_READY_POSE },
    { name: 'arbitrary pose', pose: [0.3, -0.9, 1.1, -1.4, 0.8, 0.5] },
    // Deliberately near-singular: wrist_2 (index 4) at zero is the
    // wrist-singularity candidate PITFALLS.md Pitfall 2 requires.
    { name: 'near-singular pose (wrist_2 = 0)', pose: [0.2, -1.0, 0.6, -0.9, 0, 0.4] },
  ]

  for (const { name, pose } of posesToTest) {
    it(`reproduces the TCP position for the ${name}`, () => {
      const target = forwardKinematics(pose)
      const candidates = solveUR6IK(target.matrix)
      const valid = validBranches(candidates)
      expect(valid.length).toBeGreaterThan(0)

      // Assert against the POSE (TCP position), not the joint tuple:
      // several distinct branches are genuinely correct answers for the
      // same target, so asserting joint equality would fail on a correct
      // solver.
      const chosen = pickClosestBranch(valid, pose)
      expect(chosen).not.toBeNull()

      const resultFk = forwardKinematics(chosen as JointAngles)
      expect(resultFk.tcpPosition.x).toBeCloseTo(target.tcpPosition.x, 5)
      expect(resultFk.tcpPosition.y).toBeCloseTo(target.tcpPosition.y, 5)
      expect(resultFk.tcpPosition.z).toBeCloseTo(target.tcpPosition.z, 5)
    })
  }

  it('returns multiple, bounded branches for a mid-workspace pose, all finite and normalised', () => {
    const pose: JointAngles = [0.3, -0.9, 1.1, -1.4, 0.8, 0.5]
    const target = forwardKinematics(pose)
    const candidates = solveUR6IK(target.matrix)

    expect(candidates.length).toBeGreaterThan(1)
    expect(candidates.length).toBeLessThanOrEqual(8)

    for (const candidate of candidates) {
      for (const angle of candidate) {
        expect(Number.isFinite(angle)).toBe(true)
        expect(angle).toBeGreaterThan(-Math.PI)
        expect(angle).toBeLessThanOrEqual(Math.PI)
      }
    }
  })
})

describe('pickClosestBranch — continuity along a line of tool-down targets', () => {
  it('keeps adjacent joint-space steps small when the nearest branch is chosen, and proves the rule does work', () => {
    // A line of closely spaced tool-down targets in the same world-space
    // region the bundled samples occupy (validated reachable this planning
    // session — 03-01-PLAN.md "Verified IK port contract").
    const stepCount = 40
    const halfSpan = 0.05 // 100mm line, within the validated 150mm span
    const scenePoints: [number, number, number][] = []
    for (let i = 0; i < stepCount; i++) {
      const t = i / (stepCount - 1)
      const x = TOOLPATH_ANCHOR_OFFSET.x - halfSpan + t * (2 * halfSpan)
      scenePoints.push([x, TOOLPATH_ANCHOR_OFFSET.y, TOOLPATH_ANCHOR_OFFSET.z])
    }

    const solveAt = (point: [number, number, number]): JointAngles[] => {
      const dh = sceneToDhFrame(point, ROBOT_MOUNT_WORLD)
      const target = buildToolDownTarget(dh)
      return validBranches(solveUR6IK(target))
    }

    // Seed from UR3E_READY_POSE (matching D-03's real seeding rule), but
    // measure the "adjacent steps stay small" claim only from the SECOND
    // point onward — the ready-pose-to-first-sample transition is a
    // documented, expected one-time large jump (03-01-PLAN.md: "the ready
    // pose parks the arm in the air and the first toolpath point is on the
    // workbench, so loading a sample legitimately moves the arm a long way
    // once... not a mid-scrub snap"), not part of this test's claim about
    // ADJACENT in-sequence steps.
    let previous: JointAngles = UR3E_READY_POSE
    let maxStep = 0
    scenePoints.forEach((point, i) => {
      const candidates = solveAt(point)
      expect(candidates.length).toBeGreaterThan(0)
      const chosen = pickClosestBranch(candidates, previous) as JointAngles
      expect(chosen).not.toBeNull()
      if (i > 0) {
        maxStep = Math.max(maxStep, jointSpaceDistance(chosen, previous))
      }
      previous = chosen
    })

    // Generous bound given the planner's own measured worst case of
    // 0.035 rad over a denser 160-sample path — fails loudly if branch
    // selection is dropped or inverted.
    expect(maxStep).toBeLessThan(0.2)

    // Negative control: choosing an ARBITRARY (non-nearest) branch at each
    // step must produce a larger max step for the same target sequence,
    // proving the continuity rule is doing real work rather than merely
    // passing by coincidence. Same exclusion of the first (seed) transition.
    let previousArbitrary: JointAngles = UR3E_READY_POSE
    let maxStepArbitrary = 0
    scenePoints.forEach((point, i) => {
      const candidates = solveAt(point)
      const arbitrary = candidates[candidates.length - 1]
      if (i > 0) {
        maxStepArbitrary = Math.max(maxStepArbitrary, jointSpaceDistance(arbitrary, previousArbitrary))
      }
      previousArbitrary = arbitrary
    })

    expect(maxStepArbitrary).toBeGreaterThan(maxStep)
  })
})

describe('validBranches', () => {
  it('keeps only the in-range candidate when one violates the elbow limit', () => {
    const inRange: JointAngles = [0, 0, 1, 0, 0, 0]
    const outOfRange: JointAngles = [0, 0, 3.5, 0, 0, 0] // elbow limit is +/- pi
    const result = validBranches([inRange, outOfRange])
    expect(result).toEqual([inRange])
  })

  it('drops candidates carrying NaN or Infinity', () => {
    const withNaN: JointAngles = [NaN, 0, 0, 0, 0, 0]
    const withInfinity: JointAngles = [0, 0, 0, 0, Infinity, 0]
    const valid: JointAngles = [0, 0, 0, 0, 0, 0]
    const result = validBranches([withNaN, withInfinity, valid])
    expect(result).toEqual([valid])
  })
})

describe('pickClosestBranch', () => {
  it('returns null for an empty candidate list', () => {
    expect(pickClosestBranch([], UR3E_HOME_POSE)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// UAT regression (debug session `table-clipping-singularities`). `solveUR6IK`
// normalises every branch into (-pi, pi]. A joint that crosses that boundary
// between two adjacent 2mm-apart samples therefore comes back ~2pi away in
// RAW value while being physically ~0 away — and raw-subtraction scoring then
// prefers a completely different arm configuration. Measured on the real print
// sample: the physically-identical branch scored 6.2761 raw (0.0103 shortest-
// path) and lost to a full reconfiguration scoring 5.1713, which whipped the
// arm and dropped its elbow to 8mm from the tabletop.
// ---------------------------------------------------------------------------
describe('pickClosestBranch — 2*pi wrap must not be mistaken for real motion', () => {
  it('prefers the physically-adjacent branch over a nearer-in-raw-value reconfiguration', () => {
    // wrist_3 sits just under +pi; the continuation just over +pi comes back
    // normalised to just over -pi.
    const previous: JointAngles = [0, -1, 1, -1, -1, 3.14]
    const wrapped: JointAngles = [0, -1, 1, -1, -1, -3.14] // 0.0032 rad away, physically
    const reconfiguration: JointAngles = [0.5, -0.5, 0.5, -0.5, -0.5, 0.5]

    // Establishes the trap this test exists for: raw subtraction really does
    // rank the reconfiguration ahead of the physically-adjacent branch.
    expect(jointSpaceDistance(wrapped, previous)).toBeGreaterThan(
      jointSpaceDistance(reconfiguration, previous),
    )

    const chosen = pickClosestBranch([reconfiguration, wrapped], previous) as JointAngles
    expect(chosen).not.toBeNull()

    // Every joint must land within a hair of `previous` — i.e. the wrapped
    // branch won, and was returned in the revolution that keeps the stored
    // value continuous (so a joint-velocity readout can't see a 2*pi spike).
    chosen.forEach((angle, i) => {
      expect(Math.abs(angle - previous[i])).toBeLessThan(0.01)
    })
  })

  it('returns a pose physically identical to the candidate it selected', () => {
    const previous: JointAngles = [0, -1, 1, -1, -1, 3.14]
    const wrapped: JointAngles = [0, -1, 1, -1, -1, -3.14]

    const chosen = pickClosestBranch([wrapped], previous) as JointAngles
    const chosenTcp = forwardKinematics(chosen).tcpPosition
    const candidateTcp = forwardKinematics(wrapped).tcpPosition

    // Re-expressing an angle by a whole number of turns cannot move the arm.
    expect(chosenTcp.x).toBeCloseTo(candidateTcp.x, 12)
    expect(chosenTcp.y).toBeCloseTo(candidateTcp.y, 12)
    expect(chosenTcp.z).toBeCloseTo(candidateTcp.z, 12)
    expect(isWithinJointLimits(chosen)).toBe(true)
  })

  it('never unwraps a joint out of its own travel limit', () => {
    // The elbow (index 2) is limited to +/- pi, unlike the other five joints'
    // +/- 2pi — so the continuous continuation past +pi is genuinely
    // unreachable and must NOT be manufactured. Boundary neighbour of the
    // case above, where unwrapping IS legal.
    const previous: JointAngles = [0, 0, 3.1, 0, 0, 0]
    const wrapped: JointAngles = [0, 0, -3.1, 0, 0, 0] // unwrapping -> 3.183 > pi

    const chosen = pickClosestBranch([wrapped], previous) as JointAngles
    expect(isWithinJointLimits(chosen)).toBe(true)
    expect(chosen[2]).toBeCloseTo(-3.1, 12)
  })
})

describe('UR3E_PARKED_POSE — must hold the same tool-down orientation every solved sample uses', () => {
  it('has a flange orientation matching buildToolDownTarget', () => {
    // `compileTrajectory` emits this authored pose VERBATIM as scrub-fraction-0
    // (it is also `RobotModel.tsx`'s static stance), while every subsequent
    // sample is solved against `buildToolDownTarget`'s fixed orientation. If
    // the two disagree, the very first scrub step has to rotate the wrist to
    // make up the difference — measured at 1.5732 rad over 1.2mm of travel
    // before this was fixed.
    const { matrix } = forwardKinematics(UR3E_PARKED_POSE)
    const toolDown = buildToolDownTarget(forwardKinematics(UR3E_PARKED_POSE).tcpPosition)

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(matrix[row][col]).toBeCloseTo(toolDown[row][col], 9)
      }
    }
  })
})
