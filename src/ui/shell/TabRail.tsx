import { LayoutDashboard, Move3d, type LucideIcon } from 'lucide-react'
import { TAB_DEFS, type TabId } from '../tabs/tab-registry'
import { useUiShellStore } from '../../store/uiShellStore'

// One icon per registry id — kept as a lookup keyed by TabId (not a second
// hardcoded tab list) so TypeScript fails the build if a registry id is
// ever added without an icon behind it. U-5 revert (quick 260816-nup): the
// printer/drill icons moved with Printing/Milling back to `ModeBar.tsx`.
//
// Quick 260817-gdv (Task 2): `LayoutDashboard` stays on 'run' — deliberately
// NOT a play glyph, which would compete visually with the transport Play
// button in the scene overlay. 'free-movement' gets `Move3d` (already
// exported by the installed `lucide-react`, no new dependency).
const TAB_ICONS: Record<TabId, LucideIcon> = {
  run: LayoutDashboard,
  'free-movement': Move3d,
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

function tabButtonStyle(current: boolean): React.CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-xs)',
    padding: 'var(--space-sm) 0',
    border: 'none',
    background: current ? 'var(--ui-surface-raised)' : 'transparent',
    color: current ? 'var(--ui-fg)' : 'var(--ui-fg-muted)',
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
 *
 * Quick 260817-gdv (Task 2): with a real second destination landing
 * (Free Movement, alongside Run), "which one am I on" is the meaningful
 * state again — the CURRENT tab is highlighted and shows the active bar
 * whether or not its panel happens to be open. Semantics moved from
 * `aria-pressed` (U-5's single-toggle rail) to `aria-current="page"` for
 * the current tab, plus `aria-expanded` reflecting whether THAT tab's
 * panel is showing.
 */
export default function TabRail() {
  const activeTab = useUiShellStore((state) => state.activeTab)
  const panelOpen = useUiShellStore((state) => state.panelOpen)
  const setActiveTab = useUiShellStore((state) => state.setActiveTab)

  return (
    <nav style={railStyle} aria-label="Cell interface tabs">
      {TAB_DEFS.map((tab) => {
        const Icon = TAB_ICONS[tab.id]
        const current = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            style={tabButtonStyle(current)}
            aria-current={current ? 'page' : undefined}
            aria-expanded={current && panelOpen}
            onClick={() => setActiveTab(tab.id)}
          >
            {current && <span aria-hidden="true" style={activeBarStyle} />}
            <Icon size={20} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
