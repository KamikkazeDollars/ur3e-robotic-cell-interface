---
phase: quick
plan: 260817-iyv
subsystem: ui
tags: [react, zustand, tsx, vitest]

# Dependency graph
requires:
  - phase: quick-260817-gdv
    provides: "showsPlaybackControls predicate + showPlayback flag gating PlaybackControl/ScrubControl in App.tsx's bottom-left overlay"
provides:
  - "SampleSelect (g-code sample picker) gated behind the same showPlayback flag as PlaybackControl/ScrubControl — Run-tab-only, absent from the DOM elsewhere"
  - "Extended playback-chrome-visibility.test.ts structural guard: single guarded SampleSelect mount, and a single-source-of-truth check that App.tsx never inlines its own activeTab comparison"
affects: [ui-shell, run-tab, free-movement-tab]

actuals:
  tokens: 935
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Overlay children are gated individually behind the shared showPlayback flag rather than hoisting the gate onto the container — keeps two already-shipped literal-JSX assertions intact."

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/ui/shell/playback-chrome-visibility.test.ts

key-decisions:
  - "Reversed quick 260817-gdv's earlier decision to keep SampleSelect mounted on every tab; the picker is now treated as Run-tab chrome like the rest of the transport, per explicit user direction."
  - "Gated the child (SampleSelect), not the container — the container's shellContentLeft offset and flex layout stay byte-identical, matching the plan's discovery notes."
  - "playback-chrome-visibility.ts left untouched; showsPlaybackControls remains the single source of the Run-only rule with no second inline tab comparison in App.tsx."

patterns-established:
  - "Single-source visibility gate: any future overlay child that should be Run-only reuses the existing showPlayback const rather than deriving its own."

requirements-completed: [QUICK-260817-IYV, DASH-01]

coverage:
  - id: D1
    description: "SampleSelect mounts only on the Run tab (guarded by showPlayback), absent from the DOM on Free Movement, with PlaybackControl/ScrubControl gating and the shared predicate unchanged."
    requirement: "QUICK-260817-IYV"
    verification:
      - kind: unit
        ref: "src/ui/shell/playback-chrome-visibility.test.ts#App.tsx — playback transport + sample picker structural guards (quick 260817-gdv Task 3, quick 260817-iyv) > mounts SampleSelect exactly once, guarded by the visibility flag (quick 260817-iyv)"
        status: pass
      - kind: unit
        ref: "src/ui/shell/playback-chrome-visibility.test.ts#App.tsx — playback transport + sample picker structural guards (quick 260817-gdv Task 3, quick 260817-iyv) > has no inline tab comparison anywhere — every tab decision routes through showsPlaybackControls (quick 260817-iyv)"
        status: pass
      - kind: unit
        ref: "npm test (full suite) — 436/436 passed"
        status: pass
    human_judgment: true
    rationale: "This repo has no jsdom/Testing Library; presence/absence of the picker in the live DOM on Free Movement, and the visual continuity of the Run-tab overlay (dropdown, notes, Play button in original order), can only be confirmed by the plan's <human-check> browser walkthrough. The structural tests prove the source-level guard but not the rendered DOM."

duration: 12min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-iyv: Gate SampleSelect to the Run Tab Summary

**`SampleSelect` (the g-code sample picker) now mounts only on the Run tab, reusing the exact `showPlayback` flag that already gates `PlaybackControl`/`ScrubControl`, with an extended structural test locking the single-source guard in place.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-17T10:33Z
- **Completed:** 2026-08-17T10:45Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `SampleSelect` mount in `src/App.tsx` wrapped in `{showPlayback && <SampleSelect />}`, matching the existing `PlaybackControl`/`ScrubControl` short-circuit form exactly.
- The block comment above the bottom-left overlay container rewritten to describe the new Run-only rule for all three children, explain why quick 260817-iyv deliberately reverses gdv's earlier every-tab carve-out, and note that the picker's unit/skipped-command/frozen-trajectory notes withdraw with it.
- `playback-chrome-visibility.test.ts` extended with two new cases (mount-count + guarded-form for `SampleSelect`, and a single-source-guard assertion that no inline `activeTab ===` comparison or bare `'run'`/`"run"` literal exists anywhere in the comment-stripped `App.tsx` source), inside the same `describe` block (retitled to cover all three overlay children) as the four pre-existing quick-260817-gdv assertions, which all still pass unchanged.
- `src/ui/shell/playback-chrome-visibility.ts` was not opened or modified — `showsPlaybackControls` remains the single source of the Run-only rule.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 (RED):** Add failing structural guard for `SampleSelect` gating - `dd7375b` (test)
2. **Task 1 (GREEN):** Gate `SampleSelect` behind the existing `showPlayback` flag - `cbb0fa3` (feat)

**Plan metadata:** committed separately by the orchestrator (docs commit not made by this executor per constraints).

## Files Created/Modified
- `src/App.tsx` - `SampleSelect` mount now gated by `showPlayback`; overlay block comment rewritten to state the Run-only rule for all three children and explain the reversal of gdv's earlier reasoning.
- `src/ui/shell/playback-chrome-visibility.test.ts` - two new structural assertions (guarded single mount for `SampleSelect`; no inline tab comparison anywhere in `App.tsx`), `describe` title broadened to name the sample picker.

## Decisions Made
- Gated the `SampleSelect` child directly rather than the fixed overlay container, per the plan's discovery notes — avoids touching JSX two already-shipped assertions match literally, and an empty flex container with no children is an acceptable no-op render.
- Reused the `showPlayback` const verbatim; did not introduce a second call to `showsPlaybackControls` or any inline `activeTab` comparison, keeping the predicate as the single source of truth (enforced now by the new "single-source guard" test).

## Deviations from Plan

None - plan executed exactly as written. The RED test, GREEN implementation, comment rewrite, and comment-hygiene rule (block/whole-line comments only, no trailing inline comments, backticked bare identifier for the component name) all match the plan's `<action>` steps precisely.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All automated gates green: `npm test -- src/ui/shell/playback-chrome-visibility.test.ts` (13/13), `npx tsc -b` (clean), full `npm test` (436/436 passed), `npm run build` (clean production build; only a pre-existing >500kB chunk-size warning, out of scope for this task).
- **Human browser verification is still recommended but was not run by this executor** (autonomous plan, no `checkpoint:*` task type present — proceeded per the "do not pause" instruction). The plan's `<human-check>` walkthrough (Run-tab overlay unchanged, Free Movement overlay empty and absent from DevTools Elements, return-to-Run state preservation, mode-bar/panel-edge alignment across tabs) should be performed by a human before this quick task is considered fully closed end-to-end.
- No blockers for subsequent work.

---
*Phase: quick*
*Completed: 2026-08-17*

## Self-Check: PASSED
- FOUND: src/App.tsx
- FOUND: src/ui/shell/playback-chrome-visibility.test.ts
- FOUND: .planning/quick/260817-iyv-gate-the-sampleselect-sample-g-code-pick/260817-iyv-SUMMARY.md
- FOUND commit: dd7375b (test)
- FOUND commit: cbb0fa3 (feat)
