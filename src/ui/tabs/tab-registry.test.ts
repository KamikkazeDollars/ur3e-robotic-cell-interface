import { describe, it, expect } from 'vitest'
import { TAB_DEFS, DEFAULT_TAB_ID } from './tab-registry'
import { PANELS } from '../shell/TabPanel'

describe('tab-registry — TAB_DEFS (quick 260817-gdv, Task 2: Run + Free Movement)', () => {
  it('contains exactly 2 entries', () => {
    expect(TAB_DEFS).toHaveLength(2)
  })

  it('has ids exactly ["run", "free-movement"]', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(ids).toEqual(['run', 'free-movement'])
  })

  it('gives every entry a non-empty label', () => {
    for (const tab of TAB_DEFS) {
      expect(tab.label.length).toBeGreaterThan(0)
    }
  })

  it('labels the two entries "Run" and "Free Movement"', () => {
    const labels = TAB_DEFS.map((tab) => tab.label)
    expect(labels).toEqual(['Run', 'Free Movement'])
  })

  it('exports DEFAULT_TAB_ID as one of the registry ids, equal to "run"', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(ids).toContain(DEFAULT_TAB_ID)
    expect(DEFAULT_TAB_ID).toBe('run')
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

  // U-5 regression guard: a future edit must not quietly reintroduce the
  // two cell-mode tabs this plan removed — Printing/Milling now live only
  // in the compact top `ModeBar`.
  it('contains neither of the two cell-mode ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    expect(ids).not.toContain('printing')
    expect(ids).not.toContain('milling')
  })

  // Quick 260817-gdv regression guard: the id rename from the single-tab
  // 'dashboard' era is deliberate — a future edit must not quietly restore
  // the old dashboard name as either an id or a label.
  it('contains neither the old dashboard id nor the old dashboard label', () => {
    const ids = TAB_DEFS.map((tab) => tab.id)
    const labels = TAB_DEFS.map((tab) => tab.label)
    expect(ids).not.toContain('dashboard')
    expect(labels).not.toContain('Dashboard')
  })
})
