---
phase: quick
plan: 260817-iyv
type: execute
wave: 1
depends_on: []
files_modified:
  - src/App.tsx
  - src/ui/shell/playback-chrome-visibility.test.ts
autonomous: true
requirements: [QUICK-260817-IYV, DASH-01]

estimate:
  tokens: 18000
  raw_tokens: 18000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "While Run is the active tab, the g-code sample dropdown is mounted in the bottom-left overlay column exactly where it is today — first child, above the Play/Pause button."
    - "While Free Movement (or any future non-Run tab) is active, the sample dropdown is absent from the DOM, not hidden by CSS — along with the two status notes it renders (skipped-command count, frozen-trajectory note)."
    - "The gate reuses the single existing `showPlayback` flag derived from `showsPlaybackControls(activeTab)`; `App.tsx` gains no second inline tab comparison and `playback-chrome-visibility.ts` is not modified, renamed or restructured."
    - "Play/Pause and scrub gating from quick 260817-gdv behave exactly as before — this change adds a third gated child to the same overlay column, it does not restructure the column or the predicate module."
    - "The App.tsx structural test asserts the sample picker mounts exactly once and only in its guarded form, so a future ungated remount fails the suite instead of silently regressing."
  artifacts:
    - src/App.tsx
    - src/ui/shell/playback-chrome-visibility.test.ts
  key_links:
    - "uiShellStore.activeTab -> showsPlaybackControls() -> the one `showPlayback` flag -> ALL THREE bottom-left overlay children (one predicate, zero inline tab comparisons anywhere in App.tsx)"
    - "App.tsx overlay JSX -> playback-chrome-visibility.test.ts comment-stripped `node:fs` source read (the only automated proof of mount/unmount available — this repo has no jsdom or Testing Library)"
---

<objective>
Gate the `SampleSelect` g-code picker to the Run tab, using the same `showPlayback` flag that already gates the Play/Pause button and the scrub bar.

Purpose: quick 260817-gdv deliberately left the sample picker mounted on every tab on the reasoning that it chooses which job the 3D scene renders regardless of tab. The user has now decided the opposite: the picker is Run-tab chrome, like the rest of the transport. Free Movement is a manual-jog surface and should not carry a job picker.
Output: a one-line JSX gate in `App.tsx`, its now-wrong explanatory comment corrected, and extended structural coverage in the existing `playback-chrome-visibility.test.ts`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@src/App.tsx
@src/ui/shell/playback-chrome-visibility.ts
@src/ui/shell/playback-chrome-visibility.test.ts
@src/ui/SampleSelect.tsx
</context>

<discovery_findings>
Discovered during planning (Level 0 — no new dependency, no new pattern; this reuses machinery shipped four commits ago):

- **The gate already exists and is already wired.** `src/App.tsx` line 49 holds `const showPlayback = showsPlaybackControls(activeTab)`, and lines 86-87 use it for `PlaybackControl` and `ScrubControl`. The only change needed is to apply the same short-circuit to the `SampleSelect` mount on line 85. **No change to `src/ui/shell/playback-chrome-visibility.ts` is required or wanted** — the predicate already returns true only for `'run'` and defaults every future tab id to hidden.
- **`SampleSelect` is mounted in exactly one place.** A repo-wide grep finds the mount only at `src/App.tsx:85`; every other hit is either the import line or a doc-comment reference in another file. Nothing else needs repointing.
- **The existing App.tsx overlay comment actively contradicts the new behaviour.** Lines 68-73 state, in prose, that the picker "stays mounted on every tab (it picks which job is rendered in the 3D scene regardless of which tab is showing)". That was gdv's deliberate reasoning; it is now wrong and must be rewritten in the same edit, otherwise the file documents the opposite of what it does.
- **The structural test is comment-aware.** `playback-chrome-visibility.test.ts` has a `stripComments` helper that removes block comments and whole-line double-slash comments before running its exact-mount-count assertions — but it does NOT strip trailing inline comments. Any explanatory note added to `App.tsx` must therefore be a block comment or a whole-line comment, never trailing, or it can corrupt a count assertion.
- **Gating the picker also removes two status notes from non-Run tabs.** `SampleSelect.tsx` renders the assumed-unit note, the SIM-01 skipped-command count, and the D-06/SIM-05 frozen-trajectory note inside its own container. These disappear together with the dropdown on Free Movement. This is acceptable and intended: they annotate the *selected job*, which is Run-tab business, and the blocking-state channel (`SceneStatusOverlay`) is a separate component that stays mounted on every tab.

**Design decision — keep the overlay container, gate only the child.** The bottom-left fixed container also positions the transport controls and is offset by `shellContentLeft(panelOpen)`. Hoisting the gate onto the container would restructure JSX that two shipped assertions match by exact literal, for no benefit: with all three children short-circuited the container renders as a zero-size empty flex box with no pointer target. Gate the child, leave the container alone.
</discovery_findings>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Gate SampleSelect behind the existing showPlayback flag and extend the structural guard</name>
  <files>src/ui/shell/playback-chrome-visibility.test.ts, src/App.tsx</files>
  <behavior>
    - The comment-stripped `src/App.tsx` source contains exactly ONE mount of the sample-picker component (matched by an opening-JSX-tag regex on its name), and that single mount is in the same guarded short-circuit form the Play/Pause control uses — the `showPlayback` flag, `&&`, then the self-closing element, wrapped in a JSX expression container.
    - The three already-shipped quick-260817-gdv assertions in this file still pass untouched: `PlaybackControl` and `ScrubControl` each mount exactly once, the Play/Pause mount is guarded by the flag, and the scrub mount is guarded by the flag AND `playbackStarted`.
    - Single-source guard: the comment-stripped `src/App.tsx` source contains no strict-equality comparison against the `activeTab` identifier (regex `/activeTab\s*===/`) and no bare `'run'` / `"run"` string literal — every tab decision in that file must route through `showsPlaybackControls`.
    - The predicate unit tests for `showsPlaybackControls` and `shouldPausePlayback` are unchanged and still pass — `src/ui/shell/playback-chrome-visibility.ts` is not edited by this task.
  </behavior>
  <action>
Apply the Run-only rule to the sample picker using the flag that is already sitting one line above it, and extend the structural guard so it can never silently regress.

1. Extend `src/ui/shell/playback-chrome-visibility.test.ts` FIRST, and watch it fail. Inside the existing `describe` block for the App.tsx structural guards, add two new `it` cases attributed to quick 260817-iyv, both reading the source through the existing `readAppSource` + `stripComments` helpers (do not add a second file-read helper, and do not weaken or reword the four cases already there):
   - one asserting the sample picker mounts exactly once and that the single mount is in guarded short-circuit form, per the first behavior bullet;
   - one asserting the single-source guard from the third behavior bullet — no strict-equality comparison against the tab identifier and no bare run-id string literal survive in the comment-stripped source.
   Also broaden the existing `describe` title so it names the sample picker alongside the transport controls, since the block now covers all three overlay children.

2. In `src/App.tsx`, wrap the `SampleSelect` mount in the exact same short-circuit already applied on the line below it for the Play/Pause control: the `showPlayback` flag, `&&`, the element. Reuse the existing `showPlayback` const verbatim — do NOT declare a second flag, do NOT call `showsPlaybackControls` a second time, and do NOT compare `activeTab` inline. Change nothing else: the surrounding fixed container, its `shellContentLeft(panelOpen)` offset, the child order, and the two existing guarded mounts all stay byte-identical.

3. Do NOT open or modify `src/ui/shell/playback-chrome-visibility.ts`. The predicate is correct as shipped; it is the single source of this rule and renaming or restructuring it is out of scope.

4. Rewrite the now-false part of the block comment above that container in `src/App.tsx` (the passage that currently claims the picker stays mounted on every tab because it selects the job the scene renders). Replace it with the actual rule: all three bottom-left overlay children — picker, Play/Pause, scrub — are Run-only and are genuinely absent from the DOM elsewhere, gated by one flag from the shared predicate rather than any inline comparison; note that quick 260817-iyv deliberately reversed quick 260817-gdv's earlier carve-out for the picker, so the reversal is not mistaken for an oversight later; and note that gating the picker also withdraws its unit / skipped-command / frozen-trajectory notes from non-Run tabs, which is intended because those annotate the selected job while blocking states remain on `SceneStatusOverlay`.

5. Comment hygiene, in both files: every explanatory note must be a block comment or a whole-line double-slash comment — never a trailing inline comment — because the test's strip helper only removes those two forms, and a stray inline mention could corrupt an exact-count assertion. When naming the picker in prose, write it in backticks as a bare identifier; never introduce it with a leading angle bracket in a comment.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npm test -- src/ui/shell/playback-chrome-visibility.test.ts && npx tsc -b && npm test</automated>
    <human-check>
      Run `npm run dev` and open the app in a browser.
      1. On load (Run tab): the g-code dropdown, the "Samples are interpreted in mm." note and the round Play button are all visible bottom-left, in that order, unchanged from before.
      2. Pick a sample and press Play — the robot animates and the scrub bar appears beneath the Play button, as before.
      3. Click "Free Movement": the robot stops (the gdv pause guard), and the bottom-left overlay is now completely empty — no dropdown, no unit note, no Play button, no scrub bar.
      4. Open DevTools -> Elements and confirm there is no select element and no dropdown markup anywhere in the DOM while on Free Movement (absent, not merely hidden).
      5. Click "Run" again: the dropdown returns with the SAME sample still selected, the scrub bar returns at the position the run stopped at, and pressing Play resumes from there.
      6. Switch Printing/Milling in the top mode bar from each tab and confirm the overlay column and mode bar stay aligned with the panel edge, and that returning to Run shows the correct mode-filtered sample list.
    </human-check>
  </verify>
  <done>`src/App.tsx` mounts the sample picker exactly once, guarded by the pre-existing `showPlayback` flag; the picker and its notes are absent from the DOM on Free Movement; `playback-chrome-visibility.ts` is untouched; the extended structural test, `npx tsc -b` and the full `npm test` suite are all green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user -> browser DOM | The only boundary touched: a tab click changes which local, client-side controls are mounted. |
| (none added) | No network call, no persistence, no filesystem access, no new dependency, no new store field. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-iyv-01 | Tampering | `uiShellStore.activeTab` -> `showsPlaybackControls` -> picker mount | low | accept | The gate is a UI-affordance rule over a local simulation, not an authorization boundary. A devtools-forced state flip grants nothing the user cannot already do by clicking the Run tab. Accepted under ASVS L1, consistent with T-gdv-01. |
| T-iyv-02 | Information Disclosure | SIM-01 skipped-command note / D-06 frozen-trajectory note withdrawn from non-Run tabs | low | accept | These notes annotate the selected job and remain fully visible on Run, the only tab that plays a job. The blocking-state channel (`SceneStatusOverlay`) is a separate component that stays mounted on every tab, so no blocking condition is ever hidden by this change. |
| T-iyv-03 | Tampering | A future edit reintroducing an ungated or duplicate picker mount | low | mitigate | The extended `playback-chrome-visibility.test.ts` asserts an exact mount count of one and that the single mount is in guarded form, over a comment-stripped read of the real source — a second or ungated mount fails the suite. |
| T-iyv-04 | Repudiation | A second inline tab comparison drifting from the shared predicate | low | mitigate | The new single-source guard fails the suite if `App.tsx` regains a strict-equality comparison against the tab identifier or a bare run-id string literal, so the predicate cannot be quietly bypassed. |

No package-manager installs are performed by this plan, so the Package Legitimacy Gate does not apply and no supply-chain threat row is required.
</threat_model>

<verification>
```bash
cd "C:/Users/munte/Claude Projects/Interface"
npm test          # full Vitest suite — the extended structural guard plus every existing test
npx tsc -b        # the real build gate (bare `tsc --noEmit` checks nothing in this repo)
npm run build     # production build, catches anything the incremental gate missed
```

Then the Task 1 `<human-check>` browser walkthrough, which is the authoritative check for mount/unmount: this repo has no jsdom or Testing Library, so presence/absence is proven structurally in tests and visually in the DOM inspector.
</verification>

<success_criteria>
- On Run, the sample dropdown and its notes appear exactly as before this change, above the Play/Pause button.
- On Free Movement, the bottom-left overlay is empty: no dropdown, no notes, no Play button, no scrub bar — confirmed absent in the DOM inspector, not merely hidden.
- The gate is the pre-existing `showPlayback` flag from `showsPlaybackControls`; `App.tsx` holds no inline tab comparison and `playback-chrome-visibility.ts` is unmodified.
- `playback-chrome-visibility.test.ts` covers the sample picker's mount count, its guarded form and the no-inline-comparison rule, and all four quick-260817-gdv assertions still pass unchanged.
- The App.tsx overlay comment describes the new Run-only rule for all three children — no leftover prose claiming the picker is always mounted.
- `npm test`, `npx tsc -b` and `npm run build` all pass.
</success_criteria>

<output>
Create `.planning/quick/260817-iyv-gate-the-sampleselect-sample-g-code-pick/260817-iyv-SUMMARY.md` when done.
</output>
