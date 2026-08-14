// The tracer's own end-to-end proof: reference values come from
// `forwardKinematics`, which is already independently tested against a
// known reference pose (forward-kinematics.test.ts) — never from the
// solver's own output. This is the load-bearing gate for 03-01-PLAN.md's
// "Verified IK port contract": if the frame conversion or the solver's port
// were ever wrong, this test — not a visual scrub in the running app — is
// what catches it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { compileTrajectory, dhFrameToScene } from './compile'
import { flattenToolpathPoints } from './arc-length'
import { forwardKinematics, RAIL_CENTER_X, UR3E_PARKED_POSE } from '../kinematics'
import { ROBOT_MOUNT_WORLD, TOOLPATH_ANCHOR_OFFSET, CARRIAGE_FRONT_FACE_Z } from '../gcode/toolpath-anchor'
import { parseToolpath } from '../gcode/parseToolpath'
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

  it("scrub fraction 0 is the literal parked pose, and the last sample's point equals the flattened path's last point exactly", () => {
    // Revised must-have (scope expansion, checkpoint follow-up): fraction 0
    // is the authored home/parked waypoint, not the toolpath's own first
    // point — the travel move's END is what lands on the toolpath start
    // (see the next test).
    expect(result.samples[0].joints).toEqual(UR3E_PARKED_POSE)
    expect(result.samples[0].scrubFraction).toBe(0)

    const flattened = flattenToolpathPoints(toolpath.segments)
    const last = result.samples[result.samples.length - 1]
    expect(last.point).toEqual(flattened[flattened.length - 1])
    expect(last.scrubFraction).toBe(1)
  })

  it('the home-to-start travel move lands EXACTLY on the toolpath\'s first point at some sample', () => {
    // The revised must-have's core claim: not "close to", but an EXACT
    // scene-space match — pointAtFraction's own exact-endpoint guarantee,
    // applied to the travel sub-path, is what makes this exact rather than
    // a discretisation coincidence.
    const flattened = flattenToolpathPoints(toolpath.segments)
    const boundarySample = result.samples.find(
      (sample) =>
        sample.point[0] === flattened[0][0] &&
        sample.point[1] === flattened[0][1] &&
        sample.point[2] === flattened[0][2],
    )
    expect(boundarySample).toBeDefined()
    // It must not be the very first sample (fraction 0 is the parked pose,
    // per the test above) — there is a genuine travel move in between.
    expect(boundarySample!.scrubFraction).toBeGreaterThan(0)
    expect(boundarySample!.scrubFraction).toBeLessThan(1)
  })

  it('every sample carries singularityFlags whose `any` field agrees with the disjunction of the other three', () => {
    // Deliberately no assertion on specific flag VALUES: this toolpath is
    // not constructed to pass through a singularity, so pinning a
    // particular outcome would encode an accident of the sample rather than
    // a contract (see `classifySingularity.test.ts` for the family-level
    // coverage against deliberately-chosen singular joint tuples).
    for (const sample of result.samples) {
      const { wrist, shoulder, elbow, any } = sample.singularityFlags
      expect(typeof wrist).toBe('boolean')
      expect(typeof shoulder).toBe('boolean')
      expect(typeof elbow).toBe('boolean')
      expect(any).toBe(wrist || shoulder || elbow)
    }
  })

  it('the travel move is genuinely composed of multiple independent solves, not a single synthesised hop (SIM-05)', () => {
    const flattened = flattenToolpathPoints(toolpath.segments)
    const boundaryFraction = result.samples.find(
      (sample) =>
        sample.point[0] === flattened[0][0] &&
        sample.point[1] === flattened[0][1] &&
        sample.point[2] === flattened[0][2],
    )!.scrubFraction

    const intermediateTravelSamples = result.samples.filter(
      (sample) => sample.scrubFraction > 0 && sample.scrubFraction < boundaryFraction,
    )
    expect(intermediateTravelSamples.length).toBeGreaterThan(0)
  })
})

// Checkpoint follow-up regression: the travel move (parked pose -> toolpath
// first point) must never pass through the table. This reproduces
// Workbench.tsx's own footprint derivation (never a second, independently
// guessed literal — same discipline that file itself documents) and checks
// every compiled sample's point against it, over the REAL bundled g-code
// files (not just the synthetic square above), since the actual clip this
// regression guards against was only reproducible against the real print
// sample's specific geometry.
const TABLE_NEAR_EDGE_STANDOFF = 0.02
const TABLE_FAR_EDGE_PAD = 0.15
const TABLE_WIDTH = 0.5
const TABLE_X_MIN = TOOLPATH_ANCHOR_OFFSET.x - TABLE_WIDTH / 2
const TABLE_X_MAX = TOOLPATH_ANCHOR_OFFSET.x + TABLE_WIDTH / 2
const TABLE_NEAR_Z = CARRIAGE_FRONT_FACE_Z + TABLE_NEAR_EDGE_STANDOFF
const TABLE_FAR_Z = TOOLPATH_ANCHOR_OFFSET.z + TABLE_FAR_EDGE_PAD
const TABLE_TOP_Y = TOOLPATH_ANCHOR_OFFSET.y

describe('compileTrajectory — travel move clears the table (checkpoint regression)', () => {
  for (const sampleId of ['print', 'mill']) {
    it(`never routes a ${sampleId}-sample travel-move point through the table's footprint below its top surface`, () => {
      const gcodeText = readFileSync(join(process.cwd(), `public/gcode/${sampleId}-sample.gcode`), 'utf8')
      const toolpath = parseToolpath(gcodeText)
      const result = compileTrajectory(toolpath)

      expect(result.status).toBe('ready')

      const clippingSamples = result.samples.filter((sample) => {
        const [x, y, z] = sample.point
        const insideFootprint = x >= TABLE_X_MIN && x <= TABLE_X_MAX && z >= TABLE_NEAR_Z && z <= TABLE_FAR_Z
        // 1mm tolerance: legitimate toolpath points sit exactly AT table
        // top height, which must not itself be flagged.
        const belowTableTop = y < TABLE_TOP_Y - 0.001
        return insideFootprint && belowTableTop
      })

      expect(clippingSamples).toEqual([])
    })
  }
})
