// Reference joint tuples below were derived numerically against this
// module's own `forwardKinematics` chain (never hand-guessed), so each test
// exercises a genuinely singular (or genuinely clear) configuration rather
// than an assumed one. See `classifySingularity`'s own doc comment for why
// the shoulder family compares distance against its floor (the joint-4
// offset), not against zero.
import { describe, it, expect } from 'vitest'
import { classifySingularity, SINGULARITY_ANGLE_EPSILON, SINGULARITY_DISTANCE_EPSILON } from './singularity'
import { UR3E_READY_POSE, type JointAngles } from './ur3e-dh'

describe('classifySingularity', () => {
  it('flags wrist when joint 5 sits at zero (joints 4 and 6 axes collinear)', () => {
    const joints: JointAngles = [0.2, -0.5, 0.8, 0.3, 0, 1.0]
    const flags = classifySingularity(joints)
    expect(flags.wrist).toBe(true)
    expect(flags.elbow).toBe(false)
    expect(flags.shoulder).toBe(false)
    expect(flags.any).toBe(true)
  })

  it('flags wrist when joint 5 sits at +/- pi (joints 4 and 6 axes collinear, mirror branch)', () => {
    // Same joint tuple as the "joint 5 sits at zero" case above, with only
    // theta5 swapped to the mirror-branch value — theta1-4 (and therefore
    // the wrist-centre position / elbow angle) are unchanged, so shoulder
    // and elbow are expected to stay false exactly as in that case.
    const joints: JointAngles = [0.2, -0.5, 0.8, 0.3, Math.PI, 1.0]
    const flags = classifySingularity(joints)
    expect(flags.wrist).toBe(true)
    expect(flags.elbow).toBe(false)
    expect(flags.shoulder).toBe(false)
    expect(flags.any).toBe(true)
  })

  it('flags elbow when joint 3 sits at zero (arm fully extended)', () => {
    const joints: JointAngles = [0.1, -0.6, 0.001, 0.4, 0.6, 0.2]
    const flags = classifySingularity(joints)
    expect(flags.elbow).toBe(true)
    expect(flags.wrist).toBe(false)
    expect(flags.shoulder).toBe(false)
    expect(flags.any).toBe(true)
  })

  it('flags shoulder when the wrist centre sits at its minimum possible distance from the joint-1 axis', () => {
    // Numerically located: this joint tuple drives the wrist centre's
    // planar distance from the joint-1 axis down to the joint-4 offset
    // (~0.13105m) — the chain's own floor for that distance, and per
    // `classifySingularity`'s doc comment, the true shoulder-singular locus
    // for a non-spherical-wrist arm.
    const joints: JointAngles = [0.4, -1.17659, -3.08159, 0.2, 0.3, 0.1]
    const flags = classifySingularity(joints)
    expect(flags.shoulder).toBe(true)
    expect(flags.wrist).toBe(false)
    expect(flags.any).toBe(true)
  })

  it('flags nothing for a clearly non-singular control pose', () => {
    const flags = classifySingularity(UR3E_READY_POSE)
    expect(flags.wrist).toBe(false)
    expect(flags.shoulder).toBe(false)
    expect(flags.elbow).toBe(false)
    expect(flags.any).toBe(false)
  })

  it('is a pure function: the same joint tuple always produces the same flags', () => {
    const joints: JointAngles = [0.2, -0.5, 0.8, 0.3, 0, 1.0]
    expect(classifySingularity(joints)).toEqual(classifySingularity(joints))
  })

  it('the epsilon constants are both small, chosen heuristic values, not zero', () => {
    expect(SINGULARITY_ANGLE_EPSILON).toBeGreaterThan(0)
    expect(SINGULARITY_DISTANCE_EPSILON).toBeGreaterThan(0)
  })
})
