import { PanelShell, PanelSection, PhaseNote } from '../shell/PlaceholderPanel'

const skeletonRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 'var(--space-md)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg-muted)',
}

const markerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  marginRight: 'var(--space-xs)',
}

const durationStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--ui-fg)',
}

// Static skeleton rows — three placeholder operations, each prefixed by a
// small start/end marker glyph so the marker vocabulary Phase 6 introduces
// is visible even before real operations exist.
const SKELETON_OPERATIONS = [
  { index: 1, markers: '▶ ▪' },
  { index: 2, markers: '▶ ▪' },
  { index: 3, markers: '▶ ▪' },
]

// Four-swatch legend running shallow to deep, a red ramp derived from the
// accent tone (light to dark) — legend only, never a live reading.
const ENGAGEMENT_SWATCHES = [
  { label: 'Shallow', color: '#F4A6AD' },
  { label: '', color: '#E8666F' },
  { label: '', color: '#E11D2E' },
  { label: 'Deep', color: '#8E1420' },
]

const swatchRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-xs)',
}

const swatchStyle: React.CSSProperties = {
  flex: 1,
  height: '16px',
  borderRadius: '4px',
}

const legendLabelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 'var(--text-label)',
  color: 'var(--ui-fg-muted)',
}

const legendCaptionStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
  fontStyle: 'italic',
}

/**
 * Phase 6 surface (SIM-03/06/07). Presentational only — no props, no store
 * reads, no computed durations. The operations list and mill-engagement
 * legend below are static skeleton content, not derived from any toolpath.
 */
export default function OperationsPanel() {
  return (
    <PanelShell title="Operations">
      <PanelSection heading="Operations">
        {SKELETON_OPERATIONS.map((op) => (
          <div key={op.index} style={skeletonRowStyle}>
            <span>
              <span aria-hidden="true" style={markerStyle}>
                {op.markers}
              </span>
              Operation {op.index}
            </span>
            <span style={durationStyle}>—</span>
          </div>
        ))}
      </PanelSection>
      <PanelSection heading="Mill engagement">
        <div style={swatchRowStyle} aria-hidden="true">
          {ENGAGEMENT_SWATCHES.map((swatch, i) => (
            <span key={i} style={{ ...swatchStyle, background: swatch.color }} />
          ))}
        </div>
        <div style={legendLabelRowStyle}>
          <span>Shallow</span>
          <span>Deep</span>
        </div>
        <span style={legendCaptionStyle}>Legend only — not a live reading.</span>
      </PanelSection>
      <PhaseNote phase={6}>
        per-operation markers, computed durations and engagement coloring.
      </PhaseNote>
    </PanelShell>
  )
}
