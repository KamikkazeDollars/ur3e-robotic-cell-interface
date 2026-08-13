// Asset-integrity gate for the shipped UR3e description (SCENE-04, T-01-10).
//
// This test is the mechanically-checkable half of "the rendered robot is the
// same machine the forward-kinematics module was verified against" — it does
// not trust that the description "looks right"; it parses the actual shipped
// XML and cross-checks it against the kinematics module's own DH constants
// and joint-name list, then proves every mesh the description references
// resolves to a real file under the public asset path.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { UR3E_JOINT_NAMES, UR3E_DH } from '../kinematics/ur3e-dh'

const URDF_PATH = join(process.cwd(), 'public/robots/ur3e/ur3e.urdf')
const MESH_ROOT = join(process.cwd(), 'public/robots/ur3e')

function readUrdf(): string {
  return readFileSync(URDF_PATH, 'utf8')
}

/** Extracts the <origin xyz="x y z"/> immediately inside a named revolute joint block.
 * Matches only `type="revolute"` joint tags — the same description also declares a
 * `<transmission>` block per joint whose inner `<joint name="...">` tag (no `type`
 * attribute) would otherwise shadow the real kinematic joint definition. */
function getJointOriginXyz(urdf: string, jointName: string): [number, number, number] {
  const jointBlockMatch = urdf.match(
    new RegExp(`<joint name="${jointName}" type="revolute">([\\s\\S]*?)</joint>`),
  )
  if (!jointBlockMatch) {
    throw new Error(`joint "${jointName}" not found in URDF`)
  }
  const originMatch = jointBlockMatch[1].match(/<origin[^>]*xyz="([^"]+)"/)
  if (!originMatch) {
    throw new Error(`joint "${jointName}" has no <origin xyz=...> element`)
  }
  const [x, y, z] = originMatch[1].trim().split(/\s+/).map(Number)
  return [x, y, z]
}

/** Extracts every distinct package://ur_description/<rest> mesh reference. */
function getMeshReferences(urdf: string): string[] {
  const refs = new Set<string>()
  const re = /filename="package:\/\/ur_description\/([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(urdf)) !== null) {
    refs.add(m[1])
  }
  return Array.from(refs)
}

describe('urdf-asset integrity', () => {
  it('shipped ur3e.urdf exists on disk', () => {
    expect(existsSync(URDF_PATH)).toBe(true)
  })

  it('declares a revolute joint for every UR3E_JOINT_NAMES entry, in the same order', () => {
    const urdf = readUrdf()
    const revoluteJointNames: string[] = []
    const re = /<joint name="([^"]+)" type="revolute">/g
    let m: RegExpExecArray | null
    while ((m = re.exec(urdf)) !== null) {
      revoluteJointNames.push(m[1])
    }
    expect(revoluteJointNames).toEqual([...UR3E_JOINT_NAMES])
  })

  it('joint origin offsets match UR3E_DH to 5 decimal places (magnitude comparison)', () => {
    const urdf = readUrdf()

    const shoulderPanZ = getJointOriginXyz(urdf, 'shoulder_pan_joint')[2]
    expect(Math.abs(shoulderPanZ)).toBeCloseTo(Math.abs(UR3E_DH[0].d), 5)

    const elbowX = getJointOriginXyz(urdf, 'elbow_joint')[0]
    expect(Math.abs(elbowX)).toBeCloseTo(Math.abs(UR3E_DH[1].a), 5)

    const wrist1Xyz = getJointOriginXyz(urdf, 'wrist_1_joint')
    expect(Math.abs(wrist1Xyz[0])).toBeCloseTo(Math.abs(UR3E_DH[2].a), 5)
    expect(Math.abs(wrist1Xyz[2])).toBeCloseTo(Math.abs(UR3E_DH[3].d), 5)

    const wrist2Y = getJointOriginXyz(urdf, 'wrist_2_joint')[1]
    expect(Math.abs(wrist2Y)).toBeCloseTo(Math.abs(UR3E_DH[4].d), 5)

    const wrist3Y = getJointOriginXyz(urdf, 'wrist_3_joint')[1]
    expect(Math.abs(wrist3Y)).toBeCloseTo(Math.abs(UR3E_DH[5].d), 5)
  })

  it('every referenced mesh file exists under public/robots/ur3e, and at least one mesh is referenced', () => {
    const urdf = readUrdf()
    const meshRefs = getMeshReferences(urdf)

    expect(meshRefs.length).toBeGreaterThan(0)

    const missing: string[] = []
    for (const rest of meshRefs) {
      const meshPath = join(MESH_ROOT, rest)
      if (!existsSync(meshPath)) {
        missing.push(rest)
      }
    }
    expect(missing[0]).toBeUndefined()
    expect(missing).toEqual([])
  })
})
