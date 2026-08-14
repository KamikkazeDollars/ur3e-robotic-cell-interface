import { useFrame } from '@react-three/fiber'
import type { URDFRobot } from 'urdf-loader'
import { UR3E_JOINT_NAMES } from '../kinematics'
import { useCellStore } from '../store/cellStore'

interface RobotPoseProps {
  robot: URDFRobot
}

/**
 * Imperative, per-frame scrub-driven pose driver (D-05). Renders nothing.
 *
 * Reads `trajectory`/`scrubFraction` via `useCellStore.getState()` inside
 * `useFrame` rather than a reactive selector-function subscription: a
 * slider drag fires at animation-like rates, so a reactive subscription
 * here would re-render the scene subtree on every tick — the exact
 * anti-pattern CLAUDE.md and cellStore.ts's file header both forbid.
 *
 * Zips `UR3E_JOINT_NAMES` against the chosen sample's `JointAngles` tuple
 * via `setJointValue`, exactly as `RobotModel.tsx` already does for the D-08
 * ready pose. With no trajectory (or an empty one), this returns early and
 * leaves whatever pose is already applied untouched — with no sample
 * selected, that is the D-08 ready pose `RobotModel.tsx` set on load.
 *
 * Does NOT touch `robot.rotation.x`: the solved joint angles already live
 * in the DH-native frame `setJointValue` expects; the one-time z-up -> y-up
 * frame rotation is `RobotModel.tsx`'s own concern, set once on load.
 */
export default function RobotPose({ robot }: RobotPoseProps) {
  useFrame(() => {
    const { trajectory, scrubFraction } = useCellStore.getState()
    if (!trajectory || trajectory.samples.length === 0) return

    const { samples } = trajectory
    const rawIndex = Math.round(scrubFraction * (samples.length - 1))
    const index = Math.min(samples.length - 1, Math.max(0, rawIndex))
    const sample = samples[index]

    UR3E_JOINT_NAMES.forEach((jointName, i) => {
      robot.setJointValue(jointName, sample.joints[i])
    })
  })

  return null
}
