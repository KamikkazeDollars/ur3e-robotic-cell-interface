import type { ComponentType } from 'react'
import { type TabId } from '../tabs/tab-registry'
import { useUiShellStore } from '../../store/uiShellStore'
import DashboardPanel from '../tabs/DashboardPanel'
import JobPanel from '../tabs/JobPanel'

// Thin module-scope wrappers over the shared `JobPanel` so `PANELS` below
// stays a flat `Record<TabId, ComponentType>` — no per-tab prop plumbing
// needed at the router level.
const PrintingPanel = () => <JobPanel mode="printing" />
const MillingPanel = () => <JobPanel mode="milling" />

// Typed as `Record<TabId, ComponentType>` so TypeScript itself fails the
// build if a registry id has no panel behind it (Task 3 gate:
// `tab-registry.test.ts` Test 6 — every registry id resolves to a defined
// panel and `PANELS` has no orphan key).
export const PANELS: Record<TabId, ComponentType> = {
  printing: PrintingPanel,
  milling: MillingPanel,
  dashboard: DashboardPanel,
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 'var(--shell-rail-width)',
  bottom: 0,
  width: 'var(--shell-panel-width)',
  background: 'var(--ui-surface)',
  borderRight: '1px solid var(--ui-border)',
  overflowY: 'auto',
  zIndex: 2,
}

/**
 * Docked panel immediately right of `TabRail`. Renders whichever entry of
 * `PANELS` matches the store's `activeTab` — the panel-router half of the
 * rail/panel pair, so the two can never drift apart from each other (each
 * reads the same `TAB_DEFS`/`activeTab` source of truth).
 */
export default function TabPanel() {
  const activeTab = useUiShellStore((state) => state.activeTab)
  const ActivePanel = PANELS[activeTab]

  return (
    <div style={panelStyle}>
      <ActivePanel />
    </div>
  )
}
