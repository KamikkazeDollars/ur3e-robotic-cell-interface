// Degrees/millimetres presentation layer for the Dashboard's manual-jog
// controls. Kept OUT of `src/kinematics/` because the kinematics modules are
// radians-and-metres-native and must stay that way — this file is the one
// place unit conversion for human-typed input happens.
import { UR3E_JOINT_LIMITS } from '../kinematics/ur3e-dh';
import { RAIL_TRAVEL, clampRailPosition } from '../kinematics/rail';

/**
 * Parses a controlled numeric-input string into a finite number, or `null`
 * when the text is empty, an in-progress partial entry (e.g. `-`, `.`,
 * `-.`), non-numeric, or a non-finite textual value (`Infinity`, `NaN`) —
 * so a controlled input can hold an in-progress string without committing
 * it to the store.
 */
export function parseNumericInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  // Reject partial/in-progress entries and anything Number() would coerce
  // to a finite value from a non-numeric-looking string (e.g. whitespace).
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function millimetresToMetres(mm: number): number {
  return mm / 1000;
}

export function metresToMillimetres(m: number): number {
  return m * 1000;
}

/** Joint limits for `jointIndex`, converted to degrees from `UR3E_JOINT_LIMITS`. */
export function jointLimitsDegrees(jointIndex: number): { min: number; max: number } {
  const limits = UR3E_JOINT_LIMITS[jointIndex];
  if (!limits) {
    throw new RangeError(`jointLimitsDegrees: joint index ${jointIndex} is out of bounds`);
  }
  return { min: toDegrees(limits.min), max: toDegrees(limits.max) };
}

/** Rail travel limits, converted to millimetres from `RAIL_TRAVEL`. */
export function railLimitsMillimetres(): { min: number; max: number } {
  return { min: metresToMillimetres(RAIL_TRAVEL.min), max: metresToMillimetres(RAIL_TRAVEL.max) };
}

/** Clamps a millimetre rail value by routing through the metres-native `clampRailPosition`. */
export function clampRailMillimetres(mm: number): number {
  return metresToMillimetres(clampRailPosition(millimetresToMetres(mm)));
}

/** Fixed-precision (1 decimal place) degree display string — the one formatting authority for the Dashboard panel. */
export function formatDegrees(radians: number): string {
  return toDegrees(radians).toFixed(1);
}

/** Fixed-precision (1 decimal place) millimetre display string. */
export function formatMillimetres(metres: number): string {
  return metresToMillimetres(metres).toFixed(1);
}
