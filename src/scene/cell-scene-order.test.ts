// Structural guard for gap closure G-04-1's frame-order correction
// (04-04-PLAN.md Task 2). `usePlaybackClock` writes `livePlayback.fraction`
// inside its own `useFrame`, and R3F runs frame callbacks in subscription
// order, which follows mount order — so `PlaybackClock`, the WRITER of that
// channel, must be mounted ahead of every READER (the rail rig carrying
// RobotPose, the trail highlight, and the scrub marker) or those readers
// observe the previous frame's stale value instead of the current one. That
// staleness is invisible to every other automated check (it never throws,
// never fails a snapshot, and only shows up as a barely perceptible one-frame
// playback lag), so this test reads `CellScene.tsx` from disk with `node:fs`
// — the same filesystem-reading approach `urdf-asset.test.ts` already uses in
// this repo (available because Vitest runs in the `node` environment here) —
// and asserts the mount ORDER directly, rather than trusting a comment to
// stay honest across a future re-ordering.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CELL_SCENE_PATH = join(process.cwd(), 'src/scene/CellScene.tsx')

function readCellScene(): string {
  return readFileSync(CELL_SCENE_PATH, 'utf8')
}

describe("CellScene.tsx mount order: PlaybackClock (the fraction writer) precedes its readers", () => {
  it('mounts <PlaybackClock before <RailRig, <Toolpath, <PlaybackTrail and <ScrubMarker', () => {
    const source = readCellScene()

    const clockIndex = source.indexOf('<PlaybackClock')
    const railRigIndex = source.indexOf('<RailRig')
    const toolpathIndex = source.indexOf('<Toolpath')
    const playbackTrailIndex = source.indexOf('<PlaybackTrail')
    const scrubMarkerIndex = source.indexOf('<ScrubMarker')

    expect(clockIndex).toBeGreaterThan(-1)
    expect(railRigIndex).toBeGreaterThan(-1)
    expect(toolpathIndex).toBeGreaterThan(-1)
    expect(playbackTrailIndex).toBeGreaterThan(-1)
    expect(scrubMarkerIndex).toBeGreaterThan(-1)

    expect(clockIndex).toBeLessThan(railRigIndex)
    expect(clockIndex).toBeLessThan(toolpathIndex)
    expect(clockIndex).toBeLessThan(playbackTrailIndex)
    expect(clockIndex).toBeLessThan(scrubMarkerIndex)
  })
})
