// Quick 260817-gdv, Task 3: the toolpath transport (Play/Pause button +
// scrub bar) belongs to the Run tab alone (quick 260817-gdv) — this
// predicate is the single source of that rule, so no component may inline
// its own tab comparison. Data only — no JSX, no React import — matching
// `shell-geometry.ts`'s convention so `playback-chrome-visibility.test.ts`
// can import it without a DOM.
//
// Quick 260817-iyv extended this rule to the sample/g-code picker
// (SampleSelect), and quick 260817-jfy extended it again to the top-of-scene
// mode bar (Printing/Milling toggle, mounted-tool chip, job label, upload
// control) — all Run-only chrome governed by this same predicate.
import { TAB_DEFS, type TabId } from '../tabs/tab-registry'

const RUN_TAB_ID: TabId = 'run'

/** True only for the Run tab. Any future third tab defaults to hidden — it
 * has to be explicitly added here to show the transport, never the other
 * way round. */
export function showsPlaybackControls(activeTab: TabId): boolean {
  return activeTab === RUN_TAB_ID
}

/** True only when playback IS running AND the current tab does NOT show
 * the transport — i.e. the user just navigated away from Run mid-playback.
 * Defined in terms of `showsPlaybackControls` rather than a second inline
 * id comparison, so the two predicates can never disagree with each other. */
export function shouldPausePlayback(activeTab: TabId, isPlaying: boolean): boolean {
  return isPlaying && !showsPlaybackControls(activeTab)
}

// Re-exported so the test file (and any future caller) can iterate the full
// registry without a second import of `tab-registry.ts`.
export { TAB_DEFS }
