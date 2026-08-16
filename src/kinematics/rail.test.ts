import { describe, it, expect } from 'vitest';
import {
  RAIL_TRAVEL,
  RAIL_CENTER_X,
  railRemainingTravel,
  clampRailPosition,
  resolveRailPosition,
  RAIL_RESOLUTION_CANDIDATES,
  RAIL_CANDIDATE_SPACING_M,
  MODE_RAIL_START_OFFSET_M,
  railStartXForMode,
} from './rail';
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor';

const TOTAL_TRAVEL = RAIL_TRAVEL.max - RAIL_TRAVEL.min;

describe('rail travel geometry', () => {
  it('exposes a min/max range with max strictly greater than min, totaling 2.19 metres', () => {
    expect(RAIL_TRAVEL.max).toBeGreaterThan(RAIL_TRAVEL.min);
    expect(TOTAL_TRAVEL).toBeCloseTo(2.19, 5);
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

describe('grid-alignment invariant (quick 260816-s4e, U-3): holds by construction, not coincidence', () => {
  it('RAIL_CANDIDATE_SPACING_M equals the travel span divided by RAIL_RESOLUTION_CANDIDATES - 1', () => {
    expect(RAIL_CANDIDATE_SPACING_M).toBeCloseTo(
      TOTAL_TRAVEL / (RAIL_RESOLUTION_CANDIDATES - 1),
      12,
    );
  });

  it('MODE_RAIL_START_OFFSET_M is an exact whole multiple of RAIL_CANDIDATE_SPACING_M, to within 1e-9', () => {
    const ratio = MODE_RAIL_START_OFFSET_M / RAIL_CANDIDATE_SPACING_M;
    expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9);
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

describe('railStartXForMode (G-04-1 gap closure)', () => {
  it("printing's station is strictly greater than RAIL_CENTER_X and milling's is strictly less", () => {
    expect(railStartXForMode('printing')).toBeGreaterThan(RAIL_CENTER_X);
    expect(railStartXForMode('milling')).toBeLessThan(RAIL_CENTER_X);
  });

  it('both stations lie inside RAIL_TRAVEL and each equals its own clampRailPosition result', () => {
    const printingX = railStartXForMode('printing');
    const millingX = railStartXForMode('milling');

    expect(printingX).toBeGreaterThanOrEqual(RAIL_TRAVEL.min);
    expect(printingX).toBeLessThanOrEqual(RAIL_TRAVEL.max);
    expect(printingX).toBe(clampRailPosition(printingX));

    expect(millingX).toBeGreaterThanOrEqual(RAIL_TRAVEL.min);
    expect(millingX).toBeLessThanOrEqual(RAIL_TRAVEL.max);
    expect(millingX).toBe(clampRailPosition(millingX));
  });

  it('the two stations are symmetric about RAIL_CENTER_X, separated by twice MODE_RAIL_START_OFFSET_M', () => {
    const printingX = railStartXForMode('printing');
    const millingX = railStartXForMode('milling');

    expect((printingX + millingX) / 2).toBeCloseTo(RAIL_CENTER_X, 9);
    expect(printingX - millingX).toBeCloseTo(2 * MODE_RAIL_START_OFFSET_M, 9);
  });

  it('leaves positive remaining travel in both directions at each mode station', () => {
    for (const mode of ['printing', 'milling'] as const) {
      const remaining = railRemainingTravel(railStartXForMode(mode));
      expect(remaining.negative).toBeGreaterThan(0);
      expect(remaining.positive).toBeGreaterThan(0);
    }
  });

  it('resolveRailPosition is translation-covariant under the mode offset, EXACTLY (to within 1e-9, not merely within one grid step) — the property that lets the anchor, rather than the resolver, carry the mode', () => {
    const mount = ROBOT_MOUNT_WORLD;
    // Same symmetric point cloud as the "resolves at RAIL_CENTER_X" test
    // above, so the baseline resolves exactly to RAIL_CENTER_X.
    const points: [number, number, number][] = [
      [mount.x - 0.05, mount.y, mount.z + 0.4],
      [mount.x + 0.05, mount.y, mount.z + 0.4],
      [mount.x - 0.03, mount.y + 0.02, mount.z + 0.35],
      [mount.x + 0.03, mount.y + 0.02, mount.z + 0.35],
    ];
    const baseline = resolveRailPosition(points, mount);

    for (const offset of [MODE_RAIL_START_OFFSET_M, -MODE_RAIL_START_OFFSET_M]) {
      const translated = points.map(([x, y, z]) => [x + offset, y, z] as [number, number, number]);
      const resolved = resolveRailPosition(translated, mount);
      // If this fails, fix the offset derivation (RAIL_CANDIDATE_SPACING_M /
      // MODE_RAIL_START_OFFSET_STEPS) — do NOT widen this tolerance back
      // toward a grid step.
      expect(Math.abs(resolved - (baseline + offset))).toBeLessThan(1e-9);
    }
  });
});
