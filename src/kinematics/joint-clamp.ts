// Joint-space clamping — the counterpart to rail.ts's clampRailPosition.
//
// This is one of the two clamping authorities in the project (the other is
// `clampRailPosition` in `./rail.ts`). Both read their bounds from the real
// configured limit tables (`UR3E_JOINT_LIMITS` here, `RAIL_TRAVEL` there)
// rather than restating any bound as a local literal, so a manually typed
// value is ALWAYS clamped into a legal pose, never rejected and never able
// to reach `setJointValue` out of range.
import { UR3E_JOINT_LIMITS, type JointAngles } from './ur3e-dh';

/**
 * Clamps a single joint's angle (radians) into `UR3E_JOINT_LIMITS[jointIndex]`.
 *
 * Non-finite input (NaN, +/-Infinity) is guarded explicitly rather than left
 * to fall through `Math.min`/`Math.max` — a NaN reaching `setJointValue`
 * would silently corrupt the rendered pose. NaN resolves to 0 (or the
 * nearest limit if 0 itself is out of range for that joint); +/-Infinity
 * resolves to the corresponding limit.
 */
export function clampJointAngle(jointIndex: number, radians: number): number {
  const limits = UR3E_JOINT_LIMITS[jointIndex];
  if (!limits) {
    throw new RangeError(`clampJointAngle: joint index ${jointIndex} is out of bounds`);
  }
  const { min, max } = limits;

  if (Number.isNaN(radians)) {
    return Math.min(max, Math.max(min, 0));
  }
  if (radians === Infinity) return max;
  if (radians === -Infinity) return min;

  return Math.min(max, Math.max(min, radians));
}

/** Clamps all six joints positionally, returning a NEW tuple (never mutates the input). */
export function clampJointAngles(joints: JointAngles): JointAngles {
  return joints.map((angle, i) => clampJointAngle(i, angle)) as unknown as JointAngles;
}
