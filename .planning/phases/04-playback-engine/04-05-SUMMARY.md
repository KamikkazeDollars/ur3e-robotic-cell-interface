---
phase: 04-playback-engine
plan: 05
subsystem: ui
tags: [zustand, react, gcode, cell-mode, gap-closure]

# Dependency graph
requires:
  - phase: 03-kinematics-toolpath-scrub
    provides: cellStore.selectSample with request-id staleness guard and full scrub/playback reset on every branch
provides:
  - "src/cell-mode.ts: dependency-free CellMode union both UI chrome and domain data import"
  - "src/gcode/samples.ts: mode-tagged GcodeSample plus samplesForMode/sampleMatchesMode/firstSampleIdForMode pure helpers"
  - "SampleSelect.tsx dropdown filtered to the active cell mode"
  - "useCellModeSampleSync hook keeping the loaded sample and active mode in step"
affects: [04-06, 05-telemetry]

# Actuals (#2632)
actuals:
  tokens: 3483
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-free type modules at src root (src/cell-mode.ts) for cross-layer types neither layer should import the other's home module for"
    - "Non-reactive cross-store sync hook (useCellStore.getState() inside a useEffect keyed on the OTHER store's reactive field) mounted once at the shell level, rather than orchestrating one store's action from inside another store's setter"

key-files:
  created:
    - src/cell-mode.ts
    - src/gcode/samples.test.ts
    - src/ui/useCellModeSampleSync.ts
  modified:
    - src/gcode/samples.ts
    - src/store/uiShellStore.ts
    - src/ui/SampleSelect.tsx
    - src/App.tsx

key-decisions:
  - "Relocated CellMode's declaration from uiShellStore.ts to a new dependency-free src/cell-mode.ts, re-exported from uiShellStore.ts so ModeBar.tsx's existing import form keeps compiling untouched"
  - "useCellModeSampleSync reads selectedSampleId/selectSample via useCellStore.getState() (non-reactive) inside an effect keyed only on cellMode, so the hook never re-fires on its own selectSample dispatch or on an unrelated selection change"

patterns-established:
  - "Pattern: shared cross-layer types live in dependency-free modules at src root, never inside the store or feature folder that happens to declare them first"

requirements-completed: [SIM-04]

coverage:
  - id: D1
    description: "Every bundled sample carries a mode tag; samplesForMode/sampleMatchesMode/firstSampleIdForMode partition and resolve the list correctly, including a defensive false/null on an unresolved id"
    requirement: SIM-04
    verification:
      - kind: unit
        ref: "src/gcode/samples.test.ts (9 tests: tagging, filePath distinctness, samplesForMode partition/disjointness, sampleMatchesMode true/false/unknown-id, firstSampleIdForMode per mode)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sample dropdown offers only the active cell mode's samples, and switching mode with a mismatched sample loaded re-selects the new mode's first sample while switching mode with nothing selected changes nothing"
    requirement: SIM-04
    verification: []
    human_judgment: true
    rationale: "Plan explicitly defers this to a blocking human-verification checkpoint in plan 04-06 (see 04-05-PLAN.md <verification> item 4); no automated UI/interaction test exists for this deliverable in this plan"

# Metrics
duration: 17min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 5: Mode-Filtered Sample Picker Summary

**Bundled g-code samples now carry a `CellMode` tag; the picker filters its dropdown to the active mode and a mount-level sync hook re-selects a matching sample the instant the mode changes out from under a loaded selection.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-15T15:20:28Z
- **Completed:** 2026-08-15T15:37:30Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Added `src/cell-mode.ts`, a dependency-free `CellMode` module both `src/store` and `src/gcode` can import without inverting the project's layering
- Tagged both bundled samples (`print` → printing, `mill` → milling) and added `samplesForMode`, `sampleMatchesMode`, `firstSampleIdForMode` pure filtering helpers, covered by a 9-test Vitest suite (`src/gcode/samples.test.ts`)
- `SampleSelect.tsx`'s dropdown now renders `samplesForMode(cellMode)` instead of the full `GCODE_SAMPLES` list
- Added `useCellModeSampleSync`, mounted once in `App.tsx`, which re-selects the new mode's first sample whenever a mode change leaves the loaded sample mismatched — inert on initial mount and on no-op mode changes

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED/GREEN cycle since it carried `tdd="true"`):

1. **Task 1: Tag the bundled samples with a cell mode and expose pure filters**
   - `0f92a8e` (test) — RED: failing `samples.test.ts` + dependency-free `cell-mode.ts`
   - `c0f112b` (feat) — GREEN: `mode` field on `GcodeSample`, three pure helpers, `uiShellStore` re-export
2. **Task 2: Filter the picker by the active mode and keep the selection in step with it** - `01607eb` (feat)

**Plan metadata:** commit pending (this SUMMARY + REQUIREMENTS.md)

## Files Created/Modified
- `src/cell-mode.ts` - Dependency-free `CellMode` union, the shared type both UI chrome and domain data import
- `src/gcode/samples.ts` - Added `mode: CellMode` to `GcodeSample`, tagged both entries, added `samplesForMode`/`sampleMatchesMode`/`firstSampleIdForMode`
- `src/gcode/samples.test.ts` - 9-test Nyquist gate for mode tagging, partitioning, and defensive unknown-id handling
- `src/store/uiShellStore.ts` - `CellMode`'s declaration relocated to `src/cell-mode.ts`; re-exported so `ModeBar.tsx`'s existing import keeps compiling
- `src/ui/SampleSelect.tsx` - Subscribes to `cellMode`, renders options from `samplesForMode(cellMode)` instead of the full list
- `src/ui/useCellModeSampleSync.ts` - Mount-level hook re-selecting a matching sample on a real mode change
- `src/App.tsx` - Mounts `useCellModeSampleSync()` once at the top of the component body

## Decisions Made
- Relocated `CellMode` out of `uiShellStore.ts` into a new root-level `src/cell-mode.ts` rather than declaring a second, duplicate union in `src/gcode/samples.ts` — a dependency-free module lets both the store and domain data reach the same type without `src/gcode` importing `src/store`, preserving the project's layering (and setting up plan 04-06's rail-geometry consumer).
- The mode/selection crossing lives in a dedicated hook (`useCellModeSampleSync`) mounted once at the App shell, not inside `uiShellStore`'s `setCellMode` — `uiShellStore` deliberately holds UI chrome only and does not orchestrate simulation loading (per that store's own header comment); keeping the crossing at the shell mount point makes it a single, easy-to-find spot rather than hidden inside a UI-chrome setter.
- The hook reads `selectedSampleId`/`selectSample` via `useCellStore.getState()` (non-reactive) rather than a reactive selector, and keys its effect only on `cellMode` — this is required for T-04-17 (the effect must not re-fire on its own `selectSample` dispatch or on any unrelated selection change).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**`npm run lint` fails: no `eslint.config.js` found.** Pre-existing, unrelated to this plan's changes — confirmed via `git log` that no `eslint.config.js`/`.mjs`/`.cjs` has ever existed in this repo. Already tracked in `.planning/STATE.md`'s Blockers/Concerns section from Phase 2's code review ("non-functional ESLint setup ... Non-blocking; worth fixing early in Phase 2 before more scene code accumulates"). Out of scope for this gap-closure plan per the scope-boundary rule (only fix issues directly caused by this task's own file changes); `npm test` (235/235) and `npm run build` (`tsc -b && vite build`) are both green, satisfying two of the three `<verification>` items. This is a carried-forward pre-existing gap, not a new regression from this plan.

## Next Phase Readiness
- `src/cell-mode.ts` is now in place for plan 04-06's rail-geometry work, which the plan's objective states this lays groundwork for.
- Visual confirmation of the filtered picker and mode-switch behavior (D2 above) is deferred to plan 04-06's blocking human-verification checkpoint, per this plan's own `<verification>` item 4 — not a gap introduced here.
- The pre-existing missing `eslint.config.js` remains open; still non-blocking per the Phase 2 review's own assessment.

---
*Phase: 04-playback-engine*
*Completed: 2026-08-15*
