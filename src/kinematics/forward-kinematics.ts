// Hand-written standard-DH forward-kinematics chain for the UR3e.
//
// This module is deliberately framework-free (no rendering engine, no
// robot-loader, no UI framework import) so it is directly unit-testable and
// reusable independent of the renderer (ARCHITECTURE.md "Structure
// Rationale"). It must NOT delegate to urdf-loader's internal joint
// transforms — that library has its own separate transform pipeline used
// purely for rendering; keeping the two independent is what makes plan
// 01-03's cross-check meaningful (RESEARCH.md, "Anti-Patterns to Avoid").
import { UR3E_DH, UR3E_JOINT_LIMITS, type JointAngles } from './ur3e-dh';

/** A 4x4 homogeneous transform matrix, row-major: matrix[row][col]. */
export type Matrix4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

function identity4(): Matrix4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function multiply4(a: Matrix4, b: Matrix4): Matrix4 {
  const result = identity4();
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row][k] * b[k][col];
      }
      result[row][col] = sum;
    }
  }
  return result;
}

function rotZ(theta: number): Matrix4 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function transZ(d: number): Matrix4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, d],
    [0, 0, 0, 1],
  ];
}

function transX(a: number): Matrix4 {
  return [
    [1, 0, 0, a],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function rotX(alpha: number): Matrix4 {
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Single-joint standard-DH transform:
 * T_i = Rot_z(theta) . Trans_z(d) . Trans_x(a) . Rot_x(alpha)
 */
function dhTransform(theta: number, d: number, a: number, alpha: number): Matrix4 {
  return multiply4(multiply4(multiply4(rotZ(theta), transZ(d)), transX(a)), rotX(alpha));
}

export interface ForwardKinematicsResult {
  /** Cumulative base-to-joint-i transforms, one per revolute joint (length 6). */
  frames: Matrix4[];
  /** Base-to-flange transform (rail translation included). */
  matrix: Matrix4;
  /** TCP position read out of `matrix`. */
  tcpPosition: { x: number; y: number; z: number };
}

/**
 * Computes the UR3e's base-to-flange forward kinematics from the officially
 * sourced DH table, with the 7th-axis rail position entering first as a pure
 * translation along the rail's world x axis (ARCHITECTURE.md:
 * `T_rail(x) . T1(theta1) . ... . T6(theta6)`), so the same function serves
 * both the arm alone and the rail-mounted cell.
 */
export function forwardKinematics(
  joints: JointAngles,
  railPos = 0,
): ForwardKinematicsResult {
  const frames: Matrix4[] = [];
  let cumulative = transX(railPos);

  for (let i = 0; i < 6; i++) {
    const { a, d, alpha } = UR3E_DH[i];
    const jointTransform = dhTransform(joints[i], d, a, alpha);
    cumulative = multiply4(cumulative, jointTransform);
    frames.push(cumulative);
  }

  const matrix = frames[5];
  const tcpPosition = { x: matrix[0][3], y: matrix[1][3], z: matrix[2][3] };

  return { frames, matrix, tcpPosition };
}

/** Whether every joint angle is within its URDF-encoded travel limit. */
export function isWithinJointLimits(joints: JointAngles): boolean {
  return joints.every((angle, i) => {
    const { min, max } = UR3E_JOINT_LIMITS[i];
    return angle >= min && angle <= max;
  });
}
