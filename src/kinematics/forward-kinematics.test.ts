// Pitfall 1 (PITFALLS.md) — mandatory reference-pose test.
// Reference values below are typed in from 01-RESEARCH.md's independently
// cross-verified DH table + tool-computed home-pose matrix (verified against
// both Universal Robots' official DH page and the flattened UR3e URDF's
// joint origin offsets). They are NEVER derived from this module's own
// output — that would make the test self-confirming (see T-01-06).
import { describe, it, expect } from 'vitest';
import { forwardKinematics, isWithinJointLimits } from './forward-kinematics';
import { UR3E_HOME_POSE, UR3E_READY_POSE, type JointAngles } from './ur3e-dh';
import { RAIL_TRAVEL } from './rail';

describe('forwardKinematics', () => {
  it('matches the known home-pose (all-zero joints) TCP position', () => {
    const T = forwardKinematics(UR3E_HOME_POSE);
    expect(T.tcpPosition.x).toBeCloseTo(-0.45675, 5);
    expect(T.tcpPosition.y).toBeCloseTo(-0.22315, 5);
    expect(T.tcpPosition.z).toBeCloseTo(0.0665, 5);
  });

  it('matches the known home-pose base-to-flange rotation submatrix', () => {
    const T = forwardKinematics(UR3E_HOME_POSE);
    // RESEARCH.md-published home matrix rotation rows:
    // [1, 0, 0]
    // [0, 0, -1]
    // [0, 1, 0]
    expect(T.matrix[0][0]).toBeCloseTo(1, 5);
    expect(T.matrix[0][1]).toBeCloseTo(0, 5);
    expect(T.matrix[0][2]).toBeCloseTo(0, 5);
    expect(T.matrix[1][0]).toBeCloseTo(0, 5);
    expect(T.matrix[1][1]).toBeCloseTo(0, 5);
    expect(T.matrix[1][2]).toBeCloseTo(-1, 5);
    expect(T.matrix[2][0]).toBeCloseTo(0, 5);
    expect(T.matrix[2][1]).toBeCloseTo(1, 5);
    expect(T.matrix[2][2]).toBeCloseTo(0, 5);
  });

  it('enters the rail position as a pure prepended translation along x', () => {
    const home = forwardKinematics(UR3E_HOME_POSE);
    const railed = forwardKinematics(UR3E_HOME_POSE, 0.75);
    expect(railed.tcpPosition.x).toBeCloseTo(home.tcpPosition.x + 0.75, 5);
    expect(railed.tcpPosition.y).toBeCloseTo(home.tcpPosition.y, 5);
    expect(railed.tcpPosition.z).toBeCloseTo(home.tcpPosition.z, 5);
  });

  it('returns exactly 6 cumulative joint frames, the last matching tcpPosition', () => {
    const T = forwardKinematics(UR3E_HOME_POSE);
    expect(T.frames).toHaveLength(6);
    const last = T.frames[5];
    expect(last[0][3]).toBeCloseTo(T.tcpPosition.x, 5);
    expect(last[1][3]).toBeCloseTo(T.tcpPosition.y, 5);
    expect(last[2][3]).toBeCloseTo(T.tcpPosition.z, 5);
  });

  it('accepts the all-zero pose within joint limits', () => {
    expect(isWithinJointLimits(UR3E_HOME_POSE)).toBe(true);
  });

  it('rejects an elbow value outside the URDF-encoded +/- pi range', () => {
    const joints: JointAngles = [0, 0, 3.5, 0, 0, 0];
    expect(isWithinJointLimits(joints)).toBe(false);
  });

  it('accepts the same 3.5 rad value on the wider shoulder-pan joint', () => {
    const joints: JointAngles = [3.5, 0, 0, 0, 0, 0];
    expect(isWithinJointLimits(joints)).toBe(true);
  });

  it('has a genuinely posed UR3E_READY_POSE within joint limits', () => {
    expect(isWithinJointLimits(UR3E_READY_POSE)).toBe(true);
    const nonZeroCount = UR3E_READY_POSE.filter((v) => v !== 0).length;
    expect(nonZeroCount).toBeGreaterThanOrEqual(2);
  });

  it('agrees with RAIL_TRAVEL on what "travel" means end-to-end', () => {
    const atMax = forwardKinematics(UR3E_HOME_POSE, RAIL_TRAVEL.max).tcpPosition.x;
    const atMin = forwardKinematics(UR3E_HOME_POSE, RAIL_TRAVEL.min).tcpPosition.x;
    expect(atMax - atMin).toBeCloseTo(RAIL_TRAVEL.max - RAIL_TRAVEL.min, 5);
  });
});
