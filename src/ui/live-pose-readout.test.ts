// Quick 260817-jfy (Task 1, TDD): coverage for `livePoseJoints` /
// `livePoseJointDegrees`. Trajectory fixtures are minimal object literals
// satisfying only the fields `sampleAtFraction` and `livePoseJoints` touch,
// matching `sample-lookup.test.ts`'s own fixture-building convention in
// this repo. Mid-fraction assertions are checked against a direct
// `sampleAtFraction` call rather than a re-derived expected value, so the
// two functions can never silently disagree.
import { describe, it, expect } from 'vitest'
import { livePoseJoints, livePoseJointDegrees, type LivePoseReadoutState } from './live-pose-readout'
import { sampleAtFraction } from '../trajectory/sample-lookup'
import { UR3E_PARKED_POSE, type JointAngles } from '../kinematics'
import { toDegrees } from './manual-jog'
import type { CompiledTrajectory, TrajectorySample } from '../trajectory/compile'

function buildSample(scrubFraction: number, joints: JointAngles): TrajectorySample {
  return {
    scrubFraction,
    point: [0, 0, 0],
    joints,
    railPos: 0.25,
    tcpPosition: { x: 0, y: 0, z: 0 },
    singularityFlags: { wrist: false, shoulder: false, elbow: false, any: false },
  }
}

function buildTrajectory(samples: TrajectorySample[]): CompiledTrajectory {
  return {
    samples,
    railPos: 0.25,
    status: 'ready',
    requestedSampleCount: samples.length,
    travelLength: 0,
    toolpathLength: 0,
  }
}

const MANUAL_JOINTS: JointAngles = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
const FIRST_JOINTS: JointAngles = [0, 0, 0, 0, 0, 0]
const LAST_JOINTS: JointAngles = [1, 2, 3, 4, 5, 6]

const twoSampleTrajectory = buildTrajectory([buildSample(0, FIRST_JOINTS), buildSample(1, LAST_JOINTS)])

describe('livePoseJoints — manual override wins', () => {
  it('returns the manualJog joints when manualJog is non-null, even with a non-empty trajectory present', () => {
    const state: LivePoseReadoutState = {
      manualJog: { joints: MANUAL_JOINTS, railPos: 0.5 },
      trajectory: twoSampleTrajectory,
      lastRailPos: 0,
      scrubFraction: 0.5,
    }
    expect(livePoseJoints(state)).toEqual(MANUAL_JOINTS)
  })
})

describe('livePoseJoints — trajectory sample, manualJog null', () => {
  it('at scrubFraction 0 returns the first sample joints exactly', () => {
    const state: LivePoseReadoutState = {
      manualJog: null,
      trajectory: twoSampleTrajectory,
      lastRailPos: 0,
      scrubFraction: 0,
    }
    expect(livePoseJoints(state)).toEqual(FIRST_JOINTS)
  })

  it('at scrubFraction 1 returns the last sample joints exactly', () => {
    const state: LivePoseReadoutState = {
      manualJog: null,
      trajectory: twoSampleTrajectory,
      lastRailPos: 0,
      scrubFraction: 1,
    }
    expect(livePoseJoints(state)).toEqual(LAST_JOINTS)
  })

  it('at a mid fraction returns exactly what sampleAtFraction itself returns, never a re-derived expectation', () => {
    const state: LivePoseReadoutState = {
      manualJog: null,
      trajectory: twoSampleTrajectory,
      lastRailPos: 0,
      scrubFraction: 0.37,
    }
    const expected = sampleAtFraction(twoSampleTrajectory, 0.37)!.joints
    expect(livePoseJoints(state)).toEqual(expected)
  })
})

describe('livePoseJoints — parked-pose fallback', () => {
  it('returns UR3E_PARKED_POSE when manualJog is null and trajectory is null', () => {
    const state: LivePoseReadoutState = {
      manualJog: null,
      trajectory: null,
      lastRailPos: 0,
      scrubFraction: 0.5,
    }
    expect(livePoseJoints(state)).toEqual(UR3E_PARKED_POSE)
  })

  it('returns UR3E_PARKED_POSE and does not throw when manualJog is null and trajectory.samples is empty', () => {
    const state: LivePoseReadoutState = {
      manualJog: null,
      trajectory: buildTrajectory([]),
      lastRailPos: 0,
      scrubFraction: 0.5,
    }
    expect(() => livePoseJoints(state)).not.toThrow()
    expect(livePoseJoints(state)).toEqual(UR3E_PARKED_POSE)
  })

  it('covers all six joint indices for the parked-pose case, so an index-mapping slip cannot pass', () => {
    const state: LivePoseReadoutState = {
      manualJog: null,
      trajectory: null,
      lastRailPos: 0,
      scrubFraction: 0,
    }
    for (let i = 0; i < 6; i++) {
      expect(livePoseJointDegrees(state, i)).toBeCloseTo(toDegrees(UR3E_PARKED_POSE[i]), 9)
    }
  })
})

describe('livePoseJointDegrees', () => {
  it('converts the selected joint radians value to degrees via toDegrees', () => {
    const state: LivePoseReadoutState = {
      manualJog: { joints: MANUAL_JOINTS, railPos: 0 },
      trajectory: null,
      lastRailPos: 0,
      scrubFraction: 0,
    }
    for (let i = 0; i < 6; i++) {
      expect(livePoseJointDegrees(state, i)).toBeCloseTo(toDegrees(MANUAL_JOINTS[i]), 9)
    }
  })
})
