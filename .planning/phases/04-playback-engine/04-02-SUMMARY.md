---
phase: 04-playback-engine
plan: 02
subsystem: playback
tags: [trajectory-compile, playback, tdd, vitest]

# Dependency graph
requires:
  - phase: 04-playback-engine
    plan: 01
    provides: FractionMapping seam (clock-step.ts), usePlaybackClock's toolpath-identity mapping-rebuild guard, UNIFORM_FRACTION_MAPPING placeholder
provides:
  - CompiledTrajectory.travelLength / CompiledTrajectory.toolpathLength (additive contract fields, Phase 5/6 can read the travel/toolpath boundary without re-deriving it)
  - src/playback/duration-mapping.ts — buildDurationMapping(toolpath, trajectory), the D-02 move-type-weighted FractionMapping implementation
affects: [05-telemetry-dashboard, 06-operation-polish]

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared, parameterized bracketing-pair search (keyOf/readOf) drives both directions of a monotone breakpoint-table FractionMapping, rather than two near-identical search functions"
    - "Contract fields added to a cross-phase interface (CompiledTrajectory) are populated by passing through existing local bindings at every return site, never recomputed at the new call site"

key-files:
  created:
    - src/playback/duration-mapping.ts
    - src/playback/duration-mapping.test.ts
  modified:
    - src/trajectory/compile.ts
    - src/trajectory/compile.test.ts
    - src/playback/usePlaybackClock.ts

key-decisions:
  - "Loosened the 'sum equals total arc length' compile.test.ts assertion's tolerance for the travel-phase measurement from 1e-6 to an explicit 5mm bound (documented in the test), because chord-summing the compiled travel-phase samples under-measures the true arc length by a small, bounded amount at the travel path's two interior corners (lift waypoint, above-first-point waypoint) — every other adjacent sample pair lies on a straight sub-segment where chord length equals arc length exactly, so this is real discretization error, not a bug. The toolpathLength assertion stayed at its original 1e-9 tolerance since it's compared against the same buildArcLengthTable call the compiler itself uses, with no chord-sum approximation involved."

requirements-completed: [SIM-04]

coverage:
  - id: D1
    description: "CompiledTrajectory exposes travelLength/toolpathLength, populated at both return sites, with the travel/toolpath boundary fraction asserted against the compiler's own scrubFraction arithmetic"
    requirement: "SIM-04"
    verification:
      - kind: unit
        ref: "src/trajectory/compile.test.ts — 'compileTrajectory — travel/toolpath length split' describe block, 4 new tests"
        status: pass
      - kind: other
        ref: "npx tsc -b, npm test (207 tests), npm run build"
        status: pass
    human_judgment: false
    rationale: "Fully covered by automated unit tests against the compiler's own arithmetic; no visual/behavioral component to this task."
  - id: D2
    description: "D-02 move-type-weighted playback timing: rapids consume strictly less playback time per unit arc length than cuts, inside the unchanged fixed 10s total duration"
    requirement: "SIM-04"
    verification:
      - kind: unit
        ref: "src/playback/duration-mapping.test.ts — 14 tests: weighting direction, D-02 timing comparison, boundary exactness (0/1), monotonic sweep, round-trip within 1e-9, four degenerate-input cases"
        status: pass
      - kind: other
        ref: "npx tsc -b, npm test (207 tests), npm run build"
        status: pass
    human_judgment: true
    rationale: "The plan's own <verify><human-check> defers visual confirmation (robot visibly traversing rapids faster than cuts, total run time unchanged, no pause/jump at the travel/toolpath handoff) to end-of-phase UAT, per config.json's human_verify_mode: end-of-phase."

duration: 45min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 2: Trajectory Duration Weighting (D-02) Summary

**`CompiledTrajectory` now exposes `travelLength`/`toolpathLength`, and a new pure `buildDurationMapping` module weights the playback clock's time-to-position mapping by move type — rapids traverse in roughly a quarter of the time per unit distance that cuts do, inside the same fixed 10-second total duration plan 04-01 established.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-15 (session resumed mid-task after an API session-limit interruption; re-oriented via `git log`/`git status` against the plan before continuing — no work was redone)
- **Completed:** 2026-08-15
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `CompiledTrajectory` carries `travelLength` and `toolpathLength` (scene metres), populated at both the degenerate early return (0/0) and the main return (existing local bindings, no recomputation) — a purely additive contract change with no effect on any solved pose
- New `src/playback/duration-mapping.ts`: pure, framework-free `buildDurationMapping(toolpath, trajectory)` implementing the `FractionMapping` seam from plan 04-01, with `RAPID_SPEED_WEIGHT = 4` / `CUT_SPEED_WEIGHT = 1` traverse-speed constants (playback time = arc length / weight, so the larger weight produces less time per unit distance — documented explicitly against the inverted reading, which would type-check and still look plausible)
- The mapping reads the travel/toolpath boundary from Task 1's `travelLength`/`toolpathLength` fields (`boundaryFraction = travelLength / (travelLength + toolpathLength)`) rather than re-deriving it by matching point coordinates; the travel phase itself is weighted at rapid speed throughout (a documented deliberate assumption)
- One shared, parameterized bracketing-pair helper (`resolveBreakpoint`, keyed by `keyOf`/`readOf`) drives both `elapsedToFraction` and `fractionToElapsed` against the same monotone breakpoint table, rather than two near-identical search functions
- Every divisor in the chain (boundary denominator, running toolpath real-length total, grand total weighted time, bracketing span) is guarded with a `1e-12` floor; both directions coerce a non-finite input to 0 before any arithmetic; a toolpath with no real movement falls back to `UNIFORM_FRACTION_MAPPING`
- Wired into `usePlaybackClock.ts`'s existing toolpath-identity mapping-rebuild guard — `buildDurationMapping(toolpath, trajectory)` replaces `UNIFORM_FRACTION_MAPPING` with no other change to the hook (the table is still built once per sample selection, never per frame)
- 18 new unit tests total (4 in the extended `compile.test.ts`, 14 in the new `duration-mapping.test.ts`) — full suite now 207 tests, all green; `npx tsc -b` and `npm run build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Publish the travel/toolpath arc-length split on the compiled trajectory** - `0ca4391` (feat)
2. **Task 2 (TDD, RED): Failing tests for D-02 weighted duration mapping** - `1f66c46` (test)
3. **Task 2 (TDD, GREEN): D-02 rapids play faster than cuts inside the fixed duration** - `7465f13` (feat)

_Task 2 carries `tdd="true"`: the RED commit (`1f66c46`) added `duration-mapping.test.ts` against a not-yet-existing module and was confirmed failing (`Cannot find module './duration-mapping'`) before the GREEN commit (`7465f13`) added the implementation and the wiring into `usePlaybackClock.ts` together, since the wiring is a single one-line assignment inside an already-tested hook with no independent behavior to RED/GREEN separately. No REFACTOR commit was needed — the implementation was clean on the first GREEN pass._

## Files Created/Modified
- `src/trajectory/compile.ts` - Added `travelLength: number` and `toolpathLength: number` to the exported `CompiledTrajectory` interface; populated at the degenerate early return (both 0) and the main return (existing local `travelLength`/`toolpathLength` bindings passed through unchanged)
- `src/trajectory/compile.test.ts` - New `describe('compileTrajectory — travel/toolpath length split', ...)` block: both fields finite and >0; their sum matches the compiler's own arc-length arithmetic (toolpath portion exact via `buildArcLengthTable`, travel portion cross-checked via compiled-sample chord-summing within a documented 5mm discretization bound); the load-bearing boundary-fraction assertion (`scrubFraction === travelLength / (travelLength + toolpathLength)` within 1e-9); the degenerate branch returns 0/0 with the `samples: []` / `status: 'ready'` contract unchanged
- `src/playback/duration-mapping.ts` - New pure module: `RAPID_SPEED_WEIGHT`, `CUT_SPEED_WEIGHT`, `buildDurationMapping`, the shared `resolveBreakpoint` bracketing helper
- `src/playback/duration-mapping.test.ts` - 14 hand-computed tests against two synthetic fixtures (Fixture A: no travel, equal-length rapid+cut; Fixture B: travel phase weighted at rapid speed) covering weighting direction, the D-02 timing comparison, boundary exactness, monotonic sweep, round-trip, and four degenerate-input cases
- `src/playback/usePlaybackClock.ts` - Swapped `UNIFORM_FRACTION_MAPPING` for `buildDurationMapping(toolpath, trajectory)` inside the existing mapping-rebuild guard; updated the `MappingRecord` doc comment; no other change

## Decisions Made
- Loosened the compile.test.ts "sum equals total arc length" assertion's travel-phase tolerance from an initial 1e-6 to an explicit, documented 5mm bound, after the tighter tolerance failed on real chord-summing discretization error at the travel path's two interior corners (the lift and above-first-point waypoints, where the piecewise-linear travel path bends and adjacent-sample chord length is legitimately shorter than the true bent arc length). The toolpathLength half of the same assertion stayed at 1e-9 since it compares against the exact same `buildArcLengthTable` computation the compiler itself performs — no approximation involved there.

## Deviations from Plan

None — both tasks implemented exactly as specified in 04-02-PLAN.md's `<action>` blocks. The test-tolerance adjustment above is a test-construction refinement (Rule 1 — the initial tolerance was too tight for an intentionally approximate chord-sum cross-check, not a bug in the implementation being tested), not a deviation from the plan's own `<action>` or `<acceptance_criteria>` text.

## Issues Encountered

Work was interrupted mid-task by an API session-limit error partway through Task 2 exploration (before any code had been written for Task 2). On resume, `git log`/`git status` confirmed Task 1 was already committed (`0ca4391`) and nothing else was in progress; Task 2 was implemented fresh from that point with no rework.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-03 (`sample-lookup.ts` / `sampleAtFraction`) can proceed independently — this plan touched only the duration/timing axis (`FractionMapping`), not the sample-lookup-by-fraction axis plan 04-03 owns.
- `CompiledTrajectory.travelLength`/`toolpathLength` are now available for any future consumer (e.g. Phase 5's Dashboard, Phase 6's operations tree) needing the travel/toolpath boundary without re-deriving it.
- Manual/visual verification (rapids visibly traversing faster than cuts, total run time still ~10s, no pause/jump at the travel/toolpath handoff) is deferred to end-of-phase UAT per this project's `human_verify_mode: end-of-phase` config — not yet performed for this plan.

## Self-Check: PASSED

All 5 claimed files (2 created, 3 modified) verified present on disk; commits `0ca4391`, `1f66c46`, `7465f13` verified present in `git log --oneline`.

---
*Phase: 04-playback-engine*
*Completed: 2026-08-15*
