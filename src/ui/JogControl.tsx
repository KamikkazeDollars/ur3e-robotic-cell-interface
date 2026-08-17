import { useState, type CSSProperties } from 'react'
import { commitNumberFieldDraft } from './number-field-commit'

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
}

const fieldLabelRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
}

const labelStyle: CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg-muted)',
}

const hintStyle: CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg-muted)',
}

const inputRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
}

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '8px',
  border: '1px solid var(--ui-border)',
  background: 'var(--ui-surface-raised)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg)',
  fontFamily: 'var(--font-mono)',
}

const unitStyle: CSSProperties = {
  fontSize: 'var(--text-label)',
  color: 'var(--ui-fg-muted)',
}

/** Task 5 (quick 260816-qym): the per-axis slider, styled with the same
 * UI-SPEC surface custom property `ScrubControl.tsx` already uses for its
 * own native `<input type="range">` — never the Accent tone, which is
 * reserved for the nav cube and the Reset View button. */
const rangeInputStyle: CSSProperties = {
  width: '100%',
  accentColor: 'var(--ui-surface-raised)',
}

export interface JogControlProps {
  label: string
  unit: string
  min: number
  max: number
  /** The committed (already clamped) value in display units, read from the store. */
  value: number
  onCommit: (parsed: number) => void
  /** Reads the TRUE post-commit value live from the store (quick 260816-qym,
   * U-1) — see `number-field-commit.ts`'s file header. Never the `value`
   * prop captured at render time; always a fresh `useCellStore.getState()`
   * read applied through the same `manual-pose-readback` selector `value`
   * itself was derived from. */
  readCommitted: () => number
  /** Slider step size, in the SAME display unit as `unit` (quick
   * 260816-qym, Task 5): 0.5 for a joint (degrees), 5 for the rail
   * (millimetres). */
  step: number
}

/**
 * Controlled numeric jog control for a single manual-jog axis (quick
 * 260816-m6d, renamed from `NumberField` in quick 260816-qym Task 5 once it
 * grew a slider alongside its typed field): a typed text entry plus a
 * range-input slider, both committing through the SAME `onCommit` — there
 * is no second write path.
 *
 * Typed field: holds the in-progress text in local state so a partial entry
 * (e.g. "-") never has to round-trip through the store. Commit cadence
 * (quick 260816-nup — U-3): `onChange` only updates the local `draft`; the
 * store action dispatches once, on blur or Enter.
 *
 * Drift fix (quick 260816-qym, U-1): the commit body delegates entirely to
 * `commitNumberFieldDraft` (`./number-field-commit.ts`), which reads the
 * settled value back from the store live via `readCommitted` rather than
 * closing over this render's own `value` prop — the confirmed stale-closure
 * defect where a successful commit was immediately overwritten by whatever
 * `value` happened to be BEFORE the store update landed. `lastValue` is then
 * updated from that same live `readCommitted()` call, not re-parsed from the
 * returned display string, so it can never disagree with the store by a
 * rounding step.
 *
 * External-write re-sync (quick 260816-qym, U-1/U-3): a render-time state
 * adjustment (React's documented "adjust state when a prop changes"
 * pattern — no `useEffect`) keeps `draft` following `value` whenever it
 * changes from OUTSIDE the typed field — a slider drag (below), the
 * Home/Reset button, a job load clearing manual override — otherwise those
 * writers would move the robot while the typed field kept showing a stale
 * number. Comparing against `lastValue` (not re-deriving on every render)
 * means a commit this field itself just made — which updates `lastValue` at
 * the same time — does not immediately re-trigger the sync branch.
 *
 * Native spinner surface removed (quick 260816-qym, U-1 second lead): a
 * focused native numeric input increments by its default step on a mouse
 * wheel and on the Up/Down arrow keys, entirely outside this component's
 * control — exactly the shape of the reported uniform +1-in-native-unit
 * drift. The typed field is declared as plain decimal-mode text entry
 * instead; `parseNumericInput` already validates every commit and the
 * min/max hint is already rendered as adjacent text, so nothing is lost —
 * the slider below now supplies the nudge affordance the spinner used to.
 *
 * Slider (quick 260816-qym, Task 5): a plain `<input type="range">`,
 * matching `ScrubControl.tsx`'s own documented reason for a native range
 * element over a registry Slider primitive. `value={value}` — the
 * store-derived number, NOT the local `draft` — so the thumb always
 * reflects the pose the robot is ACTUALLY holding. `onChange` dispatches
 * the SAME `onCommit(Number(event.target.value))` the typed field's commit
 * path uses, landing on `setManualJointAngle`/`setManualRailPos` ->
 * `commitManualJog` -> `validateManualPose` — no bypass. A refused drag
 * position is correct behaviour, not a bug: `commitManualJog` leaves
 * `manualJog` untouched on refusal, so the controlled `value` doesn't move
 * and the thumb visibly snaps back to the last safe pose while
 * `manualJogError` explains why — deliberately no smoothing, deferral, or
 * optimistic local slider state that would let the thumb travel through a
 * refused region.
 *
 * Shared widget (quick 260817-gdv): this component moved out of the single
 * Dashboard panel into its own file so `RunPanel.tsx` and
 * `FreeMovementPanel.tsx` — two deliberately independent panel copies — can
 * both use it without forking its stale-closure/commit-cadence fixes. A fix
 * landed here applies to both panels at once; the panel bodies themselves
 * are free to diverge.
 */
export default function JogControl({ label, unit, min, max, value, onCommit, readCommitted, step }: JogControlProps) {
  const [draft, setDraft] = useState(() => value.toFixed(1))
  const [lastValue, setLastValue] = useState(value)

  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value.toFixed(1))
  }

  function commitDraft() {
    const settledDraft = commitNumberFieldDraft(draft, onCommit, readCommitted)
    setDraft(settledDraft)
    setLastValue(readCommitted())
  }

  return (
    <div style={fieldStyle}>
      <div style={fieldLabelRowStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={hintStyle}>
          {min.toFixed(0)}…{max.toFixed(0)} {unit}
        </span>
      </div>
      <div style={inputRowStyle}>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          style={inputStyle}
        />
        <span style={unitStyle}>{unit}</span>
      </div>
      <input
        type="range"
        aria-label={`${label} (${unit})`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onCommit(Number(event.target.value))}
        style={rangeInputStyle}
      />
    </div>
  )
}
