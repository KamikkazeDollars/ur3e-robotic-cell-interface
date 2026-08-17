import type { CSSProperties } from 'react'
import { PanelShell, PanelSection, ReadoutRow } from '../shell/PlaceholderPanel'
import { Button } from '../../components/ui/button'
import { useCellStore } from '../../store/cellStore'
import JogControl from '../JogControl'
import {
  toRadians,
  formatMillimetres,
  jointLimitsDegrees,
  railLimitsMillimetres,
  millimetresToMetres,
} from '../manual-jog'
import { manualJointDegrees, manualRailMillimetres, type ManualPoseReadbackState } from '../manual-pose-readback'
import { railRemainingTravel } from '../../kinematics'

const JOINT_LABELS = ['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3'] as const

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

/**
 * Run tab (DASH-01/DASH-03), the renamed Dashboard panel (quick 260817-gdv —
 * previously `DashboardPanel.tsx`), reworked into a real manual-control
 * surface (quick 260816-m6d, supersedes the Phase 5 static placeholder):
 * six typed joint angles plus a typed rail position, every entry clamped
 * (never rejected) to the real configured limits read from
 * `UR3E_JOINT_LIMITS`/`RAIL_TRAVEL` via the `src/kinematics` barrel and the
 * `src/ui/manual-jog.ts` degrees/mm presentation layer. The shared
 * `JogControl` widget (`src/ui/JogControl.tsx`) supplies each axis's typed
 * field + slider.
 *
 * Deliberately has no tool-center-point section (DASH-02 descoped — see
 * `.planning/REQUIREMENTS.md`): the cell's flange is bare, so a Cartesian/
 * speed readout would describe a tool that does not exist.
 *
 * Displayed joint/rail values always come from `manualJog` when it is
 * non-null, falling back to `UR3E_PARKED_POSE`/the current trajectory or
 * last-known rail position — the numbers on screen are always exactly the
 * numbers that will be (or already are) commanded.
 *
 * `FreeMovementPanel.tsx` (quick 260817-gdv) is a deliberate copy of this
 * component, started verbatim identical and expected to diverge into a
 * distinct manual-jog surface — editing this file does not automatically
 * change that one, and vice versa.
 */
export default function RunPanel() {
  const manualJog = useCellStore((state) => state.manualJog)
  const manualJogError = useCellStore((state) => state.manualJogError)
  const trajectory = useCellStore((state) => state.trajectory)
  const lastRailPos = useCellStore((state) => state.lastRailPos)
  const setManualJointAngle = useCellStore((state) => state.setManualJointAngle)
  const setManualRailPos = useCellStore((state) => state.setManualRailPos)
  const clearManualJog = useCellStore((state) => state.clearManualJog)
  const homeManualPose = useCellStore((state) => state.homeManualPose)

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
    <PanelShell title="Run">
      {manualJogError && (
        <div role="alert" style={errorRowStyle}>
          {manualJogError}
        </div>
      )}
      <PanelSection heading="Joint angles — manual control">
        {JOINT_LABELS.map((label, i) => {
          const limits = jointLimitsDegrees(i)
          return (
            <JogControl
              key={label}
              label={label}
              unit="°"
              min={limits.min}
              max={limits.max}
              step={0.5}
              value={manualJointDegrees(poseState, i)}
              onCommit={(parsedDegrees) => setManualJointAngle(i, toRadians(parsedDegrees))}
              readCommitted={() => manualJointDegrees(useCellStore.getState(), i)}
            />
          )
        })}
      </PanelSection>
      <PanelSection heading="Rail — 7th axis">
        <JogControl
          label="Position"
          unit="mm"
          min={railLimits.min}
          max={railLimits.max}
          step={5}
          value={manualRailMillimetres(poseState)}
          onCommit={(parsedMm) => setManualRailPos(millimetresToMetres(parsedMm))}
          readCommitted={() => manualRailMillimetres(useCellStore.getState())}
        />
        <ReadoutRow label="Travel remaining (−X) (mm)" value={formatMillimetres(remaining.negative)} />
        <ReadoutRow label="Travel remaining (+X) (mm)" value={formatMillimetres(remaining.positive)} />
      </PanelSection>
      <PanelSection heading="Recovery">
        {/* Quick 260816-qym (U-4): always visible/enabled, including while
            a job is playing or paused — recovering a robot mid-run is the
            entire point. Dispatches homeManualPose, the SAME
            commitManualJog/validateManualPose gated path every other
            manual-jog write uses; distinct from "Return to toolpath" below
            (one hands control back to the trajectory, one parks the
            robot) — both are wanted, so both stay. */}
        <Button variant="secondary" onClick={() => homeManualPose()}>
          Home / Reset Position
        </Button>
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
