import { describe, it, expect } from 'vitest'
import { SCENE_STATUS_COPY, toolpathStatusCopy } from './scene-status-copy'

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

  it('toolpathParsing copy ends with a single-character ellipsis, not three periods', () => {
    expect(SCENE_STATUS_COPY.toolpathParsing.endsWith('...')).toBe(false)
    expect(SCENE_STATUS_COPY.toolpathParsing.endsWith('…')).toBe(true)
  })

  it('toolpathError copy is a non-empty, apologetic, action-suggesting string ending in a period', () => {
    expect(SCENE_STATUS_COPY.toolpathError.length).toBeGreaterThan(0)
    expect(SCENE_STATUS_COPY.toolpathError.endsWith('.')).toBe(true)
  })

  it('the four copy keys are pairwise distinct', () => {
    const values = [
      SCENE_STATUS_COPY.loading,
      SCENE_STATUS_COPY.error,
      SCENE_STATUS_COPY.toolpathParsing,
      SCENE_STATUS_COPY.toolpathError,
    ]
    expect(new Set(values).size).toBe(values.length)
  })

  it('trajectoryFrozen copy exists, is non-empty, and carries no placeholder/interpolation syntax', () => {
    expect(SCENE_STATUS_COPY.trajectoryFrozen.length).toBeGreaterThan(0)
    // The assertion that matters: this string must stay a fixed constant
    // that can never accidentally become a template for exception text —
    // no `${...}`, no `%s`/`{0}`-style placeholders, no template braces.
    expect(SCENE_STATUS_COPY.trajectoryFrozen).not.toMatch(/\$\{|%s|\{\d+\}|\{[a-zA-Z_]+\}/)
  })
})

describe('toolpathStatusCopy', () => {
  it('resolves "parsing" to the toolpathParsing string', () => {
    expect(toolpathStatusCopy('parsing')).toBe(SCENE_STATUS_COPY.toolpathParsing)
  })

  it('resolves "error" to the toolpathError string', () => {
    expect(toolpathStatusCopy('error')).toBe(SCENE_STATUS_COPY.toolpathError)
  })
})
