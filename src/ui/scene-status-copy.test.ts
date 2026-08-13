import { describe, it, expect } from 'vitest'
import { SCENE_STATUS_COPY } from './scene-status-copy'

describe('SCENE_STATUS_COPY', () => {
  it('loading copy matches the UI-SPEC string exactly, ending with a single-character ellipsis', () => {
    expect(SCENE_STATUS_COPY.loading).toBe('Loading robot model…')
    // Guard against the common typo of three periods instead of the single
    // horizontal-ellipsis character (U+2026).
    expect(SCENE_STATUS_COPY.loading.endsWith('...')).toBe(false)
    expect(SCENE_STATUS_COPY.loading.endsWith('…')).toBe(true)
  })

  it('error copy matches the UI-SPEC string exactly, including its trailing period', () => {
    expect(SCENE_STATUS_COPY.error).toBe(
      "Couldn't load the robot model. Check your connection and reload the page.",
    )
    expect(SCENE_STATUS_COPY.error.endsWith('.')).toBe(true)
  })

  it('neither copy string is empty, and the two are not equal to each other', () => {
    expect(SCENE_STATUS_COPY.loading.length).toBeGreaterThan(0)
    expect(SCENE_STATUS_COPY.error.length).toBeGreaterThan(0)
    expect(SCENE_STATUS_COPY.loading).not.toBe(SCENE_STATUS_COPY.error)
  })
})
