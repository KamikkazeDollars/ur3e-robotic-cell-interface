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

/**
 * Sample-selection dropdown (D-02). Reads `selectedSampleId` and dispatches
 * `selectSample` on change — mirroring `ResetViewButton.tsx`'s convention
 * that a DOM control only dispatches a store action and never touches the
 * scene, camera or parser directly.
 */
export default function SampleSelect() {
  const selectedSampleId = useCellStore((state) => state.selectedSampleId)
  const selectSample = useCellStore((state) => state.selectSample)

  return (
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
  )
}
