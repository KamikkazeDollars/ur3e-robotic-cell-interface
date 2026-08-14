import { PanelShell, PanelSection, ReadoutRow, PhaseNote } from '../shell/PlaceholderPanel'

/**
 * Phase 5 surface (DASH-01/02/03). Presentational only — takes no props,
 * reads no store, computes nothing. Playback does not exist yet (Phase 4
 * is deliberately skipped this plan), so every readout below is a static
 * em-dash placeholder rather than a half-real value read from `cellStore`.
 */
export default function DashboardPanel() {
  return (
    <PanelShell title="Dashboard">
      <PanelSection heading="Joint angles">
        <ReadoutRow label="Base" value="— °" />
        <ReadoutRow label="Shoulder" value="— °" />
        <ReadoutRow label="Elbow" value="— °" />
        <ReadoutRow label="Wrist 1" value="— °" />
        <ReadoutRow label="Wrist 2" value="— °" />
        <ReadoutRow label="Wrist 3" value="— °" />
      </PanelSection>
      <PanelSection heading="TCP">
        <ReadoutRow label="X (mm)" />
        <ReadoutRow label="Y (mm)" />
        <ReadoutRow label="Z (mm)" />
        <ReadoutRow label="Speed (mm/s)" />
      </PanelSection>
      <PanelSection heading="Rail — 7th axis">
        <ReadoutRow label="Position (mm)" />
        <ReadoutRow label="Travel remaining (−X) (mm)" />
        <ReadoutRow label="Travel remaining (+X) (mm)" />
      </PanelSection>
      <PhaseNote phase={5}>these become live once Phase 4 playback drives them.</PhaseNote>
    </PanelShell>
  )
}
