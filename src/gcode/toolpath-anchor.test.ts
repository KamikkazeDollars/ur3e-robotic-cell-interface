// Mechanical proof of D-06 ("positioned in front of the robot within its
// reach envelope") rather than an assertion left in prose. Reads both
// bundled fixtures from disk (same discipline as parseToolpath.test.ts /
// urdf-asset.test.ts) and calls the real forwardKinematics module — not a
// hand-ported matrix chain — so this pins a value the repo actually
// computes, for Phase 3 to rely on.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseToolpath } from './parseToolpath'
import {
  ROBOT_MOUNT_WORLD,
  TOOLPATH_ANCHOR_OFFSET,
  CARRIAGE_FRONT_FACE_Z,
  WORKBENCH_TOP_Y,
  toolpathAnchorForMode,
} from './toolpath-anchor'
import { ROBOT_REACH_ENVELOPE, RIG_Z_OFFSET, CARRIAGE_TOP_Y } from '../scene/RailRig'
import { forwardKinematics, UR3E_READY_POSE, RAIL_CENTER_X, railStartXForMode } from '../kinematics'

function readSample(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

function distanceFromMount(point: readonly [number, number, number]): number {
  return Math.hypot(
    point[0] - ROBOT_MOUNT_WORLD.x,
    point[1] - ROBOT_MOUNT_WORLD.y,
    point[2] - ROBOT_MOUNT_WORLD.z,
  )
}

describe('D-06 anchor: bundled samples land inside the robot reach envelope', () => {
  it('every point of the anchored print sample is within ROBOT_REACH_ENVELOPE of ROBOT_MOUNT_WORLD', () => {
    const result = parseToolpath(readSample('public/gcode/print-sample.gcode'))
    let farthest = 0
    for (const segment of result.segments) {
      for (const point of segment.points) {
        farthest = Math.max(farthest, distanceFromMount(point))
      }
    }
    expect(farthest).toBeLessThan(ROBOT_REACH_ENVELOPE)
  })

  it('every point of the anchored mill sample is within ROBOT_REACH_ENVELOPE of ROBOT_MOUNT_WORLD', () => {
    const result = parseToolpath(readSample('public/gcode/mill-sample.gcode'))
    let farthest = 0
    for (const segment of result.segments) {
      for (const point of segment.points) {
        farthest = Math.max(farthest, distanceFromMount(point))
      }
    }
    expect(farthest).toBeLessThan(ROBOT_REACH_ENVELOPE)
  })
})

describe('D-06 anchor: ready-pose TCP world position sits above the anchor and within reach horizontally', () => {
  it('forwardKinematics(UR3E_READY_POSE), composed through the scene frame rotation and mount offsets, places the TCP above the anchor Y and within ROBOT_REACH_ENVELOPE of it in the XZ plane', () => {
    const T = forwardKinematics(UR3E_READY_POSE)

    // Scene frame rotation (RobotModel.tsx's Rx(-90 degrees), z-up -> y-up):
    // scene-local x is the DH x, scene-local y is the DH z, scene-local z is
    // the negated DH y. Then compose with the mount offsets component-wise.
    const worldX = RAIL_CENTER_X + T.tcpPosition.x
    const worldY = CARRIAGE_TOP_Y + T.tcpPosition.z
    const worldZ = RIG_Z_OFFSET + -T.tcpPosition.y

    expect(worldY).toBeGreaterThan(TOOLPATH_ANCHOR_OFFSET.y)

    const horizontalDistance = Math.hypot(
      worldX - TOOLPATH_ANCHOR_OFFSET.x,
      worldZ - TOOLPATH_ANCHOR_OFFSET.z,
    )
    expect(horizontalDistance).toBeLessThan(ROBOT_REACH_ENVELOPE)
  })
})

describe('D-06 anchor: bundled samples clear the carriage front face (G-02-02)', () => {
  it("the anchored print sample's near (mount-facing) edge clears CARRIAGE_FRONT_FACE_Z", () => {
    const result = parseToolpath(readSample('public/gcode/print-sample.gcode'))
    let minZ = Infinity
    for (const segment of result.segments) {
      for (const point of segment.points) {
        minZ = Math.min(minZ, point[2])
      }
    }
    expect(minZ).toBeGreaterThan(CARRIAGE_FRONT_FACE_Z)
  })

  it("the anchored mill sample's near (mount-facing) edge clears CARRIAGE_FRONT_FACE_Z", () => {
    const result = parseToolpath(readSample('public/gcode/mill-sample.gcode'))
    let minZ = Infinity
    for (const segment of result.segments) {
      for (const point of segment.points) {
        minZ = Math.min(minZ, point[2])
      }
    }
    expect(minZ).toBeGreaterThan(CARRIAGE_FRONT_FACE_Z)
  })
})

describe('toolpathAnchorForMode (G-04-1 gap closure)', () => {
  it("takes its X solely from railStartXForMode for each mode — never restates the offset itself", () => {
    expect(toolpathAnchorForMode('printing').x).toBe(railStartXForMode('printing'))
    expect(toolpathAnchorForMode('milling').x).toBe(railStartXForMode('milling'))
  })

  it("shares TOOLPATH_ANCHOR_OFFSET's own y and z for both modes — only the rail station changes", () => {
    for (const mode of ['printing', 'milling'] as const) {
      const anchor = toolpathAnchorForMode(mode)
      expect(anchor.y).toBe(TOOLPATH_ANCHOR_OFFSET.y)
      expect(anchor.z).toBe(TOOLPATH_ANCHOR_OFFSET.z)
    }
  })

  it("parsing the print sample with an explicit mode anchor lands the bounds' X centre on that anchor's X and the min Y on WORKBENCH_TOP_Y", () => {
    const anchor = toolpathAnchorForMode('printing')
    const result = parseToolpath(readSample('public/gcode/print-sample.gcode'), anchor)
    expect(result.bounds).not.toBeNull()
    const centerX = (result.bounds!.min[0] + result.bounds!.max[0]) / 2
    expect(centerX).toBeCloseTo(anchor.x, 9)
    expect(result.bounds!.min[1]).toBeCloseTo(WORKBENCH_TOP_Y, 9)
  })

  it('parsing with no second argument reproduces, element for element, the existing centred-anchor result (default-argument regression guard)', () => {
    const gcodeText = readSample('public/gcode/print-sample.gcode')
    const withDefault = parseToolpath(gcodeText)
    const withExplicitCentred = parseToolpath(gcodeText, TOOLPATH_ANCHOR_OFFSET)
    expect(withDefault).toEqual(withExplicitCentred)
  })
})
