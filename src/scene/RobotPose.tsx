import { useFrame } from '@react-three/fiber'
import type { URDFRobot } from 'urdf-loader'
import { UR3E_JOINT_NAMES, toUrdfJointAngles } from '../kinematics'
import { useCellStore } from '../store/cellStore'
import { sampleAtFraction } from '../trajectory/sample-lookup'

interface RobotPoseProps {
  robot: URDFRobot
}

/**
 * Imperative, per-frame scrub/playback-driven pose driver (D-05). Renders
 * nothing.
 *
 * Reads `trajectory`/`livePlayback` via `useCellStore.getState()` inside
 * `useFrame` rather than a reactive selector-function subscription: both a
 * slider drag and playback (Phase 4) fire at animation-like rates, so a
 * reactive subscription here would re-render the scene subtree on every
 * tick — the exact anti-pattern CLAUDE.md and cellStore.ts's file header
 * both forbid. `livePlayback.fraction` is the non-reactive 60fps channel
 * that stays in lockstep with the reactive `scrubFraction` on every manual
 * drag and every throttled playback sync (see cellStore.ts), so reading it
 * here is correct for both interaction modes.
 *
 * The pose is BLENDED between the two bracketing compiled samples via the
 * shared `sampleAtFraction` lookup, not snapped to the nearer one (04-03,
 * supersedes Phase 3's nearest-index derivation): playback advances by time
 * and lands on arbitrary fractions between samples, and a short toolpath can
 * compile to very few samples — snapping to the nearest one would show as
 * visible per-sample ticking under a continuous clock, which was invisible
 * during Phase 3's manual scrubbing on a dense path but is not invisible
 * here.
 *
 * Feeds the blended `JointAngles` tuple into `setJointValue`, exactly as
 * `RobotModel.tsx` already does for the D-08 parked pose — including routing
 * through `toUrdfJointAngles` first, so the URDF's `base_link_inertia`
 * 180-degree frame divergence (see that function's doc comment) is corrected
 * here too. With no trajectory (or an empty one), this returns early and
 * leaves whatever pose is already applied untouched — with no sample
 * selected, that is the D-08 parked pose `RobotModel.tsx` set on load, which
 * is also `compileTrajectory`'s scrub-fraction-0 sample, so there is no
 * visual snap on selection.
 *
 * Does NOT touch `robot.rotation.x`: the solved joint angles already live
 * in the DH-native frame `setJointValue` expects (once corrected); the
 * one-time z-up -> y-up frame rotation is `RobotModel.tsx`'s own concern,
 * set once on load.
 *
 * Manual jog (quick 260816-m6d): when `manualJog` is non-null (the
 * Dashboard's typed joint/rail controls are commanding a pose), it wins over
 * the trajectory sample and this returns early — a manually commanded pose
 * always overrides whatever the compiled trajectory would otherwise show.
 * Routed through `toUrdfJointAngles` exactly like the solved-sample path
 * below: the URDF's `base_link_inertia` frame divergence applies to a
 * manually commanded pose just as much as a solved one.
 */
export default function RobotPose({ robot }: RobotPoseProps) {
  useFrame(() => {
    const { trajectory, livePlayback, manualJog } = useCellStore.getState()

    if (manualJog) {
      const urdfJoints = toUrdfJointAngles(manualJog.joints)
      UR3E_JOINT_NAMES.forEach((jointName, i) => {
        robot.setJointValue(jointName, urdfJoints[i])
      })
      return
    }

    if (!trajectory || trajectory.samples.length === 0) return

    const sample = sampleAtFraction(trajectory, livePlayback.fraction)
    if (!sample) return

    const urdfJoints = toUrdfJointAngles(sample.joints)
    UR3E_JOINT_NAMES.forEach((jointName, i) => {
      robot.setJointValue(jointName, urdfJoints[i])
    })
  })

  return null
}
