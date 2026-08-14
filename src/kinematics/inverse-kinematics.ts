// Closed-form 6-DOF analytical inverse kinematics for the UR3e's standard-DH
// chain (Hawkins, 2013, "Analytic Inverse Kinematics for the Universal
// Robots UR-5/UR-10 Arms"; ported from ROS-Industrial's `ur_kin.cpp`
// reference implementation, the same algorithm family the CLAUDE.md stack
// table names as this project's chosen approach).
//
// This module is deliberately framework-free (no rendering engine, no
// robot-loader, no UI framework import), following forward-kinematics.ts's
// exact discipline: explicit 4x4 literals, no delegation to urdf-loader's
// own transform pipeline, and every export carries a doc comment naming the
// source it encodes.
//
// PORT NOTE — do NOT apply `ur_kin.cpp`'s base-frame index remapping.
// `ur_kin.cpp`'s `forward()` emits its matrix in a ROS base frame that is
// rotated relative to this project's raw standard-DH chain, so its own
// `inverse()` reads permuted, sign-flipped elements of the caller's matrix
// (e.g. `T02 = -T[0][0]`, `T00 = T[0][1]`, `T22 = T[2][0]`). This project's
// `forwardKinematics(...).matrix` IS the raw DH chain, so this port reads
// `target[row][col]` DIRECTLY below — no permutation, no sign flips. This
// was re-verified this planning session (03-01-PLAN.md, "Verified IK port
// contract") by round-tripping 400 randomised poses through the real
// `UR3E_DH` table and this project's own `forwardKinematics`:
//   - With the remap applied: 0/400 round-trips passed, worst TCP error 1.12 m.
//   - Reading `target[row][col]` directly (this file's approach): 400/400
//     passed, worst TCP error 3.7e-16 m.
// The remapped variant is PITFALLS.md Pitfall 1's exact failure mode — a
// confident, plausible-looking pose that is metres wrong. The round-trip
// test in inverse-kinematics.test.ts is the gate that would catch a
// regression back to it.
// Imports siblings directly rather than through the kinematics barrel
// (`./index.ts`): this file IS one of the barrel's own re-export sources,
// so importing back from the barrel would create a same-directory
// self-referential cycle. forward-kinematics.ts already establishes this
// "import siblings directly" convention.
import { UR3E_DH, type JointAngles } from './ur3e-dh';
import { isWithinJointLimits, type Matrix4 } from './forward-kinematics';

/** Below this magnitude, a value is treated as exactly zero for the
 * degenerate-case branches below (ur_kin.cpp's own `ZERO_THRESH`). */
const ZERO_THRESH = 1e-8;

/** ur_kin.cpp's `SIGN` macro: `(x>0)-(x<0)` — returns 0 at exactly zero,
 * not 1. Preserved verbatim; the degenerate-case branches below depend on
 * this exact zero-at-zero behaviour, not the more common +/-1-only sign. */
function sign(x: number): number {
  return (x > 0 ? 1 : 0) - (x < 0 ? 1 : 0);
}

/** Clamps an `acos`/`asin` argument into the closed interval [-1, 1] before
 * the call (ASVS V5, T-03-01): floating-point error can otherwise push a
 * mathematically-valid argument fractionally outside the domain, producing
 * NaN from a target that is, in reality, reachable. */
function clampUnit(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

/** Normalises an angle into the half-open interval (-pi, pi]. */
function normalizeAngle(angle: number): number {
  let a = angle;
  while (a <= -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/**
 * The distance (metres) from the flange to the tool tip along the flange's
 * approach axis. Zero because no tool is mounted in this phase — this is
 * the seam ROADMAP Phase 7 sets per mounted tool (print head vs. mill
 * spindle each have a different physical length). A non-zero value shifts
 * the solved flange target back along the approach axis so the TOOL TIP,
 * not the bare flange, lands on the toolpath point.
 */
export const TOOL_FLANGE_OFFSET_Z = 0;

/**
 * Builds a fixed tool-down IK target at the given scene/DH-frame position:
 * rotation rows `[1,0,0]`, `[0,-1,0]`, `[0,0,-1]` (approach axis along DH
 * -Z), translation displaced by `TOOL_FLANGE_OFFSET_Z` along that approach
 * axis.
 *
 * This is this project's resolution of Assumption A1 (03-RESEARCH.md): the
 * g-code sources this app reads carry position only, never tool
 * orientation, so a fixed tool-down orientation with a constant flange X
 * axis is a deliberate scoping decision, not data read from the file. A
 * tangent-derived X axis (rotating the flange to track the path direction)
 * was evaluated and rejected: at a square perimeter's corner the path
 * tangent changes discontinuously between adjacent samples, which would
 * rotate wrist_3 by ~90 degrees in a single sample step. `pickClosestBranch`
 * below selects among branches of a GIVEN target and cannot smooth a
 * discontinuity in the target itself, so a tangent-derived X axis would
 * manufacture exactly the visible joint-snapping this phase's first success
 * criterion forbids.
 */
export function buildToolDownTarget(position: { x: number; y: number; z: number }): Matrix4 {
  const approachAxis = { x: 0, y: 0, z: -1 };
  const tx = position.x + approachAxis.x * TOOL_FLANGE_OFFSET_Z;
  const ty = position.y + approachAxis.y * TOOL_FLANGE_OFFSET_Z;
  const tz = position.z + approachAxis.z * TOOL_FLANGE_OFFSET_Z;
  return [
    [1, 0, 0, tx],
    [0, -1, 0, ty],
    [0, 0, -1, tz],
    [0, 0, 0, 1],
  ];
}

/**
 * Closed-form 6-DOF inverse kinematics for a base-to-flange target,
 * expressed directly in this project's raw standard-DH frame (see the PORT
 * NOTE above — `target[row][col]` is read as-is, no remap).
 *
 * Solve order (03-01-PLAN.md "Verified IK port contract", Finding 2):
 * theta1 (up to 2 branches) -> theta5 (2 per theta1) -> theta6 -> theta3 (2,
 * elbow up/down) -> theta2 -> theta4, yielding up to 8 solutions. Every
 * `acos`/`asin` argument is clamped into [-1, 1] before the call. theta6 is
 * left undetermined (emitted as 0) at a wrist singularity
 * (`abs(sin theta5) < ZERO_THRESH`) per D-03 — the caller's continuity rule
 * (`pickClosestBranch`) chooses among branches at that point, this function
 * does not. Returns an empty array for an unreachable target rather than
 * throwing; never mutates `target`.
 */
export function solveUR6IK(target: Matrix4): JointAngles[] {
  const d1 = UR3E_DH[0].d;
  const a2 = UR3E_DH[1].a;
  const a3 = UR3E_DH[2].a;
  const d4 = UR3E_DH[3].d;
  const d5 = UR3E_DH[4].d;
  const d6 = UR3E_DH[5].d;

  const T00 = target[0][0];
  const T01 = target[0][1];
  const T02 = target[0][2];
  const T03 = target[0][3];
  const T10 = target[1][0];
  const T11 = target[1][1];
  const T12 = target[1][2];
  const T13 = target[1][3];
  const T20 = target[2][0];
  const T21 = target[2][1];
  const T22 = target[2][2];
  const T23 = target[2][3];

  const solutions: JointAngles[] = [];

  // --- theta1 (shoulder pan): the three-case branching from the plan's
  // "Verified IK port contract" table -------------------------------------
  const A = d6 * T12 - T13;
  const B = d6 * T02 - T03;
  const R = A * A + B * B;

  const q1: number[] = [];
  if (Math.abs(A) < ZERO_THRESH) {
    const div =
      Math.abs(Math.abs(d4) - Math.abs(B)) < ZERO_THRESH ? -sign(d4) * sign(B) : -d4 / B;
    let arcsin = Math.asin(clampUnit(div));
    if (Math.abs(arcsin) < ZERO_THRESH) arcsin = 0;
    q1.push(arcsin < 0 ? arcsin + 2 * Math.PI : arcsin);
    q1.push(Math.PI - arcsin);
  } else if (Math.abs(B) < ZERO_THRESH) {
    const div =
      Math.abs(Math.abs(d4) - Math.abs(A)) < ZERO_THRESH ? sign(d4) * sign(A) : d4 / A;
    const arccos = Math.acos(clampUnit(div));
    q1.push(arccos);
    q1.push(2 * Math.PI - arccos);
  } else if (d4 * d4 > R) {
    // Unreachable — no theta1 solves this target at all.
    return [];
  } else {
    const acosTerm = Math.acos(clampUnit(d4 / Math.sqrt(R)));
    const atanTerm = Math.atan2(-B, A);
    q1.push(atanTerm + acosTerm);
    q1.push(atanTerm - acosTerm);
  }

  for (const theta1 of q1) {
    const s1 = Math.sin(theta1);
    const c1 = Math.cos(theta1);

    // --- theta5 (wrist 2): 2 branches per theta1 --------------------------
    const numer = T03 * s1 - T13 * c1 - d4;
    const divQ5 =
      Math.abs(Math.abs(numer) - Math.abs(d6)) < ZERO_THRESH ? sign(numer) * sign(d6) : numer / d6;
    const arccosQ5 = Math.acos(clampUnit(divQ5));
    const q5options = [arccosQ5, 2 * Math.PI - arccosQ5];

    for (const theta5 of q5options) {
      const s5 = Math.sin(theta5);
      const c5 = Math.cos(theta5);

      // --- theta6 (wrist 3): undetermined at the wrist singularity --------
      let theta6: number;
      if (Math.abs(s5) < ZERO_THRESH) {
        theta6 = 0;
      } else {
        theta6 = Math.atan2(sign(s5) * -(T01 * s1 - T11 * c1), sign(s5) * (T00 * s1 - T10 * c1));
        if (Math.abs(theta6) < ZERO_THRESH) theta6 = 0;
      }
      const s6 = Math.sin(theta6);
      const c6 = Math.cos(theta6);

      // --- shared RRR (theta2, theta3, theta4) intermediates --------------
      const x04x =
        -s5 * (T02 * c1 + T12 * s1) - c5 * (s6 * (T01 * c1 + T11 * s1) - c6 * (T00 * c1 + T10 * s1));
      const x04y = c5 * (T20 * c6 - T21 * s6) - T22 * s5;
      const p13x =
        d5 * (s6 * (T00 * c1 + T10 * s1) + c6 * (T01 * c1 + T11 * s1)) -
        d6 * (T02 * c1 + T12 * s1) +
        T03 * c1 +
        T13 * s1;
      const p13y = T23 - d1 - d6 * T22 + d5 * (T21 * c6 + T20 * s6);

      let c3 = (p13x * p13x + p13y * p13y - a2 * a2 - a3 * a3) / (2 * a2 * a3);
      if (Math.abs(Math.abs(c3) - 1) < ZERO_THRESH) {
        c3 = sign(c3);
      } else if (Math.abs(c3) > 1) {
        // theta3 (elbow) unreachable for this (theta1, theta5) branch pair —
        // skip it, other branch pairs may still solve.
        continue;
      }

      const arccosQ3 = Math.acos(clampUnit(c3));
      const q3options = [arccosQ3, 2 * Math.PI - arccosQ3];
      const denom = a2 * a2 + a3 * a3 + 2 * a2 * a3 * c3;

      const q2options: number[] = [];
      for (const s3Sign of [1, -1]) {
        const s3 = s3Sign * Math.sin(arccosQ3);
        const coefA = a2 + a3 * c3;
        const coefB = a3 * s3;
        q2options.push(
          Math.atan2((coefA * p13y - coefB * p13x) / denom, (coefA * p13x + coefB * p13y) / denom),
        );
      }

      for (let k = 0; k < 2; k++) {
        let theta2 = q2options[k];
        const theta3 = q3options[k];

        const c23 = Math.cos(theta2 + theta3);
        const s23 = Math.sin(theta2 + theta3);
        let theta4 = Math.atan2(c23 * x04y - s23 * x04x, x04x * c23 + x04y * s23);

        // Cosmetic near-zero/near-pi snap, preserved verbatim from
        // `ur_kin.cpp` (part of the verified 400/400 round-trip port).
        if (Math.abs(theta2) < ZERO_THRESH) theta2 = 0;
        else if (Math.abs(theta2 - Math.PI) < ZERO_THRESH) theta2 -= Math.PI;
        if (Math.abs(theta4) < ZERO_THRESH) theta4 = 0;
        else if (Math.abs(theta4 - Math.PI) < ZERO_THRESH) theta4 -= Math.PI;

        solutions.push([
          normalizeAngle(theta1),
          normalizeAngle(theta2),
          normalizeAngle(theta3),
          normalizeAngle(theta4),
          normalizeAngle(theta5),
          normalizeAngle(theta6),
        ]);
      }
    }
  }

  return solutions;
}

/** Euclidean norm of the component-wise joint-angle difference. */
export function jointSpaceDistance(a: JointAngles, b: JointAngles): number {
  let sumSq = 0;
  for (let i = 0; i < 6; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Keeps only branches where every angle is finite AND the tuple is within
 * `isWithinJointLimits`. Order matters and is deliberate: the finiteness
 * screen runs FIRST, so a non-finite value produced by a near-singular
 * division (T-03-01) can never reach a comparison operator inside
 * `isWithinJointLimits`, where a NaN comparison silently evaluates to
 * `false` and would be discarded for the wrong reason (looking like an
 * out-of-limits joint rather than a corrupt value).
 */
export function validBranches(candidates: JointAngles[]): JointAngles[] {
  return candidates.filter(
    (candidate) => candidate.every((angle) => Number.isFinite(angle)) && isWithinJointLimits(candidate),
  );
}

/**
 * D-03's continuity rule: returns the candidate minimising
 * `jointSpaceDistance` to `previous`, or `null` for an empty candidate list.
 * A pure function — the decision of WHAT `previous` is (the prior compiled
 * sample, or `UR3E_READY_POSE` for the very first sample) belongs to the
 * caller (`src/trajectory/compile.ts`), not here.
 */
export function pickClosestBranch(candidates: JointAngles[], previous: JointAngles): JointAngles | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestDistance = jointSpaceDistance(best, previous);
  for (let i = 1; i < candidates.length; i++) {
    const distance = jointSpaceDistance(candidates[i], previous);
    if (distance < bestDistance) {
      best = candidates[i];
      bestDistance = distance;
    }
  }
  return best;
}
