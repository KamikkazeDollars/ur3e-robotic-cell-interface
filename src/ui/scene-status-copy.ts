/**
 * The UI-SPEC loading/error copy for the robot-load overlay, as a
 * framework-free constant.
 *
 * Lives in its own module — separate from `SceneStatusOverlay.tsx` — so the
 * copy contract is unit-testable in the existing Vitest node environment
 * without needing a DOM test environment or a rendering-test library, which
 * this phase does not otherwise need (01-UI-SPEC.md "Registry Safety").
 *
 * Strings are reproduced verbatim from 01-UI-SPEC.md "Copywriting Contract".
 * The loading string ends with a single U+2026 horizontal-ellipsis
 * character, not three periods.
 */
export const SCENE_STATUS_COPY = {
  loading: 'Loading robot model…',
  error: "Couldn't load the robot model. Check your connection and reload the page.",
} as const
