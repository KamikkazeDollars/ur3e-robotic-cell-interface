// Quick 260817-gdv, Task 2: coverage for the tab-identity/panel-open split
// (`activeTab: TabId` non-nullable + separate `panelOpen: boolean`) and the
// `setActiveTab` branching it drives. Reset discipline follows
// `src/store/cellStore.test.ts`'s existing `beforeEach` pattern.
import { describe, it, expect, beforeEach } from 'vitest'
import { useUiShellStore } from './uiShellStore'
import { TAB_DEFS, DEFAULT_TAB_ID, type TabId } from '../ui/tabs/tab-registry'

beforeEach(() => {
  useUiShellStore.setState({ activeTab: DEFAULT_TAB_ID, panelOpen: false, cellMode: 'printing' })
})

describe('useUiShellStore — initial state', () => {
  it('initialises activeTab to "run"', () => {
    expect(useUiShellStore.getState().activeTab).toBe('run')
  })

  it('initialises panelOpen to false', () => {
    expect(useUiShellStore.getState().panelOpen).toBe(false)
  })
})

describe('useUiShellStore — setActiveTab on the ALREADY-active tab', () => {
  it('toggles panelOpen and leaves activeTab unchanged', () => {
    const startTab = useUiShellStore.getState().activeTab
    useUiShellStore.getState().setActiveTab(startTab)
    expect(useUiShellStore.getState().activeTab).toBe(startTab)
    expect(useUiShellStore.getState().panelOpen).toBe(true)
  })

  it('calling it twice returns panelOpen to its starting value', () => {
    const startTab = useUiShellStore.getState().activeTab
    const startPanelOpen = useUiShellStore.getState().panelOpen
    useUiShellStore.getState().setActiveTab(startTab)
    useUiShellStore.getState().setActiveTab(startTab)
    expect(useUiShellStore.getState().panelOpen).toBe(startPanelOpen)
  })
})

describe('useUiShellStore — setActiveTab on a DIFFERENT tab', () => {
  it('sets activeTab to that id and forces panelOpen true', () => {
    useUiShellStore.getState().setActiveTab('free-movement')
    expect(useUiShellStore.getState().activeTab).toBe('free-movement')
    expect(useUiShellStore.getState().panelOpen).toBe(true)
  })

  it('forces panelOpen true even if it was already true beforehand', () => {
    useUiShellStore.setState({ activeTab: 'run', panelOpen: true })
    useUiShellStore.getState().setActiveTab('free-movement')
    expect(useUiShellStore.getState().panelOpen).toBe(true)
  })
})

describe('useUiShellStore — activeTab stays within the registry ids', () => {
  it('never leaves activeTab outside TAB_DEFS ids across any setActiveTab sequence', () => {
    const registryIds = TAB_DEFS.map((tab) => tab.id)
    const sequence: TabId[] = ['run', 'free-movement', 'free-movement', 'run', 'run']

    for (const id of sequence) {
      useUiShellStore.getState().setActiveTab(id)
      expect(registryIds).toContain(useUiShellStore.getState().activeTab)
    }
  })
})

describe('useUiShellStore — setActiveTab never mutates cellMode', () => {
  it('leaves cellMode unchanged across a same-tab toggle and a cross-tab switch', () => {
    useUiShellStore.setState({ cellMode: 'milling' })
    useUiShellStore.getState().setActiveTab('run')
    expect(useUiShellStore.getState().cellMode).toBe('milling')
    useUiShellStore.getState().setActiveTab('free-movement')
    expect(useUiShellStore.getState().cellMode).toBe('milling')
  })
})
