import { describe, it, expect } from 'vitest';
import { clampJointAngle, clampJointAngles } from './joint-clamp';
import { UR3E_JOINT_LIMITS } from './ur3e-dh';
import { isWithinJointLimits } from './forward-kinematics';

describe('clampJointAngle', () => {
  it('clamps the base joint (index 0) to its real configured max/min', () => {
    expect(clampJointAngle(0, 10)).toBe(2 * Math.PI);
    expect(clampJointAngle(0, -10)).toBe(-2 * Math.PI);
  });

  it("honours the elbow's narrower +/- pi range (index 2), proving the table is read per index", () => {
    expect(clampJointAngle(2, 4)).toBe(Math.PI);
    expect(clampJointAngle(2, -4)).toBe(-Math.PI);
  });

  it('returns an in-range value unchanged for every one of the 6 joint indices', () => {
    for (let i = 0; i < 6; i++) {
      const { min, max } = UR3E_JOINT_LIMITS[i];
      const midpoint = (min + max) / 2;
      expect(clampJointAngle(i, midpoint)).toBe(midpoint);
    }
  });

  it('returns a finite in-range number for NaN and Infinity input, never NaN', () => {
    for (let i = 0; i < 6; i++) {
      const { min, max } = UR3E_JOINT_LIMITS[i];

      const nanResult = clampJointAngle(i, NaN);
      expect(Number.isFinite(nanResult)).toBe(true);
      expect(nanResult).toBeGreaterThanOrEqual(min);
      expect(nanResult).toBeLessThanOrEqual(max);

      const posInfResult = clampJointAngle(i, Infinity);
      expect(Number.isFinite(posInfResult)).toBe(true);
      expect(posInfResult).toBeGreaterThanOrEqual(min);
      expect(posInfResult).toBeLessThanOrEqual(max);

      const negInfResult = clampJointAngle(i, -Infinity);
      expect(Number.isFinite(negInfResult)).toBe(true);
      expect(negInfResult).toBeGreaterThanOrEqual(min);
      expect(negInfResult).toBeLessThanOrEqual(max);
    }
  });

  it('throws for an out-of-bounds joint index rather than reading undefined.min', () => {
    expect(() => clampJointAngle(-1, 0)).toThrow();
    expect(() => clampJointAngle(6, 0)).toThrow();
  });
});

describe('clampJointAngles', () => {
  it('clamps all six positionally and returns a new tuple', () => {
    const input: [number, number, number, number, number, number] = [10, 10, 4, -10, -10, 10];
    const result = clampJointAngles(input);
    expect(result).not.toBe(input);
    expect(result[0]).toBe(2 * Math.PI);
    expect(result[1]).toBe(2 * Math.PI);
    expect(result[2]).toBe(Math.PI);
    expect(result[3]).toBe(-2 * Math.PI);
    expect(result[4]).toBe(-2 * Math.PI);
    expect(result[5]).toBe(2 * Math.PI);
  });

  it('structural guard: the clamped output satisfies isWithinJointLimits for every index', () => {
    const input: [number, number, number, number, number, number] = [
      100, -100, 100, -100, 100, -100,
    ];
    const result = clampJointAngles(input);
    expect(isWithinJointLimits(result)).toBe(true);
  });
});
