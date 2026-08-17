// Quick 260817-gdv, Task 3: coverage for the pure playback-visibility
// predicates, plus a structural guard over `App.tsx` reading the real
// source from disk with `node:fs` — the same discipline
// `manual-jog-input-hardening.test.ts` and `cell-scene-order.test.ts` use in
// this repo (available because Vitest runs in the `node` environment here).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { showsPlaybackControls, shouldPausePlayback, TAB_DEFS } from './playback-chrome-visibility'

const APP_SOURCE_PATH = 'src/App.tsx'

function readAppSource(): string {
  return readFileSync(join(process.cwd(), APP_SOURCE_PATH), 'utf8')
}

/** Strips block comments and whole-line `//` comments so the mount-count
 * assertions below describe real JSX, never prose in a doc comment. */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return withoutBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

describe('showsPlaybackControls', () => {
  it('is true for the run tab', () => {
    expect(showsPlaybackControls('run')).toBe(true)
  })

  it('is false for the free-movement tab', () => {
    expect(showsPlaybackControls('free-movement')).toBe(false)
  })

  it('is false for every non-run registry id, so a future third tab defaults to hidden', () => {
    for (const tab of TAB_DEFS) {
      if (tab.id === 'run') continue
      expect(showsPlaybackControls(tab.id)).toBe(false)
    }
  })
})

describe('shouldPausePlayback', () => {
  it('is true only when isPlaying is true AND the tab does not show playback controls', () => {
    expect(shouldPausePlayback('free-movement', true)).toBe(true)
  })

  it('is false while playing on run', () => {
    expect(shouldPausePlayback('run', true)).toBe(false)
  })

  it('is false while paused on run', () => {
    expect(shouldPausePlayback('run', false)).toBe(false)
  })

  it('is false while paused on free-movement', () => {
    expect(shouldPausePlayback('free-movement', false)).toBe(false)
  })
})

describe('App.tsx — playback transport + sample picker structural guards (quick 260817-gdv Task 3, quick 260817-iyv)', () => {
  it('imports showsPlaybackControls', () => {
    const source = readAppSource()
    expect(source).toMatch(/\bshowsPlaybackControls\b/)
  })

  it('mounts PlaybackControl and ScrubControl exactly once each', () => {
    const source = stripComments(readAppSource())
    const playbackControlMounts = source.match(/<PlaybackControl\b/g) ?? []
    const scrubControlMounts = source.match(/<ScrubControl\b/g) ?? []
    expect(playbackControlMounts).toHaveLength(1)
    expect(scrubControlMounts).toHaveLength(1)
  })

  it("guards the PlaybackControl mount behind the visibility flag", () => {
    const source = stripComments(readAppSource())
    expect(source).toMatch(/\{showPlayback && <PlaybackControl \/>\}/)
  })

  it('guards the ScrubControl mount behind the visibility flag AND playbackStarted', () => {
    const source = stripComments(readAppSource())
    expect(source).toMatch(/\{showPlayback && playbackStarted && <ScrubControl \/>\}/)
  })

  it('mounts SampleSelect exactly once, guarded by the visibility flag (quick 260817-iyv)', () => {
    const source = stripComments(readAppSource())
    const sampleSelectMounts = source.match(/<SampleSelect\b/g) ?? []
    expect(sampleSelectMounts).toHaveLength(1)
    expect(source).toMatch(/\{showPlayback && <SampleSelect \/>\}/)
  })

  it('has no inline tab comparison anywhere — every tab decision routes through showsPlaybackControls (quick 260817-iyv)', () => {
    const source = stripComments(readAppSource())
    expect(source).not.toMatch(/activeTab\s*===/)
    expect(source).not.toMatch(/['"]run['"]/)
  })
})
