import { useCellStore } from '../store/cellStore'
import { GCODE_SAMPLES } from '../gcode/samples'

// D-02: a plain native `<select>` rather than a registry component —
// `src/components/ui/` only has `button.tsx` today, and the installed
// shadcn CLI (4.x) diverges from the 3.8.4 preset flow STATE.md records
// this project as pinned to, so pulling in a registry select would reopen a
// resolved decision for a control this simple. Styled with the existing
// UI-SPEC custom properties (Label type size, spacing scale, Secondary
// tone) rather than a new one-off palette.
const selectStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '8px',
  border: '1px solid var(--color-secondary)',
  background: 'var(--color-secondary)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: '#08060d',
}

// Secondary-tone static text at the label type size — never the Accent tone
// reserved for the nav cube and the Reset View button (UI-SPEC "Color").
const noteStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--color-secondary)',
}

/**
 * Sample-selection dropdown (D-02). Reads `selectedSampleId` and dispatches
 * `selectSample` on change — mirroring `ResetViewButton.tsx`'s convention
 * that a DOM control only dispatches a store action and never touches the
 * scene, camera or parser directly.
 *
 * Also states the samples' assumed unit and, when the parser refused any
 * command, how many — both read off the parsed toolpath rather than a
 * second hard-coded literal, so the label can never drift from what the
 * parser actually reported. PITFALLS.md's unit-ambiguity entry calls for
 * surfacing the assumed unit rather than hard-coding it invisibly; a
 * silently truncated path presented as the whole job is this phase's own
 * transparency prohibition (SIM-01).
 */
export default function SampleSelect() {
  const selectedSampleId = useCellStore((state) => state.selectedSampleId)
  const selectSample = useCellStore((state) => state.selectSample)
  const toolpath = useCellStore((state) => state.toolpath)

  const unitLabel = toolpath?.unit ?? 'mm'
  const skippedMotionCount = toolpath?.skippedMotionCount ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <select
        aria-label="G-code sample"
        value={selectedSampleId ?? ''}
        onChange={(event) => {
          void selectSample(event.target.value)
        }}
        style={selectStyle}
      >
        <option value="" disabled>
          Select a g-code sample…
        </option>
        {GCODE_SAMPLES.map((sample) => (
          <option key={sample.id} value={sample.id}>
            {sample.label}
          </option>
        ))}
      </select>
      <span style={noteStyle}>Samples are interpreted in {unitLabel}.</span>
      {skippedMotionCount > 0 && (
        <span style={noteStyle} role="status">
          {skippedMotionCount} command{skippedMotionCount === 1 ? '' : 's'} in this file could not be
          rendered and {skippedMotionCount === 1 ? 'was' : 'were'} skipped.
        </span>
      )}
    </div>
  )
}
