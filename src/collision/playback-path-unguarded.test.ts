// U-3: structural guard that the manual-jog safety gate this plan adds
// never leaks onto the g-code playback path. Phase 3 deliberately lets
// compiled samples pass through singular configurations, and already has
// its own separately-fixed table-clearance travel move (`compile.ts`'s
// "lift, traverse, descend" waypoints) — hard-blocking on the trajectory
// path would regress already-human-verified playback (03-UAT.md). Reads
// the real source from disk with `node:fs`, the same discipline
// `src/scene/cell-scene-order.test.ts` already uses in this repo (available
// because Vitest runs in the `node` environment here), rather than trusting
// a comment to stay honest across a future edit.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('playback path never imports from src/collision/', () => {
  it('src/trajectory/compile.ts contains no import from the collision directory', () => {
    const source = readSource('src/trajectory/compile.ts')
    expect(source).not.toMatch(/from ['"].*\/collision/)
  })

  it('src/scene/RobotPose.tsx contains no import from the collision directory', () => {
    const source = readSource('src/scene/RobotPose.tsx')
    expect(source).not.toMatch(/from ['"].*\/collision/)
  })
})
