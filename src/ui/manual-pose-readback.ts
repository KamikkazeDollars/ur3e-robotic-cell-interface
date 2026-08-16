// Quick 260816-qym (U-1): the single derivation of "what value is the
// Dashboard currently showing for this axis". `DashboardPanel.tsx` consumes
// these same two selectors for BOTH its reactive `value` props and its
// post-commit `readCommitted` read-back (`number-field-commit.ts`'s third
// argument), so the displayed number and the read-back can never disagree —
// they are provably the same derivation, called twice.
//
// Reproduces exactly the fallback chains `DashboardPanel.tsx` and
// `CellScene.tsx` already inline for the joint/rail display value and the
// carriage's rendered X respectively — this file does not invent a
// different fallback order, it names the existing one.
//
// A local structural type, not an import of cellStore's (unexported)
// `CellState` interface: `useCellStore.getState()` satisfies this shape
// structurally, and keeping this module's own input type minimal avoids a
// needless coupling to the store module's full internal shape.
import { UR3E_PARKED_POSE, type JointAngles } from '../kinematics'
import { toDegrees, metresToMillimetres } from './manual-jog'

export interface ManualPoseReadbackState {
  manualJog: { joints: JointAngles; railPos: number } | null
  trajectory: { railPos: number } | null
  lastRailPos: number
}

/** The degrees value the Dashboard shows (and would read back after a
 * commit) for joint `jointIndex` — `manualJog` when set, else the parked
 * pose, exactly `DashboardPanel.tsx`'s existing `joints[i]` derivation. */
export function manualJointDegrees(state: ManualPoseReadbackState, jointIndex: number): number {
  const joints = state.manualJog?.joints ?? UR3E_PARKED_POSE
  return toDegrees(joints[jointIndex])
}

/** The millimetres value the Dashboard shows (and would read back after a
 * commit) for the rail — `manualJog.railPos`, else the compiled
 * trajectory's rail position, else the last-known rail position, exactly
 * `DashboardPanel.tsx`'s existing `railPosMetres` derivation. */
export function manualRailMillimetres(state: ManualPoseReadbackState): number {
  const railPosMetres = state.manualJog?.railPos ?? state.trajectory?.railPos ?? state.lastRailPos
  return metresToMillimetres(railPosMetres)
}
