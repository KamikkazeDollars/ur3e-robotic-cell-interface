import { useUiShellStore, type CellMode } from '../../store/uiShellStore'
import { PhaseNote } from './PlaceholderPanel'

// The Phase 7 surface (TOOL-01/TOOL-02) — a Printing/Milling segmented
// control plus a tool-changer chip that mirrors the selection. Visual-only
// this pass: `cellMode` is read here at render time and nowhere under
// `src/scene/`, `src/trajectory/` or `src/kinematics/`.

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'var(--space-lg)',
  left: 'calc(var(--shell-rail-width) + var(--shell-panel-width) + var(--space-lg))',
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '8px',
  background: 'var(--ui-surface)',
  border: '1px solid var(--ui-border)',
}

const segmentedStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-xs)',
}

function segmentStyle(selected: boolean): React.CSSProperties {
  return {
    padding: 'var(--space-xs) var(--space-md)',
    borderRadius: '6px',
    border: 'none',
    fontSize: 'var(--text-label)',
    lineHeight: 'var(--leading-label)',
    fontWeight: selected ? 'var(--weight-semibold)' : 'var(--weight-regular)',
    background: selected ? 'var(--ui-accent)' : 'var(--ui-surface-raised)',
    color: selected ? 'var(--ui-accent-fg)' : 'var(--ui-fg-muted)',
    cursor: 'pointer',
  }
}

const chipStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg)',
}

const MOUNTED_TOOL_LABEL: Record<CellMode, string> = {
  printing: 'Print head',
  milling: 'Mill spindle',
}

export default function ModeBar() {
  const cellMode = useUiShellStore((state) => state.cellMode)
  const setCellMode = useUiShellStore((state) => state.setCellMode)

  return (
    <div style={containerStyle}>
      <div style={segmentedStyle} role="tablist" aria-label="Cell mode">
        <button
          type="button"
          role="tab"
          aria-selected={cellMode === 'printing'}
          style={segmentStyle(cellMode === 'printing')}
          onClick={() => setCellMode('printing')}
        >
          Printing
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cellMode === 'milling'}
          style={segmentStyle(cellMode === 'milling')}
          onClick={() => setCellMode('milling')}
        >
          Milling
        </button>
      </div>
      <span style={chipStyle}>Mounted tool: {MOUNTED_TOOL_LABEL[cellMode]}</span>
      <PhaseNote phase={7}>
        the tool-changer station swaps the mounted tool in the 3D scene.
      </PhaseNote>
    </div>
  )
}
