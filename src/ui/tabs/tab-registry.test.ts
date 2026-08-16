import { describe, it, expect } from 'vitest'
import { TAB_DEFS, DEFAULT_TAB_ID, cellModeForTab } from './tab-registry'
import { PANELS } from '../shell/TabPanel'

const EXPECTED_IDS = ['printing', 'milling', 'dashboard']

describe('tab-registry — TAB_DEFS', () => {
  it('contains exactly 3 entries', () => {
    expect(TAB_DEFS).toHaveLength(3)
  })

  it('has an id set exactly equal to printing/milling/dashboard', () => {
    const ids = TAB_DEFS.map((tab) => tab.id).sort()
    expect(ids).toEqual([...EXPECTED_IDS].sort())
  })

  it('has no duplicate ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every entry a non-empty label', () => {
    for (const tab of TAB_DEFS) {
      expect(tab.label.length).toBeGreaterThan(0)
    }
  })

  it('exports DEFAULT_TAB_ID as one of the registry ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(ids).toContain(DEFAULT_TAB_ID)
  })

  // The gate that keeps the rail and the panel set from drifting apart —
  // every registry id must resolve to a defined panel, and PANELS must
  // carry no orphan key.
  it('has a defined PANELS entry for every registry id, and no orphan PANELS key', () => {
    const registryIds = TAB_DEFS.map((tab) => tab.id).sort()
    const panelKeys = Object.keys(PANELS).sort()

    for (const id of registryIds) {
      expect(PANELS[id]).toBeDefined()
    }
    expect(panelKeys).toEqual(registryIds)
  })
})

describe('cellModeForTab', () => {
  it('returns the mode itself for the two mode tabs', () => {
    expect(cellModeForTab('printing')).toBe('printing')
    expect(cellModeForTab('milling')).toBe('milling')
  })

  it('returns null for the dashboard tab', () => {
    expect(cellModeForTab('dashboard')).toBeNull()
  })
})
