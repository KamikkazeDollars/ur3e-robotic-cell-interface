import {
  LayoutDashboard,
  ListTree,
  Settings,
  Eye,
  Crosshair,
  Plug,
  Gauge,
  type LucideIcon,
} from 'lucide-react'
import { TAB_DEFS, type TabId } from '../tabs/tab-registry'
import { useUiShellStore } from '../../store/uiShellStore'

// One icon per registry id — kept as a lookup keyed by TabId (not a second
// hardcoded tab list) so TypeScript fails the build if a registry id is
// ever added without an icon behind it.
const TAB_ICONS: Record<TabId, LucideIcon> = {
  dashboard: LayoutDashboard,
  operations: ListTree,
  setup: Settings,
  vision: Eye,
  calibrate: Crosshair,
  io: Plug,
  optimization: Gauge,
}

const railStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: 'var(--shell-rail-width)',
  background: 'var(--ui-surface)',
  borderRight: '1px solid var(--ui-border)',
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  paddingTop: 'var(--space-md)',
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-xs)',
    padding: 'var(--space-sm) 0',
    border: 'none',
    background: active ? 'var(--ui-surface-raised)' : 'transparent',
    color: active ? 'var(--ui-fg)' : 'var(--ui-fg-muted)',
    fontSize: 'var(--text-label)',
    lineHeight: 'var(--leading-label)',
    fontWeight: 'var(--weight-regular)',
    cursor: 'pointer',
  }
}

const activeBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: '3px',
  background: 'var(--ui-accent)',
}

/**
 * Fixed-position vertical rail pinned to the left viewport edge. Maps over
 * `TAB_DEFS` — never a second hardcoded list — rendering one icon+label
 * button per tab. Clicking dispatches `setActiveTab` and nothing else; this
 * component never imports from `src/scene/`, matching the convention every
 * existing control in `src/ui/` documents.
 */
export default function TabRail() {
  const activeTab = useUiShellStore((state) => state.activeTab)
  const setActiveTab = useUiShellStore((state) => state.setActiveTab)

  return (
    <nav style={railStyle} aria-label="Cell interface tabs">
      {TAB_DEFS.map((tab) => {
        const Icon = TAB_ICONS[tab.id]
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            style={tabButtonStyle(active)}
            aria-current={active ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {active && <span aria-hidden="true" style={activeBarStyle} />}
            <Icon size={20} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
