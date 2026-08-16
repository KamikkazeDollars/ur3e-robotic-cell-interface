import { useEffect } from 'react'
import { useUiShellStore } from '../store/uiShellStore'
import { useCellStore } from '../store/cellStore'

/**
 * Quick 260816-m6d, replacing `useCellModeSampleSync.ts`. Mounted once at
 * the shell level — the one place the UI-chrome store (`uiShellStore`) and
 * the simulation store (`cellStore`) are deliberately crossed, for the same
 * reason its predecessor documented: `uiShellStore` holds UI chrome and
 * deliberately does not orchestrate simulation loading itself, so this
 * crossing lives in a hook mounted once at the shell level instead of
 * hidden inside a UI-chrome setter.
 *
 * Two deliberate reversals of the predecessor's rules, both driven by the
 * user-facing requirement that each mode's tab already shows its job with
 * no manual picking:
 *
 * 1. Dispatches `loadJobForMode` on the INITIAL mount too — the
 *    predecessor's "must never auto-load a sample on startup" rule is
 *    reversed on purpose. Uses the `'mode-sync'` origin (not `'manual'`) so
 *    `ToolpathCameraFit.tsx` keeps the wide whole-cell default framing on
 *    startup instead of immediately zooming to the toolpath's bounding box.
 * 2. Dispatches `loadJobForMode` unconditionally on every later `cellMode`
 *    change too — the predecessor's `sampleMatchesMode` guard is dropped on
 *    purpose. With per-mode uploads, "the right job for this mode" is no
 *    longer answerable from the bundled-sample table alone (an uploaded job
 *    has no entry there at all), so a redundant reload is one cheap
 *    parse+compile rather than a correctness risk. The same `'mode-sync'`
 *    origin applies to every dispatch from this hook — none of them are a
 *    human's own dropdown pick.
 *
 * Reads the simulation store via `getState()` inside the effect (never a
 * reactive selector) so the effect's only dependency stays `cellMode` — a
 * reactive read here would re-fire this effect on its own `loadJobForMode`
 * dispatch.
 */
export default function useModeJobSync(): void {
  const cellMode = useUiShellStore((state) => state.cellMode)

  useEffect(() => {
    void useCellStore.getState().loadJobForMode(cellMode, 'mode-sync')
  }, [cellMode])
}
