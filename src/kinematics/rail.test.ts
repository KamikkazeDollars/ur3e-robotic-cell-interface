import { describe, it, expect } from 'vitest';
import {
  RAIL_TRAVEL,
  RAIL_CENTER_X,
  railRemainingTravel,
  clampRailPosition,
  resolveRailPosition,
} from './rail';
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor';

const TOTAL_TRAVEL = RAIL_TRAVEL.max - RAIL_TRAVEL.min;

describe('rail travel geometry', () => {
  it('exposes a min/max range with max strictly greater than min, totaling 3 metres', () => {
    expect(RAIL_TRAVEL.max).toBeGreaterThan(RAIL_TRAVEL.min);
    expect(TOTAL_TRAVEL).toBeCloseTo(3, 5);
  });

  it('centres RAIL_CENTER_X at the midpoint of the travel range', () => {
    expect(RAIL_CENTER_X).toBeCloseTo((RAIL_TRAVEL.min + RAIL_TRAVEL.max) / 2, 5);
    expect(clampRailPosition(RAIL_CENTER_X)).toBe(RAIL_CENTER_X);
  });

  it('clamps below-range, above-range, and in-range values correctly', () => {
    expect(clampRailPosition(RAIL_TRAVEL.min - 10)).toBe(RAIL_TRAVEL.min);
    expect(clampRailPosition(RAIL_TRAVEL.max + 10)).toBe(RAIL_TRAVEL.max);
    const midway = (RAIL_TRAVEL.min + RAIL_TRAVEL.max) / 2;
    expect(clampRailPosition(midway)).toBe(midway);
  });

  it('reports equal remaining travel in both directions at the centre', () => {
    const remaining = railRemainingTravel(RAIL_CENTER_X);
    expect(remaining.negative).toBeCloseTo(TOTAL_TRAVEL / 2, 5);
    expect(remaining.positive).toBeCloseTo(TOTAL_TRAVEL / 2, 5);
  });

  it('reports zero/full remaining travel at the min and max limits', () => {
    const atMin = railRemainingTravel(RAIL_TRAVEL.min);
    expect(atMin.negative).toBeCloseTo(0, 5);
    expect(atMin.positive).toBeCloseTo(TOTAL_TRAVEL, 5);

    const atMax = railRemainingTravel(RAIL_TRAVEL.max);
    expect(atMax.negative).toBeCloseTo(TOTAL_TRAVEL, 5);
    expect(atMax.positive).toBeCloseTo(0, 5);
  });
});

describe('resolveRailPosition', () => {
  const mount = ROBOT_MOUNT_WORLD;

  it('resolves at RAIL_CENTER_X for a symmetric point cloud centred on it', () => {
    // Mirrored pairs (same y/z per pair, x symmetric about mount.x) so the
    // worst-case-reach objective's optimum is provably exact, not just
    // approximately near, the centre.
    const points: [number, number, number][] = [
      [mount.x - 0.05, mount.y, mount.z + 0.4],
      [mount.x + 0.05, mount.y, mount.z + 0.4],
      [mount.x - 0.03, mount.y + 0.02, mount.z + 0.35],
      [mount.x + 0.03, mount.y + 0.02, mount.z + 0.35],
    ];
    const resolved = resolveRailPosition(points, mount);
    expect(resolved).toBeCloseTo(RAIL_CENTER_X, 5);
  });

  it('resolves to a visibly different, larger position for the same cloud translated 1m along x (D-02, Pitfall 5)', () => {
    const points: [number, number, number][] = [
      [mount.x - 0.05, mount.y, mount.z + 0.4],
      [mount.x + 0.05, mount.y, mount.z + 0.4],
    ];
    const translated = points.map(([x, y, z]) => [x + 1.0, y, z] as [number, number, number]);
    const resolved = resolveRailPosition(translated, mount);
    expect(resolved).toBeGreaterThan(RAIL_CENTER_X + 0.5);
  });

  it('resolves inside RAIL_TRAVEL for a cloud translated far beyond the travel range', () => {
    const points: [number, number, number][] = [[mount.x + 10, mount.y, mount.z]];
    const resolved = resolveRailPosition(points, mount);
    expect(resolved).toBeGreaterThanOrEqual(RAIL_TRAVEL.min);
    expect(resolved).toBeLessThanOrEqual(RAIL_TRAVEL.max);
  });

  it('resolves to RAIL_CENTER_X for an empty point list', () => {
    expect(resolveRailPosition([], mount)).toBe(RAIL_CENTER_X);
  });

  it('sits within a millimetre of the x-span midpoint for the centred cloud (A2 cross-check)', () => {
    // Retires the closed-form-optimality assumption (03-RESEARCH.md
    // Assumption A2) rather than carrying it forward: the brute-force scan
    // (D-02) should agree closely with the simple x-span-midpoint shortcut
    // for a symmetric point cloud.
    const points: [number, number, number][] = [
      [mount.x - 0.06, mount.y, mount.z + 0.3],
      [mount.x + 0.06, mount.y, mount.z + 0.3],
    ];
    const xs = points.map((p) => p[0]);
    const midpointHeuristic = (Math.min(...xs) + Math.max(...xs)) / 2;
    const resolved = resolveRailPosition(points, mount);
    expect(Math.abs(resolved - midpointHeuristic)).toBeLessThan(0.001);
  });

  it('agrees with the invariant ROBOT_MOUNT_WORLD.x === RAIL_CENTER_X the resolver relies on', () => {
    expect(ROBOT_MOUNT_WORLD.x).toBe(RAIL_CENTER_X);
  });
});
