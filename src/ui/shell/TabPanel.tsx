import type { ComponentType } from 'react'
import { type TabId } from '../tabs/tab-registry'
import { useUiShellStore } from '../../store/uiShellStore'
import DashboardPanel from '../tabs/DashboardPanel'
import OperationsPanel from '../tabs/OperationsPanel'
import SetupPanel from '../tabs/SetupPanel'
import VisionPanel from '../tabs/VisionPanel'
import CalibratePanel from '../tabs/CalibratePanel'
import IoPanel from '../tabs/IoPanel'
import OptimizationPanel from '../tabs/OptimizationPanel'

// Typed as `Record<TabId, ComponentType>` so TypeScript itself fails the
// build if a registry id has no panel behind it. Every value below is a
// real, phase-labelled placeholder panel from `src/ui/tabs/` — none of
// them import the simulation store or compute anything from a trajectory
// (Task 3 gate: `tab-registry.test.ts` Test 6 plus the plan's cellStore
// import grep).
export const PANELS: Record<TabId, ComponentType> = {
  dashboard: DashboardPanel,
  operations: OperationsPanel,
  setup: SetupPanel,
  vision: VisionPanel,
  calibrate: CalibratePanel,
  io: IoPanel,
  optimization: OptimizationPanel,
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
