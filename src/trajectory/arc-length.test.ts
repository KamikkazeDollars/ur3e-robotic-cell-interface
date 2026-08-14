import { describe, it, expect } from 'vitest'
import { flattenToolpathPoints, buildArcLengthTable, pointAtFraction } from './arc-length'
import type { ClassifiedSegment } from '../gcode/parseToolpath'

describe('flattenToolpathPoints', () => {
  it('merges a shared joint point between two segments into a single copy, preserving segment order', () => {
    const segments: ClassifiedSegment[] = [
      { type: 'cut', motion: 'G1', source: 'line', feedRate: null, points: [[0, 0, 0], [1, 0, 0]] },
      { type: 'cut', motion: 'G1', source: 'line', feedRate: null, points: [[1, 0, 0], [1, 1, 0]] },
    ]
    const points = flattenToolpathPoints(segments)
    expect(points).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ])
  })

  it('consumes segments in their original order, never regrouping by move type', () => {
    const segments: ClassifiedSegment[] = [
      { type: 'rapid', motion: 'G0', source: 'line', feedRate: null, points: [[0, 0, 0], [2, 0, 0]] },
      { type: 'cut', motion: 'G1', source: 'line', feedRate: 500, points: [[2, 0, 0], [2, 2, 0]] },
      { type: 'rapid', motion: 'G0', source: 'line', feedRate: null, points: [[2, 2, 0], [0, 2, 0]] },
    ]
    const points = flattenToolpathPoints(segments)
    expect(points).toEqual([
      [0, 0, 0],
      [2, 0, 0],
      [2, 2, 0],
      [0, 2, 0],
    ])
  })
})

describe('buildArcLengthTable', () => {
  it('sums leg lengths correctly for a hand-summable 3-4-5 right-triangle polyline', () => {
    const points: [number, number, number][] = [
      [0, 0, 0],
      [3, 0, 0],
      [3, 4, 0],
    ]
    const table = buildArcLengthTable(points)
    expect(table.totalLength).toBeCloseTo(7, 6) // 3 + 4
    expect(table.cumulative).toEqual([0, 3, 7])
    expect(table.cumulative.length).toBe(points.length)
    for (let i = 1; i < table.cumulative.length; i++) {
      expect(table.cumulative[i]).toBeGreaterThanOrEqual(table.cumulative[i - 1])
    }
  })

  it('produces a leading zero and matches point count for an empty or single-point input', () => {
    expect(buildArcLengthTable([])).toEqual({ cumulative: [], totalLength: 0 })
    expect(buildArcLengthTable([[1, 2, 3]])).toEqual({ cumulative: [0], totalLength: 0 })
  })
})

describe('pointAtFraction', () => {
  // Deliberately uneven point spacing (1 unit, then 3 units) — the
  // assertion that proves the parameterisation is arc length, not point
  // index: a naive index-based halfway point would land at points[1]
  // exactly, not 1/3 of the way into the second leg.
  const points: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 3, 0],
  ]
  const table = buildArcLengthTable(points)

  it('returns exactly the first point at fraction 0 and the last point at fraction 1', () => {
    expect(pointAtFraction(points, table, 0)).toEqual(points[0])
    expect(pointAtFraction(points, table, 1)).toEqual(points[2])
  })

  it('lands at the geometric halfway point by arc length, not by point index', () => {
    // total length = 4; half = 2 => 1 unit into the second leg (length 3)
    const half = pointAtFraction(points, table, 0.5)
    expect(half[0]).toBeCloseTo(1, 6)
    expect(half[1]).toBeCloseTo(1, 6) // 1/3 of the way up the 3-unit leg
    expect(half[2]).toBeCloseTo(0, 6)
  })

  it('clamps out-of-range fractions instead of throwing', () => {
    expect(() => pointAtFraction(points, table, -1)).not.toThrow()
    expect(() => pointAtFraction(points, table, 2)).not.toThrow()
    expect(pointAtFraction(points, table, -1)).toEqual(points[0])
    expect(pointAtFraction(points, table, 2)).toEqual(points[2])
  })

  it('returns the single point for every fraction on a one-point path, and the origin for an empty path', () => {
    expect(pointAtFraction([[5, 6, 7]], buildArcLengthTable([[5, 6, 7]]), 0.5)).toEqual([5, 6, 7])
    expect(pointAtFraction([], buildArcLengthTable([]), 0.5)).toEqual([0, 0, 0])
  })
})
