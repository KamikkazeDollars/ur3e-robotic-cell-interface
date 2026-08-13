// Numeric assertions against hand-computed arc geometry — no snapshotting.
// See arcTessellation.ts's header comment for the XY-plane-only, Z-linear-
// interpolation convention these test cases assume.
import { describe, it, expect } from 'vitest'
import { tessellateArc, ARC_SEGMENTS_PER_TURN } from './arcTessellation'

const CENTER: [number, number, number] = [40, 20, 0]
const QUARTER_START: [number, number, number] = [40, 10, 0]
const QUARTER_END: [number, number, number] = [50, 20, 0]

function distance2D(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Perpendicular distance from point p to the infinite line through a-b (2D, XY only). */
function distanceFromChord(
  p: readonly [number, number, number],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const [ax, ay] = a
  const [bx, by] = b
  const [px, py] = p
  const num = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax)
  const den = Math.hypot(by - ay, bx - ax)
  return den === 0 ? 0 : num / den
}

describe('tessellateArc', () => {
  it('quarter circle CCW (G3): first point is the exact start, last is the exact end', () => {
    const points = tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G3')
    expect(points[0]).toEqual(QUARTER_START)
    expect(points[points.length - 1]).toEqual(QUARTER_END)
  })

  it('quarter circle CCW (G3): every intermediate point sits on the true circle (radius 10, within 1e-9)', () => {
    const points = tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G3')
    for (const p of points) {
      expect(Math.abs(distance2D(p, CENTER) - 10)).toBeLessThan(1e-9)
    }
  })

  it('quarter circle CCW (G3) vs CW (G2): CW sweeps the complementary 270 degrees, farther from the chord', () => {
    const ccw = tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G3')
    const cw = tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G2')

    expect(cw[0]).toEqual(QUARTER_START)
    expect(cw[cw.length - 1]).toEqual(QUARTER_END)

    const ccwMaxChordDist = Math.max(
      ...ccw.map((p) => distanceFromChord(p, QUARTER_START, QUARTER_END)),
    )
    const cwMaxChordDist = Math.max(
      ...cw.map((p) => distanceFromChord(p, QUARTER_START, QUARTER_END)),
    )
    expect(cwMaxChordDist).toBeGreaterThan(ccwMaxChordDist)
  })

  it('full circle (start equals end, non-zero radius): sweeps a full turn, not a degenerate point', () => {
    const start: [number, number, number] = [50, 20, 0]
    const points = tessellateArc(CENTER, start, start, 'G3')

    expect(points[0]).toEqual(start)
    expect(points[points.length - 1]).toEqual(start)
    expect(points.length).toBeGreaterThan(10)

    // At least one intermediate point is far from the start (proves it swept
    // around the circle rather than collapsing to a single repeated point).
    const farthest = Math.max(...points.map((p) => distance2D(p, start)))
    expect(farthest).toBeGreaterThan(15) // diameter is 20, so a genuine sweep gets well past a near-zero distance
  })

  it('degenerate arc (start, end, centre all coincide): returns exactly the two endpoints', () => {
    const point: [number, number, number] = [5, 5, 1]
    const points = tessellateArc(point, point, point, 'G3')
    expect(points).toEqual([point, point])
  })

  it('point count scales with swept angle: quarter turn yields roughly a quarter of ARC_SEGMENTS_PER_TURN intermediate points', () => {
    const points = tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G3')
    const intermediateCount = points.length - 2
    const expectedApprox = ARC_SEGMENTS_PER_TURN / 4
    expect(intermediateCount).toBeGreaterThan(expectedApprox * 0.5)
    expect(intermediateCount).toBeLessThan(expectedApprox * 1.5)
  })

  it('every returned coordinate is finite across all cases above', () => {
    const cases: [number, number, number][][] = [
      tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G3'),
      tessellateArc(CENTER, QUARTER_START, QUARTER_END, 'G2'),
      tessellateArc(CENTER, [50, 20, 0], [50, 20, 0], 'G3'),
      tessellateArc([5, 5, 1], [5, 5, 1], [5, 5, 1], 'G3'),
    ]
    for (const points of cases) {
      for (const [x, y, z] of points) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
        expect(Number.isFinite(z)).toBe(true)
      }
    }
  })

  it('Z interpolates linearly from start to end (helical move)', () => {
    const start: [number, number, number] = [40, 10, 0]
    const end: [number, number, number] = [50, 20, 10]
    const points = tessellateArc(CENTER, start, end, 'G3')
    const mid = points[Math.floor(points.length / 2)]
    expect(mid[2]).toBeGreaterThan(0)
    expect(mid[2]).toBeLessThan(10)
  })
})
