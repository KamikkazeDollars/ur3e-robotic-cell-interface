/**
 * The UI-SPEC loading/error copy for the robot-load and toolpath-load
 * overlay, as a framework-free constant.
 *
 * Lives in its own module — separate from `SceneStatusOverlay.tsx` — so the
 * copy contract is unit-testable in the existing Vitest node environment
 * without needing a DOM test environment or a rendering-test library, which
 * this phase does not otherwise need (01-UI-SPEC.md "Registry Safety").
 *
 * Strings are reproduced verbatim from 01-UI-SPEC.md "Copywriting Contract".
 * Every "in progress" string ends with a single U+2026 horizontal-ellipsis
 * character, not three periods, matching the existing `loading` string's
 * punctuation convention (extended, not duplicated, by `toolpathParsing`).
 */
export const SCENE_STATUS_COPY = {
  loading: 'Loading robot model…',
  error: "Couldn't load the robot model. Check your connection and reload the page.",
  toolpathParsing: 'Parsing g-code…',
  toolpathError: "Couldn't load that sample. Check your connection and try again.",
  // D-06/SIM-05: a fixed string with no interpolation — the numeric detail
  // (samples reached vs. intended) is composed at the call site, the same
  // way `SampleSelect.tsx`'s existing skipped-command note composes its own
  // count, so this copy contract can never accidentally become a template
  // for a caught exception's text.
  trajectoryFrozen: "Part of this toolpath is beyond the robot's reach. The robot is held at the last reachable point.",
} as const

/**
 * Resolves the toolpath's in-progress/failed copy string without requiring
 * callers to spell out the `SCENE_STATUS_COPY.toolpathParsing`/`.toolpathError`
 * property names themselves — keeps the copy-key selection colocated with
 * the copy constants it selects from, one level removed from any consumer.
 */
export function toolpathStatusCopy(status: 'parsing' | 'error'): string {
  return status === 'parsing' ? SCENE_STATUS_COPY.toolpathParsing : SCENE_STATUS_COPY.toolpathError
}
