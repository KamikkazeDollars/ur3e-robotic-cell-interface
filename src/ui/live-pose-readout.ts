// Quick 260817-jfy (Task 1): the live joint-angle readout for the Run tab's
// read-only telemetry. `manual-pose-readback.ts`'s `manualJointDegrees` was
// built for a jog INPUT (what will be commanded next) — it has no
// trajectory branch, so reusing it verbatim here would show the parked pose
// frozen on screen while the robot visibly animates a job (finding F-1).
// This module adds the missing trajectory branch for joints only.
//
// Reads the reactive `scrubFraction` rather than the 60fps
// `livePlayback.fraction` `RobotPose.tsx` drives the scene with (finding
// F-3): `scrubFraction` is the coarse-cadence channel `usePlaybackClock.ts`
// throttle-syncs alongside the 60fps channel specifically so a subscribed
// DOM consumer (like Run's readouts, or `ScrubControl` already) can read it
// without forcing a per-frame React re-render — the exact anti-pattern
// CLAUDE.md and `cellStore.ts`'s file header forbid. Coarse-cadence text
// updates are correct and desirable here, not a compromise.
//
// The precedence below deliberately mirrors `RobotPose.tsx`'s own
// manualJog-then-sample-then-parked precedence exactly, so the on-screen
// numbers and the rendered arm can never disagree about which pose is
// authoritative.
//
// No rail function is exported here: per finding F-2, `railPos` is constant
// across every sample of a compiled trajectory ("nothing to blend" —
// `sample-lookup.ts`'s own doc comment), so the existing
// `manualRailMillimetres` from `./manual-pose-readback` is already
// live-correct. A second rail derivation would be exactly the kind of
// duplicate `manual-pose-readback.ts` was created to prevent.
import { UR3E_PARKED_POSE, type JointAngles } from '../kinematics'
import { toDegrees } from './manual-jog'
import type { ManualPoseReadbackState } from './manual-pose-readback'
import { sampleAtFraction } from '../trajectory/sample-lookup'
import type { CompiledTrajectory } from '../trajectory/compile'

export interface LivePoseReadoutState extends ManualPoseReadbackState {
  trajectory: CompiledTrajectory | null
  scrubFraction: number
}

/** The authoritative joint tuple Run's readouts show, in the same
 * precedence `RobotPose.tsx` applies at render time:
 *   1. `manualJog` non-null -> the manual pose (manual override wins).
 *   2. no trajectory, or an empty one -> `UR3E_PARKED_POSE`.
 *   3. otherwise -> the trajectory sample blended at `scrubFraction`.
 */
export function livePoseJoints(state: LivePoseReadoutState): JointAngles {
  if (state.manualJog) return state.manualJog.joints

  if (!state.trajectory || state.trajectory.samples.length === 0) return UR3E_PARKED_POSE

  const sample = sampleAtFraction(state.trajectory, state.scrubFraction)
  return sample ? sample.joints : UR3E_PARKED_POSE
}

/** Degrees value for joint `jointIndex`, per `livePoseJoints`'s precedence. */
export function livePoseJointDegrees(state: LivePoseReadoutState, jointIndex: number): number {
  return toDegrees(livePoseJoints(state)[jointIndex])
}
