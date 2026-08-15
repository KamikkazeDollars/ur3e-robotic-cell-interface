import { useEffect, useRef } from 'react'
import { useUiShellStore } from '../store/uiShellStore'
import { useCellStore } from '../store/cellStore'
import { sampleMatchesMode, firstSampleIdForMode } from '../gcode/samples'

/**
 * G-04-1 gap closure. Enforces the invariant that the mode bar, the
 * picker's option list (`SampleSelect.tsx`), and the loaded toolpath must
 * never disagree: when `cellMode` changes and the currently loaded sample
 * belongs to the mode being left, this hook re-selects the first sample of
 * the newly active mode so the picker's value and the running job can never
 * point at a job the mounted tool can't actually run.
 *
 * This crossing lives in a hook mounted once at the shell level, not inside
 * `setCellMode` itself: `uiShellStore` holds UI chrome and deliberately does
 * not orchestrate simulation loading (see that store's header comment) — the
 * two stores are kept apart on purpose so either can be rewired without
 * touching the other. Doing the cross-store dispatch here, explicitly, at
 * the one place the shell mounts, keeps that crossing easy to find instead
 * of hidden inside a UI-chrome setter.
 *
 * `cellStore.selectSample` already resets `isPlaying`, `scrubFraction` and
 * `livePlayback.fraction` on every branch (see that store's own header
 * comment), so dispatching it from a mode switch mid-playback cannot leave a
 * stale position animating against a fresh trajectory — no extra guard is
 * needed here for that case.
 */
export default function useCellModeSampleSync(): void {
  const cellMode = useUiShellStore((state) => state.cellMode)
  const previousModeRef = useRef(cellMode)

  useEffect(() => {
    // Inert on the initial mount and on any effect run where the mode has
    // not actually changed since the previous run — the app still requires
    // an explicit first pick and must never auto-load a sample on startup.
    if (cellMode === previousModeRef.current) return
    previousModeRef.current = cellMode

    // Read non-reactively via getState(): this hook must only re-run when
    // cellMode changes, never when a selection changes (a reactive selector
    // here would re-fire this effect on its own selectSample dispatch).
    const { selectedSampleId, selectSample } = useCellStore.getState()
    if (selectedSampleId === null) return
    if (sampleMatchesMode(selectedSampleId, cellMode)) return

    const nextSampleId = firstSampleIdForMode(cellMode)
    if (nextSampleId === null) return
    void selectSample(nextSampleId)
  }, [cellMode])
}
