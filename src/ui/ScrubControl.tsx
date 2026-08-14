import { useCellStore } from '../store/cellStore'

// D-05: a plain native `<input type="range">` rather than a registry Slider
// primitive, for the same reason `SampleSelect.tsx` documents for its plain
// `<select>` — the installed shadcn CLI (4.x) diverges from the 3.8.4
// preset flow STATE.md records this project as pinned to, so pulling in a
// registry slider would reopen a resolved decision for a control this
// simple. Styled with the existing UI-SPEC custom properties — Secondary
// tone, never the Accent tone reserved for the nav cube and the Reset View
// button (UI-SPEC "Color" visual-focal-point rule).
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

const rangeStyle: React.CSSProperties = {
  width: '240px',
  accentColor: 'var(--color-secondary)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--color-secondary)',
}

// Same style vocabulary as `SampleSelect.tsx`'s `noteStyle` — Secondary
// tone, Label type size, no new one-off colour — reused verbatim here for
// both the percentage readout and the disabled-state explanation.
const noteStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--color-secondary)',
}

/**
 * D-05 scrub control: a controlled range input that reads `scrubFraction`
 * and dispatches `setScrubFraction` on change — and nothing else, mirroring
 * `SampleSelect.tsx`'s convention that a DOM control only dispatches a
 * store action and never touches the scene, camera or trajectory directly
 * (never imports from `scene/`). Disabled whenever the store has no
 * trajectory or the trajectory has no samples, so a drag can never target a
 * trajectory that doesn't exist — with no sample selected, this reads as an
 * inert control next to a robot parked at the D-08 ready pose, PLUS a
 * one-line explanation (below) of why it's inert, rather than a
 * silently-do-nothing control.
 *
 * The percentage readout is derived from `scrubFraction` at render time —
 * never a second source of truth — and is wired to the range input via
 * `aria-describedby` so assistive technology reads the position alongside
 * the control itself.
 */
export default function ScrubControl() {
  const scrubFraction = useCellStore((state) => state.scrubFraction)
  const setScrubFraction = useCellStore((state) => state.setScrubFraction)
  const trajectory = useCellStore((state) => state.trajectory)

  const disabled = !trajectory || trajectory.samples.length === 0
  const percent = Math.round(scrubFraction * 100)

  return (
    <div style={containerStyle}>
      <span style={labelStyle} id="scrub-control-label">
        Scrub toolpath
      </span>
      <span style={noteStyle} id="scrub-control-readout">
        {percent}% of path
      </span>
      <input
        type="range"
        aria-labelledby="scrub-control-label"
        aria-describedby="scrub-control-readout"
        min={0}
        max={1}
        step={0.01}
        value={scrubFraction}
        disabled={disabled}
        onChange={(event) => setScrubFraction(Number(event.target.value))}
        style={rangeStyle}
      />
      {disabled && (
        <span style={noteStyle} role="status">
          Select a sample before the toolpath can be scrubbed.
        </span>
      )}
    </div>
  )
}
