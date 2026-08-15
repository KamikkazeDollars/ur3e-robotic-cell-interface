---
phase: 04-playback-engine
plan: 01
subsystem: playback
tags: [react-three-fiber, zustand, useFrame, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-inverse-kinematics-trajectory-compile-scrub
    provides: cellStore.trajectory (CompiledTrajectory), scrubFraction/setScrubFraction, RobotPose.tsx/ScrubMarker.tsx's getState()-inside-useFrame pattern
provides:
  - Pure playback clock core (src/playback/clock-step.ts) — duration constant, delta clamp, resume/restart branching, termination
  - usePlaybackClock R3F hook driving the clock via useFrame
  - cellStore isPlaying/play()/pause() and the non-reactive livePlayback.fraction dual-cadence channel
  - PlaybackControl Play/Pause DOM control
  - RobotPose.tsx/ScrubMarker.tsx reading livePlayback.fraction instead of scrubFraction (60fps, not throttled)
  - ScrubControl.tsx pause-on-drag (D-04)
affects: [05-telemetry-dashboard, 06-operation-polish]

# Actuals (#2632)
actuals:
  tokens: 10600
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-cadence Zustand store write: a referentially-stable livePlayback object mutated by direct property assignment (never set()) for 60fps consumers, alongside a throttled reactive scrubFraction sync for DOM consumers"
    - "FractionMapping seam (elapsedToFraction/fractionToElapsed) isolates the D-02 weighted-time mapping (plan 04-02) from the clock stepping logic"

key-files:
  created:
    - src/playback/clock-step.ts
    - src/playback/clock-step.test.ts
    - src/playback/usePlaybackClock.ts
    - src/ui/PlaybackControl.tsx
  modified:
    - src/store/cellStore.ts
    - src/store/cellStore.test.ts
    - src/App.tsx
    - src/scene/CellScene.tsx
    - src/scene/RobotPose.tsx
    - src/scene/ScrubMarker.tsx
    - src/ui/ScrubControl.tsx

key-decisions:
  - "Proceeded directly from Task 1 (tracer) into Task 2 without a mid-flight checkpoint:human-verify halt, because config.json sets workflow.human_verify_mode: end-of-phase and checkpoints.md's default-mode note states new projects do NOT halt mid-flight at checkpoint:human-verify — the tracer's <verify><human-check> block is already the embedded verification detail the end-of-phase UAT flow harvests, matching the plan's own <verification> section wording ('deferred to the end-of-phase human verification')."
  - "usePlaybackClock guards on toolpath being non-null (in addition to trajectory), even though the plan's action prose only lists isPlaying/trajectory/samples.length — toolpath is required for the mapping-record identity check and is always set alongside trajectory in selectSample, so this is a type-safety addition, not a behavior change."

patterns-established:
  - "Pattern 1 (dual-cadence store write) and Pattern 2 (pause lives in the drag handler, never in setScrubFraction) from 04-RESEARCH.md, implemented exactly as researched."

requirements-completed: [SIM-04]

coverage:
  - id: D1
    description: "Play/Pause playback engine — pure clock core (D-01 fixed 10s duration, D-05/D-06/D-07 resume/restart/termination) wired through a dual-cadence store (livePlayback 60fps / scrubFraction throttled ~12.5Hz) so the robot and scrub marker animate smoothly end-to-end while the slider tracks progress without re-rendering at animation frequency"
    requirement: "SIM-04"
    verification:
      - kind: unit
        ref: "src/playback/clock-step.test.ts — 13 tests (pure clock behavior: D-01/D-05/D-06/D-07/delta-clamp/sync-throttle, plus a headless end-to-end playback run and livePlayback/NaN store checks)"
        status: pass
      - kind: other
        ref: "npx tsc -b"
        status: pass
    human_judgment: true
    rationale: "Visual animation smoothness (no stepping/stutter), the marker riding the drawn line in step with the flange, and the Play/Pause icon transitions cannot be confirmed by this project's node-environment Vitest suite (no jsdom/RTL) — deferred to end-of-phase UAT per config.json human_verify_mode: end-of-phase, per the plan's own <verify><human-check> block."
  - id: D2
    description: "Dragging the scrub slider mid-playback immediately pauses and seeks in one gesture (D-04); store's playback contract (toggle, lockstep write, clamp, referential stability, no self-pause / Pitfall 4) covered by unit tests"
    requirement: "SIM-04"
    verification:
      - kind: unit
        ref: "src/store/cellStore.test.ts — 'useCellStore — playback' describe block, 10 tests"
        status: pass
      - kind: other
        ref: "npm test (full suite, 189 tests) and npm run build"
        status: pass
    human_judgment: true
    rationale: "The actual drag-to-pause gesture and visual seek behavior require in-browser confirmation — deferred to end-of-phase UAT per config.json human_verify_mode: end-of-phase, per the plan's own <verify><human-check> block."

duration: 13min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 1: Playback Engine (Tracer) Summary

**Fixed-10s Play/Pause playback of the compiled UR3e trajectory, driven by a dual-cadence Zustand store (60fps `livePlayback.fraction` vs. throttled `scrubFraction`) so the robot, scrub marker, and slider all stay in sync without per-frame React re-renders.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-15T13:37:23Z (phase plan base commit)
- **Completed:** 2026-08-15T13:49:50Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- A real Play/Pause DOM control drives the UR3e (and rail carriage) continuously along the whole compiled toolpath in a fixed 10 seconds, holding the final pose at the end (D-01/D-06)
- Solved the load-bearing dual-cadence problem: `livePlayback.fraction` (non-reactive, 60fps) drives the 3D scene while `scrubFraction` (reactive, throttled to ~12.5Hz) drives the slider — proven by a headless end-to-end test asserting `setScrubFraction` fires far fewer times than animation steps
- Pressing Play resumes from the current scrub position (D-05); pressing Play again after a completed run restarts from 0 rather than producing a zero-duration no-op (D-07, epsilon-checked, not exact equality)
- Dragging the scrub slider while playing pauses immediately and seeks (D-04), wired into the DOM handler specifically so the clock's own throttled sync (which shares `setScrubFraction`) can never pause itself (Pitfall 4)
- 23 new unit tests (13 in `clock-step.test.ts`, 10 in the extended `cellStore.test.ts`) — full suite now 189 tests, all green; `npx tsc -b` and `npm run build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "press Play and the robot runs the toolpath" — one path only** - `4904f8b` (feat)
2. **Task 2: Dragging the slider mid-run pauses and seeks (D-04), with the store's playback contract under test** - `c341e4b` (feat)

_Note: this is a `tdd="true"` tracer task; the clock-step test file and implementation were authored together in Task 1's commit rather than as separate RED/GREEN commits, given the task spans five tightly-coupled layers (pure clock, store, hook, UI control, two scene consumers) — every behavior in the plan's `<behavior>` block is covered and green in the single commit._

## Files Created/Modified
- `src/playback/clock-step.ts` - Pure playback clock core: `PLAYBACK_TOTAL_DURATION_SECONDS`, `MAX_FRAME_DELTA_S`, `RESUME_EPSILON`, `STORE_SYNC_INTERVAL_S`, `FractionMapping`, `UNIFORM_FRACTION_MAPPING`, `resumeElapsedSeconds`, `stepClock` — framework-free
- `src/playback/clock-step.test.ts` - 13 tests: pure clock behavior (D-01/D-05/D-06/D-07/delta clamp/sync throttle) + a headless end-to-end playback run
- `src/playback/usePlaybackClock.ts` - R3F hook: reads store via `getState()` inside `useFrame`, re-seeds elapsed time on every Play-press transition (not just on toolpath change), writes `livePlayback.fraction` every frame, syncs `scrubFraction` only on `shouldSync`, calls `pause()` on finish
- `src/ui/PlaybackControl.tsx` - Play/Pause button, `variant="secondary"` (accent reserved elsewhere), disabled with no trajectory
- `src/store/cellStore.ts` - Added `isPlaying`/`play()`/`pause()` (reactive) and `livePlayback: { fraction }` (non-reactive, referentially stable); `setScrubFraction` keeps both channels in lockstep without touching `isPlaying`; `selectSample` resets `isPlaying`/`livePlayback.fraction` on every branch
- `src/store/cellStore.test.ts` - New `useCellStore — playback` describe block: toggle, lockstep write, NaN/Infinity/range clamping, referential stability, Pitfall 4 guard
- `src/App.tsx` - Mounted `<PlaybackControl />` above `<ScrubControl />` in the existing bottom-left overlay
- `src/scene/CellScene.tsx` - New local `PlaybackClock` leaf (renders null, runs `usePlaybackClock`), mounted after `<ScrubMarker />`, before `<OrbitControls>`; composition-order header comment updated
- `src/scene/RobotPose.tsx` - Reads `livePlayback.fraction` instead of `scrubFraction` for the per-frame sample index
- `src/scene/ScrubMarker.tsx` - Same field swap as `RobotPose.tsx`, doc comment updated
- `src/ui/ScrubControl.tsx` - `onChange` calls `pause()` before `setScrubFraction` when `isPlaying` (D-04)

## Decisions Made
- Proceeded directly from Task 1 (tracer) into Task 2 without a mid-flight `checkpoint:human-verify` halt: `config.json` sets `workflow.human_verify_mode: end-of-phase`, and `checkpoints.md`'s default-mode note states new projects do NOT halt mid-flight at `checkpoint:human-verify` — the verification detail is already embedded in the tracer's own `<verify><human-check>` block (harvested by end-of-phase UAT), matching this plan's own `<verification>` section, which explicitly defers manual checks to end-of-phase.
- `usePlaybackClock` guards on `toolpath` being non-null in addition to `trajectory` (the plan's prose only lists `isPlaying`/`trajectory`/`samples.length`) — required for the mapping-record identity check's type safety; `toolpath` is always set alongside `trajectory` in `selectSample`, so this changes no runtime behavior.

## Deviations from Plan

None beyond the two notes above (documented as decisions, not corrective fixes) - the five-layer tracer and the D-04/test-coverage task were both implemented exactly as specified in 04-01-PLAN.md's `<action>` blocks.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `FractionMapping` seam (`elapsedToFraction`/`fractionToElapsed`) is ready for plan 04-02 to swap `UNIFORM_FRACTION_MAPPING` for a rapid/cut-weighted `buildDurationMapping(toolpath, trajectory)` with no other change to `usePlaybackClock.ts`.
- `livePlayback.fraction` is now the canonical 60fps read surface for any future per-frame consumer (Phase 5's Dashboard will read playback-derived values from this same channel, per 04-CONTEXT.md's deferred-ideas note).
- Manual/visual verification (smooth animation, marker tracking, drag-pause-seek, restart-after-completion) is deferred to end-of-phase UAT per this project's `human_verify_mode: end-of-phase` config — not yet performed for this plan.

## Self-Check: PASSED

All 11 claimed files (4 created, 7 modified) verified present on disk; commits `4904f8b` and `c341e4b` verified present in `git log --oneline --all`.

---
*Phase: 04-playback-engine*
*Completed: 2026-08-15*
