import type { ReactNode } from 'react'

// Shared presentational primitives every panel under `src/ui/tabs/` composes
// from (quick 260816-m6d: now three panels — Printing/Milling's `JobPanel`
// and `DashboardPanel` — pruned from the original seven), so they stay
// visually consistent and none of them invents its own one-off styling.
// Inline `React.CSSProperties` objects referencing the `--ui-*` /
// `--space-*` / `--text-*` custom properties, exactly as `SampleSelect.tsx`
// and `ScrubControl.tsx` already do — no CSS-module or styled-components
// layer.

const panelShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

const headingStyle: React.CSSProperties = {
  margin: 0,
  padding: 'var(--space-md) var(--space-lg)',
  fontSize: 'var(--text-heading)',
  lineHeight: 'var(--leading-tight)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--ui-fg)',
  borderBottom: '1px solid var(--ui-border)',
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-md) var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
}

/** Panel heading plus a scrollable body. Every real panel under
 * `src/ui/tabs/` is wrapped in exactly one of these. */
export function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={panelShellStyle}>
      <h2 style={headingStyle}>{title}</h2>
      <div style={bodyStyle}>{children}</div>
    </div>
  )
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 'var(--space-sm)',
  paddingBottom: 'var(--space-xs)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--ui-fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--ui-border)',
}

const sectionBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

/** A labelled group with a bottom hairline under its heading. */
export function PanelSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h3 style={sectionHeadingStyle}>{heading}</h3>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  )
}

const readoutRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 'var(--space-md)',
}

const readoutLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg-muted)',
}

const readoutValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg)',
}

/** Label left, monospace value right — defaults to an em-dash placeholder
 * so "no data yet" reads as deliberate rather than broken. This is the one
 * primitive every telemetry-shaped placeholder should use. */
export function ReadoutRow({ label, value = '—' }: { label: string; value?: string }) {
  return (
    <div style={readoutRowStyle}>
      <span style={readoutLabelStyle}>{label}</span>
      <span style={readoutValueStyle}>{value}</span>
    </div>
  )
}
