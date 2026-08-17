import { useEffect } from 'react'
import { useUiShellStore } from '../store/uiShellStore'
import { useCellStore } from '../store/cellStore'
import { shouldPausePlayback } from './shell/playback-chrome-visibility'

/**
 * Quick 260817-gdv, Task 3. Modelled directly on `useModeJobSync.ts`'s
 * pattern: subscribes reactively to `activeTab` ONLY, and inside a
 * `useEffect` keyed on `activeTab` reads `isPlaying`/`pause` from
 * `useCellStore.getState()` — never a reactive selector.
 *
 * Why this guard exists: `usePlaybackClock` runs inside `CellScene`, which
 * stays mounted on every tab (it is the 3D scene itself, not part of the
 * tab-panel routing). Unmounting the Play/Pause button and scrub bar alone
 * (the `showsPlaybackControls` gate in `App.tsx`) would leave a job
 * animating with no reachable Pause once the user navigates away from
 * Run — this hook is what actually stops the clock, not just hides its
 * controls.
 *
 * Why the cellStore read is non-reactive: if `isPlaying` were a reactive
 * dependency of this effect, the effect's own `pause()` dispatch (which
 * flips `isPlaying` to false) would re-fire the effect immediately after
 * running — the exact self-refiring loop `useModeJobSync.ts`'s header
 * documents avoiding by reading via `getState()` instead of a selector.
 * Keeping `activeTab` as the only dependency means this effect runs exactly
 * once per tab change, never as a side effect of its own dispatch.
 */
export default function usePlaybackTabGuard(): void {
  const activeTab = useUiShellStore((state) => state.activeTab)

  useEffect(() => {
    const { isPlaying, pause } = useCellStore.getState()
    if (shouldPausePlayback(activeTab, isPlaying)) {
      pause()
    }
  }, [activeTab])
}
