import { describe, it, expect } from 'vitest'
import { TAB_DEFS, DEFAULT_TAB_ID } from './tab-registry'
import { PANELS } from '../shell/TabPanel'

const EXPECTED_IDS = ['dashboard', 'operations', 'setup', 'vision', 'calibrate', 'io', 'optimization']

describe('tab-registry — TAB_DEFS', () => {
  it('contains exactly 7 entries', () => {
    expect(TAB_DEFS).toHaveLength(7)
  })

  it('has an id set exactly equal to the 7 roadmap tab ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id).sort()
    expect(ids).toEqual([...EXPECTED_IDS].sort())
  })

  it('has no duplicate ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every entry a non-empty label and a phase number in 5-8', () => {
    for (const tab of TAB_DEFS) {
      expect(tab.label.length).toBeGreaterThan(0)
      expect(tab.phase).toBeGreaterThanOrEqual(5)
      expect(tab.phase).toBeLessThanOrEqual(8)
    }
  })

  it('exports DEFAULT_TAB_ID as one of the registry ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(ids).toContain(DEFAULT_TAB_ID)
  })

  // Test 6 (Task 3): the gate that keeps the rail and the panel set from
  // drifting apart as later phases add or rename tabs — every registry id
  // must resolve to a defined panel, and PANELS must carry no orphan key.
  it('has a defined PANELS entry for every registry id, and no orphan PANELS key', () => {
    const registryIds = TAB_DEFS.map((tab) => tab.id).sort()
    const panelKeys = Object.keys(PANELS).sort()

    for (const id of registryIds) {
      expect(PANELS[id]).toBeDefined()
    }
    expect(panelKeys).toEqual(registryIds)
  })
})
