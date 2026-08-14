import type { ComponentType } from 'react'
import { TAB_DEFS, type TabId } from '../tabs/tab-registry'
import { useUiShellStore } from '../../store/uiShellStore'
import { PanelShell, PhaseNote } from './PlaceholderPanel'

// Temporary stub panels — Task 3 replaces each of these with a real
// component from `src/ui/tabs/`. Built from the same `PanelShell`/
// `PhaseNote` primitives the real panels will use, so nothing about the
// shell's shape changes when they land. One stub per tab (rather than one
// generic component parameterised by id) so each entry below is a distinct
// value `PANELS` can be checked against.
function DashboardStub() {
  return findTabStub('dashboard')
}
function OperationsStub() {
  return findTabStub('operations')
}
function SetupStub() {
  return findTabStub('setup')
}
function VisionStub() {
  return findTabStub('vision')
}
function CalibrateStub() {
  return findTabStub('calibrate')
}
function IoStub() {
  return findTabStub('io')
}
function OptimizationStub() {
  return findTabStub('optimization')
}

function findTabStub(id: TabId) {
  const tab = TAB_DEFS.find((candidate) => candidate.id === id)
  const label = tab?.label ?? id
  const phase = tab?.phase ?? 8
  return (
    <PanelShell title={label}>
      <PhaseNote phase={phase}>this panel's real content lands here.</PhaseNote>
    </PanelShell>
  )
}

// Typed as `Record<TabId, ComponentType>` so TypeScript itself fails the
// build if a registry id has no panel behind it — Task 3 replaces each
// value here with the corresponding real panel from `src/ui/tabs/`.
export const PANELS: Record<TabId, ComponentType> = {
  dashboard: DashboardStub,
  operations: OperationsStub,
  setup: SetupStub,
  vision: VisionStub,
  calibrate: CalibrateStub,
  io: IoStub,
  optimization: OptimizationStub,
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
