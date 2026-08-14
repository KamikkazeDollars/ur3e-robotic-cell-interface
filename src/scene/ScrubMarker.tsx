import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { useCellStore } from '../store/cellStore'

// D-07: a deep teal, chosen so the current-scrub-position indicator is
// unmistakably distinct from every colour already claimed elsewhere in the
// scene — never `Toolpath.tsx`'s `RAPID_COLOR` (#9CA3AF muted gray) or
// `CUTTING_COLOR` (#EA580C warm orange, also the start/end marker tone),
// and never the UI-SPEC Accent blue (#2563EB) reserved exclusively for the
// nav cube and the Reset View button. Reads clearly against both the
// Dominant (#FAFAFA) background and the Secondary (#E4E7EB) floor/workbench.
const SCRUB_MARKER_COLOR = '#0F766E'

// Meaningfully larger than `Toolpath.tsx`'s MARKER_RADIUS (0.012) so this
// single current-position indicator reads as the PRIMARY marker on the
// toolpath, not a third instance of the same start/end bullet size.
const SCRUB_MARKER_RADIUS = 0.02

/**
 * D-07 current-scrub-position indicator (SIM-05). Renders nothing reactive —
 * a single sphere mesh whose position is driven imperatively every frame,
 * mirroring `RobotPose.tsx`'s `useFrame` + `getState()` pattern exactly:
 * both this component and the pose driver resolve the SAME sample index
 * from the SAME `scrubFraction`, via the identical `Math.round` + clamp
 * derivation, so the marker and the arm can never disagree about where
 * along the path the scrub is (the plan's load-bearing must-have — a
 * mismatch here would imply a positional accuracy the arm is not actually
 * achieving).
 *
 * Reads `trajectory`/`scrubFraction` via `useCellStore.getState()` inside
 * `useFrame` rather than a reactive selector, for the same reason
 * `RobotPose.tsx` does: a scrub drag fires at animation-like rates, and a
 * reactive subscription here would force a React re-render of the scene
 * subtree on every tick (CLAUDE.md anti-pattern).
 *
 * One indicator only — not a pair, and explicitly not a per-operation
 * marker (Phase 6's job). Visibility is toggled off (rather than the
 * component returning null) whenever there is no compiled sample to point
 * at, so no marker renders before a trajectory exists.
 */
export default function ScrubMarker() {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const { trajectory, scrubFraction } = useCellStore.getState()
    if (!trajectory || trajectory.samples.length === 0) {
      mesh.visible = false
      return
    }

    const { samples } = trajectory
    // Identical index derivation to `RobotPose.tsx` — the load-bearing
    // detail that keeps the marker and the robot's pose agreeing on which
    // sample they are both reporting.
    const rawIndex = Math.round(scrubFraction * (samples.length - 1))
    const index = Math.min(samples.length - 1, Math.max(0, rawIndex))
    const sample = samples[index]

    // Lifted by the marker's own radius on the vertical axis, mirroring
    // `Toolpath.tsx`'s `liftMarker` rationale: a sphere centred exactly on
    // the point sits half-sunk into the opaque workbench surface and is
    // visibly clipped by it. Lifting keeps the sphere's BOTTOM at the
    // sample's point instead of its centre, so it always rests visibly on
    // top of whatever surface that point happens to sit on.
    mesh.position.set(sample.point[0], sample.point[1] + SCRUB_MARKER_RADIUS, sample.point[2])
    mesh.visible = true
  })

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[SCRUB_MARKER_RADIUS, 16, 16]} />
      <meshStandardMaterial color={SCRUB_MARKER_COLOR} />
    </mesh>
  )
}
