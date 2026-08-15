import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { useCellStore } from '../store/cellStore'
import { scrubMarkerRadiusFromBounds } from './marker-scale'
import { sampleAtFraction } from '../trajectory/sample-lookup'

// D-07: a deep teal, chosen so the current-scrub-position indicator is
// unmistakably distinct from every colour already claimed elsewhere in the
// scene — never `Toolpath.tsx`'s `RAPID_COLOR` (muted gray) or
// `CUTTING_COLOR` (warm orange, also the start/end marker tone), and never
// the app's accent red (`SCENE_PALETTE.navCubeHover`) reserved for the nav
// cube and active-tab indicator. This is a checkpoint-approved decision
// (D-07), not part of any reported gap — its tone is unchanged by G-03-4.
const SCRUB_MARKER_COLOR = '#0F766E'

/**
 * D-07 current-scrub-position indicator (SIM-05). Renders nothing reactive —
 * a single sphere mesh whose position is driven imperatively every frame,
 * mirroring `RobotPose.tsx`'s `useFrame` + `getState()` pattern exactly:
 * both this component and the pose driver call the SAME `sampleAtFraction`
 * export on the SAME `livePlayback.fraction` store field (04-03), so the
 * marker and the arm can never disagree about where along the path the
 * scrub/playback position is (the plan's load-bearing must-have — a
 * mismatch here would imply a positional accuracy the arm is not actually
 * achieving). This is a STRONGER guarantee than the two verbatim, hand-kept-
 * in-sync index derivations it replaces: Phase 3 deliberately chose that
 * duplication so the two could never silently drift apart (see cellStore.ts
 * decision log); this change reverses that choice on purpose, because one
 * shared function enforces the same invariant more strongly than two copies
 * that merely happen to agree today.
 *
 * Reads `trajectory`/`livePlayback` via `useCellStore.getState()` inside
 * `useFrame` rather than a reactive selector, for the same reason
 * `RobotPose.tsx` does: both a scrub drag and playback (Phase 4) fire at
 * animation-like rates, and a reactive subscription here would force a
 * React re-render of the scene subtree on every tick (CLAUDE.md
 * anti-pattern). `livePlayback.fraction` is the non-reactive 60fps channel
 * that stays in lockstep with the reactive `scrubFraction` on every manual
 * drag and every throttled playback sync (see cellStore.ts).
 *
 * One indicator only — not a pair, and explicitly not a per-operation
 * marker (Phase 6's job). Visibility is toggled off (rather than the
 * component returning null) whenever there is no compiled sample to point
 * at, so no marker renders before a trajectory exists.
 */
export default function ScrubMarker() {
  const meshRef = useRef<Mesh>(null)

  // G-03-4: radius derived from the same `ParsedToolpath.bounds` that sizes
  // the endpoint markers (`Toolpath.tsx`), scaled above them by
  // `SCRUB_MARKER_SCALE` inside `scrubMarkerRadiusFromBounds` — the size
  // hierarchy against the endpoint markers is now guaranteed by
  // construction in `marker-scale.ts` (and asserted there), rather than by
  // two literals that happened to be ordered correctly.
  //
  // This is a REACTIVE selector, unlike `trajectory`/`livePlayback` below,
  // which are deliberately read via `getState()` inside `useFrame` instead.
  // That asymmetry is legitimate, not an oversight: the parsed toolpath
  // (and therefore its bounds) changes at most once per sample selection —
  // exactly the coarse cadence `cellStore.ts`'s own header comment sanctions
  // for reactive subscriptions — whereas the scrub/playback fraction and
  // the pose it drives change every animation frame and must keep going
  // through `getState()` to avoid forcing a React re-render on every tick.
  const scrubMarkerRadius = useCellStore((state) => scrubMarkerRadiusFromBounds(state.toolpath?.bounds ?? null))

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const { trajectory, livePlayback } = useCellStore.getState()
    if (!trajectory || trajectory.samples.length === 0) {
      mesh.visible = false
      return
    }

    // Same shared lookup call `RobotPose.tsx` makes — the load-bearing
    // detail that keeps the marker and the robot's pose agreeing on where
    // along the path they are both reporting.
    const sample = sampleAtFraction(trajectory, livePlayback.fraction)
    if (!sample) {
      mesh.visible = false
      return
    }

    // Lifted by the marker's own radius on the vertical axis, mirroring
    // `Toolpath.tsx`'s `liftMarker` rationale: a sphere centred exactly on
    // the point sits half-sunk into the opaque workbench surface and is
    // visibly clipped by it. Lifting keeps the sphere's BOTTOM at the
    // sample's point instead of its centre, so it always rests visibly on
    // top of whatever surface that point happens to sit on.
    mesh.position.set(sample.point[0], sample.point[1] + scrubMarkerRadius, sample.point[2])
    mesh.visible = true
  })

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[scrubMarkerRadius, 16, 16]} />
      <meshStandardMaterial color={SCRUB_MARKER_COLOR} />
    </mesh>
  )
}
