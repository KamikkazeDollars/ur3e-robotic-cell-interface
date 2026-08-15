// TDD RED for `buildTrailGeometry`/`traversedSegmentCount` (04-04-PLAN.md
// Task 1, gap closure G-04-1). Most fixtures below are hand-built
// `CompiledTrajectory`-shaped objects with hand-chosen sample values, so
// every expected number here is computable by hand rather than derived from
// the implementation under test — same discipline
// `src/trajectory/sample-lookup.test.ts` already establishes. The final
// describe block exercises the real compiler (`compileTrajectory`) against
// the same square-toolpath fixture `compile.test.ts`/`sample-lookup.test.ts`
// use, proving the uniformity and no-overshoot premises against real data
// rather than assuming them.
import { describe, it, expect } from 'vitest'
import { buildTrailGeometry, traversedSegmentCount, type TrailGeometry } from './trail-progress'
import { compileTrajectory } from '../trajectory/compile'
import type { CompiledTrajectory, TrajectorySample } from '../trajectory/compile'
import type { ClassifiedSegment, ParsedToolpath } from '../gcode/parseToolpath'
import { TOOLPATH_ANCHOR_OFFSET } from '../gcode/toolpath-anchor'
import type { JointAngles } from '../kinematics'

const ZERO_JOINTS: JointAngles = [0, 0, 0, 0, 0, 0]

function buildSample(scrubFraction: number, point: [number, number, number]): TrajectorySample {
  return {
    scrubFraction,
    point,
    joints: ZERO_JOINTS,
    railPos: 0,
    tcpPosition: { x: point[0], y: point[1], z: point[2] },
    singularityFlags: { wrist: false, shoulder: false, elbow: false, any: false },
  }
}

function buildTrajectory(
  samples: TrajectorySample[],
  travelLength: number,
  toolpathLength: number,
  status: CompiledTrajectory['status'] = 'ready',
): CompiledTrajectory {
  return {
    samples,
    railPos: 0,
    status,
    requestedSampleCount: samples.length,
    travelLength,
    toolpathLength,
  }
}

/** Same square toolpath `compile.test.ts`/`sample-lookup.test.ts` use —
 * reachable at this scale, verified there via the planner spike. */
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

describe('buildTrailGeometry — degenerate inputs', () => {
  it('returns null for a null trajectory', () => {
    expect(buildTrailGeometry(null)).toBeNull()
  })

  it('returns null for a trajectory with zero samples', () => {
    expect(buildTrailGeometry(buildTrajectory([], 2, 8))).toBeNull()
  })

  it('returns null when the toolpath phase holds fewer than two samples (one toolpath sample)', () => {
    const trajectory = buildTrajectory(
      [
        buildSample(0, [0, 0, 0]),
        buildSample(0.1, [1, 0, 0]),
        buildSample(0.2, [10, 0, 0]), // the only toolpath-phase sample
      ],
      2,
      8,
    )
    expect(buildTrailGeometry(trajectory)).toBeNull()
  })

  it('returns null when the toolpath phase holds zero samples (every sample below the boundary)', () => {
    const trajectory = buildTrajectory([buildSample(0, [0, 0, 0]), buildSample(0.1, [1, 0, 0])], 2, 8)
    expect(buildTrailGeometry(trajectory)).toBeNull()
  })
})

describe('buildTrailGeometry — travel/toolpath split', () => {
  it('holds exactly the toolpath-phase points in order, and none of the travel points', () => {
    // travelLength 2, toolpathLength 8 -> boundary fraction exactly 0.2,
    // matching the first toolpath sample's own scrubFraction below.
    const trajectory = buildTrajectory(
      [
        buildSample(0, [0, 0, 0]),
        buildSample(0.05, [1, 0, 0]),
        buildSample(0.1, [2, 0, 0]),
        buildSample(0.2, [10, 0, 0]),
        buildSample(0.4, [11, 0, 0]),
        buildSample(0.6, [12, 0, 0]),
        buildSample(1, [13, 0, 0]),
      ],
      2,
      8,
    )

    const trail = buildTrailGeometry(trajectory)
    expect(trail).not.toBeNull()
    expect(trail!.points).toEqual([
      [10, 0, 0],
      [11, 0, 0],
      [12, 0, 0],
      [13, 0, 0],
    ])
  })

  it('startFraction equals the first toolpath sample\'s own scrubFraction, endFraction the last', () => {
    const trajectory = buildTrajectory(
      [
        buildSample(0, [0, 0, 0]),
        buildSample(0.1, [1, 0, 0]),
        buildSample(0.2, [10, 0, 0]),
        buildSample(0.6, [11, 0, 0]),
        buildSample(1, [12, 0, 0]),
      ],
      2,
      8,
    )
    const trail = buildTrailGeometry(trajectory)!
    expect(trail.startFraction).toBe(0.2)
    expect(trail.endFraction).toBe(1)
  })

  it('a zero-length travel phase (startFraction 0) still returns every sample as a trail point', () => {
    const trajectory = buildTrajectory(
      [buildSample(0, [0, 0, 0]), buildSample(0.5, [1, 0, 0]), buildSample(1, [2, 0, 0])],
      0,
      10,
    )
    const trail = buildTrailGeometry(trajectory)!
    expect(trail.points).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ])
    expect(trail.startFraction).toBe(0)
  })
})

describe('traversedSegmentCount — boundary and monotonicity, over a 5-point (4-segment) trail', () => {
  // Uniform interior fractions 0.2, 0.4, 0.6, 0.8, 1.0 — mirrors the real
  // compiler's uniform arc-length step within the toolpath phase.
  const trail: TrailGeometry = {
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
      [4, 0, 0],
    ],
    startFraction: 0.2,
    endFraction: 1,
  }
  const segmentCount = trail.points.length - 1 // 4

  it('returns 0 at fraction 0', () => {
    expect(traversedSegmentCount(trail, 0)).toBe(0)
  })

  it('returns 0 at a fraction strictly below startFraction', () => {
    expect(traversedSegmentCount(trail, 0.1)).toBe(0)
  })

  it('returns 0 at exactly startFraction', () => {
    expect(traversedSegmentCount(trail, 0.2)).toBe(0)
  })

  it('returns segmentCount at exactly endFraction', () => {
    expect(traversedSegmentCount(trail, 1)).toBe(segmentCount)
  })

  it('returns segmentCount at every fraction above endFraction', () => {
    expect(traversedSegmentCount(trail, 1.5)).toBe(segmentCount)
  })

  it.each([
    [0.4, 1],
    [0.6, 2],
    [0.8, 3],
  ])('returns exactly %i segments for fraction %p landing on an interior sample fraction', (fraction, expected) => {
    expect(traversedSegmentCount(trail, fraction)).toBe(expected)
  })

  it('never counts an unfinished segment: a fraction midway between two sample fractions returns the lower count', () => {
    // Midway between the k=1 (0.4) and k=2 (0.6) sample fractions.
    expect(traversedSegmentCount(trail, 0.5)).toBe(1)
  })

  it('is non-decreasing across a sweep of 200 fractions from 0 to 1', () => {
    let previous = -1
    for (let i = 0; i <= 200; i++) {
      const fraction = i / 200
      const count = traversedSegmentCount(trail, fraction)
      expect(count).toBeGreaterThanOrEqual(previous)
      previous = count
    }
  })

  it.each([NaN, Infinity, -Infinity, -1, 2])(
    'returns a finite value inside [0, segmentCount] for fraction %p',
    (fraction) => {
      const count = traversedSegmentCount(trail, fraction)
      expect(Number.isFinite(count)).toBe(true)
      expect(count).toBeGreaterThanOrEqual(0)
      expect(count).toBeLessThanOrEqual(segmentCount)
    },
  )
})

describe('traversedSegmentCount — truncated (frozen-at-unreachable) trail whose endFraction is below 1', () => {
  const trail: TrailGeometry = {
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ],
    startFraction: 0,
    endFraction: 0.6,
  }
  const segmentCount = trail.points.length - 1 // 3

  it('reaches full segment count at its own last sample fraction (0.6), not only at 1', () => {
    expect(traversedSegmentCount(trail, 0.6)).toBe(segmentCount)
  })

  it('stays at full segment count for fraction 1, rather than staying permanently short', () => {
    expect(traversedSegmentCount(trail, 1)).toBe(segmentCount)
  })
})

describe('buildTrailGeometry / traversedSegmentCount — real compiled trajectory (density + no-overshoot)', () => {
  const toolpath = buildSquareToolpath()
  const trajectory = compileTrajectory(toolpath)
  const trail = buildTrailGeometry(trajectory)

  it('is a non-trivial, ready trajectory with a built trail (sanity check on the fixture itself)', () => {
    expect(trajectory.status).toBe('ready')
    expect(trail).not.toBeNull()
    expect(trail!.points.length).toBeGreaterThan(10)
  })

  it('every adjacent pair of toolpath-phase sample fractions differs by the same step within 1e-9 — the uniformity premise', () => {
    const boundary = trajectory.travelLength / (trajectory.travelLength + trajectory.toolpathLength)
    const toolpathSamples = trajectory.samples.filter((s) => s.scrubFraction >= boundary - 1e-9)
    expect(toolpathSamples.length).toBe(trail!.points.length)

    const steps: number[] = []
    for (let i = 1; i < toolpathSamples.length; i++) {
      steps.push(toolpathSamples[i].scrubFraction - toolpathSamples[i - 1].scrubFraction)
    }
    const firstStep = steps[0]
    for (const step of steps) {
      expect(Math.abs(step - firstStep)).toBeLessThan(1e-9)
    }
  })

  it("the highlight's leading vertex is never at a fraction ahead of the swept fraction (no-overshoot invariant)", () => {
    const boundary = trajectory.travelLength / (trajectory.travelLength + trajectory.toolpathLength)
    const toolpathSamples = trajectory.samples.filter((s) => s.scrubFraction >= boundary - 1e-9)

    for (let i = 0; i <= 200; i++) {
      const fraction = i / 200
      const count = traversedSegmentCount(trail!, fraction)
      if (count === 0) continue
      const leadingVertexFraction = toolpathSamples[count].scrubFraction
      expect(leadingVertexFraction).toBeLessThanOrEqual(fraction + 1e-9)
    }
  })
})
