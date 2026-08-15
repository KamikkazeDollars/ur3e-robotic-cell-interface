---
phase: 04-playback-engine
plan: 03
subsystem: playback
tags: [trajectory, react-three-fiber, useFrame, vitest, tdd]

# Dependency graph
requires:
  - phase: 04-playback-engine
    plan: "04-01"
    provides: cellStore.livePlayback.fraction (60fps non-reactive playback/scrub channel), RobotPose.tsx/ScrubMarker.tsx's getState()-inside-useFrame pattern
provides:
  - src/trajectory/sample-lookup.ts — sampleAtFraction(trajectory, fraction), the single shared interpolated-pose lookup over a CompiledTrajectory's samples
  - RobotPose.tsx and ScrubMarker.tsx both driven by that one shared lookup instead of two independent nearest-index derivations
affects: [04-04, 05-telemetry-dashboard, 06-operation-polish]

# Actuals (#2632)
actuals:
  tokens: 5100
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared bracketing-pair interpolated lookup (sampleAtFraction) over a monotonically non-decreasing scrubFraction array, located via binary search, with a load-bearing ratio clamp into [0,1] so a truncated (frozen-at-unreachable) trajectory returns its last solved sample rather than an extrapolated pose"
    - "Joint-space blending between two IMMEDIATE array-neighbour samples only (never across arbitrary waypoints) — safe here because compiled samples are one IK solve every 2mm and continuity-selected, verified by a real-fixture test asserting every adjacent joint delta stays below 0.5 rad"

key-files:
  created:
    - src/trajectory/sample-lookup.ts
    - src/trajectory/sample-lookup.test.ts
  modified:
    - src/scene/RobotPose.tsx
    - src/scene/ScrubMarker.tsx

key-decisions:
  - "Implemented findUpperIndex as a true O(log n) binary search (lo/hi narrowing to the first index >= target) rather than arc-length.ts's linear incrementing walk, per the plan's explicit 'binary search' wording in the <action> block — arc-length.ts's walk was left as-is since this plan does not touch it."
  - "Reversed the Phase 3 decision (recorded in STATE.md's decision log) that ScrubMarker.tsx should duplicate RobotPose.tsx's index derivation verbatim so the two components could never silently drift apart. That guarantee is now enforced by both components calling the SAME sampleAtFraction export on the SAME livePlayback.fraction field — a single shared function is a stronger guarantee than two hand-kept-in-sync copies, per the plan's own objective section."

patterns-established:
  - "sampleAtFraction is now the canonical position-lookup surface for any future per-frame scene consumer reading playback/scrub position (e.g. a Phase 5 Dashboard telemetry readout keyed off the same trajectory)."

requirements-completed: [SIM-04]

coverage:
  - id: T1
    description: "Shared, unit-tested interpolated lookup over CompiledTrajectory.samples — exact endpoints, span-weighted interior blends, degenerate-fixture handling, non-finite/out-of-range fraction coercion, and a real-compiled-trajectory density-premise check"
    requirement: "SIM-04"
    verification:
      - kind: unit
        ref: "src/trajectory/sample-lookup.test.ts — 16 tests (two-sample endpoints/midpoint, non-uniform span weighting, exact interior match, truncated-trajectory clamp, empty/single-sample degenerate fixtures, NaN/Infinity/-1/2 fraction coercion, real square-toolpath endpoint-reproduction and sub-0.5rad adjacent-joint-delta density check)"
        status: pass
      - kind: other
        ref: "npx tsc -b"
        status: pass
    human_judgment: false
    rationale: "Fully covered by deterministic unit tests against hand-computed fixture values and a real compiled trajectory — no visual/UI surface in this task."
  - id: T2
    description: "RobotPose.tsx and ScrubMarker.tsx both refactored onto sampleAtFraction, replacing their independent nearest-index derivations, so the posed arm and the scrub marker cannot report different points on the path"
    requirement: "SIM-04"
    verification:
      - kind: unit
        ref: "npm test — full suite, 205 tests (up from 189 pre-plan), all green"
        status: pass
      - kind: other
        ref: "npx tsc -b and npm run build both clean; grep checks confirm sampleAtFraction/livePlayback.fraction present and rawIndex absent in both files, toUrdfJointAngles and scrubMarkerRadius both survive"
        status: pass
    human_judgment: true
    rationale: "Visual smoothness of the blended motion (no per-sample ticking during playback, marker-on-path/flange-on-marker agreement while scrubbing) requires in-browser confirmation — deferred to end-of-phase UAT per config.json human_verify_mode: end-of-phase, matching this plan's own <verification> section wording."

duration: unmeasured (session interrupted by an API session-limit error mid-execution; work resumed from committed/uncommitted state with no loss)
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 3: Shared Interpolated Sample Lookup Summary

**A pure, unit-tested `sampleAtFraction` lookup that blends between the two immediately-adjacent compiled trajectory samples bracketing a fraction, now the single position source both `RobotPose.tsx` and `ScrubMarker.tsx` read — replacing two independent nearest-index derivations that could tick visibly under a continuous playback clock.**

## Performance

- **Duration:** Not cleanly measurable — this run was interrupted mid-task by an API session-limit error between confirming the RED test and writing the implementation, then resumed in a fresh session. No work was lost; the RED test file was already on disk when the session resumed. Commit-to-commit interval for the two task commits was ~2.5 minutes.
- **Completed:** 2026-08-15
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `src/trajectory/sample-lookup.ts` exports `sampleAtFraction(trajectory, fraction): InterpolatedSample | null` — a pure, framework-free binary-search lookup over `CompiledTrajectory.samples`. Fraction 0 and 1 return the first/last sample's `point`/`joints` exactly (element-wise, never a near-value); interior fractions return the bracketing pair's span-weighted blend; a truncated (`frozen-at-unreachable`) trajectory returns its last solved sample rather than an extrapolated pose, via a load-bearing ratio clamp into `[0, 1]`
- `InterpolatedSample` deliberately omits `railPos`, `tcpPosition`, and `singularityFlags` — those are per-sample observations of a solved, FK-verified pose, and a blended value for them would be a fabricated reading
- 16 new unit tests: hand-computed two-sample and non-uniformly-spaced fixtures (exact endpoints, midpoint, span-weighted interior blend, exact-interior-match), a truncated-trajectory fixture (no extrapolation), empty/single-sample degenerate fixtures, `NaN`/`Infinity`/`-1`/`2` fraction coercion, and a real compiled square-toolpath fixture proving both endpoint reproduction (within 1e-9) and the sub-0.5rad adjacent-joint-delta density premise the joint-space blend relies on
- `RobotPose.tsx` and `ScrubMarker.tsx` both replaced their private `Math.round`-based nearest-sample-index derivation with one `sampleAtFraction(trajectory, livePlayback.fraction)` call — the arm and the teal scrub marker are now provably unable to disagree about position, by construction rather than by two hand-kept-in-sync copies
- `toUrdfJointAngles`'s URDF frame correction (`RobotPose.tsx`) and the bounds-derived `scrubMarkerRadius` sizing (`ScrubMarker.tsx`) both survive the refactor unchanged
- Full suite (`npm test`) grew from 189 to 205 tests, all green; `npx tsc -b` and `npm run build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: A shared interpolated lookup over the compiled trajectory** - `b5a491a` (feat) — TDD: test file (`sample-lookup.test.ts`) written and confirmed RED before `sample-lookup.ts` existed, then implementation written and confirmed GREEN (16/16 passing) before commit; both files committed together per this project's established tracer-commit convention for tightly-coupled TDD pairs (see 04-01-SUMMARY.md's precedent)
2. **Task 2: The arm and the marker glide, both driven by the one shared lookup** - `b003801` (feat)

## Files Created/Modified

- `src/trajectory/sample-lookup.ts` - `InterpolatedSample` type and `sampleAtFraction` — pure, framework-free binary-search interpolated lookup
- `src/trajectory/sample-lookup.test.ts` - 16 tests covering every `<behavior>` item in 04-03-PLAN.md
- `src/scene/RobotPose.tsx` - Replaced local `rawIndex`/`index` derivation with `sampleAtFraction(trajectory, livePlayback.fraction)`; doc comment updated to describe blended (not snapped) pose derivation and why it matters under a continuous clock
- `src/scene/ScrubMarker.tsx` - Same replacement; doc comment's "can never disagree" paragraph rewritten to name the Phase 3 duplication reversal explicitly

## Decisions Made

- Implemented the bracketing-pair search as a true O(log n) binary search (`lo`/`hi` narrowing to the first index whose `scrubFraction` is `>=` the target), matching the plan's explicit "binary search" wording, rather than reusing `arc-length.ts`'s linear incrementing-`hi` walk (which that file itself also calls a "binary search" in its own doc comment but implements as a linear scan). `arc-length.ts` was left untouched — this plan does not modify it.
- Recorded the Phase 3 decision reversal explicitly, per the plan's objective: `ScrubMarker.tsx` no longer duplicates `RobotPose.tsx`'s index derivation verbatim. The prior decision (STATE.md: "ScrubMarker.tsx duplicates RobotPose.tsx's sample-index derivation verbatim rather than sharing a helper, so the marker and the robot pose can never silently drift apart") is superseded — a single shared `sampleAtFraction` call on the same store field enforces that same invariant more strongly than two independently-maintained copies that merely happened to stay in sync.

## Deviations from Plan

None — both tasks implemented exactly as specified in 04-03-PLAN.md's `<action>` blocks. The only interruption was an external API session-limit error mid-session (occurring after Task 1's RED test was written and confirmed failing, before the implementation was written); execution resumed in a fresh session with both in-progress files intact on disk and no rework needed.

## Issues Encountered

None beyond the session interruption noted above, which caused no data loss and required no corrective action beyond re-verifying branch/base identity before continuing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `sampleAtFraction` is now the canonical position-lookup surface for any future per-frame scene consumer reading playback/scrub position — a Phase 5 Dashboard telemetry readout keyed off the same `trajectory`/`livePlayback.fraction` pair can reuse it directly rather than re-deriving a sample index.
- Manual/visual verification (smooth continuous motion during playback with no per-sample ticking; marker-on-path and flange-on-marker agreement while scrubbing, unchanged from Phase 3) is deferred to end-of-phase UAT per this project's `human_verify_mode: end-of-phase` config, matching this plan's own `<verification>` section.

## Self-Check: PASSED

All 4 claimed files (2 created, 2 modified) verified present on disk; commits `b5a491a` and `b003801` verified present in `git log --oneline --all`.

---
*Phase: 04-playback-engine*
*Completed: 2026-08-15*
