// TDD RED for `sampleAtFraction` (04-03-PLAN.md Task 1). Most fixtures below
// are hand-built `CompiledTrajectory`-shaped objects with hand-chosen sample
// values, so every expected number here is computable by hand rather than
// derived from the implementation under test. The final `describe` block
// exercises the real compiler (`compileTrajectory`) against the same
// square-toolpath fixture `compile.test.ts` uses, proving the density
// premise `sampleAtFraction`'s joint-space blending relies on.
import { describe, it, expect } from 'vitest'
import { sampleAtFraction } from './sample-lookup'
import { compileTrajectory } from './compile'
import type { CompiledTrajectory, TrajectorySample } from './compile'
import type { ClassifiedSegment, ParsedToolpath } from '../gcode/parseToolpath'
import { TOOLPATH_ANCHOR_OFFSET } from '../gcode/toolpath-anchor'
import type { JointAngles } from '../kinematics'

function buildSample(
  scrubFraction: number,
  point: [number, number, number],
  joints: JointAngles,
): TrajectorySample {
  return {
    scrubFraction,
    point,
    joints,
    railPos: 0,
    tcpPosition: { x: point[0], y: point[1], z: point[2] },
    singularityFlags: { wrist: false, shoulder: false, elbow: false, any: false },
  }
}

function buildTrajectory(
  samples: TrajectorySample[],
  status: CompiledTrajectory['status'] = 'ready',
): CompiledTrajectory {
  return { samples, railPos: 0, status, requestedSampleCount: samples.length, travelLength: 0, toolpathLength: 0 }
}

/** Same square toolpath `compile.test.ts` uses — reachable at this scale,
 * verified there via the planner spike. */
function buildSquareToolpath(): ParsedToolpath {
  const halfSide = 0.075
  const cx = TOOLPATH_ANCHOR_OFFSET.x
  const cy = TOOLPATH_ANCHOR_OFFSET.y
  const cz = TOOLPATH_ANCHOR_OFFSET.z

  const corners: [number, number, number][] = [
    [cx - halfSide, cy, cz - halfSide],
    [cx + halfSide, cy, cz - halfSide],
    [cx + halfSide, cy, cz + halfSide],
    [cx - halfSide, cy, cz + halfSide],
    [cx - halfSide, cy, cz - halfSide],
  ]

  const segments: ClassifiedSegment[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    segments.push({
      type: 'cut',
      motion: 'G1',
      source: 'line',
      points: [corners[i], corners[i + 1]],
      feedRate: 600,
    })
  }

  return {
    segments,
    unit: 'mm',
    skippedMotionCount: 0,
    appliedAnchorTranslation: [0, 0, 0],
    bounds: null,
  }
}

describe('sampleAtFraction — two-sample fixture (endpoints and midpoint)', () => {
  const trajectory = buildTrajectory([
    buildSample(0, [0, 0, 0], [0, 0, 0, 0, 0, 0]),
    buildSample(1, [10, 20, 30], [1, 2, 3, 4, 5, 6]),
  ])

  it('fraction 0 returns the first sample exactly (element-wise, not approximate)', () => {
    const result = sampleAtFraction(trajectory, 0)
    expect(result!.point).toEqual([0, 0, 0])
    expect(result!.joints).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('fraction 1 returns the last sample exactly (element-wise, not approximate)', () => {
    const result = sampleAtFraction(trajectory, 1)
    expect(result!.point).toEqual([10, 20, 30])
    expect(result!.joints).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('fraction 0.5 returns the element-wise midpoint of both arrays', () => {
    const result = sampleAtFraction(trajectory, 0.5)
    expect(result!.point).toEqual([5, 10, 15])
    expect(result!.joints).toEqual([0.5, 1, 1.5, 2, 2.5, 3])
  })
})

describe('sampleAtFraction — non-uniformly spaced fixture (span-weighted blend)', () => {
  const trajectory = buildTrajectory([
    buildSample(0, [0, 0, 0], [0, 0, 0, 0, 0, 0]),
    buildSample(0.25, [4, 8, 12], [2, 4, 6, 8, 10, 12]),
    buildSample(1, [100, 200, 300], [20, 40, 60, 80, 100, 120]),
  ])

  it('fraction 0.125 returns the midpoint of samples 0 and 1, weighted by their own span (not index)', () => {
    const result = sampleAtFraction(trajectory, 0.125)
    expect(result!.point).toEqual([2, 4, 6])
    expect(result!.joints).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("fraction exactly equal to an interior sample's own scrubFraction returns that sample exactly", () => {
    const result = sampleAtFraction(trajectory, 0.25)
    expect(result!.point).toEqual([4, 8, 12])
    expect(result!.joints).toEqual([2, 4, 6, 8, 10, 12])
  })
})

describe('sampleAtFraction — truncated trajectory (D-06, never extrapolates)', () => {
  const trajectory = buildTrajectory(
    [
      buildSample(0, [0, 0, 0], [0, 0, 0, 0, 0, 0]),
      buildSample(0.3, [3, 6, 9], [1, 1, 1, 1, 1, 1]),
      buildSample(0.6, [6, 12, 18], [2, 2, 2, 2, 2, 2]),
    ],
    'frozen-at-unreachable',
  )

  it("fraction 1 returns the last solved sample's point and joints exactly — no extrapolation past it", () => {
    const result = sampleAtFraction(trajectory, 1)
    expect(result!.point).toEqual([6, 12, 18])
    expect(result!.joints).toEqual([2, 2, 2, 2, 2, 2])
  })
})

describe('sampleAtFraction — degenerate trajectories', () => {
  it('returns null for a trajectory with no samples', () => {
    const trajectory = buildTrajectory([])
    expect(sampleAtFraction(trajectory, 0.5)).toBeNull()
  })

  it('returns the only sample for a single-sample trajectory, for fractions 0, 0.5, and 1', () => {
    const trajectory = buildTrajectory([buildSample(0, [5, 5, 5], [1, 1, 1, 1, 1, 1])])
    for (const fraction of [0, 0.5, 1]) {
      const result = sampleAtFraction(trajectory, fraction)
      expect(result!.point).toEqual([5, 5, 5])
      expect(result!.joints).toEqual([1, 1, 1, 1, 1, 1])
    }
  })
})

describe('sampleAtFraction — non-finite and out-of-range fraction arguments', () => {
  const trajectory = buildTrajectory([
    buildSample(0, [0, 0, 0], [0, 0, 0, 0, 0, 0]),
    buildSample(1, [10, 20, 30], [1, 2, 3, 4, 5, 6]),
  ])

  it.each([NaN, Infinity, -Infinity, -1, 2])(
    'fraction %p produces finite point and joint values within the fixture range',
    (fraction) => {
      const result = sampleAtFraction(trajectory, fraction)
      expect(result).not.toBeNull()
      for (const value of result!.point) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(30)
      }
      for (const value of result!.joints) {
        expect(Number.isFinite(value)).toBe(true)
      }
    },
  )
})

describe('sampleAtFraction — real compiled trajectory (density premise)', () => {
  const toolpath = buildSquareToolpath()
  const trajectory = compileTrajectory(toolpath)

  it('is a non-trivial, ready trajectory (sanity check on the fixture itself)', () => {
    expect(trajectory.status).toBe('ready')
    expect(trajectory.samples.length).toBeGreaterThan(10)
  })

  it("calling sampleAtFraction with a sample's own scrubFraction reproduces its point and joints within 1e-9", () => {
    const { samples } = trajectory
    const indices = [0, 1, Math.floor(samples.length / 2), samples.length - 2, samples.length - 1]
    for (const index of indices) {
      const sample = samples[index]
      const result = sampleAtFraction(trajectory, sample.scrubFraction)!
      for (let i = 0; i < 3; i++) {
        expect(result.point[i]).toBeCloseTo(sample.point[i], 9)
      }
      for (let i = 0; i < 6; i++) {
        expect(result.joints[i]).toBeCloseTo(sample.joints[i], 9)
      }
    }
  })

  it('every adjacent sample pair differs by less than 0.5 radians on every joint — the density premise for joint-space blending', () => {
    const { samples } = trajectory
    for (let i = 1; i < samples.length; i++) {
      const previous = samples[i - 1].joints
      const current = samples[i].joints
      for (let j = 0; j < 6; j++) {
        expect(Math.abs(current[j] - previous[j])).toBeLessThan(0.5)
      }
    }
  })
})
