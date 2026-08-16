import { describe, it, expect } from 'vitest'
import { shellContentLeft } from './shell-geometry'

describe('shellContentLeft', () => {
  it('returns two different strings for open vs closed', () => {
    expect(shellContentLeft(true)).not.toBe(shellContentLeft(false))
  })

  it('both forms reference the rail width token', () => {
    expect(shellContentLeft(true)).toContain('--shell-rail-width')
    expect(shellContentLeft(false)).toContain('--shell-rail-width')
  })

  it('only the open form references the panel width token', () => {
    expect(shellContentLeft(true)).toContain('--shell-panel-width')
    expect(shellContentLeft(false)).not.toContain('--shell-panel-width')
  })
})
