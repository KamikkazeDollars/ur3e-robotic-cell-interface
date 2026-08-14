---
phase: quick
plan: 260815-3cn
subsystem: ui-shell
tags: [theming, tab-shell, placeholder-panels, scaffold-only]
status: complete
dependency-graph:
  requires: []
  provides:
    - UI-SPEC dark Red + Dark Grey token layer (--ui-* roles)
    - tab-registry.ts (single source of truth for the 7-tab rail)
    - uiShellStore.ts (activeTab, cellMode)
    - TabRail / TabPanel / ModeBar shell chrome
    - 7 phase-labelled placeholder panels
  affects:
    - src/index.css
    - src/App.tsx
    - src/scene/CellScene.tsx
    - src/ui/SampleSelect.tsx
    - src/ui/ScrubControl.tsx
    - src/ui/SceneStatusOverlay.tsx
tech-stack:
  added: []
  patterns:
    - "--ui-* prefixed CSS custom properties instead of Tailwind's reserved --color-* namespace, to avoid @theme inline silently overriding role tokens"
    - "PanelShell/PanelSection/ReadoutRow/PhaseNote shared presentational primitives for every placeholder panel"
    - "Record<TabId, ComponentType> typed PANELS map so TypeScript fails the build on an orphan registry id"
key-files:
  created:
    - src/ui/tabs/tab-registry.ts
    - src/ui/tabs/tab-registry.test.ts
    - src/store/uiShellStore.ts
    - src/ui/shell/PlaceholderPanel.tsx
    - src/ui/shell/TabRail.tsx
    - src/ui/shell/TabPanel.tsx
    - src/ui/shell/ModeBar.tsx
    - src/ui/tabs/DashboardPanel.tsx
    - src/ui/tabs/OperationsPanel.tsx
    - src/ui/tabs/SetupPanel.tsx
    - src/ui/tabs/VisionPanel.tsx
    - src/ui/tabs/CalibratePanel.tsx
    - src/ui/tabs/IoPanel.tsx
    - src/ui/tabs/OptimizationPanel.tsx
  modified:
    - src/index.css
    - src/App.tsx
    - src/scene/CellScene.tsx
    - src/ui/SampleSelect.tsx
    - src/ui/ScrubControl.tsx
    - src/ui/SceneStatusOverlay.tsx
decisions:
  - "Renamed UI-SPEC role tokens from Tailwind-reserved --color-* to --ui-* to fix a real, pre-existing bug where @theme inline silently overrode --color-secondary/-accent/-destructive with shadcn's own variables"
  - ":root itself is now the dark theme (no .dark class is ever applied in this app) — the trailing .dark block is left as dead code, out of scope for this pass"
  - "PANELS map in TabPanel.tsx is a manually-enumerated object literal (not derived from TAB_DEFS via Object.fromEntries) so Record<TabId, ComponentType> actually gives TypeScript something to check against an orphan id"
  - "VisionPanel bakes in the 'estimated and simulated, never measured from hardware' disclosure now rather than retrofitting it later, per the roadmap's success criterion"
metrics:
  duration: ~20min
  completed: 2026-08-14
actuals:
  tokens: 11165
  tasks: 3
  commits: 4
---

# Quick Task 260815-3cn: Skip Phase 4 (Playback Engine) for now — UI shell scaffold + Red/Dark-Grey retheme Summary

Stood up the full 7-tab UI shell (rail + docked panel + Printing/Milling mode bar) as static, phase-labelled scaffolding, and re-themed the entire app from its original light palette to Red + Dark Grey — fixing a real token-collision bug in the process, before any of the 7 new panels could be written against the stale tokens.

## What Was Built

**Task 1 — Re-themed token layer.** `src/index.css`'s UI-SPEC role tokens were renamed from Tailwind's reserved `--color-*` namespace to a new `--ui-*` namespace (`--ui-dominant`, `--ui-surface`, `--ui-surface-raised`, `--ui-border`, `--ui-fg`, `--ui-fg-muted`, `--ui-accent`, `--ui-accent-fg`, `--ui-destructive`), plus `--shell-rail-width` / `--shell-panel-width` shell-geometry tokens and a `--font-mono` stack for future telemetry. This fixed a real bug: the later `@theme inline` block was silently re-declaring `--color-secondary`/`-accent`/`-destructive` as aliases of shadcn's own variables, so every existing text-color usage of `var(--color-secondary)` was actually resolving to shadcn's near-white `--secondary`, not the UI-SPEC grey the comments claimed — invisible only because both were light greys on the old light background. `:root` itself is now the dark theme (this app never applies a `.dark` class). `SampleSelect.tsx`, `ScrubControl.tsx`, and `SceneStatusOverlay.tsx` were updated to the new names, splitting surface-fill usages from text-color usages correctly. `CellScene.tsx`'s WebGL clear-color/floor-tone constants were updated to match, keeping the DOM/canvas tone-sync invariant intact.

**Task 2 — Tab registry, UI shell store, and rail/panel/mode-bar chrome.** `tab-registry.ts` is the single source of truth for the 7 tabs (dashboard/operations/setup/vision/calibrate/io/optimization), each declaring its id, label, owning phase (5-8), and blurb. `tab-registry.test.ts` proves it (5 assertions, TDD RED→GREEN — see below). `uiShellStore.ts` is a new Zustand store, deliberately separate from `cellStore`, holding only `activeTab` and `cellMode`. `TabRail.tsx`, `TabPanel.tsx`, and `ModeBar.tsx` render the rail, the docked panel router, and the Printing/Milling segmented control + mounted-tool chip, respectively — wired into `App.tsx`, with the pre-existing `SampleSelect`/`ScrubControl` overlay stack shifted right past the new rail+panel using the same shell-geometry tokens so the two layouts can never drift apart.

**Task 3 — Seven placeholder panels.** `DashboardPanel`, `OperationsPanel`, `SetupPanel`, `VisionPanel`, `CalibratePanel`, `IoPanel`, and `OptimizationPanel` were built purely from Task 2's `PanelShell`/`PanelSection`/`ReadoutRow`/`PhaseNote` primitives (added in `PlaceholderPanel.tsx`). Every interactive control is disabled; every panel ends with an "Arrives in Phase N" footer. `TabPanel.tsx`'s `PANELS` map was updated from Task 2's temporary stubs to these real components. `tab-registry.test.ts` gained a sixth assertion proving every registry id resolves to a defined panel and no orphan `PANELS` key exists.

## TDD Gate Compliance

Both Task 2 and Task 3 carried `tdd="true"`.

- **Task 2:** genuine RED→GREEN. `tab-registry.test.ts` was written against a deliberately empty `TAB_DEFS` stub, confirmed failing (3 of 5 assertions red), committed as `test(quick-260815-3cn): add failing test for tab registry` (2f45cbb), then the real 7-entry `TAB_DEFS` plus the full store/shell implementation was added and committed as `feat(quick-260815-3cn): tab registry, UI shell store, rail/panel/mode-bar chrome` (f55ebfd), confirmed all 5 assertions green.
- **Task 3:** Test 6 (added to the same `tab-registry.test.ts`) checks a structural invariant — every `TAB_DEFS` id has a defined `PANELS` entry and no orphan key exists — that Task 2's `Record<TabId, ComponentType>`-typed stub map already satisfied. Writing this assertion before implementing the real panels therefore could not produce a genuine failing (RED) state: the invariant it checks was already guaranteed by TypeScript's type system in the prior commit, not by the panel *content* this task adds. Investigated per the fail-fast rule and concluded no test-authoring error was present — this is intentionally a regression-guard assertion, not a feature-existence test. Proceeded directly to implementing the seven real panels and committed as a single `feat(quick-260815-3cn): fill the seven tab panels with placeholder content` (57019ed), re-verified Test 6 (and the rest of the suite) green afterward. Documented here as a deviation from the strict RED→GREEN sequence rather than silently skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `TabPanel.tsx`'s `PANELS` map required a manual object literal, not `Object.fromEntries`**
- **Found during:** Task 2, immediately after the first `npm run build`.
- **Issue:** The plan's action text implies `PANELS` is "a `PANELS` map from `TabId` to a component," typed `Record<TabId, ComponentType>` so an orphan id fails the build. A first pass built it via `Object.fromEntries(TAB_DEFS.map(...))`, which TypeScript widens to `Record<string, ComponentType>` — `tsc -b` rejected the cast to `Record<TabId, ComponentType>` as a type mismatch (TS2352).
- **Fix:** Rewrote `PANELS` as a manually-enumerated object literal (one entry per tab id, each a distinct component reference) so the `Record<TabId, ComponentType>` annotation is load-bearing rather than a lying cast.
- **Files modified:** `src/ui/shell/TabPanel.tsx`
- **Commit:** f55ebfd

**2. [Documented, not a code fix — see TDD Gate Compliance above] Task 3's Test 6 could not produce a genuine RED state**
- **Found during:** Task 3, before implementing the real panels.
- **Issue:** as described above.
- **Resolution:** proceeded to GREEN with a single commit and documented the deviation rather than forcing an artificial failing state.

No other deviations — Task 1 and the remainder of Task 2/3 executed as written.

## Known Stubs

None. All seven panels are the plan's intended final placeholder content for this pass — each is explicitly labelled "Arrives in Phase N" and none silently reads or computes simulation data (`OperationsPanel`'s skeleton rows and engagement legend, `VisionPanel`'s baseline bar, and `OptimizationPanel`'s feed-rate slider are static constants, not stand-ins for missing wiring). `requirements_status: scaffold-only` in the plan frontmatter already documents that none of DASH-01/02/03, SIM-03/06/07, TOOL-01/02, SETUP-01, VISION-01, CALIB-01/02, IO-01, OPT-01/02 are satisfied by this plan — their real delivery still belongs to Phases 5-8.

## Self-Check

- `src/ui/tabs/tab-registry.ts` — FOUND
- `src/ui/tabs/tab-registry.test.ts` — FOUND
- `src/store/uiShellStore.ts` — FOUND
- `src/ui/shell/TabRail.tsx` — FOUND
- `src/ui/shell/TabPanel.tsx` — FOUND
- `src/ui/shell/ModeBar.tsx` — FOUND
- `src/ui/shell/PlaceholderPanel.tsx` — FOUND
- `src/ui/tabs/DashboardPanel.tsx` — FOUND
- `src/ui/tabs/OperationsPanel.tsx` — FOUND
- `src/ui/tabs/SetupPanel.tsx` — FOUND
- `src/ui/tabs/VisionPanel.tsx` — FOUND
- `src/ui/tabs/CalibratePanel.tsx` — FOUND
- `src/ui/tabs/IoPanel.tsx` — FOUND
- `src/ui/tabs/OptimizationPanel.tsx` — FOUND
- Commit 3e33fec (Task 1) — FOUND in `git log`
- Commit 2f45cbb (Task 2 RED) — FOUND in `git log`
- Commit f55ebfd (Task 2 GREEN) — FOUND in `git log`
- Commit 57019ed (Task 3) — FOUND in `git log`

## Self-Check: PASSED

## Verification Status

- `npm run build` (`tsc -b && vite build`) — PASSED after every task, and again at the end.
- `npm test` — PASSED (132/132 tests, including the 6-assertion `tab-registry.test.ts`) after every task, and again at the end.
- `grep -rqE -- "--color-(dominant|secondary|accent|destructive)" src/ui src/scene` — CLEAN (no old-namespace tokens remain).
- `grep -rnE "^\s*import .*cellStore" src/ui/tabs` — CLEAN (no panel imports the simulation store).
- `npm run dev` visual pass — NOT independently verified in this session (no browser tooling available to this executor); the build/type-check and full Vitest suite are green, and every styling change reuses the same `--ui-*` / `--space-*` / `--text-*` custom-property vocabulary the pre-existing, visually-verified `SampleSelect`/`ScrubControl`/`ResetViewButton` components already use. Recommend a human visual pass before considering this plan's "Red + Dark Grey across DOM chrome and WebGL canvas alike" success criterion fully closed.

## Threat Flags

None. This plan's own STRIDE register (T-quick-01, T-quick-02) covers the surface added; no new network calls, file inputs, or dependencies were introduced beyond what the plan itself accounted for.
