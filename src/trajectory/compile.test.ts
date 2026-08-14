// The tracer's own end-to-end proof: reference values come from
// `forwardKinematics`, which is already independently tested against a
// known reference pose (forward-kinematics.test.ts) — never from the
// solver's own output. This is the load-bearing gate for 03-01-PLAN.md's
// "Verified IK port contract": if the frame conversion or the solver's port
// were ever wrong, this test — not a visual scrub in the running app — is
// what catches it.
import { describe, it, expect } from 'vitest'
import { compileTrajectory, dhFrameToScene } from './compile'
import { flattenToolpathPoints } from './arc-length'
import { forwardKinematics, RAIL_CENTER_X } from '../kinematics'
import { ROBOT_MOUNT_WORLD, TOOLPATH_ANCHOR_OFFSET } from '../gcode/toolpath-anchor'
import type { ClassifiedSegment, ParsedToolpath } from '../gcode/parseToolpath'

/** A closed, 150mm-side square perimeter centred on the D-06 anchor's own
 * X/Z at its Y — the same world-space region the real bundled samples
 * occupy, and the region 03-01-PLAN.md's planner spike measured as fully
 * reachable (49/49 points over a 7x7 grid at this scale). */
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

describe('compileTrajectory', () => {
  const toolpath = buildSquareToolpath()
  const result = compileTrajectory(toolpath)

  it('returns a ready, non-empty trajectory', () => {
    expect(result.status).toBe('ready')
    expect(result.samples.length).toBeGreaterThan(0)
    expect(result.requestedSampleCount).toBe(result.samples.length)
  })

  it('produces monotonically non-decreasing scrubFraction values from 0 to 1', () => {
    for (let i = 1; i < result.samples.length; i++) {
      expect(result.samples[i].scrubFraction).toBeGreaterThanOrEqual(result.samples[i - 1].scrubFraction)
    }
    expect(result.samples[0].scrubFraction).toBe(0)
    expect(result.samples[result.samples.length - 1].scrubFraction).toBe(1)
  })

  it('resolves a single rail position shared by every sample', () => {
    for (const sample of result.samples) {
      expect(sample.railPos).toBe(result.railPos)
    }
  })

  it("FK-reproduces every sample's own toolpath point to within 1e-6 metres", () => {
    for (const sample of result.samples) {
      const fk = forwardKinematics(sample.joints, sample.railPos - RAIL_CENTER_X)
      const scenePoint = dhFrameToScene(fk.tcpPosition, ROBOT_MOUNT_WORLD)
      expect(scenePoint[0]).toBeCloseTo(sample.point[0], 6)
      expect(scenePoint[1]).toBeCloseTo(sample.point[1], 6)
      expect(scenePoint[2]).toBeCloseTo(sample.point[2], 6)
    }
  })

  it("the first and last samples' points equal the flattened path's first and last points exactly", () => {
    const flattened = flattenToolpathPoints(toolpath.segments)
    expect(result.samples[0].point).toEqual(flattened[0])
    expect(result.samples[result.samples.length - 1].point).toEqual(flattened[flattened.length - 1])
  })
})
