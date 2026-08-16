import { describe, it, expect } from 'vitest';
import {
  parseNumericInput,
  toRadians,
  toDegrees,
  jointLimitsDegrees,
  railLimitsMillimetres,
  clampRailMillimetres,
  millimetresToMetres,
  metresToMillimetres,
} from './manual-jog';

describe('parseNumericInput', () => {
  it('returns null for empty/in-progress typing states', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('-')).toBeNull();
    expect(parseNumericInput('.')).toBeNull();
    expect(parseNumericInput('-.')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('1e')).toBeNull();
  });

  it('parses complete numeric strings, trimming whitespace', () => {
    expect(parseNumericInput('-90')).toBe(-90);
    expect(parseNumericInput('600')).toBe(600);
    expect(parseNumericInput(' 12.5 ')).toBe(12.5);
  });

  it('returns null for non-finite textual values', () => {
    expect(parseNumericInput('Infinity')).toBeNull();
    expect(parseNumericInput('NaN')).toBeNull();
  });
});

describe('toRadians / toDegrees', () => {
  it('round-trips 180 degrees / pi radians within 1e-9', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 9);
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 9);
  });
});

describe('jointLimitsDegrees', () => {
  it('derives the base joint (index 0) limits from UR3E_JOINT_LIMITS', () => {
    expect(jointLimitsDegrees(0)).toEqual({ min: -360, max: 360 });
  });

  it("derives the elbow joint (index 2) narrower limits from UR3E_JOINT_LIMITS", () => {
    expect(jointLimitsDegrees(2)).toEqual({ min: -180, max: 180 });
  });
});

describe('railLimitsMillimetres', () => {
  it('derives millimetre limits from RAIL_TRAVEL', () => {
    expect(railLimitsMillimetres()).toEqual({ min: -1500, max: 1500 });
  });
});

describe('clampRailMillimetres', () => {
  it('clamps above-range, below-range, and in-range millimetre values', () => {
    expect(clampRailMillimetres(9999)).toBe(1500);
    expect(clampRailMillimetres(-9999)).toBe(-1500);
    expect(clampRailMillimetres(250)).toBe(250);
  });
});

describe('millimetresToMetres / metresToMillimetres', () => {
  it('round-trips 1500mm / 1.5m', () => {
    expect(millimetresToMetres(1500)).toBe(1.5);
    expect(metresToMillimetres(1.5)).toBe(1500);
  });
});
