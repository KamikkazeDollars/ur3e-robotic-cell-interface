import { PanelShell, PanelSection, PhaseNote } from '../shell/PlaceholderPanel'

const ioRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-sm)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
}

const dotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'var(--ui-fg-muted)',
  marginRight: 'var(--space-sm)',
}

const stateStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--ui-fg)',
}

const IO_SIGNALS = ['Tool-changer engaged', 'Spindle on', 'Extruder heating']

/**
 * IO-01. Presentational only. Every signal below leads with an inactive
 * status dot and an em-dash state — no digital I/O exists to read from yet.
 */
export default function IoPanel() {
  return (
    <PanelShell title="I/O">
      <PanelSection heading="Digital I/O">
        {IO_SIGNALS.map((signal) => (
          <div key={signal} style={ioRowStyle}>
            <span>
              <span aria-hidden="true" style={dotStyle} />
              {signal}
            </span>
            <span style={stateStyle}>—</span>
          </div>
        ))}
      </PanelSection>
      <PhaseNote phase={8}>digital I/O status becomes live here.</PhaseNote>
    </PanelShell>
  )
}
