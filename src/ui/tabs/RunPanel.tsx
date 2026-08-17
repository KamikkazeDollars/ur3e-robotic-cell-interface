import type { CSSProperties } from 'react'
import { PanelShell, PanelSection, ReadoutRow } from '../shell/PlaceholderPanel'
import { useCellStore } from '../../store/cellStore'
import { formatMillimetres } from '../manual-jog'
import { manualRailMillimetres } from '../manual-pose-readback'
import { livePoseJointDegrees, type LivePoseReadoutState } from '../live-pose-readout'
import { railRemainingTravel } from '../../kinematics'

const JOINT_LABELS = ['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3'] as const

const overrideNoteStyle: CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
  fontStyle: 'italic',
}

/**
 * Run tab (DASH-01/DASH-03), the renamed Dashboard panel (quick 260817-gdv —
 * previously `DashboardPanel.tsx`). As of quick 260817-jfy this is a
 * READ-ONLY live telemetry readout, not a manual-control surface: manual
 * jog control now lives solely on `FreeMovementPanel.tsx`. Run shows six
 * joint-angle rows and a rail-position row as plain label/value text — no
 * input, no slider, no button, no store-write path.
 *
 * Joint values come from `livePoseJointDegrees` (`../live-pose-readout`),
 * not from `manual-pose-readback.ts`'s `manualJointDegrees`: the latter has
 * no trajectory branch (`state.manualJog?.joints ?? UR3E_PARKED_POSE`) and
 * would show the parked pose frozen on screen while the robot visibly
 * animates a job — it was built for a jog INPUT, not a playback readout
 * (finding F-1). `livePoseJointDegrees` adds the missing trajectory branch,
 * sampled at the reactive, throttle-synced `scrubFraction` so the readout
 * updates at a coarse cadence without forcing a per-frame React re-render
 * (finding F-3).
 *
 * The rail row still uses `manualRailMillimetres` unchanged: `railPos` is
 * constant across every sample of a compiled trajectory ("nothing to
 * blend" — `sample-lookup.ts`'s own doc comment), so that chain is already
 * live-correct and a second rail derivation would only duplicate it
 * (finding F-2).
 *
 * The Recovery section (`Home / Reset Position`) and the override-release
 * button (`Return to toolpath`) were deliberately removed, not overlooked:
 * both dispatch a manual-pose store WRITE, and Run now has no write path at
 * all. Releasing a manual override requires switching to the Manual tab
 * (`free-movement` id, `FreeMovementPanel.tsx` — labelled "Manual" as of
 * quick 260817), or loading/reselecting a job, which clears `manualJog` on
 * every branch of `loadJobSource` — see finding F-7, the one judgement
 * call in this quick task, flagged for human confirmation at the end of
 * Task 3.
 *
 * Deliberately still has no tool-center-point section (DASH-02 descoped —
 * see `.planning/REQUIREMENTS.md`): the cell's flange is bare, so a
 * Cartesian/speed readout would describe a tool that does not exist.
 *
 * `FreeMovementPanel.tsx` keeps full manual control and is untouched by
 * this quick task — editing this file does not affect that one, and vice
 * versa.
 */
export default function RunPanel() {
  const manualJog = useCellStore((state) => state.manualJog)
  const trajectory = useCellStore((state) => state.trajectory)
  const lastRailPos = useCellStore((state) => state.lastRailPos)
  const scrubFraction = useCellStore((state) => state.scrubFraction)

  // One snapshot feeding BOTH the joint readouts and the rail readout, so
  // the two can never be fed different state (mirrors the discipline
  // `manual-pose-readback.ts`'s own doc comment establishes for this shape).
  const poseState: LivePoseReadoutState = { manualJog, trajectory, lastRailPos, scrubFraction }
  const railPosMetres = manualJog?.railPos ?? trajectory?.railPos ?? lastRailPos
  const remaining = railRemainingTravel(railPosMetres)

  return (
    <PanelShell title="Run">
      <PanelSection heading="Joint angles">
        {JOINT_LABELS.map((label, i) => (
          <ReadoutRow key={label} label={`${label} (°)`} value={livePoseJointDegrees(poseState, i).toFixed(1)} />
        ))}
      </PanelSection>
      <PanelSection heading="Rail — 7th axis">
        <ReadoutRow label="Position (mm)" value={manualRailMillimetres(poseState).toFixed(1)} />
        <ReadoutRow label="Travel remaining (−X) (mm)" value={formatMillimetres(remaining.negative)} />
        <ReadoutRow label="Travel remaining (+X) (mm)" value={formatMillimetres(remaining.positive)} />
      </PanelSection>
      {manualJog && (
        <span style={overrideNoteStyle}>
          Manual command is currently overriding playback. Switch to Manual to release it.
        </span>
      )}
    </PanelShell>
  )
}
