// U-1, U-3: composes `classifySingularity` (existing since Phase 3) and
// `classifyPoseCollision` (this plan's Task 2) into the single verdict
// `cellStore.ts`'s manual-jog commit path gates on. Pure, framework-free —
// no React, no store import — mirroring `singularity.ts`/`pose-collision.ts`'s
// own discipline.
//
// The rejection copy lives HERE rather than in `src/ui/`: the store is the
// writer of the resulting message (`manualJogError`) and must not import
// upward from the UI layer. `src/ui/scene-status-copy.ts` sets the existing
// precedent for centralising user-facing strings in one tested place — this
// module is that same pattern, one layer lower in the dependency graph.
import { classifySingularity } from '../kinematics'
import { classifyPoseCollision } from './pose-collision'
import type { JointAngles } from '../kinematics'

export type ManualPoseRejectionReason =
  | 'singular-wrist'
  | 'singular-shoulder'
  | 'singular-elbow'
  | 'collision-floor'
  | 'collision-workbench'
  | 'collision-rig'

/** One short, plain-language sentence per reason — each states both what
 * was refused and that the last valid position was kept. */
export const MANUAL_POSE_REJECTION_COPY: Record<ManualPoseRejectionReason, string> = {
  'singular-wrist':
    'That entry would put the wrist in a singular orientation. The command was refused and the robot stayed at its last valid position.',
  'singular-shoulder':
    'That entry would put the shoulder in a singular orientation. The command was refused and the robot stayed at its last valid position.',
  'singular-elbow':
    'That entry would put the elbow in a singular orientation. The command was refused and the robot stayed at its last valid position.',
  'collision-floor':
    'That entry would drive the arm through the floor. The command was refused and the robot stayed at its last valid position.',
  'collision-workbench':
    'That entry would drive the arm through the workbench. The command was refused and the robot stayed at its last valid position.',
  'collision-rig':
    'That entry would drive the arm into the rail or carriage. The command was refused and the robot stayed at its last valid position.',
}

export interface ManualPoseVerdict {
  ok: boolean
  reason: ManualPoseRejectionReason | null
  message: string | null
}

/**
 * Calls `classifySingularity(joints)` first and returns the wrist ->
 * shoulder -> elbow reason in that fixed order; only if clean calls
 * `classifyPoseCollision(joints, railPos, workbenchX)` and returns floor ->
 * workbench -> rig in that fixed order. Fixed precedence so the message a
 * user sees for a given entry is deterministic across runs.
 */
export function validateManualPose(
  joints: JointAngles,
  railPos: number,
  workbenchX: number,
): ManualPoseVerdict {
  const singularity = classifySingularity(joints)

  if (singularity.wrist) {
    return { ok: false, reason: 'singular-wrist', message: MANUAL_POSE_REJECTION_COPY['singular-wrist'] }
  }
  if (singularity.shoulder) {
    return { ok: false, reason: 'singular-shoulder', message: MANUAL_POSE_REJECTION_COPY['singular-shoulder'] }
  }
  if (singularity.elbow) {
    return { ok: false, reason: 'singular-elbow', message: MANUAL_POSE_REJECTION_COPY['singular-elbow'] }
  }

  const collision = classifyPoseCollision(joints, railPos, workbenchX)

  if (collision.floor) {
    return { ok: false, reason: 'collision-floor', message: MANUAL_POSE_REJECTION_COPY['collision-floor'] }
  }
  if (collision.workbench) {
    return { ok: false, reason: 'collision-workbench', message: MANUAL_POSE_REJECTION_COPY['collision-workbench'] }
  }
  if (collision.rig) {
    return { ok: false, reason: 'collision-rig', message: MANUAL_POSE_REJECTION_COPY['collision-rig'] }
  }

  return { ok: true, reason: null, message: null }
}
