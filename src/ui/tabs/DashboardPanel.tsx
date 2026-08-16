import { useState, type CSSProperties } from 'react'
import { PanelShell, PanelSection, ReadoutRow } from '../shell/PlaceholderPanel'
import { Button } from '../../components/ui/button'
import { useCellStore } from '../../store/cellStore'
import {
  parseNumericInput,
  toRadians,
  toDegrees,
  formatMillimetres,
  jointLimitsDegrees,
  railLimitsMillimetres,
  millimetresToMetres,
  metresToMillimetres,
} from '../manual-jog'
import { UR3E_PARKED_POSE, railRemainingTravel } from '../../kinematics'

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

interface NumberFieldProps {
  label: string
  unit: string
  min: number
  max: number
  /** The committed (already clamped) value in display units, read from the store. */
  value: number
  onCommit: (parsed: number) => void
}

/**
 * Controlled numeric input for manual-jog values (quick 260816-m6d). Holds
 * the in-progress text in local state so a partial entry (e.g. "-") never
 * has to round-trip through the store: on change, the draft updates
 * immediately and — when `parseNumericInput` can parse it — the store
 * action dispatches; on blur, the draft is rewritten from the (clamped)
 * `value` prop, so an out-of-range entry visibly snaps to the limit instead
 * of lingering as typed text.
 */
function NumberField({ label, unit, min, max, value, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(() => value.toFixed(1))

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
          type="number"
          aria-label={label}
          value={draft}
          onChange={(event) => {
            const text = event.target.value
            setDraft(text)
            const parsed = parseNumericInput(text)
            if (parsed !== null) onCommit(parsed)
          }}
          onBlur={() => setDraft(value.toFixed(1))}
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
  const trajectory = useCellStore((state) => state.trajectory)
  const lastRailPos = useCellStore((state) => state.lastRailPos)
  const setManualJointAngle = useCellStore((state) => state.setManualJointAngle)
  const setManualRailPos = useCellStore((state) => state.setManualRailPos)
  const clearManualJog = useCellStore((state) => state.clearManualJog)

  const joints = manualJog?.joints ?? UR3E_PARKED_POSE
  const railPosMetres = manualJog?.railPos ?? trajectory?.railPos ?? lastRailPos
  const remaining = railRemainingTravel(railPosMetres)
  const railLimits = railLimitsMillimetres()

  return (
    <PanelShell title="Dashboard">
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
              value={toDegrees(joints[i])}
              onCommit={(parsedDegrees) => setManualJointAngle(i, toRadians(parsedDegrees))}
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
          value={metresToMillimetres(railPosMetres)}
          onCommit={(parsedMm) => setManualRailPos(millimetresToMetres(parsedMm))}
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
