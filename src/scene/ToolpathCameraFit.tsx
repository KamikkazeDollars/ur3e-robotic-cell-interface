import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3, type PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCellStore } from '../store/cellStore'
import { shouldTightFrameOnReady } from './camera-fit-origin'

// Padding factor applied to the computed fit distance, a little above 1, so
// the toolpath's bounding box doesn't touch the viewport edges.
const FIT_PADDING = 1.3

/**
 * In-Canvas subscriber that renders nothing. Frames the camera to the
 * selected sample's parsed toolpath bounds (D-05), reading the bounds the
 * parser already computed in world space (post D-06 anchor) rather than
 * recomputing a bounding box by traversing the scene graph.
 *
 * Structurally mirrors `CameraResetListener.tsx` — one `useThree` read of
 * camera/controls, one `useEffect` keyed on a single store field, imperative
 * mutation, deliberate narrow dependency array. Unlike the reset listener,
 * this component DOES act on its first run: no sample is loaded at all
 * until the user picks one, so — unlike the always-already-framed default
 * camera the reset listener guards — there is no unwanted initial move to
 * skip here.
 *
 * Keyed on `toolpathLoadStatus`, not `selectedSampleId`: `selectSample`
 * (cellStore.ts) sets `selectedSampleId` synchronously, before the async
 * fetch/parse resolves, at the same moment it resets `toolpath` to null —
 * so bounds are never available on that transition. `toolpathLoadStatus`
 * flips to 'ready' only once `toolpath.bounds` is actually populated,
 * which is the transition this effect needs to react to.
 *
 * G-04-1 checkpoint follow-up (plan 04-06 continuation): `toolpathLoadStatus`
 * also flips to 'ready' when `useCellModeSampleSync.ts` auto-reselects a
 * sample after a mode switch, not just on a manual dropdown pick. That
 * mode-triggered case must NOT re-trigger this tight auto-frame — the user
 * asked to see the rail sweep, not zoom in on whichever job the mode-sync
 * silently picked. `shouldTightFrameOnReady` (camera-fit-origin.ts) reads
 * `cellStore`'s `lastSelectSampleOrigin` to tell the two cases apart; the
 * mode-sync case defers to `requestCameraReset()` (the SAME wide framing
 * Reset View already produces via `CameraResetListener.tsx`) instead of
 * computing a fit here.
 */
export default function ToolpathCameraFit() {
  const camera = useThree((state) => state.camera) as ThreePerspectiveCamera
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null
  const toolpathLoadStatus = useCellStore((state) => state.toolpathLoadStatus)

  useEffect(() => {
    if (toolpathLoadStatus !== 'ready') return
    const state = useCellStore.getState()

    // G-04-1 checkpoint follow-up: a mode-sync-triggered reselection flips
    // this same 'ready' transition, but wants the wide Reset View framing,
    // not this tight fit — see the file-header comment. This check runs
    // before the `controls` guard below because `requestCameraReset()` is a
    // store-only write; it does not need `controls` to be non-null.
    if (!shouldTightFrameOnReady(state.lastSelectSampleOrigin)) {
      state.requestCameraReset()
      return
    }

    if (!controls) return
    const bounds = state.toolpath?.bounds
    if (!bounds) return

    const center = new Vector3(
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    )
    const size = Math.max(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    )

    // Guard the arithmetic: a degenerate (zero or non-finite) largest
    // dimension would otherwise propagate into a non-finite camera position
    // and blank the canvas with no error (T-02-11) — leave the camera
    // untouched instead.
    if (!Number.isFinite(size) || size <= 0) return

    const fovRadians = (camera.fov * Math.PI) / 180
    const distance = ((size / 2) / Math.tan(fovRadians / 2)) * FIT_PADDING

    // Preserve the current viewing DIRECTION rather than resetting to a
    // fixed angle: framing the new bounds from the angle the user is
    // already looking from avoids an unexplained rotation on every
    // selection.
    const direction = camera.position.clone().sub(controls.target)
    if (direction.lengthSq() === 0) direction.set(0, 0, 1)
    direction.normalize()

    camera.position.copy(center.clone().add(direction.multiplyScalar(distance)))
    controls.target.copy(center)
    controls.update()
    // Intentionally reacting only to toolpathLoadStatus — camera/controls are
    // stable object references from R3F's default-controls registration,
    // and the toolpath bounds are re-read from the store fresh on every run
    // rather than added to the dependency array, so a re-render that doesn't
    // flip the load status can't re-fire this effect and fight the user's
    // own subsequent camera moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolpathLoadStatus])

  return null
}
