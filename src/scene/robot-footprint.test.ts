// Quick 260816-qym, Task 3: measures the UR3e's real rendered footprint
// from the shipped binary STL collision meshes and an FK keypoint sweep,
// rather than trusting the abstract `CARRIAGE_BASE_WIDTH` carriage-box
// constant the previous (failed) fix attempt grew. Same on-disk asset-
// reading discipline as `src/scene/urdf-asset.test.ts` (node `fs`, available
// because Vitest runs in the `node` environment here).
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  UR3E_BASE_MESH_RADIUS_M,
  UR3E_MAX_LINK_HALF_EXTENT_M,
  ROBOT_FOOTPRINT_HALF_WIDTH_X,
} from './robot-footprint'
import { UR3E_JOINT_LIMITS, UR3E_PARKED_POSE, RAIL_CENTER_X, type JointAngles } from '../kinematics'
import { poseKeypointsWorld } from '../collision'
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor'

const MESH_DIR = join(process.cwd(), 'public/robots/ur3e/meshes/ur3e/collision')

/** The seven link collision meshes, in an order that does not matter for
 * this measurement (every one is swept for the worst-case link). */
const MESH_FILES = ['base.stl', 'shoulder.stl', 'upperarm.stl', 'forearm.stl', 'wrist1.stl', 'wrist2.stl', 'wrist3.stl']

interface ParsedStl {
  triangleCount: number
  /** Every triangle vertex, in the mesh's own local frame — never
   * transformed here; that is FK's job, exercised separately below. */
  vertices: [number, number, number][]
}

/**
 * Parses a binary STL file: an 80-byte header, a little-endian uint32
 * triangle count at byte offset 80, then 50 bytes per triangle (a 12-byte
 * normal, three 12-byte vertices, a 2-byte attribute word). Verifies the
 * parse against the file's own size before trusting any extent — a
 * malformed/truncated file must fail loudly, not silently under-measure.
 */
function parseBinaryStl(filePath: string): ParsedStl {
  const buffer = readFileSync(filePath)
  const triangleCount = buffer.readUInt32LE(80)
  const expectedSize = 84 + 50 * triangleCount
  if (buffer.length !== expectedSize) {
    throw new Error(
      `STL parse verification failed for ${filePath}: expected ${expectedSize} bytes ` +
        `(84 + 50 * ${triangleCount} triangles) but the file is ${buffer.length} bytes`,
    )
  }

  const vertices: [number, number, number][] = []
  let offset = 84
  for (let i = 0; i < triangleCount; i++) {
    offset += 12 // skip the per-triangle normal vector
    for (let v = 0; v < 3; v++) {
      const x = buffer.readFloatLE(offset)
      const y = buffer.readFloatLE(offset + 4)
      const z = buffer.readFloatLE(offset + 8)
      vertices.push([x, y, z])
      offset += 12
    }
    offset += 2 // skip the trailing attribute byte count
  }
  return { triangleCount, vertices }
}

/** Maximum Euclidean distance from the mesh's own local origin to any
 * vertex — the measured stand-in for `COLLISION_LINK_RADIUS_M`, itself
 * documented in `pose-collision.ts` as a chosen figure, not a datasheet
 * value. */
function maxRadialHalfExtent(vertices: [number, number, number][]): number {
  let max = 0
  for (const [x, y, z] of vertices) {
    const distance = Math.hypot(x, y, z)
    if (distance > max) max = distance
  }
  return max
}

function measureAllLinks(): { fileName: string; radius: number }[] {
  return MESH_FILES.map((fileName) => {
    const parsed = parseBinaryStl(join(MESH_DIR, fileName))
    return { fileName, radius: maxRadialHalfExtent(parsed.vertices) }
  })
}

/** Evenly spaced sweep values across `[min, max]`, `steps` points inclusive
 * of both endpoints. */
function linspace(min: number, max: number, steps: number): number[] {
  const values: number[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    values.push(min + t * (max - min))
  }
  return values
}

const SWEEP_STEPS_PER_JOINT = 9

/**
 * Sweeps joints 0-3 (base, shoulder, elbow, wrist_1) over
 * `UR3E_JOINT_LIMITS` on a coarse grid, wrists 2/3 held at
 * `UR3E_PARKED_POSE`'s own values, and returns the worst-case (largest)
 * `|keypoint.x - ROBOT_MOUNT_WORLD.x|` seen across the whole sweep, plus the
 * `UR3E_PARKED_POSE`-alone figure for comparison.
 */
function sweepWorstCaseHalfWidthX(): { sweepMax: number; parkedOnly: number } {
  const j0Values = linspace(UR3E_JOINT_LIMITS[0].min, UR3E_JOINT_LIMITS[0].max, SWEEP_STEPS_PER_JOINT)
  const j1Values = linspace(UR3E_JOINT_LIMITS[1].min, UR3E_JOINT_LIMITS[1].max, SWEEP_STEPS_PER_JOINT)
  const j2Values = linspace(UR3E_JOINT_LIMITS[2].min, UR3E_JOINT_LIMITS[2].max, SWEEP_STEPS_PER_JOINT)
  const j3Values = linspace(UR3E_JOINT_LIMITS[3].min, UR3E_JOINT_LIMITS[3].max, SWEEP_STEPS_PER_JOINT)

  let sweepMax = 0
  for (const j0 of j0Values) {
    for (const j1 of j1Values) {
      for (const j2 of j2Values) {
        for (const j3 of j3Values) {
          const joints: JointAngles = [j0, j1, j2, j3, UR3E_PARKED_POSE[4], UR3E_PARKED_POSE[5]]
          const keypoints = poseKeypointsWorld(joints, RAIL_CENTER_X)
          for (const [x] of keypoints) {
            const halfWidth = Math.abs(x - ROBOT_MOUNT_WORLD.x)
            if (halfWidth > sweepMax) sweepMax = halfWidth
          }
        }
      }
    }
  }

  let parkedOnly = 0
  const parkedKeypoints = poseKeypointsWorld(UR3E_PARKED_POSE, RAIL_CENTER_X)
  for (const [x] of parkedKeypoints) {
    const halfWidth = Math.abs(x - ROBOT_MOUNT_WORLD.x)
    if (halfWidth > parkedOnly) parkedOnly = halfWidth
  }

  return { sweepMax, parkedOnly }
}

describe('robot-footprint measurement (quick 260816-qym, U-2)', () => {
  it('every collision mesh file exists on disk', () => {
    for (const fileName of MESH_FILES) {
      expect(existsSync(join(MESH_DIR, fileName))).toBe(true)
    }
  })

  it('every collision mesh parses to a triangle-count-consistent byte size', () => {
    for (const fileName of MESH_FILES) {
      const parsed = parseBinaryStl(join(MESH_DIR, fileName))
      expect(parsed.triangleCount).toBeGreaterThan(0)
      expect(parsed.vertices.length).toBe(parsed.triangleCount * 3)
    }
  })

  it('SCALE CHECK: the base mesh radial half-extent falls in a band consistent with a real UR3e base (~0.04-0.12m against the published ~128mm base diameter) — proves the shipped meshes are metres-native, agreeing with the metres-native rail geometry', () => {
    const baseMesh = measureAllLinks().find((link) => link.fileName === 'base.stl')
    expect(baseMesh).toBeDefined()
    expect(baseMesh!.radius).toBeGreaterThanOrEqual(0.04)
    expect(baseMesh!.radius).toBeLessThanOrEqual(0.12)
  })

  it('UR3E_BASE_MESH_RADIUS_M matches a fresh measurement of base.stl to within 1e-6', () => {
    const baseMesh = measureAllLinks().find((link) => link.fileName === 'base.stl')
    expect(baseMesh).toBeDefined()
    expect(UR3E_BASE_MESH_RADIUS_M).toBeCloseTo(baseMesh!.radius, 6)
  })

  it('UR3E_MAX_LINK_HALF_EXTENT_M matches the largest fresh measurement across all seven links to within 1e-6', () => {
    const links = measureAllLinks()
    const freshMax = Math.max(...links.map((link) => link.radius))
    expect(UR3E_MAX_LINK_HALF_EXTENT_M).toBeCloseTo(freshMax, 6)
  })

  it('ROBOT_FOOTPRINT_HALF_WIDTH_X matches a fresh joint-limit sweep (joints 0-3, 9 steps each, wrists 2/3 parked) plus the measured link half-extent, to within 1e-6', () => {
    const { sweepMax, parkedOnly } = sweepWorstCaseHalfWidthX()
    const links = measureAllLinks()
    const freshLinkHalfExtent = Math.max(...links.map((link) => link.radius))
    const freshFootprint = sweepMax + freshLinkHalfExtent

    expect(ROBOT_FOOTPRINT_HALF_WIDTH_X).toBeCloseTo(freshFootprint, 6)
    // The worst-case sweep must be at least as large as the parked-only
    // figure — the sweep explores strictly more of the joint-limit domain
    // than any single fixed pose.
    expect(sweepMax).toBeGreaterThanOrEqual(parkedOnly)
  })

  it('robot-footprint.ts declares no module-level import (no edge into the RailRig -> cellStore -> compile -> toolpath-anchor -> RailRig cycle)', () => {
    const source = readFileSync(join(process.cwd(), 'src/scene/robot-footprint.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
  })
})
