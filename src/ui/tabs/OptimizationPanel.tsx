import { PanelShell, PanelSection, ReadoutRow, PhaseNote } from '../shell/PlaceholderPanel'

const feedRateRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-md)',
}

const feedRateInputStyle: React.CSSProperties = {
  flex: 1,
  accentColor: 'var(--ui-surface-raised)',
}

const feedRateReadoutStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-label)',
  color: 'var(--ui-fg)',
  minWidth: '3.5ch',
  textAlign: 'right',
}

/**
 * OPT-01/02. Presentational only. Feed-rate override sits at its documented
 * default (100%) — a disabled control, not a live value — and cycle time is
 * a plain em-dash placeholder.
 */
export default function OptimizationPanel() {
  return (
    <PanelShell title="Optimization">
      <PanelSection heading="Feed-rate override">
        <div style={feedRateRowStyle}>
          <input
            type="range"
            min={10}
            max={200}
            value={100}
            disabled
            readOnly
            style={feedRateInputStyle}
            aria-label="Feed-rate override"
          />
          <span style={feedRateReadoutStyle}>100%</span>
        </div>
      </PanelSection>
      <PanelSection heading="Cycle time">
        <ReadoutRow label="Cycle time" />
      </PanelSection>
      <PhaseNote phase={8}>feed-rate override and computed cycle time become live here.</PhaseNote>
    </PanelShell>
  )
}
