// Reference behaviour below is pinned against this project's OWN empirical
// finding (see `urdf-joint-mapping.ts`'s header comment): reading the live
// Three.js scene graph's world matrices for a real compiled trajectory
// sample showed the rendered flange 180 degrees around the vertical axis
// from the intended point, and the shipped URDF's own inline comment on the
// `base_link-base_link_inertia` joint (`public/robots/ur3e/ur3e.urdf`)
// independently documents the exact same 180-degree-about-Z divergence —
// two independent sources agreeing, never the module's own output used as
// its own reference.
import { describe, it, expect } from 'vitest'
import { toUrdfJointAngles, URDF_SHOULDER_PAN_OFFSET } from './urdf-joint-mapping'
import { UR3E_HOME_POSE, UR3E_READY_POSE, type JointAngles } from './ur3e-dh'

describe('toUrdfJointAngles', () => {
  it('offsets only shoulder_pan (joint index 0) by pi, leaving joints 1-5 untouched', () => {
    const joints: JointAngles = [0.3, -0.9, 1.1, -1.4, 0.8, 0.5]
    const urdf = toUrdfJointAngles(joints)
    expect(urdf[1]).toBe(joints[1])
    expect(urdf[2]).toBe(joints[2])
    expect(urdf[3]).toBe(joints[3])
    expect(urdf[4]).toBe(joints[4])
    expect(urdf[5]).toBe(joints[5])
  })

  it('adds exactly URDF_SHOULDER_PAN_OFFSET (pi) to shoulder_pan before normalisation', () => {
    // A small negative joints[0] value stays within (-pi, pi] after adding
    // pi, so no wraparound occurs and the raw addition is directly
    // observable.
    const joints: JointAngles = [-0.1, 0, 0, 0, 0, 0]
    const urdf = toUrdfJointAngles(joints)
    expect(URDF_SHOULDER_PAN_OFFSET).toBeCloseTo(Math.PI, 10)
    expect(urdf[0]).toBeCloseTo(-0.1 + Math.PI, 10)
  })

  it('normalises the offset shoulder_pan value into (-pi, pi], never leaking outside URDF limits', () => {
    // joints[0] near +pi: +pi pushes it to ~2*pi, which must wrap back down
    // rather than exceed the joint's declared travel.
    const joints: JointAngles = [Math.PI - 0.05, 0, 0, 0, 0, 0]
    const urdf = toUrdfJointAngles(joints)
    expect(urdf[0]).toBeGreaterThan(-Math.PI)
    expect(urdf[0]).toBeLessThanOrEqual(Math.PI)
    // (pi - 0.05) + pi = 2*pi - 0.05, which wraps to -0.05.
    expect(urdf[0]).toBeCloseTo(-0.05, 10)
  })

  it('applied twice is the identity modulo 2*pi (offsetting is its own involution)', () => {
    const joints: JointAngles = [1.2, -0.4, 0.6, -0.2, 1.0, -1.1]
    const twice = toUrdfJointAngles(toUrdfJointAngles(joints))
    for (let i = 0; i < 6; i++) {
      // atan2/sin-cos round trip avoids a raw modulo comparison at the
      // (-pi, pi] boundary.
      expect(Math.sin(twice[i])).toBeCloseTo(Math.sin(joints[i]), 9)
      expect(Math.cos(twice[i])).toBeCloseTo(Math.cos(joints[i]), 9)
    }
  })

  it('leaves the home pose (all-zero) and ready pose shapes intact aside from joint 0', () => {
    const urdfHome = toUrdfJointAngles(UR3E_HOME_POSE)
    expect(urdfHome[0]).toBeCloseTo(Math.PI, 10)
    expect(urdfHome.slice(1)).toEqual(UR3E_HOME_POSE.slice(1))

    const urdfReady = toUrdfJointAngles(UR3E_READY_POSE)
    expect(urdfReady.slice(1)).toEqual(UR3E_READY_POSE.slice(1))
  })
})
