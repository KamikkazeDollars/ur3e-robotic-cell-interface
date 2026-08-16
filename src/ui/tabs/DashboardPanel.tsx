import { useState, type CSSProperties } from 'react'
import { PanelShell, PanelSection, ReadoutRow } from '../shell/PlaceholderPanel'
import { Button } from '../../components/ui/button'
import { useCellStore } from '../../store/cellStore'
import {
  toRadians,
  formatMillimetres,
  jointLimitsDegrees,
  railLimitsMillimetres,
  millimetresToMetres,
} from '../manual-jog'
import { commitNumberFieldDraft } from '../number-field-commit'
import { manualJointDegrees, manualRailMillimetres, type ManualPoseReadbackState } from '../manual-pose-readback'
import { railRemainingTravel } from '../../kinematics'

const JOINT_LABELS = ['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3'] as const

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

const overrideNoteStyle: CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
  fontStyle: 'italic',
}

const overrideRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

/** U-3 (quick 260816-nup): the manual-jog rejection alert row. Reuses
 * `inputStyle`'s own surface treatment (`--ui-surface-raised`, `8px`
 * radius, `1px solid var(--ui-border)`) with `--ui-destructive` for the
 * text — the token `src/index.css` reserves as distinct from `--ui-accent`
 * for exactly this purpose. No new colour introduced. */
const errorRowStyle: CSSProperties = {
  padding: 'var(--space-sm)',
  borderRadius: '8px',
  border: '1px solid var(--ui-border)',
  background: 'var(--ui-surface-raised)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-destructive)',
}

interface NumberFieldProps {
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
}

/**
 * Controlled numeric input for manual-jog values (quick 260816-m6d). Holds
 * the in-progress text in local state so a partial entry (e.g. "-") never
 * has to round-trip through the store.
 *
 * Commit cadence (quick 260816-nup — U-3): `onChange` only updates the local
 * `draft`; the store action dispatches once, on blur or Enter.
 *
 * Drift fix (quick 260816-qym, U-1): the commit body now delegates entirely
 * to `commitNumberFieldDraft` (`../number-field-commit.ts`), which reads the
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
 * changes from OUTSIDE this field (a slider drag, the Home/Reset button, a
 * job load clearing manual override) — otherwise those writers would move
 * the robot while this field kept showing a stale number. Comparing against
 * `lastValue` (not re-deriving on every render) means a commit this field
 * itself just made — which updates `lastValue` at the same time — does not
 * immediately re-trigger the sync branch.
 *
 * Native spinner surface removed (quick 260816-qym, U-1 second lead): a
 * focused native numeric input increments by its default step on a mouse
 * wheel and on the Up/Down arrow keys, entirely outside this component's
 * control — exactly the shape of the reported uniform +1-in-native-unit
 * drift. The field is now declared as plain decimal-mode text entry
 * instead; `parseNumericInput` already validates every commit and the
 * min/max hint is already rendered as adjacent text, so nothing is lost.
 */
function NumberField({ label, unit, min, max, value, onCommit, readCommitted }: NumberFieldProps) {
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
    </div>
  )
}

/**
 * Dashboard tab (DASH-01/DASH-03) reworked into a real manual-control
 * surface (quick 260816-m6d, supersedes the Phase 5 static placeholder):
 * six typed joint angles plus a typed rail position, every entry clamped
 * (never rejected) to the real configured limits read from
 * `UR3E_JOINT_LIMITS`/`RAIL_TRAVEL` via the `src/kinematics` barrel and the
 * `src/ui/manual-jog.ts` degrees/mm presentation layer.
 *
 * Deliberately has no tool-center-point section (DASH-02 descoped — see
 * `.planning/REQUIREMENTS.md`): the cell's flange is bare, so a Cartesian/
 * speed readout would describe a tool that does not exist.
 *
 * Displayed joint/rail values always come from `manualJog` when it is
 * non-null, falling back to `UR3E_PARKED_POSE`/the current trajectory or
 * last-known rail position — the numbers on screen are always exactly the
 * numbers that will be (or already are) commanded.
 */
export default function DashboardPanel() {
  const manualJog = useCellStore((state) => state.manualJog)
  const manualJogError = useCellStore((state) => state.manualJogError)
  const trajectory = useCellStore((state) => state.trajectory)
  const lastRailPos = useCellStore((state) => state.lastRailPos)
  const setManualJointAngle = useCellStore((state) => state.setManualJointAngle)
  const setManualRailPos = useCellStore((state) => state.setManualRailPos)
  const clearManualJog = useCellStore((state) => state.clearManualJog)

  // The reactive snapshot this render's `value` props derive from — the
  // SAME shape (and, structurally, the same fields) `manual-pose-readback.ts`
  // reads from `useCellStore.getState()` inside each field's `readCommitted`
  // closure below (quick 260816-qym, U-1). One selector, two call sites, so
  // the displayed number and the post-commit read-back can never disagree.
  const poseState: ManualPoseReadbackState = { manualJog, trajectory, lastRailPos }
  const railPosMetres = manualJog?.railPos ?? trajectory?.railPos ?? lastRailPos
  const remaining = railRemainingTravel(railPosMetres)
  const railLimits = railLimitsMillimetres()

  return (
    <PanelShell title="Dashboard">
      {manualJogError && (
        <div role="alert" style={errorRowStyle}>
          {manualJogError}
        </div>
      )}
      <PanelSection heading="Joint angles — manual control">
        {JOINT_LABELS.map((label, i) => {
          const limits = jointLimitsDegrees(i)
          return (
            <NumberField
              key={label}
              label={label}
              unit="°"
              min={limits.min}
              max={limits.max}
              value={manualJointDegrees(poseState, i)}
              onCommit={(parsedDegrees) => setManualJointAngle(i, toRadians(parsedDegrees))}
              readCommitted={() => manualJointDegrees(useCellStore.getState(), i)}
            />
          )
        })}
      </PanelSection>
      <PanelSection heading="Rail — 7th axis">
        <NumberField
          label="Position"
          unit="mm"
          min={railLimits.min}
          max={railLimits.max}
          value={manualRailMillimetres(poseState)}
          onCommit={(parsedMm) => setManualRailPos(millimetresToMetres(parsedMm))}
          readCommitted={() => manualRailMillimetres(useCellStore.getState())}
        />
        <ReadoutRow label="Travel remaining (−X) (mm)" value={formatMillimetres(remaining.negative)} />
        <ReadoutRow label="Travel remaining (+X) (mm)" value={formatMillimetres(remaining.positive)} />
      </PanelSection>
      {manualJog && (
        <div style={overrideRowStyle}>
          <span style={overrideNoteStyle}>Manual command is currently overriding playback.</span>
          <Button variant="secondary" onClick={() => clearManualJog()}>
            Return to toolpath
          </Button>
        </div>
      )}
    </PanelShell>
  )
}
