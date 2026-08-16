// U-1, U-3: TDD — validateManualPose composes classifySingularity (Phase 3,
// existing) and classifyPoseCollision (this plan's Task 2) into the single
// verdict the manual-jog commit path gates on.
import { describe, it, expect } from 'vitest'
import { validateManualPose, MANUAL_POSE_REJECTION_COPY, type ManualPoseRejectionReason } from './manual-pose-safety'
import {
  UR3E_PARKED_POSE,
  RAIL_CENTER_X,
  UR3E_JOINT_LIMITS,
  railStartXForMode,
  type JointAngles,
} from '../kinematics'

describe('validateManualPose', () => {
  it('returns ok: true, reason: null, message: null for a non-singular, collision-free pose', () => {
    const verdict = validateManualPose(UR3E_PARKED_POSE, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(verdict).toEqual({ ok: true, reason: null, message: null })
  })

  it('returns ok: false with the elbow reason for a pose with classifySingularity(...).elbow', () => {
    // theta3 (index 2) near zero -> elbow singularity (classifySingularity's
    // own documented condition), while wrist (theta5=index4) and shoulder
    // stay clear.
    const joints: JointAngles = [0.1, -0.6, 0.001, 0.4, 0.6, 0.2]
    const verdict = validateManualPose(joints, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('singular-elbow')
    expect(verdict.message).toBe(MANUAL_POSE_REJECTION_COPY['singular-elbow'])
  })

  it('reports the SINGULARITY reason (not collision) for a pose that is both singular and colliding', () => {
    // theta5 (index 4) = 0 -> wrist singular; this same tuple was verified
    // (Task 2's exploration) to also intrude the floor/rig envelope.
    const joints: JointAngles = [0, Math.PI / 2, -0.05, 0, 0, 0]
    const verdict = validateManualPose(joints, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('singular-wrist')
  })

  it('every reason code has non-empty copy, and no two reason codes share the same string', () => {
    const reasons = Object.keys(MANUAL_POSE_REJECTION_COPY) as ManualPoseRejectionReason[]
    const messages = reasons.map((reason) => MANUAL_POSE_REJECTION_COPY[reason])
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0)
    }
    expect(new Set(messages).size).toBe(messages.length)
  })

  it('UR3E_PARKED_POSE at every mode station returns ok: true', () => {
    for (const railPos of [RAIL_CENTER_X, railStartXForMode('printing'), railStartXForMode('milling')]) {
      const verdict = validateManualPose(UR3E_PARKED_POSE, railPos, railPos)
      expect(verdict.ok).toBe(true)
    }
  })

  it("an elbow angle of exactly UR3E_JOINT_LIMITS[2].max (= pi) returns ok: false — the elbow's own travel limit IS the elbow singularity", () => {
    expect(UR3E_JOINT_LIMITS[2].max).toBeCloseTo(Math.PI, 9)
    // wrist_2 (index 4) held clear of both wrist-singular branches (0 and
    // +/-pi). Note: a fully-folded elbow (theta3 = pi) also drives the
    // wrist centre's planar distance from the joint-1 axis to its own
    // floor (verified numerically) — a real geometric coupling in this DH
    // chain, not a test artifact — so this pose is reported via whichever
    // of shoulder/elbow the fixed wrist->shoulder->elbow precedence reaches
    // first. The plan's own must-have is ok: false, not a specific reason.
    const joints: JointAngles = [0, -0.5, UR3E_JOINT_LIMITS[2].max, 0, 0.6, 0]
    const verdict = validateManualPose(joints, RAIL_CENTER_X, RAIL_CENTER_X)
    expect(verdict.ok).toBe(false)
    expect(['singular-shoulder', 'singular-elbow']).toContain(verdict.reason)
  })
})
