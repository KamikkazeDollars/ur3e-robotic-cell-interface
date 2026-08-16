---
phase: quick
plan: 260816-m6d
subsystem: ui-dashboard
tags: [manual-control, joint-clamp, rail-jog, tab-pruning, gcode-upload, playback-ui]
status: complete
dependency-graph:
  requires:
    - tab-registry.ts / uiShellStore.ts (quick 260815-3cn UI shell scaffold)
    - UR3E_JOINT_LIMITS, RAIL_TRAVEL / clampRailPosition (existing kinematics/rail constants)
  provides:
    - src/kinematics/joint-clamp.ts (clampJointAngle / clampJointAngles)
    - src/ui/manual-jog.ts (degree/mm parsing + clamped conversion helpers)
    - cellStore.manualJog (RobotPose useFrame override for typed poses)
    - Pruned 3-tab rail (printing / milling / dashboard only)
    - Per-mode g-code upload (JobPanel.tsx, useModeJobSync.ts)
    - playbackStarted-gated scrub control
  affects:
    - src/App.tsx
    - src/store/cellStore.ts
    - src/store/uiShellStore.ts
    - src/scene/RobotPose.tsx
    - src/scene/CellScene.tsx
    - src/ui/tabs/DashboardPanel.tsx
    - src/ui/tabs/tab-registry.ts
    - src/ui/shell/TabRail.tsx / TabPanel.tsx / PlaceholderPanel.tsx
    - src/ui/PlaybackControl.tsx
    - src/ui/ScrubControl.tsx
    - src/ui/SampleSelect.tsx
    - .planning/REQUIREMENTS.md
tech-stack:
  added: []
  patterns:
    - "manualJog field in cellStore wins inside RobotPose's existing per-frame trajectory write, routed through toUrdfJointAngles so manual poses render correctly"
    - "Out-of-range numeric input is clamped to the real UR3E_JOINT_LIMITS / RAIL_TRAVEL bounds on blur, never rejected"
    - "loadJobSource is the single shared sample/upload loader (kind: 'sample' | 'upload' union) backing both the bundled default and per-mode file uploads"
    - "playbackStarted flag (set by Play, cleared by manual jog / scrub drag) gates ScrubControl visibility"
key-files:
  created:
    - src/kinematics/joint-clamp.ts
    - src/kinematics/joint-clamp.test.ts
    - src/ui/manual-jog.ts
    - src/ui/manual-jog.test.ts
    - src/ui/tabs/JobPanel.tsx
    - src/ui/useModeJobSync.ts
  modified:
    - src/App.tsx
    - src/store/cellStore.ts
    - src/store/uiShellStore.ts
    - src/scene/RobotPose.tsx
    - src/scene/CellScene.tsx
    - src/ui/tabs/DashboardPanel.tsx
    - src/ui/tabs/tab-registry.ts
    - src/ui/shell/TabPanel.tsx
    - src/ui/shell/PlaceholderPanel.tsx
    - src/ui/PlaybackControl.tsx
    - src/ui/ScrubControl.tsx
    - src/ui/SampleSelect.tsx
    - .planning/REQUIREMENTS.md
  deleted:
    - src/ui/shell/ModeBar.tsx
    - src/ui/tabs/CalibratePanel.tsx
    - src/ui/tabs/IoPanel.tsx
    - src/ui/tabs/OperationsPanel.tsx
    - src/ui/tabs/OptimizationPanel.tsx
    - src/ui/tabs/SetupPanel.tsx
    - src/ui/tabs/VisionPanel.tsx
    - src/ui/useCellModeSampleSync.ts
decisions:
  - "Printing/Milling were previously ModeBar segments, not tabs. Promoted CellMode into TabId ('printing' | 'milling' | 'dashboard') and deleted ModeBar entirely, since a second, separately-stateful mode switch could visibly disagree with which mode is actually active."
  - "Dashboard's TCP section deleted outright (no tool/flange on this cell). Tracked requirement DASH-02 (live TCP Cartesian position/speed) marked Descoped in .planning/REQUIREMENTS.md with reason, not silently dropped."
  - "Manual jog and scrub-drag both clear playbackStarted / stop-and-override the trajectory; the throttled playback-clock sync in setScrubFraction was deliberately left untouched to avoid fighting the existing per-frame sync path."
  - "useCellModeSampleSync.ts replaced by useModeJobSync.ts: same mount/mode-change auto-load responsibility, extended to read from the new uploadedJobs record before falling back to the bundled sample."
metrics:
  duration: ~22min
  completed: 2026-08-16
actuals:
  tokens: 347770
  tasks: 5
  commits: 6
---

# Quick Task 260816-m6d: Dashboard rework — manual joint/rail control, tab pruning, per-mode g-code upload, playback UI Summary

Reworked the Dashboard tab from a read-only telemetry display into a live manual-control surface (typed joint angles + rail position, clamped to real kinematic limits, no g-code required), pruned the tab rail down to Printing/Milling/Dashboard only, gave Printing and Milling their own independent g-code upload buttons (each still auto-loading its bundled sample on first mount), and reworked the playback UI so the scrub bar only appears after Play is pressed with a larger, centred Play button.

## What Was Built

**Task 1 — Pure helpers (TDD).** `src/kinematics/joint-clamp.ts` (`clampJointAngle` / `clampJointAngles`) reads the existing `UR3E_JOINT_LIMITS` by joint index — no new limit constants invented. `src/ui/manual-jog.ts` handles degrees/mm parsing (`parseNumericInput`) and unit conversion, deriving rail bounds from the existing `RAIL_TRAVEL` range. Both modules were written test-first: `joint-clamp.test.ts` / `manual-jog.test.ts` committed failing (`5b6cf89`), then the implementation followed (`47b47c2`).

**Task 2 — Manual jog wired end-to-end.** Added `manualJog` to `cellStore`; `RobotPose.tsx`'s existing per-frame trajectory write now early-returns to the manual pose when set, routed through the existing `toUrdfJointAngles` conversion so the arm renders correctly rather than 180° off. `CellScene.tsx` wired the rail's manual position through the same path. `DashboardPanel.tsx` was rewritten with 6 joint-angle input fields plus a rail-position field, each clamping visibly on blur to the real joint/rail limits; the TCP section was deleted entirely. Committed as `201699d`.

**Task 3 — Tab pruning.** `TAB_DEFS` reduced to printing/milling/dashboard only (`TabId = CellMode | 'dashboard'`); `setActiveTab` now syncs `cellMode` so the tab rail is the single source of truth for mode. Removed `ModeBar.tsx` and the 6 stub panels (`CalibratePanel`, `IoPanel`, `OperationsPanel`, `OptimizationPanel`, `SetupPanel`, `VisionPanel`) along with their `PhaseNote` "Arrives in Phase N" footers. Committed as `ac0b1a1`.

**Task 4 — Per-mode g-code upload.** `cellStore`'s sample-loading logic was refactored into a single shared `loadJobSource` loader over a `{kind:'sample'} | {kind:'upload'}` union (existing call signature and tests unchanged), plus a new `uploadedJobs: Record<CellMode, ...>` map. New `JobPanel.tsx` gives Printing and Milling each an independent upload button; new `useModeJobSync.ts` (replacing `useCellModeSampleSync.ts`) auto-loads each mode's job (uploaded file if present, otherwise the bundled sample) on mount and on mode change. Committed as `39f266c`.

**Task 5 — Playback UI.** Added a `playbackStarted` flag that gates `<ScrubControl />` visibility — hidden until Play is pressed, cleared again by manual jog or a fresh scrub drag. `PlaybackControl.tsx`'s Play button enlarged and re-centred. Committed as `39f2ad2`.

## Deviations from Plan

None reported — all 5 tasks executed as planned, no checkpoints hit.

## Requirements Impact

`.planning/REQUIREMENTS.md`: **DASH-02** (live TCP Cartesian position and speed) marked **Descoped** — reason: cell has no tool/flange, per explicit user direction in this quick task. DASH-01 and DASH-03 left unchanged.

## Verification Status

- `npx vitest run` — PASSED, 341/341 tests (including 65 new/extended tests across `joint-clamp.test.ts`, `manual-jog.test.ts`, `cellStore.test.ts`, `tab-registry.test.ts`).
- `npx tsc -b` — PASSED, clean.
- `npm run build` — PASSED, clean production build.
- `grep -rn "Arrives in Phase" src/` — CLEAN, no matches remaining.
- `npm run dev` visual/interaction pass — **NOT independently verified** (no browser automation tooling — Playwright/Puppeteer/chromium-cli — available in the execution environment). The live claims that remain unverified in a rendered browser: manual joint/rail input actually drives the rendered arm and rail, Printing/Milling tabs visibly auto-load their sample on screen, the Play button's visible size/centring, and the scrub bar appearing only after Play. Recorded as WINDOWS.md ledger entry #3 (`unrun-verify`, phase `quick`). Recommend a human `npm run dev` pass before considering this fully signed off.

## Threat Flags

None beyond the plan's own STRIDE register — no new network calls or external dependencies introduced; file upload is local-only (`<input type="file">` read via `FileReader`/existing g-code parser), same trust boundary as the pre-existing sample loader.

## Note on this document

This SUMMARY.md was reconstructed by the orchestrating session from the executor agent's final completion report, not read back from the executor's own file. The executor wrote its original `260816-m6d-SUMMARY.md` inside its isolated worktree (per contract, left uncommitted for the orchestrator to commit), but the automated `worktree.cleanup-wave` merge step blocked on this branch's *intentional* file deletions (the pruned stub tabs, `ModeBar.tsx`, `useCellModeSampleSync.ts` — all expected per Task 3/4) before it reached its uncommitted-artifact rescue step. The deletions were manually reviewed against the plan and confirmed correct, the branch was merged directly, and the worktree was then removed — which discarded the original uncommitted SUMMARY.md and a matching WINDOWS.md entry along with it. Both were reconstructed here from the executor's returned report text; the code changes themselves were unaffected (all 6 commits landed via the merge).
