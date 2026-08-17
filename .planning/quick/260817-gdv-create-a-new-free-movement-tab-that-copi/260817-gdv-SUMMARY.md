---
phase: quick
plan: 260817-gdv
subsystem: ui
tags: [react, zustand, tsx, tab-shell, playback]

# Dependency graph
requires:
  - phase: quick-260816-qym
    provides: JogControl typed field + slider, commitNumberFieldDraft stale-closure fix
  - phase: quick-260816-nup
    provides: single toggleable Dashboard tab, activeTab|null toggle model
provides:
  - "Two left-rail tabs: Run (renamed Dashboard) and Free Movement (independent copy)"
  - "Shared JogControl widget extracted to src/ui/JogControl.tsx, consumed by both panel copies"
  - "uiShellStore split: activeTab (non-nullable TabId) + panelOpen (boolean), replacing the nullable-activeTab toggle model"
  - "showsPlaybackControls/shouldPausePlayback pure predicates gating the toolpath transport to the Run tab"
  - "usePlaybackTabGuard hook that pauses cellStore playback when the user navigates away from Run mid-run"
affects: [dashboard, telemetry, free-movement-manual-jog]

# Actuals (#2632)
actuals:
  tokens: 15815
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared interactive widget extracted from a panel into its own file so two deliberately-independent panel copies consume the same fix surface without forking it"
    - "Tab identity (activeTab) split from panel-visibility (panelOpen) in a Zustand store, so a docked-panel toggle can't silently collapse 'which destination is current'"
    - "Playback-chrome visibility gated by ONE pure predicate (showsPlaybackControls) consumed by both the JSX gate and the pause-guard hook, so the two can never disagree with each other"
    - "Tab-change store guard (usePlaybackTabGuard) mirrors useModeJobSync's getState()-not-selector pattern to avoid a self-refiring effect loop"

key-files:
  created:
    - src/ui/JogControl.tsx
    - src/ui/tabs/RunPanel.tsx
    - src/ui/tabs/FreeMovementPanel.tsx
    - src/ui/manual-jog-input-hardening.test.ts
    - src/store/uiShellStore.test.ts
    - src/ui/shell/playback-chrome-visibility.ts
    - src/ui/shell/playback-chrome-visibility.test.ts
    - src/ui/usePlaybackTabGuard.ts
  modified:
    - src/ui/tabs/tab-registry.ts
    - src/ui/tabs/tab-registry.test.ts
    - src/store/uiShellStore.ts
    - src/ui/shell/TabRail.tsx
    - src/ui/shell/TabPanel.tsx
    - src/ui/shell/ModeBar.tsx
    - src/App.tsx

key-decisions:
  - "activeTab widened from 'dashboard' to a 'run'|'free-movement' union and made non-nullable; panelOpen is a new separate boolean carrying the old nullable-activeTab toggle semantics, so the app can still open on the full-width scene WITH the Play button (activeTab='run', panelOpen=false)"
  - "JogControl (the per-axis typed field + slider) is shared, not duplicated — it carries the documented stale-closure/commit-cadence fixes from quick 260816-qym and a forked copy would silently drift; the panel BODIES (RunPanel/FreeMovementPanel) are deliberate, fully independent copies per the request"
  - "showsPlaybackControls/shouldPausePlayback live in one pure, dependency-free module (playback-chrome-visibility.ts) consumed by both App.tsx's JSX gate and usePlaybackTabGuard's pause logic, so the mount gate and the pause gate can never disagree"
  - "usePlaybackClock runs inside CellScene (mounted on every tab), so unmounting the Play/scrub controls alone would leave a job animating with no reachable Pause — usePlaybackTabGuard actually stops the clock on tab change, reading cellStore via getState() (never a reactive selector) to avoid re-firing itself on its own pause() dispatch"
  - "SampleSelect stays mounted on every tab (chooses which job renders in the 3D scene, independent of which tab is showing); only PlaybackControl and ScrubControl are gated to Run"

requirements-completed: [QUICK-260817-GDV, DASH-01, DASH-03, SIM-04]

coverage:
  - id: D1
    description: "Left rail shows exactly two tabs, 'Run' and 'Free Movement' — no 'Dashboard' label or id anywhere"
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "src/ui/tabs/tab-registry.test.ts#tab-registry — TAB_DEFS (quick 260817-gdv, Task 2: Run + Free Movement)"
        status: pass
      - kind: automated_ui
        ref: "playwright screenshot gdv3-1-initial-load.png (Run highlighted, aria-current=page; Free Movement aria-current=null)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Free Movement panel renders the same sections/controls as Run, from its own file (FreeMovementPanel.tsx), editable without touching RunPanel.tsx"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "src/ui/manual-jog-input-hardening.test.ts#src/ui/tabs/FreeMovementPanel.tsx — manual-jog panel structural guards (quick 260817-gdv)"
        status: pass
      - kind: automated_ui
        ref: "playwright screenshot gdv3-3-free-movement-mid-play.png (Free Movement panel open, joint/rail/recovery sections all present)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Play/Pause button and scrub bar are mounted ONLY while Run is active — genuinely absent (not CSS-hidden) from the DOM on Free Movement"
    requirement: SIM-04
    verification:
      - kind: unit
        ref: "src/ui/shell/playback-chrome-visibility.test.ts#App.tsx — playback transport structural guards (quick 260817-gdv, Task 3)"
        status: pass
      - kind: automated_ui
        ref: "playwright DOM-count check on Free Movement: Play button count 0, Pause button count 0, ScrubControl count 0 (screenshot gdv3-3-free-movement-mid-play.png)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Leaving Run mid-playback pauses the clock; returning to Run restores the transport at the retained scrub position and resumes correctly"
    requirement: SIM-04
    verification:
      - kind: unit
        ref: "src/ui/shell/playback-chrome-visibility.test.ts#shouldPausePlayback (all 4 isPlaying/tab combinations)"
        status: pass
      - kind: automated_ui
        ref: "playwright walkthrough: switched to Free Movement while playing, returned to Run, Play button visible (paused) at ~41% scrub position, Play resumed to Pause state (screenshot gdv3-5-back-on-run.png); zero console errors"
        status: pass
    human_judgment: false
  - id: D5
    description: "App still opens on Run with the docked panel closed (full-width scene) and the Play button available — no default-state regression from the activeTab/panelOpen split"
    verification:
      - kind: unit
        ref: "src/store/uiShellStore.test.ts#useUiShellStore — initial state"
        status: pass
      - kind: automated_ui
        ref: "playwright screenshot gdv3-1-initial-load.png (full-width scene, Play button visible, panel closed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Manual jog from either panel commits through the same validated store path (setManualJointAngle/setManualRailPos/clearManualJog/homeManualPose only) — no second write path into manualJog"
    verification:
      - kind: unit
        ref: "src/ui/manual-jog-input-hardening.test.ts (looped allowlist + no-direct-write guards over both RunPanel.tsx and FreeMovementPanel.tsx)"
        status: pass
      - kind: automated_ui
        ref: "playwright: typed 10 into Free Movement's Base joint field, committed to 10.0; typed out-of-range 999, clamped to 360.0 (configured limit) — same commitNumberFieldDraft/JogControl path RunPanel uses"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min active execution (task commits span 13:22–13:31 UTC+3; one interactive checkpoint pause between Task 1 and Tasks 2–3 for tracer-gate confirmation, excluded from active time)
completed: 2026-08-17
status: complete
---

# Quick 260817-gdv: Free Movement Tab Summary

**Split the single Dashboard tab into "Run" and "Free Movement" (a real independent copy), extracted the shared JogControl widget, and gated the toolpath Play/scrub transport to Run-only with a tab-change pause guard.**

## Performance

- **Duration:** ~20 min active execution across 3 tasks (interactive tracer-gate checkpoint paused between Task 1 and Tasks 2–3, per protocol for a non-auto-mode run)
- **Started:** 2026-08-17T13:22:02+03:00 (Task 1 commit)
- **Completed:** 2026-08-17T13:31:31+03:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 16 (8 created, 8 modified; 2 renamed via `git mv`)

## Accomplishments

- Extracted the shared `JogControl` widget (typed field + slider, carrying the quick 260816-qym stale-closure/spinner fixes) into `src/ui/JogControl.tsx`, consumed by both panels
- Renamed `DashboardPanel.tsx` → `RunPanel.tsx` and created `FreeMovementPanel.tsx` as a fully independent copy — editing one cannot change the other
- Widened the tab registry to two real destinations (`run`, `free-movement`) and split `uiShellStore`'s `activeTab | null` toggle into a non-nullable `activeTab: TabId` + separate `panelOpen: boolean`, preserving the original "opens full-width with Play button" default
- Added `showsPlaybackControls`/`shouldPausePlayback` — one pure predicate module gating both the JSX mount of the Play/scrub transport AND the tab-change pause guard, so they can never disagree
- Added `usePlaybackTabGuard`, which actually pauses the running playback clock (which lives in `CellScene`, mounted on every tab) when the user navigates away from Run — unmounting the buttons alone would have left a job animating with no reachable Pause
- Verified end-to-end in a real browser (Playwright driver against `npm run dev`): DOM-absence of the transport on Free Movement, pause-on-leave, resume-from-retained-position, and mode-bar/overlay alignment across both tabs — zero console errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Share JogControl, rename Dashboard panel to Run, add Free Movement copy** — `e0e9218` (feat, tracer)
2. **Task 2: Two-tab registry — Run + Free Movement, tab identity split from panel-open** — `c5e5894` (feat)
3. **Task 3: Gate the Play button and scrub bar to the Run tab, and stop the clock on leaving it** — `b1a1ab9` (feat)

**Plan metadata:** `ba6f6f1` (docs: plan Free Movement tab + Run rename + Run-only playback transport)

_Note: Task 1 is `type="tracer"`. Per the execute-plan.md tracer-feedback-gate protocol, execution paused after Task 1's commit for a `checkpoint:human-verify` (auto mode was not active: `workflow._auto_chain_active` unset, `workflow.auto_advance` false). The coordinator confirmed the checkpoint (citing an equivalent verification already completed on Task 1's identical slice in a prior, now-discarded worktree run of this same plan) and directed continuation through Tasks 2–3, including Task 3's human-check browser walkthrough — performed live in this session via a Playwright driver against the running dev server, not skipped._

## Files Created/Modified

- `src/ui/JogControl.tsx` — shared typed-field+slider widget (moved verbatim out of the old DashboardPanel)
- `src/ui/tabs/RunPanel.tsx` — renamed from `DashboardPanel.tsx`, `PanelShell` title now "Run"
- `src/ui/tabs/FreeMovementPanel.tsx` — new, independent copy of RunPanel, `PanelShell` title "Free Movement"
- `src/ui/manual-jog-input-hardening.test.ts` — renamed from `dashboard-input-hardening.test.ts`; widget assertions target `JogControl.tsx`, panel assertions loop over both `RunPanel.tsx` and `FreeMovementPanel.tsx`
- `src/ui/tabs/tab-registry.ts` — `TabId` widened to `'run' | 'free-movement'`, `TAB_DEFS`/`DEFAULT_TAB_ID` updated
- `src/ui/tabs/tab-registry.test.ts` — updated for the 2-entry registry, added an old-dashboard-name regression guard
- `src/store/uiShellStore.ts` — `activeTab` non-nullable (`TabId`, default `'run'`), new `panelOpen: boolean` (default `false`); `setActiveTab` toggles `panelOpen` on same-tab click, switches+opens on a different tab
- `src/store/uiShellStore.test.ts` — new, covers initial state, same-tab toggle, cross-tab switch, registry-id containment, `cellMode` isolation
- `src/ui/shell/TabRail.tsx` — two icons (`LayoutDashboard`/`Move3d`), `aria-current`/`aria-expanded` semantics replacing the single-tab `aria-pressed`
- `src/ui/shell/TabPanel.tsx` — `PANELS` maps both ids to `RunPanel`/`FreeMovementPanel`, gated on `panelOpen` rather than a null check
- `src/ui/shell/ModeBar.tsx`, `src/App.tsx` — read `panelOpen` directly from the store instead of deriving it from a null check
- `src/ui/shell/playback-chrome-visibility.ts` — new, `showsPlaybackControls`/`shouldPausePlayback` pure predicates
- `src/ui/shell/playback-chrome-visibility.test.ts` — new, predicate coverage + `App.tsx` structural mount guards
- `src/ui/usePlaybackTabGuard.ts` — new, pauses `cellStore` playback on tab change away from Run
- `src/App.tsx` — mounts `usePlaybackTabGuard`, gates `PlaybackControl`/`ScrubControl` behind `showsPlaybackControls(activeTab)`, keeps `SampleSelect` mounted on every tab

## Decisions Made

See `key-decisions` in frontmatter — summarized: split tab identity from panel-open state to avoid losing the default "Play button on load" behavior; kept `JogControl` shared while deliberately forking the panel bodies; centralized the Run-only transport rule in one predicate module consumed by both the mount gate and the pause guard; kept `SampleSelect` un-gated since it selects scene content independent of tab.

## Deviations from Plan

None — plan executed exactly as written across all 3 tasks. The tracer-feedback-gate checkpoint pause after Task 1 was protocol-mandated (not a deviation), and the coordinator's resume instruction to continue through Tasks 2–3 (including the Task 3 human-check) was followed verbatim, including actually performing the browser walkthrough via a Playwright driver rather than skipping it.

## Issues Encountered

None. All automated verification (`npm test`, `npx tsc -b`, `npm run build`) passed on the first attempt for every task. The Task 3 human-check browser walkthrough was performed with a local Playwright driver (installed transiently into the scratchpad directory, not added to the project's `package.json`/lockfile) against `npm run dev` on `localhost:5173`, using an already-cached Chromium binary from a prior session — confirmed all expected behaviors (tab highlighting, DOM-absence of transport on Free Movement, pause-on-leave, resume-from-position, alignment across mode-bar switches) with zero console errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Free Movement now exists as a real, independently-editable panel (`FreeMovementPanel.tsx`) — ready to grow its own distinct manual-jog behavior in a future phase without touching `RunPanel.tsx`.
- The Run-only playback-transport gate (`showsPlaybackControls`) is a single reusable predicate — a future third tab defaults to hidden automatically, requiring no new call-site changes.
- No blockers. The one-task-wide "Dashboard"-label/"Run"-heading mismatch flagged mid-plan (between Task 1 and Task 2) no longer exists in the final state — the registry rename in Task 2 resolved it.

---
*Quick task: 260817-gdv*
*Completed: 2026-08-17*

## Self-Check: PASSED

- All 15 files created/renamed by this plan confirmed present via `git ls-files` (JogControl.tsx, RunPanel.tsx, FreeMovementPanel.tsx, manual-jog-input-hardening.test.ts, tab-registry.ts/.test.ts, uiShellStore.ts/.test.ts, TabRail.tsx, TabPanel.tsx, ModeBar.tsx, playback-chrome-visibility.ts/.test.ts, usePlaybackTabGuard.ts, App.tsx).
- Old files (`src/ui/tabs/DashboardPanel.tsx`, `src/ui/dashboard-input-hardening.test.ts`) confirmed absent from tracked files.
- All 3 task commits (`e0e9218`, `c5e5894`, `b1a1ab9`) confirmed present in `git log`.
- Final full verification re-run clean: `npm test` (35 files, 434 tests passed), `npx tsc -b` (no output), `npm run build` (succeeded).
