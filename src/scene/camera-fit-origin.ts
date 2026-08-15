import type { SelectSampleOrigin } from '../store/cellStore'

/**
 * G-04-1 checkpoint follow-up (plan 04-06 continuation). Extracted as a
 * pure, standalone function — mirroring `marker-scale.ts`'s split from its
 * consuming scene component — so the decision `ToolpathCameraFit.tsx` makes
 * on every `toolpathLoadStatus` → 'ready' transition is unit-testable
 * without a DOM/canvas harness this repo's `environment: 'node'` Vitest
 * setup does not provide.
 *
 * A manual dropdown pick (`SampleSelect.tsx`, which calls `selectSample`
 * with no `origin` argument and so defaults to `'manual'`) should keep
 * getting the existing tight D-05 auto-frame. A mode switch's automatic
 * reselection (`useCellModeSampleSync.ts`, which passes `'mode-sync'`
 * explicitly) flips the SAME `toolpathLoadStatus` trigger but the user did
 * not ask to zoom in on whichever job the mode-sync silently picked for
 * them — they asked to see the rail sweep across the whole cell. Returning
 * `false` for that case tells `ToolpathCameraFit.tsx` to defer to
 * `requestCameraReset()` (the same wide framing the Reset View button
 * already produces via `CameraResetListener.tsx`) instead of computing a
 * tight fit.
 */
export function shouldTightFrameOnReady(origin: SelectSampleOrigin): boolean {
  return origin === 'manual'
}
