import { PanelShell, PanelSection, PhaseNote } from '../shell/PlaceholderPanel'

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg)',
}

/**
 * SETUP-01. Presentational only. Both devices reflect the cell as currently
 * modelled — a 7th-axis rail and a tool-changer both exist in the scene —
 * so both checkboxes are checked, but disabled: this is a Phase 8 surface,
 * not yet a real configuration control.
 */
export default function SetupPanel() {
  return (
    <PanelShell title="Setup">
      <PanelSection heading="Cell devices">
        <label style={checkboxRowStyle}>
          <input type="checkbox" checked disabled readOnly />
          7th-axis rail
        </label>
        <label style={checkboxRowStyle}>
          <input type="checkbox" checked disabled readOnly />
          Tool-changer
        </label>
      </PanelSection>
      <PhaseNote phase={8}>cell device configuration becomes editable here.</PhaseNote>
    </PanelShell>
  )
}
