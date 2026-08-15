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
import { flattenToolpathPoints, buildArcLengthTable } from './arc-length'
import { forwardKinematics, RAIL_CENTER_X, UR3E_PARKED_POSE, type JointAngles } from '../kinematics'
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

describe('compileTrajectory — travel/toolpath length split', () => {
  const toolpath = buildSquareToolpath()
  const result = compileTrajectory(toolpath)

  it('both fields are finite and strictly greater than 0', () => {
    expect(Number.isFinite(result.travelLength)).toBe(true)
    expect(Number.isFinite(result.toolpathLength)).toBe(true)
    expect(result.travelLength).toBeGreaterThan(0)
    expect(result.toolpathLength).toBeGreaterThan(0)
  })

  it('their sum equals the total arc length (toolpath portion from buildArcLengthTable, travel portion measured from the compiled samples)', () => {
    const flattened = flattenToolpathPoints(toolpath.segments)
    const referenceToolpathLength = buildArcLengthTable(flattened).totalLength

    const boundarySample = result.samples.find(
      (sample) =>
        sample.point[0] === flattened[0][0] &&
        sample.point[1] === flattened[0][1] &&
        sample.point[2] === flattened[0][2],
    )!
    const travelSamples = result.samples.filter((sample) => sample.scrubFraction <= boundarySample.scrubFraction)
    let referenceTravelLength = 0
    for (let i = 1; i < travelSamples.length; i++) {
      const [x0, y0, z0] = travelSamples[i - 1].point
      const [x1, y1, z1] = travelSamples[i].point
      referenceTravelLength += Math.hypot(x1 - x0, y1 - y0, z1 - z0)
    }

    // The travel phase's own sub-path is 4 waypoints (parked pose, lift,
    // above-first-point, first point), not a straight line — the chord-sum
    // above under-measures by a small, bounded amount at the two interior
    // corners (adjacent samples straddling a bend measure a chord shorter
    // than the true bent arc), while every other adjacent pair lies on a
    // straight sub-segment where chord length equals arc length exactly.
    // Bounded by 2 corners * TRAJECTORY_SAMPLE_SPACING_M (2mm) each; 5mm is
    // a safe margin above that, well under 1% of the ~0.8m travel length.
    expect(result.toolpathLength).toBeCloseTo(referenceToolpathLength, 9)
    expect(Math.abs(result.travelLength - referenceTravelLength)).toBeLessThan(0.005)
    expect(result.travelLength + result.toolpathLength).toBeGreaterThanOrEqual(
      referenceTravelLength + referenceToolpathLength - 0.005,
    )
  })

  it("the sample whose point deep-equals the toolpath's first flattened point has scrubFraction equal to travelLength / (travelLength + toolpathLength) within 1e-9", () => {
    const flattened = flattenToolpathPoints(toolpath.segments)
    const boundarySample = result.samples.find(
      (sample) =>
        sample.point[0] === flattened[0][0] &&
        sample.point[1] === flattened[0][1] &&
        sample.point[2] === flattened[0][2],
    )!
    const expectedBoundaryFraction = result.travelLength / (result.travelLength + result.toolpathLength)
    expect(boundarySample.scrubFraction).toBeCloseTo(expectedBoundaryFraction, 9)
  })

  it('the degenerate branch (fewer than two distinct flattened points) returns 0 for both fields and keeps the existing samples: [] / status: ready contract', () => {
    const degenerateToolpath: ParsedToolpath = {
      segments: [
        {
          type: 'cut',
          motion: 'G1',
          source: 'line',
          points: [
            [0, 0, 0],
            [0, 0, 0],
          ],
          feedRate: 600,
        },
      ],
      unit: 'mm',
      skippedMotionCount: 0,
      appliedAnchorTranslation: [0, 0, 0],
      bounds: null,
    }
    const degenerateResult = compileTrajectory(degenerateToolpath)
    expect(degenerateResult.travelLength).toBe(0)
    expect(degenerateResult.toolpathLength).toBe(0)
    expect(degenerateResult.samples).toEqual([])
    expect(degenerateResult.status).toBe('ready')
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

// ---------------------------------------------------------------------------
// UAT regression (03-UAT.md G-03-1 / G-03-3, debug session
// `table-clipping-singularities`). The two gates below exist because the
// TCP-only check above passed while the arm was visibly whipping and driving
// its ELBOW to within 8mm of the tabletop: `sample.point` is the target the
// TCP is solved to, and that target was never the thing going wrong.
// ---------------------------------------------------------------------------

/**
 * The arm's kinematic skeleton in scene space: the rail-offset base, then the
 * six FK frame origins, joined in order. Derived from `forwardKinematics` and
 * `dhFrameToScene` — the modules that already own that math — so this can
 * never disagree with the pose the renderer is handed.
 *
 * This is a centre-line approximation of the arm, not its mesh hull: the real
 * UR3e links have roughly 0.04-0.06m of radius around these segments, which
 * is exactly why a centre-line clearance in the low centimetres reads as a
 * visible pass-through on screen.
 */
function armSkeletonScenePoints(joints: JointAngles, railOffsetFromCenter: number): [number, number, number][] {
  const fk = forwardKinematics(joints, railOffsetFromCenter)
  const points: [number, number, number][] = [
    dhFrameToScene({ x: railOffsetFromCenter, y: 0, z: 0 }, ROBOT_MOUNT_WORLD),
  ]
  for (const frame of fk.frames) {
    points.push(dhFrameToScene({ x: frame[0][3], y: frame[1][3], z: frame[2][3] }, ROBOT_MOUNT_WORLD))
  }
  return points
}

/** Distance from a scene point to the tabletop's axis-aligned box (0 inside). */
function distanceToTabletop([x, y, z]: [number, number, number]): number {
  const TABLE_BOTTOM_Y = TABLE_TOP_Y - 0.04 // Workbench.tsx's TABLETOP_THICKNESS
  return Math.hypot(
    Math.max(TABLE_X_MIN - x, 0, x - TABLE_X_MAX),
    Math.max(TABLE_BOTTOM_Y - y, 0, y - TABLE_TOP_Y),
    Math.max(TABLE_NEAR_Z - z, 0, z - TABLE_FAR_Z),
  )
}

/** Minimum tabletop distance over the whole densely-sampled skeleton. */
function minSkeletonDistanceToTabletop(joints: JointAngles, railOffsetFromCenter: number): number {
  const points = armSkeletonScenePoints(joints, railOffsetFromCenter)
  let minimum = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const STEPS = 40
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS
      minimum = Math.min(
        minimum,
        distanceToTabletop([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]),
      )
    }
  }
  return minimum
}

describe('compileTrajectory — the whole ARM (not just the TCP) clears the table while traversing', () => {
  // The travel move's horizontal traverse runs at a single clearance plane —
  // `TRAVEL_CLEARANCE_ABOVE_TABLE_M` above everything below it — which is
  // strictly higher than any toolpath point, so "samples sitting at the
  // highest Y any sample targets" isolates exactly the traverse. During that
  // traverse the tool is going nowhere near the work, so EVERY link must stay
  // well clear of the tabletop.
  //
  // 0.05m is deliberately below the 0.08m the clearance constant is designed
  // to deliver (leaving headroom for the arm's own articulation) but an order
  // of magnitude above the 0.008m the wrap-blind branch metric produced.
  const MIN_TRAVERSE_CLEARANCE_M = 0.05

  for (const sampleId of ['print', 'mill']) {
    it(`keeps every ${sampleId}-sample arm link clear of the tabletop through the clearance-plane traverse`, () => {
      const gcodeText = readFileSync(join(process.cwd(), `public/gcode/${sampleId}-sample.gcode`), 'utf8')
      const result = compileTrajectory(parseToolpath(gcodeText))
      expect(result.status).toBe('ready')

      const railOffsetFromCenter = result.railPos - RAIL_CENTER_X
      const clearancePlaneY = Math.max(...result.samples.map((sample) => sample.point[1]))
      const traverseSamples = result.samples.filter(
        (sample) => Math.abs(sample.point[1] - clearancePlaneY) < 1e-9,
      )
      // Guards the guard: if the traverse ever stopped being identifiable
      // this way, the assertion below would vacuously pass.
      expect(traverseSamples.length).toBeGreaterThan(10)

      let worst = { clearance: Infinity, scrubFraction: -1 }
      for (const sample of traverseSamples) {
        const clearance = minSkeletonDistanceToTabletop(sample.joints, railOffsetFromCenter)
        if (clearance < worst.clearance) worst = { clearance, scrubFraction: sample.scrubFraction }
      }

      expect(
        worst.clearance,
        `closest arm link came within ${worst.clearance.toFixed(4)}m of the tabletop at scrubFraction ${worst.scrubFraction.toFixed(4)}`,
      ).toBeGreaterThan(MIN_TRAVERSE_CLEARANCE_M)
    })
  }
})

describe('compileTrajectory — adjacent samples never snap (D-03 continuity, end to end)', () => {
  // `inverse-kinematics.test.ts` already asserts continuity along a synthetic
  // straight line, but that line never crosses a joint's (-pi, pi] wrap
  // boundary. The REAL compiled travel move does — which is where a 4.28 rad
  // single-step whole-arm reconfiguration was hiding. This gate therefore runs
  // over the real bundled g-code, across BOTH phases, including the
  // parked-pose-to-first-solve transition at index 0->1 (which was itself a
  // 1.57 rad wrist snap, from an authored parked pose whose flange orientation
  // did not match `buildToolDownTarget`'s).
  //
  // At `TRAJECTORY_SAMPLE_SPACING_M` (2mm) between samples, a legitimate step
  // is a small fraction of a radian; 0.25 rad (~14 degrees) is far above any
  // real step and far below the 1.57/2.52/4.28 rad snaps this guards against.
  const MAX_ADJACENT_JOINT_STEP_RAD = 0.25

  for (const sampleId of ['print', 'mill']) {
    it(`never steps a ${sampleId}-sample joint more than ${MAX_ADJACENT_JOINT_STEP_RAD} rad between adjacent samples`, () => {
      const gcodeText = readFileSync(join(process.cwd(), `public/gcode/${sampleId}-sample.gcode`), 'utf8')
      const result = compileTrajectory(parseToolpath(gcodeText))
      expect(result.status).toBe('ready')

      let worst = { step: 0, index: -1, joint: -1 }
      for (let i = 1; i < result.samples.length; i++) {
        const previous = result.samples[i - 1].joints
        const current = result.samples[i].joints
        for (let j = 0; j < 6; j++) {
          const step = Math.abs(current[j] - previous[j])
          if (step > worst.step) worst = { step, index: i, joint: j }
        }
      }

      expect(
        worst.step,
        `joint ${worst.joint} stepped ${worst.step.toFixed(4)} rad between samples ${worst.index - 1} and ${worst.index} ` +
          `(scrubFraction ${result.samples[worst.index]?.scrubFraction.toFixed(4)})`,
      ).toBeLessThan(MAX_ADJACENT_JOINT_STEP_RAD)
    })
  }
})
