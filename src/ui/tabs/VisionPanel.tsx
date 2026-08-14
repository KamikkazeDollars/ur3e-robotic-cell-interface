import { PanelShell, PanelSection, ReadoutRow, PhaseNote } from '../shell/PlaceholderPanel'

const baselineBarTrackStyle: React.CSSProperties = {
  width: '100%',
  height: '8px',
  borderRadius: '4px',
  background: 'var(--ui-surface-raised)',
  border: '1px solid var(--ui-border)',
  overflow: 'hidden',
}

const baselineBarFillStyle: React.CSSProperties = {
  width: '0%',
  height: '100%',
  background: 'var(--ui-fg-muted)',
}

const disclosureStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--ui-fg-muted)',
}

/**
 * VISION-01. Presentational only. Baked in from the start rather than
 * retrofitted: the roadmap's success criterion requires this surface to
 * disclose that force/contact is estimated and simulated, never measured
 * from real hardware (there is no physical UR3e — CLAUDE.md constraint).
 */
export default function VisionPanel() {
  return (
    <PanelShell title="Vision">
      <PanelSection heading="Force / contact">
        <ReadoutRow label="Force" value="— N" />
        <div style={baselineBarTrackStyle} aria-hidden="true">
          <div style={baselineBarFillStyle} />
        </div>
        <p style={disclosureStyle}>
          This value is estimated and simulated — never measured from hardware.
        </p>
      </PanelSection>
      <PhaseNote phase={8}>simulated force/contact readouts become live here.</PhaseNote>
    </PanelShell>
  )
}
