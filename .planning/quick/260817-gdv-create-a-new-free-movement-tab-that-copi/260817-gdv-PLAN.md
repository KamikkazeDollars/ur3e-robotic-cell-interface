---
phase: quick
plan: 260817-gdv
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/JogControl.tsx
  - src/ui/tabs/RunPanel.tsx
  - src/ui/tabs/FreeMovementPanel.tsx
  - src/ui/manual-jog-input-hardening.test.ts
  - src/ui/tabs/tab-registry.ts
  - src/ui/tabs/tab-registry.test.ts
  - src/store/uiShellStore.ts
  - src/store/uiShellStore.test.ts
  - src/ui/shell/TabRail.tsx
  - src/ui/shell/TabPanel.tsx
  - src/ui/shell/ModeBar.tsx
  - src/ui/shell/playback-chrome-visibility.ts
  - src/ui/shell/playback-chrome-visibility.test.ts
  - src/ui/usePlaybackTabGuard.ts
  - src/App.tsx
autonomous: true
requirements: [QUICK-260817-GDV, DASH-01, DASH-03, SIM-04]

estimate:
  tokens: 58000
  raw_tokens: 29000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The left rail shows exactly two tabs, labelled 'Run' and 'Free Movement' — no tab is labelled 'Dashboard' and no registry id is 'dashboard'."
    - "The Free Movement panel renders the same sections and controls the old Dashboard panel had (joint angles, rail + travel readouts, recovery), from its OWN component file that can be edited without touching the Run panel."
    - "While Run is the active tab, the Play/Pause button is mounted and operable, and the scrub bar appears once playback has started, exactly as before this change."
    - "While Free Movement is the active tab, neither the Play/Pause button nor the scrub bar is mounted at all — they are absent from the component tree, not merely hidden by CSS."
    - "Switching away from Run while a job is playing stops the playback clock, so the robot can never keep animating with no reachable pause control."
    - "On first load the app is on Run, the docked panel is closed (full-width scene) and the Play button is available — the pre-change opening behaviour is preserved."
    - "Manual jog from EITHER panel still commits through the same validated setManualJointAngle/setManualRailPos/clearManualJog/homeManualPose path — no second write path into manualJog."
  artifacts:
    - src/ui/JogControl.tsx
    - src/ui/tabs/RunPanel.tsx
    - src/ui/tabs/FreeMovementPanel.tsx
    - src/ui/shell/playback-chrome-visibility.ts
    - src/ui/shell/playback-chrome-visibility.test.ts
    - src/ui/usePlaybackTabGuard.ts
    - src/store/uiShellStore.test.ts
  key_links:
    - "TAB_DEFS ids -> TabRail TAB_ICONS keys -> TabPanel PANELS keys (Record<TabId, _> makes a missing entry a build failure, tab-registry.test.ts makes an orphan key a test failure)"
    - "uiShellStore.activeTab -> showsPlaybackControls() -> App.tsx transport mounts (one predicate, no second inline tab comparison anywhere)"
    - "uiShellStore.panelOpen -> shellContentLeft(panelOpen) in BOTH App.tsx and ModeBar.tsx (the two overlay offsets must not drift apart)"
    - "activeTab change -> usePlaybackTabGuard -> cellStore.pause (the 'not functional elsewhere' half of the requirement)"
    - "JogControl.tsx -> RunPanel.tsx AND FreeMovementPanel.tsx (the subtle commit/stale-closure logic stays single-sourced even though the panels are deliberate copies)"
---

<objective>
Split the single Dashboard tab into two tabs — "Run" (the renamed Dashboard) and "Free Movement" (a full, independently-editable copy of the Dashboard panel) — and mount the toolpath transport controls (Play/Pause button + scrub bar) only while the user is on Run.

Purpose: Free Movement is intended to become a distinct manual-jog surface, so it starts as a real copy rather than an alias. The toolpath transport belongs to the Run tab alone: on any other tab it must be genuinely absent, not merely invisible.
Output: Two wired tabs, a shared JogControl widget, a pure visibility predicate with unit tests, a tab-change playback guard, and updated structural guards covering both panel copies.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@src/App.tsx
@src/ui/tabs/DashboardPanel.tsx
@src/ui/tabs/tab-registry.ts
@src/store/uiShellStore.ts
@src/ui/shell/TabRail.tsx
@src/ui/shell/TabPanel.tsx
@src/ui/shell/ModeBar.tsx
@src/ui/shell/shell-geometry.ts
@src/ui/dashboard-input-hardening.test.ts
@src/ui/tabs/tab-registry.test.ts
@src/ui/useModeJobSync.ts
@src/ui/PlaybackControl.tsx
@src/ui/ScrubControl.tsx
</context>

<discovery_findings>
Discovered during planning (Level 0 — all work follows existing in-repo patterns, no new dependency):

- **Tab plumbing is already single-sourced.** `src/ui/tabs/tab-registry.ts` holds `TabId`/`TAB_DEFS`/`DEFAULT_TAB_ID`; `TabRail.tsx` maps `TAB_DEFS` through a `Record<TabId, LucideIcon>` and `TabPanel.tsx` through a `Record<TabId, ComponentType>`, so adding an id without an icon or a panel is a compile error. `tab-registry.test.ts` additionally asserts registry/PANELS key parity.
- **Today there is exactly one tab** (`'dashboard'`, label "Dashboard") and `uiShellStore.activeTab` is `TabId | null` with `setActiveTab` acting as an open/close TOGGLE, defaulting to `null` so the app opens on a full-width scene.
- **The transport controls are unconditional.** `App.tsx` always mounts `<SampleSelect />` and `<PlaybackControl />` in the bottom-left overlay column; only `<ScrubControl />` is conditional, on `cellStore.playbackStarted`.
- **The playback clock does not live in the controls.** `usePlaybackClock()` runs inside `CellScene.tsx`, so unmounting the buttons alone would leave a running job animating with no reachable Pause — hence the tab-change pause guard in Task 3.
- **`panelOpen` is currently derived as `activeTab !== null`** in two places (`App.tsx`, `ModeBar.tsx`), both feeding `shellContentLeft()`.
- **Structural guards read source from disk.** `src/ui/dashboard-input-hardening.test.ts` hardcodes `SOURCE_PATH = 'src/ui/tabs/DashboardPanel.tsx'`; `playback-path-unguarded.test.ts` and `cell-scene-order.test.ts` use the same `node:fs` discipline. There is no jsdom / Testing Library in this repo — every automated check is a pure-module or source-structure test.
- **`lucide-react` already exports `Move3d`** (verified in the installed `lucide-react.d.ts`), so the second tab icon needs no install.

**Design decision — tab identity is split from panel-open state (Task 2).** The request says the transport must appear only when the user "is on the Run tab". With today's nullable `activeTab`, closing the docked panel would also mean "on no tab", which would silently remove the Play button from the app's default opening state — a regression. So `activeTab` becomes non-nullable (`TabId`, default `'run'`) and a separate `panelOpen: boolean` (default `false`) carries the docked-panel toggle. Result: the app still opens on a full-width scene WITH the Play button, and "which tab am I on" becomes an unambiguous, testable input to the visibility gate.

**Design decision — the slug is renamed, not just the label.** The constraint allows a label-only rename, but `'dashboard'` is a `TabId` union member keyed into two `Record`s and asserted in tests, and a tab labelled "Run" backed by an id `'dashboard'` sitting next to a real `'free-movement'` sibling would be actively misleading. TypeScript's `Record<TabId, _>` forces every call site to be updated, so the rename cannot be done halfway.

**Design decision — `JogControl` is shared, the panels are copies.** The panel bodies (sections, headings, readouts, recovery buttons) are duplicated verbatim so Free Movement can diverge, per the request. The `JogControl` widget itself is NOT duplicated: it carries the documented stale-closure/commit-cadence fixes from quick 260816-qym, and a forked copy would silently drift from a future fix. It is a generic per-axis widget, like `components/ui/button.tsx`, not part of what is meant to diverge.
</discovery_findings>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Share JogControl, rename the Dashboard panel to Run, add the Free Movement copy</name>
  <files>src/ui/JogControl.tsx, src/ui/tabs/RunPanel.tsx (git mv from src/ui/tabs/DashboardPanel.tsx), src/ui/tabs/FreeMovementPanel.tsx, src/ui/manual-jog-input-hardening.test.ts (git mv from src/ui/dashboard-input-hardening.test.ts), src/ui/shell/TabPanel.tsx</files>
  <behavior>
    - The shared widget source declares textual decimal entry (`type="text"`, `inputMode="decimal"`, `autoComplete="off"`), carries a range input, and contains zero occurrences of the spinner-capable native input type.
    - The shared widget's slider change handler routes to the same `onCommit` prop the typed field's commit path uses — one write path.
    - BOTH panel sources reference `manualJointDegrees` and `manualRailMillimetres`, and call no manual-pose store action outside {setManualJointAngle, setManualRailPos, clearManualJog, homeManualPose}.
    - BOTH panel sources contain no manualJog-shaped object write and no direct `.manualJog =` assignment.
    - `RunPanel` and `FreeMovementPanel` are two separately-exported components in two files (editing one cannot change the other).
  </behavior>
  <action>
Move the `JogControl` component out of the Dashboard panel into a new shared widget file, then turn the remaining panel into two independent copies.

1. Create `src/ui/JogControl.tsx`. Move `JogControlProps`, the `JogControl` function, and the style objects it alone consumes (`fieldStyle`, `fieldLabelRowStyle`, `labelStyle`, `hintStyle`, `inputRowStyle`, `inputStyle`, `unitStyle`, `rangeInputStyle`) across VERBATIM — same JSX, same prop names, same `commitNumberFieldDraft` delegation, and every existing doc comment carried over unchanged (they record the stale-closure and spinner-surface fixes from quick 260816-qym and must not be summarised away). Export it as the default export. Add a short header noting it is now shared by both tab panels, so a fix here lands in both.

2. `git mv src/ui/tabs/DashboardPanel.tsx src/ui/tabs/RunPanel.tsx`. Rename the exported component to `RunPanel`, import `JogControl` from `../JogControl`, delete the moved code and any style constant that is now unused, and change the `PanelShell` title to "Run". Keep everything else — the store selectors, `poseState`, `railRemainingTravel`, the error row, the three `PanelSection`s, the manual-override footer — exactly as-is. Update the component doc comment: this is the Run tab (the renamed Dashboard), and `FreeMovementPanel` is a deliberate copy of it that is expected to diverge, so a future edit here does not automatically apply there.

3. Create `src/ui/tabs/FreeMovementPanel.tsx` as a full copy of `RunPanel`'s component body — its own imports, its own store selectors, its own JSX — exporting `FreeMovementPanel` as default with the `PanelShell` title "Free Movement". It imports the same shared `JogControl`. Do NOT re-export, wrap, or alias `RunPanel`; the whole point is that the two can be edited apart. Head the file with a comment stating it starts as a verbatim copy of `RunPanel` (quick 260817-gdv) and is the intended home for the future distinct free-movement behaviour.

4. `git mv src/ui/dashboard-input-hardening.test.ts src/ui/manual-jog-input-hardening.test.ts` and repoint its source reads: a `WIDGET_SOURCE_PATH` of `src/ui/JogControl.tsx` for the input-hardening and slider assertions (they describe the widget, which now lives there), and a `PANEL_SOURCE_PATHS` array of both panel paths, looped so the reference-and-allowlist assertions run once per panel — the copy must be guarded exactly as tightly as the original. Keep the existing array-join construction of the spinner-capable input type literal exactly as it is written today; do not inline it as a plain string. Update the `describe` titles to name the files they now read.

5. In `src/ui/shell/TabPanel.tsx`, repoint the import to `RunPanel` and keep the single `PANELS` entry mapped from the current registry id to `RunPanel` for now — Task 2 renames the ids. Leave `FreeMovementPanel` unrouted at the end of this task; it is wired in Task 2.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npm test -- src/ui/manual-jog-input-hardening.test.ts src/ui/tabs/tab-registry.test.ts && npx tsc -b</automated>
  </verify>
  <done>`src/ui/JogControl.tsx`, `src/ui/tabs/RunPanel.tsx` and `src/ui/tabs/FreeMovementPanel.tsx` all exist; `DashboardPanel.tsx` no longer exists; the renamed hardening test passes against the widget and both panels; `tsc -b` is clean and the app still builds with the single existing tab.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Two-tab registry — Run + Free Movement, with tab identity split from panel-open</name>
  <files>src/ui/tabs/tab-registry.ts, src/ui/tabs/tab-registry.test.ts, src/store/uiShellStore.ts, src/store/uiShellStore.test.ts, src/ui/shell/TabRail.tsx, src/ui/shell/TabPanel.tsx, src/ui/shell/ModeBar.tsx, src/App.tsx</files>
  <behavior>
    - `TAB_DEFS` has exactly 2 entries with ids `['run', 'free-movement']` and non-empty labels "Run" and "Free Movement"; neither id nor label is the old dashboard name, and neither cell-mode id is present.
    - `DEFAULT_TAB_ID` is `'run'` and is one of the registry ids; every registry id resolves to a defined `PANELS` entry with no orphan key.
    - `uiShellStore` initialises `activeTab === 'run'` and `panelOpen === false`.
    - `setActiveTab` on the ALREADY-active tab toggles `panelOpen` and leaves `activeTab` unchanged; calling it twice returns `panelOpen` to its starting value.
    - `setActiveTab` on a DIFFERENT tab sets `activeTab` to that id and forces `panelOpen` true.
    - No `setActiveTab` sequence ever leaves `activeTab` outside the registry ids.
    - `setActiveTab` never mutates `cellMode`.
  </behavior>
  <action>
Turn the single-tab rail into a real two-destination rail, and separate "which tab is current" from "is the docked panel showing".

1. `src/ui/tabs/tab-registry.ts`: widen `TabId` to the union of `'run'` and `'free-movement'`; `TAB_DEFS` becomes those two entries labelled "Run" and "Free Movement", in that order; `DEFAULT_TAB_ID` becomes the run id. Rewrite the file header: the rail now carries two destinations, Free Movement began as a copy of Run and is expected to diverge, and the id rename from the old single-tab name is deliberate (a tab labelled "Run" must not be keyed by the old name).

2. `src/store/uiShellStore.ts`: change `activeTab` to a non-nullable `TabId` initialised from `DEFAULT_TAB_ID`, and add `panelOpen: boolean` initialised `false`. `setActiveTab(id)` now branches: same id as the current `activeTab` -> flip `panelOpen` only; different id -> set `activeTab` to it and `panelOpen` to true. Replace the U-5 nullable-`activeTab` paragraph in the doc comment with the reason for the split: the transport gate in Task 3 keys off "which tab am I on", and folding panel-closed into "no tab" would strip the Play button from the app's default opening state. Record that the full-width-scene-on-load behaviour is preserved by `panelOpen` starting false, and that `cellMode` dispatch is still only `setCellMode`.

3. Create `src/store/uiShellStore.test.ts` covering every bullet in this task's behavior block. Reset the store between tests with `useUiShellStore.setState({ activeTab: DEFAULT_TAB_ID, panelOpen: false, cellMode: 'printing' })` in a `beforeEach`, following `src/store/cellStore.test.ts`'s existing reset discipline. Derive the "always a registry id" assertion by iterating `TAB_DEFS` rather than restating the ids, so a future third tab is covered automatically.

4. `src/ui/shell/TabRail.tsx`: extend `TAB_ICONS` to both ids — keep `LayoutDashboard` for run (deliberately NOT a play glyph, which would compete with the transport button in the scene overlay) and use `Move3d` for free movement. Read both `activeTab` and `panelOpen`. Highlight and show the active bar for the CURRENT tab whether or not the panel is open. Swap the button semantics from `aria-pressed` to `aria-current="page"` on the current tab plus `aria-expanded` reflecting whether that tab's panel is showing — with two destinations, "which one am I on" is the meaningful state again. Update the doc comment accordingly.

5. `src/ui/shell/TabPanel.tsx`: `PANELS` maps the run id to `RunPanel` and the free-movement id to `FreeMovementPanel`; return `null` when `panelOpen` is false; otherwise render `PANELS[activeTab]`. Update the doc comment to describe the new closed-but-still-current behaviour.

6. `src/ui/shell/ModeBar.tsx` and `src/App.tsx`: read `panelOpen` straight from the store instead of deriving it from a null check, and keep feeding it to `shellContentLeft(...)` in both places unchanged — the two offsets must stay identical.

7. Update `src/ui/tabs/tab-registry.test.ts` for the two-entry registry: the count, the exact id list, non-empty labels, `DEFAULT_TAB_ID` membership, the existing PANELS-parity gate, and the existing guard that neither cell-mode id appears. Add one regression guard that no registry id or label is the old dashboard name, so a future edit cannot quietly restore it.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npm test -- src/ui/tabs/tab-registry.test.ts src/store/uiShellStore.test.ts src/ui/shell/shell-geometry.test.ts && npx tsc -b</automated>
  </verify>
  <done>The rail renders two tabs labelled "Run" and "Free Movement"; the store opens on Run with the panel closed; clicking the current tab toggles the panel while staying on that tab; clicking the other tab switches and opens; registry, store and geometry tests pass and `tsc -b` is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Gate the Play button and scrub bar to the Run tab, and stop the clock on leaving it</name>
  <files>src/ui/shell/playback-chrome-visibility.ts, src/ui/shell/playback-chrome-visibility.test.ts, src/ui/usePlaybackTabGuard.ts, src/App.tsx</files>
  <behavior>
    - `showsPlaybackControls('run')` is true.
    - `showsPlaybackControls('free-movement')` is false, and iterating `TAB_DEFS` shows every non-run id is false (a future third tab defaults to hidden).
    - `shouldPausePlayback(tab, isPlaying)` is true only when `isPlaying` is true AND `showsPlaybackControls(tab)` is false; it is false for run-while-playing, run-while-paused, and free-movement-while-paused.
    - `src/App.tsx` imports `showsPlaybackControls` and mounts the Play/Pause control and the scrub control exactly once each, both behind that predicate (the scrub control additionally behind `playbackStarted`), verified against a comment-stripped read of the real source.
  </behavior>
  <action>
Make "is the transport available?" one pure, tested predicate, and make leaving Run actually stop playback rather than just hiding its controls.

1. Create `src/ui/shell/playback-chrome-visibility.ts` — data only, no JSX and no React import, matching `shell-geometry.ts`'s convention so the test can import it without a DOM. Export `showsPlaybackControls(activeTab: TabId): boolean`, true only for the run id, and `shouldPausePlayback(activeTab: TabId, isPlaying: boolean): boolean`, defined in terms of `showsPlaybackControls` rather than a second inline id comparison. Header comment: the toolpath transport belongs to the Run tab alone (quick 260817-gdv); this predicate is the single source of that rule, so no component may inline its own tab comparison.

2. Create `src/ui/shell/playback-chrome-visibility.test.ts` covering every bullet in this task's behavior block. For the App.tsx structural assertions, read the real source with `node:fs` exactly as `manual-jog-input-hardening.test.ts` and `cell-scene-order.test.ts` do, and FIRST strip block comments and whole-line double-slash comments from the source string before counting mounts — the count assertions must describe real JSX, never prose. Then assert: the source references `showsPlaybackControls`; the comment-stripped source contains exactly one mount of each transport component; and each of those mounts is in its guarded form (the Play/Pause control guarded by the visibility flag, the scrub control guarded by the visibility flag AND `playbackStarted`).

3. Create `src/ui/usePlaybackTabGuard.ts`, modelled directly on `useModeJobSync.ts` (read that file's header for the pattern and its stated reason): subscribe reactively to `activeTab` only, and inside a `useEffect` keyed on `activeTab` read `isPlaying`/`pause` from `useCellStore.getState()` — never a reactive selector — and dispatch `pause()` when `shouldPausePlayback` says so. Document why the guard exists: `usePlaybackClock` runs inside `CellScene`, which stays mounted on every tab, so unmounting the buttons alone would leave a job animating with no reachable Pause; and why the cellStore read is non-reactive: a reactive `isPlaying` dependency would re-fire the effect on the guard's own dispatch.

4. `src/App.tsx`: mount `usePlaybackTabGuard()` alongside the existing `useModeJobSync()` call, read `activeTab` from the shell store, derive a single `showPlayback` flag from `showsPlaybackControls(activeTab)`, and guard the two transport controls in the bottom-left overlay column with it. Leave `SampleSelect` mounted on every tab — the request names only the scrub bar and the play button, and the sample picker chooses which job is rendered in the 3D scene regardless of which tab is showing. Extend the existing overlay comment to record that the transport is Run-only and that the flag comes from the shared predicate, not an inline comparison.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npm test -- src/ui/shell/playback-chrome-visibility.test.ts && npx tsc -b && npm test</automated>
    <human-check>
      Run `npm run dev` and open the app in a browser.
      1. On load: the Run tab is highlighted in the left rail, the scene is full width (panel closed), and the round Play button is visible bottom-left.
      2. Press Play on a printing job — the robot animates and the scrub bar appears beneath the Play button.
      3. Click "Free Movement" while it is still playing: the panel switches to the Free Movement copy, the robot STOPS moving, and both the Play button and the scrub bar are gone from the bottom-left overlay (only the sample dropdown remains).
      4. Open DevTools -> Elements and confirm no play/scrub markup is present in the DOM at all while on Free Movement (absent, not merely hidden).
      5. Click "Run" again: the Play/Pause button is back, the scrub bar is back at the position the run stopped at, and pressing Play resumes from there.
      6. Confirm the Free Movement panel's joint sliders/fields move the robot exactly like the Run panel's do, and that a limit-violating entry still snaps back with the same error row.
      7. Switch Printing/Milling in the top mode bar from each tab and confirm the overlay column and mode bar stay aligned with the panel edge (no drifted offsets).
    </human-check>
  </verify>
  <done>`showsPlaybackControls`/`shouldPausePlayback` are unit-tested; App.tsx mounts each transport control exactly once behind the predicate; leaving Run mid-run pauses the clock; the full `npm test` suite and `tsc -b` are green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user -> browser DOM | The only boundary this change touches: tab clicks and jog input, all handled entirely client-side. |
| (none added) | No network call, no persistence, no filesystem access, and no new dependency is introduced by this plan. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-gdv-01 | Tampering | `uiShellStore.activeTab` -> `showsPlaybackControls` gate | low | accept | The gate is a UI-affordance rule over a local simulation, not an authorization boundary — there is no privileged action or server authority behind the transport controls, so a devtools-forced state change grants nothing a user could not already do on the Run tab. Accepted under ASVS L1. |
| T-gdv-02 | Denial of Service | `usePlaybackTabGuard` effect <-> `cellStore.pause` | low | mitigate | The effect depends only on `activeTab` and reads `isPlaying`/`pause` via `getState()` (never a reactive selector), so its own dispatch cannot re-trigger it — the documented `useModeJobSync` pattern, which exists precisely to avoid a self-refiring effect loop that would freeze the tab. |
| T-gdv-03 | Information Disclosure | `FreeMovementPanel` copy of `RunPanel` | low | accept | The copy renders the same locally-computed joint/rail numbers already shown on the Run tab; no new data surface, no new source of truth. |
| T-gdv-04 | Tampering | Duplicated panel bodies drifting apart on manual-jog writes | low | mitigate | `manual-jog-input-hardening.test.ts` loops its store-action allowlist and no-direct-write assertions over BOTH panel paths, and the commit-cadence logic stays single-sourced in `JogControl.tsx` — a second write path into `manualJog` fails the suite in either copy. |

No package-manager installs are performed by this plan — the `Move3d` icon comes from the already-installed `lucide-react` dependency — so the Package Legitimacy Gate does not apply and no supply-chain threat row is required.
</threat_model>

<verification>
```bash
cd "C:/Users/munte/Claude Projects/Interface"
npm test          # full Vitest suite — registry, store, visibility predicate, both panel guards
npx tsc -b        # the real build gate (bare `tsc --noEmit` checks nothing here)
npm run build     # production build, catches anything the incremental gate missed
```

Then the Task 3 `<human-check>` browser walkthrough, which is the authoritative check for this change: this repo has no jsdom/Testing Library, so mount/unmount behaviour is proven structurally in tests and visually in the browser.
</verification>

<success_criteria>
- The left rail shows two tabs: "Run" (highlighted on load) and "Free Movement"; nothing is labelled "Dashboard".
- The Free Movement panel shows the same joint/rail/recovery content as Run, from `src/ui/tabs/FreeMovementPanel.tsx`, editable without touching `RunPanel.tsx`.
- The Play/Pause button and scrub bar are mounted only while the active tab is Run — absent from the DOM on Free Movement, not hidden by CSS.
- Leaving Run mid-playback pauses the clock; returning to Run restores the transport at the same scrub position.
- The app still opens on a full-width scene with the Play button available (no default-state regression).
- `npm test`, `npx tsc -b` and `npm run build` all pass.
</success_criteria>

<output>
Create `.planning/quick/260817-gdv-create-a-new-free-movement-tab-that-copi/260817-gdv-SUMMARY.md` when done.
</output>
</content>
</invoke>
