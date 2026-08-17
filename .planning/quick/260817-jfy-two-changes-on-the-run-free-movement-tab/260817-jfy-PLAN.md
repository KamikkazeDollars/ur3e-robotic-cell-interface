---
phase: quick
plan: 260817-jfy
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/live-pose-readout.ts
  - src/ui/live-pose-readout.test.ts
  - src/ui/tabs/RunPanel.tsx
  - src/ui/manual-jog-input-hardening.test.ts
  - src/App.tsx
  - src/ui/shell/playback-chrome-visibility.ts
  - src/ui/shell/playback-chrome-visibility.test.ts
autonomous: true
requirements: [QUICK-260817-JFY, DASH-01, DASH-03]

estimate:
  tokens: 48000
  raw_tokens: 48000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The Run tab shows the six joint angles and the rail position as plain label/value text rows — no typed field, no slider, no button, no `<input>` of any kind anywhere in `RunPanel.tsx`."
    - "Those Run readouts are LIVE: while a job plays, the joint numbers track the animating robot (via the reactive, coarse-cadence `scrubFraction` channel), and they show a manual pose whenever `manualJog` is non-null — they never sit frozen at the parked pose while the robot is visibly moving."
    - "The Run readout precedence matches `RobotPose.tsx`'s own render precedence exactly: `manualJog` wins, else the trajectory sample at the current fraction, else `UR3E_PARKED_POSE`."
    - "`RunPanel.tsx` dispatches ZERO manual-pose store actions — no `setManualJointAngle`, no `setManualRailPos`, no `homeManualPose`, no `clearManualJog`. The Recovery / Home-Reset section is gone from Run."
    - "`FreeMovementPanel.tsx` is byte-for-byte unchanged: it keeps its editable `JogControl` sliders and typed fields, its Recovery button, and its manual-override row."
    - "`JogControl.tsx` is unchanged — it remains the shared widget, now consumed by exactly one panel."
    - "While Run is the active tab, the top-of-scene mode bar (Printing/Milling toggle, `Mounted tool:` chip, `Job:` label, `Upload .gcode` button) renders exactly where it does today."
    - "While Free Movement (or any future non-Run tab) is active, that mode bar is ABSENT FROM THE DOM — unmounted, not CSS-hidden."
    - "The mode-bar gate reuses the existing `showPlayback` flag derived from `showsPlaybackControls(activeTab)`; `App.tsx` gains no second predicate and no inline tab comparison."
    - "The manual-jog input-hardening suite no longer loops its editable-surface assertions over `RunPanel.tsx` (which would now pass vacuously); it instead carries an explicit, non-vacuous read-only guard for Run and keeps guarding Free Movement as the editable surface."
  artifacts:
    - src/ui/live-pose-readout.ts
    - src/ui/live-pose-readout.test.ts
    - src/ui/tabs/RunPanel.tsx
    - src/ui/manual-jog-input-hardening.test.ts
    - src/App.tsx
    - src/ui/shell/playback-chrome-visibility.test.ts
  key_links:
    - "cellStore.scrubFraction (reactive, throttle-synced by usePlaybackClock) -> livePoseJointDegrees() -> sampleAtFraction() -> Run's ReadoutRow values — the ONLY reactive path that makes Run's numbers track playback without a per-frame React re-render"
    - "RobotPose.tsx's manualJog-then-sample-then-parked precedence -> livePoseJointDegrees()'s identical precedence — the screen numbers and the rendered arm can never disagree about which pose is authoritative"
    - "uiShellStore.activeTab -> showsPlaybackControls() -> the one `showPlayback` flag in App.tsx -> ALL FOUR Run-only chrome elements (ModeBar, SampleSelect, PlaybackControl, ScrubControl)"
    - "manual-jog-input-hardening.test.ts's editable-panel loop -> FreeMovementPanel.tsx ONLY (Run removed from the loop, replaced by an explicit read-only guard) — so neither panel can silently lose its guard"
---

<objective>
Two scoped changes to the Run / Free Movement split, continuing quick 260817-gdv and 260817-iyv:

1. Strip manual jog control off the Run tab. Run becomes a live, read-only telemetry readout of the six joint angles and the rail position. Free Movement keeps full manual control, untouched.
2. Gate the top-of-scene mode bar (Printing/Milling + mounted tool + job label + upload) to the Run tab only, reusing the existing Run-only predicate rather than forking a second one.

Purpose: manual jog control now has exactly one home (Free Movement). Run is the playback surface — its numbers should report what the robot is actually doing, and its chrome should be the job/transport chrome. Today Run carries a full duplicate jog surface and the mode bar leaks onto Free Movement, where neither belongs.
Output: one new pure readout module plus its unit test, a rewritten (read-only) `RunPanel.tsx`, a one-line JSX gate in `App.tsx`, and updated structural test coverage on both affected suites.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@src/ui/tabs/RunPanel.tsx
@src/ui/tabs/FreeMovementPanel.tsx
@src/ui/manual-pose-readback.ts
@src/ui/manual-jog.ts
@src/ui/shell/PlaceholderPanel.tsx
@src/scene/RobotPose.tsx
@src/trajectory/sample-lookup.ts
@src/App.tsx
@src/ui/shell/ModeBar.tsx
@src/ui/shell/playback-chrome-visibility.ts
@src/ui/shell/playback-chrome-visibility.test.ts
@src/ui/manual-jog-input-hardening.test.ts
</context>

<discovery_findings>
Investigated before planning; these findings are load-bearing for the task actions below.

**F-1 — `manualJointDegrees` is NOT a live pose source.** `src/ui/manual-pose-readback.ts` derives joints as `state.manualJog?.joints ?? UR3E_PARKED_POSE`. It has no trajectory branch, because it was built for a jog INPUT (what will be commanded), not a telemetry readout (what is happening). Reusing it verbatim for Run's new readouts would show the parked pose frozen on screen while the robot visibly animates a job — the exact failure the plan constraint asks about. A new derivation is required for joints.

**F-2 — the rail chain is already live-correct.** `manualRailMillimetres` derives `manualJog?.railPos ?? trajectory?.railPos ?? lastRailPos`, and `sample-lookup.ts` documents that `railPos` is constant across every sample of a compiled trajectory ("nothing to blend"). So the rail readout needs no new derivation — reuse `manualRailMillimetres` unchanged. Only joints get a new function.

**F-3 — the correct reactive live-joint channel is `scrubFraction`, not `livePlayback.fraction`.** `RobotPose.tsx` reads `livePlayback.fraction` inside `useFrame` via `getState()` precisely because it is the NON-reactive 60fps channel; subscribing a React component to it would re-render every frame — the single anti-pattern CLAUDE.md and `cellStore.ts`'s file header both forbid. `usePlaybackClock.ts` throttle-syncs the reactive `scrubFraction` alongside it (`setScrubFraction(step.fraction)`), which is the sanctioned coarse-cadence channel for a subscribed DOM consumer (`ScrubControl` already subscribes to it). Run's readouts therefore derive from `scrubFraction`. Coarse-cadence updating text is correct and desirable here, not a compromise.

**F-4 — `showsPlaybackControls` fits the mode bar exactly; do not fork a predicate.** The rule for the mode bar is "mounted only on Run", identical in both name and meaning to the rule already governing `SampleSelect`, `PlaybackControl` and `ScrubControl`. The mode bar's contents are job chrome (job label, upload, bundled-sample fallback) plus the mode toggle that selects WHICH job — the same family `SampleSelect` belongs to, and 260817-iyv already resolved that family to this predicate. A second predicate would be two names for one rule. Reuse `showPlayback`.

**F-5 — unmounting the mode bar is safe.** `useModeJobSync()` (per-mode auto-load) is mounted at the `App.tsx` shell level, not inside the bar, so mode/job loading survives unmount. `cellMode`, `uploadedJobs` and `toolpathLoadStatus` all live in stores. The bar's only local state is `lastUploadTooLarge`, a display-refinement boolean for the error line; after an unmount/remount cycle an oversized-upload rejection would read the generic "Failed to load the job." instead of the size-cap wording. Accepted as cosmetic — the rejection itself is store state and still surfaces.

**F-6 — `manual-jog-input-hardening.test.ts`'s Run coverage becomes vacuous.** Its `PANEL_SOURCE_PATHS` loop asserts (a) both readback selectors are referenced and (b) no manual-pose store action outside a four-name allowlist is called. After this change (a) is FALSE for Run (it no longer references `manualJointDegrees`) and (b) passes trivially against an empty call set. Both outcomes are unacceptable per the plan constraint. Resolution: narrow the loop to Free Movement (the only remaining editable surface) and add an explicit, non-vacuous read-only guard for Run that asserts the call set is EMPTY rather than merely allowlisted.

**F-7 — judgement call on Run's remaining buttons.** `Home / Reset Position` (`homeManualPose`) and `Return to toolpath` (`clearManualJog`) are both manual-pose store WRITES. The task specifies Run has "no store-write path", so both buttons leave Run. The informational override line stays (reworded to point at Free Movement) because a manual override silently defeating Play on the playback tab, with no on-screen explanation, would read as a broken app. Note also that `loadJobSource` already resets `manualJog` on every branch, so selecting/reloading a job from Run clears an override without any button. This is the one judgement call in the plan — the human-check step below asks the user to confirm or veto it.

**F-8 — `manualJogError` leaves Run too.** That alert row reports a REJECTED manual command. Run can no longer issue one, so the row could only ever display a rejection made on the other tab. Removed from Run; unchanged on Free Movement.
</discovery_findings>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Live joint-angle readout derivation (pure module + unit tests)</name>
  <files>src/ui/live-pose-readout.ts, src/ui/live-pose-readout.test.ts</files>
  <read_first>src/ui/manual-pose-readback.ts, src/scene/RobotPose.tsx, src/trajectory/sample-lookup.ts, src/trajectory/compile.ts (the `TrajectorySample` / `CompiledTrajectory` interface declarations only)</read_first>
  <behavior>
    - With `manualJog` non-null AND a non-empty trajectory present: returns the `manualJog` joint value in degrees (manual override wins, mirroring RobotPose.tsx's early return).
    - With `manualJog` null and a trajectory whose samples are non-empty: returns the `sampleAtFraction(trajectory, scrubFraction)` joint value in degrees. At `scrubFraction: 0` this is the first sample's joints exactly; at `scrubFraction: 1` the last sample's joints exactly; at a mid fraction it is the blended value `sampleAtFraction` itself returns (assert against a direct `sampleAtFraction` call, not a re-derived expectation, so the two can never disagree).
    - With `manualJog` null and `trajectory: null`: returns the `UR3E_PARKED_POSE` value in degrees.
    - With `manualJog` null and a trajectory whose `samples` array is EMPTY: returns the `UR3E_PARKED_POSE` value in degrees and does not throw.
    - Covers all six joint indices for at least the parked-pose case, so an index-mapping slip cannot pass.
  </behavior>
  <action>
Create `src/ui/live-pose-readout.ts` — a pure, framework-free derivation module in the same shape as the existing `manual-pose-readback.ts` (no React import, no store import; the caller passes state in), so its test can run in this repo's `node` Vitest environment.

Export an interface `LivePoseReadoutState` that EXTENDS `ManualPoseReadbackState` (imported as a type from `./manual-pose-readback`) and narrows/adds exactly two fields: `trajectory: CompiledTrajectory | null` (narrowing the base's minimal `{ railPos: number } | null` — legal, since `CompiledTrajectory` carries `railPos`) and `scrubFraction: number`. Extending rather than redeclaring is load-bearing: it lets `RunPanel.tsx` build ONE state object and pass it to both this module and the existing `manualRailMillimetres`, so the joint readouts and the rail readout can never be fed different snapshots.

Export `livePoseJoints(state: LivePoseReadoutState)` returning the authoritative joint tuple, implementing precisely the precedence `RobotPose.tsx` already applies at render time, in this order:
  1. `state.manualJog` non-null -> `state.manualJog.joints`.
  2. no trajectory, or `trajectory.samples.length === 0` -> `UR3E_PARKED_POSE`.
  3. otherwise -> `sampleAtFraction(state.trajectory, state.scrubFraction)`'s `joints`, falling back to `UR3E_PARKED_POSE` on the `null` return (which is unreachable given step 2, but keeps the function total without a non-null assertion).
Type the return as `JointAngles` if `TrajectorySample['joints']` is declared as that same type; if the compiler reports it as a distinct-but-compatible tuple, use `TrajectorySample['joints']` as the return type rather than casting.

Export `livePoseJointDegrees(state, jointIndex)` = `toDegrees(livePoseJoints(state)[jointIndex])`, reusing `toDegrees` from `./manual-jog` (the repo's single unit-conversion authority — do not inline a radians-to-degrees multiplication here).

Do NOT add a rail function: per discovery finding F-2 the existing `manualRailMillimetres` is already live-correct, and a second rail derivation is exactly the kind of duplicate the readback module was created to prevent. Record that reasoning in the module's header comment.

The header comment must also state why this module reads the reactive `scrubFraction` rather than the 60fps `livePlayback.fraction` (finding F-3), and must state that its precedence deliberately mirrors `RobotPose.tsx` so the on-screen numbers and the rendered arm always agree about which pose is authoritative.

Write `src/ui/live-pose-readout.test.ts` covering the behaviours above. Build trajectory fixtures as minimal object literals satisfying only the fields these functions touch (`samples`, `railPos`), cast through the imported type as the existing trajectory tests in this repo do — do not run the real compiler in this unit test.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npx vitest run src/ui/live-pose-readout.test.ts</automated>
  </verify>
  <done>`livePoseJointDegrees` returns the manual pose, the interpolated trajectory pose, or the parked pose — matching `RobotPose.tsx`'s precedence — and the whole new suite passes.</done>
</task>

<task type="auto">
  <name>Task 2: Make RunPanel read-only; re-aim the input-hardening guards</name>
  <files>src/ui/tabs/RunPanel.tsx, src/ui/manual-jog-input-hardening.test.ts</files>
  <read_first>src/ui/tabs/RunPanel.tsx, src/ui/shell/PlaceholderPanel.tsx, src/ui/manual-jog-input-hardening.test.ts, src/ui/shell/playback-chrome-visibility.test.ts (for its `stripComments` helper, which this task copies)</read_first>
  <action>
**Do not open, edit, or reformat `src/ui/tabs/FreeMovementPanel.tsx` or `src/ui/JogControl.tsx` in this task.** Free Movement keeps full manual control and the shared widget stays exactly as it is; `git status` must show neither file as modified when this task ends.

Rewrite `src/ui/tabs/RunPanel.tsx` as a read-only readout panel.

Remove: the jog-widget import, the `Button` import, the `toRadians` / `jointLimitsDegrees` / `railLimitsMillimetres` / `millimetresToMetres` imports, the `manualJointDegrees` import, the `ManualPoseReadbackState` type import, the `setManualJointAngle` / `setManualRailPos` / `clearManualJog` / `homeManualPose` store selectors, the `manualJogError` selector and its `errorRowStyle` alert row (finding F-8), the whole `Recovery` section and its button, and the `Return to toolpath` button with its `overrideRowStyle` wrapper (finding F-7).

Keep/add: `PanelShell` / `PanelSection` / `ReadoutRow` from `../shell/PlaceholderPanel`, `formatMillimetres` from `../manual-jog`, `manualRailMillimetres` from `../manual-pose-readback`, `railRemainingTravel` from `../../kinematics`, and `livePoseJointDegrees` + the `LivePoseReadoutState` type from `../live-pose-readout`. Keep the `JOINT_LABELS` tuple and `overrideNoteStyle` verbatim.

Selectors become exactly four reactive reads: `manualJog`, `trajectory`, `lastRailPos`, `scrubFraction`. Build one `const poseState: LivePoseReadoutState = { manualJog, trajectory, lastRailPos, scrubFraction }` and feed BOTH `livePoseJointDegrees(poseState, i)` and `manualRailMillimetres(poseState)` from it. Keep the existing `railPosMetres` / `railRemainingTravel(railPosMetres)` derivation for the two travel-remaining rows unchanged.

Render, inside `<PanelShell title="Run">`:
  - `<PanelSection heading="Joint angles">` — map `JOINT_LABELS` to one `ReadoutRow` each, `label={`${label} (°)`}` and `value={livePoseJointDegrees(poseState, i).toFixed(1)}`. Note the heading loses its former "— manual control" suffix, which is no longer true. One decimal place matches the precision the typed field used to display, so the numbers a user saw before and after this change are the same numbers.
  - `<PanelSection heading="Rail — 7th axis">` — a `ReadoutRow` labelled `Position (mm)` with `manualRailMillimetres(poseState).toFixed(1)`, followed by the two existing travel-remaining rows, unchanged. Putting the unit in the label (rather than a separate unit span) matches those two existing rows' own convention in this same file.
  - When `manualJog` is non-null, a single `<span style={overrideNoteStyle}>` explaining that a manual command is currently overriding playback and that it is released from the Free Movement tab. Text only — no button.

Replace the component's doc comment: it currently describes a manual-control surface and is now wrong in almost every line. The new comment must record (a) that Run is a read-only live readout and manual control lives solely on Free Movement as of this quick task, (b) why the joint values come from `livePoseJointDegrees` rather than `manualJointDegrees` (finding F-1: the latter has no trajectory branch and would freeze at the parked pose during playback), (c) why the rail still uses `manualRailMillimetres` (finding F-2: `railPos` is constant across a compiled trajectory, so that chain is already live), and (d) that the Recovery button and the override-release button were deliberately removed rather than overlooked, with F-7's reasoning. Keep the existing note that there is no tool-center-point section (DASH-02 descoped).

Then update `src/ui/manual-jog-input-hardening.test.ts` per finding F-6:
  - Copy the `stripComments` helper from `playback-chrome-visibility.test.ts` verbatim (same block-comment + whole-line-`//` stripping) so every negative assertion added below describes real code and never prose in a doc comment. This is what lets the RunPanel doc comment discuss the removed widget freely without self-invalidating a guard.
  - Rename `PANEL_SOURCE_PATHS` to `EDITABLE_PANEL_SOURCE_PATHS` and reduce it to `['src/ui/tabs/FreeMovementPanel.tsx']`. Leave the two assertions inside that loop otherwise untouched. Extend the file header to record that Run left this set in this quick task because it no longer has an editable surface, and that its guard moved to the new read-only describe below — so a future reader cannot mistake the narrowing for an accidental deletion of coverage.
  - At module scope, assemble the jog widget's JSX tag from string fragments joined with `.join('')`, using the same technique the existing spinner-input-type assertion already uses in this file, so the forbidden token never appears as a literal in the test source itself.
  - Add `describe('RunPanel.tsx — read-only readout guards (quick 260817-jfy)')` with four assertions, all against the COMMENT-STRIPPED Run source: (1) the assembled widget tag appears zero times; (2) no `<input` element appears at all; (3) no `<Button` element appears at all; (4) running the existing `set\w*Manual\w*|clear\w*Manual\w*|home\w*Manual\w*` call regex over the source collects an EMPTY set — assert the collected set's `size` is `0` explicitly, never an allowlist membership check, which is what would make this guard vacuous.
  - Add a fifth assertion in that same describe, against the UNSTRIPPED Run source, that it references `livePoseJointDegrees`, `manualRailMillimetres` and `scrubFraction` — proving the readouts are wired to the live derivation and not left frozen.
  - Add `describe('FreeMovementPanel.tsx — still the only editable manual-jog surface (quick 260817-jfy)')` asserting the assembled widget tag appears at least once in the comment-stripped Free Movement source. Without this, a future edit could strip manual control from BOTH panels and every remaining assertion in the file would still pass.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npx vitest run src/ui/manual-jog-input-hardening.test.ts && npx tsc -b && npx git diff --name-only -- src/ui/tabs/FreeMovementPanel.tsx src/ui/JogControl.tsx</automated>
  </verify>
  <done>Run renders six joint rows plus a rail row as plain text with zero inputs and zero manual-pose dispatches; the hardening suite passes with an explicit (non-vacuous) Run read-only guard and a Free-Movement-still-editable guard; the final `git diff --name-only` prints nothing, proving Free Movement and the shared widget are untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Gate the mode bar to the Run tab, then verify the whole change in the browser</name>
  <files>src/App.tsx, src/ui/shell/playback-chrome-visibility.ts, src/ui/shell/playback-chrome-visibility.test.ts</files>
  <read_first>src/App.tsx, src/ui/shell/playback-chrome-visibility.ts, src/ui/shell/playback-chrome-visibility.test.ts</read_first>
  <action>
In `src/App.tsx`, wrap the existing mode-bar mount in the SAME `showPlayback` flag already gating the three overlay children — `{showPlayback && <ModeBar />}` — leaving it in its current position in the JSX so DOM order and the fixed-position layout are unchanged. Do not introduce a second flag, a second predicate, or an inline `activeTab === ...` comparison anywhere: `App.tsx` already has a standing structural assertion that no inline tab comparison exists, and finding F-4 establishes the mode bar's rule is identical to the existing one.

Add a short comment above the gated mount recording that the mode bar is Run-only chrome for the same reason the job picker is (it is the job/mode selection surface), reusing the one predicate. Note in it that per-mode job auto-loading is unaffected because `useModeJobSync()` is mounted at the shell level, not inside the bar (finding F-5). Keep the comment free of any quoted tab-id string — the existing "no inline tab comparison" assertion greps the comment-stripped source for quoted ids, and this file's whole-line `//` comments are stripped, but block comments inside JSX are safer kept free of them regardless.

In `src/ui/shell/playback-chrome-visibility.ts`, update ONLY the header/doc comments to add the mode bar to the enumerated list of Run-only chrome this predicate governs. Do not change, rename, or add any exported function — the predicate's behaviour is already correct for this use.

In `src/ui/shell/playback-chrome-visibility.test.ts`, extend the existing App.tsx structural describe (updating its title to also cite quick 260817-jfy) with one test asserting, against the comment-stripped source, that the mode bar mounts exactly once and only in its guarded form — matching the exact guarded JSX string, in the same shape as the existing `SampleSelect` assertion directly above it. Leave the "no inline tab comparison" test unchanged; it must still pass.

Then run the full gate and hand off to the human check below:
`npx vitest run` (whole suite), `npx tsc -b && npx vite build`, and `npx eslint .` (report its output; a pre-existing missing-config failure is a known standing concern in STATE.md and is not a regression introduced here — do not attempt to fix ESLint config in this quick task).
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" && npx vitest run && npx tsc -b && npx vite build</automated>
    <human-check>
Run `npm run dev` and open the app.

On the **Run** tab:
1. The top-of-scene bar is present as before: Printing/Milling toggle, `Mounted tool: ...`, `Job: ...`, `Upload .gcode`.
2. The Run panel shows six joint rows and a rail Position row as plain label/value text — NO sliders, NO typed boxes, NO `Home / Reset Position` button.
3. Press Play. The six joint numbers and the rail Position number update as the robot animates. They must NOT sit frozen at the parked-pose values while the arm visibly moves. (Text updating at a coarse cadence rather than every frame is correct and intended.)

Switch to **Free Movement**:
4. The top-of-scene bar is GONE — along with the Play button, scrub bar, and job picker. Confirm in devtools it is absent from the DOM, not merely invisible.
5. The sliders and typed fields are still there and still move the robot; `Home / Reset Position` still works.
6. Jog one joint away from its current value, then switch back to **Run**.

Back on **Run**:
7. The read-only numbers show the jogged pose, and the "manual command is overriding playback" note is visible.
8. The top bar is back, with the same mode and job still selected as before you left.

JUDGEMENT CALL TO CONFIRM (finding F-7): Run no longer has a `Return to toolpath` button — releasing a manual override now requires switching to Free Movement (or loading/reselecting a job, which clears it automatically). Say so if you want that button kept on Run; it is a one-line restore.
    </human-check>
  </verify>
  <done>The mode bar mounts only on Run and is genuinely unmounted elsewhere, guarded by the single shared predicate with a structural test proving it; the full Vitest suite, `tsc -b` and `vite build` all pass; the human browser walkthrough is signed off.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user file -> `loadUploadedGcode` | The `Upload .gcode` control inside the mode bar. Pre-existing, unchanged by this plan — the bar's contents and upload handler are not edited, only the condition under which the component mounts. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jfy-01 | Tampering | `RunPanel.tsx` store access | low | mitigate | Removing every write path from Run narrows the manual-pose command surface to one component; the new test asserts Run's manual-pose dispatch set is empty, so a write path cannot be reintroduced silently. |
| T-jfy-02 | Denial of Service | Run readout render cadence | low | mitigate | Readouts subscribe to the reactive, throttle-synced `scrubFraction`, never the 60fps `livePlayback.fraction` — no per-frame React re-render is introduced (finding F-3). |
| T-jfy-03 | Information Disclosure | unmounted mode bar | low | accept | Unmounting the bar hides the loaded-job filename on non-Run tabs. Purely local display state in a single-user simulation; no confidentiality boundary exists. |

No package-manager installs in this plan, so no package-legitimacy gate applies.
</threat_model>

<verification>
- `npx vitest run` — whole suite green, including the new `live-pose-readout.test.ts`, the re-aimed `manual-jog-input-hardening.test.ts`, and the extended `playback-chrome-visibility.test.ts`.
- `npx tsc -b && npx vite build` — clean (this repo's real type gate; bare `tsc --noEmit` is known to check nothing here, per STATE.md).
- `git diff --name-only` lists only the seven files in `files_modified` — in particular NOT `src/ui/tabs/FreeMovementPanel.tsx` and NOT `src/ui/JogControl.tsx`.
- Human browser walkthrough in Task 3 signed off.
</verification>

<success_criteria>
- Run shows live, read-only joint and rail values with zero input elements and zero manual-pose store writes.
- Those values track playback and reflect a manual override set from the other tab; they never freeze at the parked pose while the robot moves.
- Free Movement's manual control and the shared jog widget are byte-for-byte unchanged.
- The mode bar is mounted on Run and absent from the DOM on Free Movement, gated by the single existing `showsPlaybackControls` predicate with no second predicate and no inline tab comparison.
- No test in the repo asserts something no longer true, and no test silently stopped testing anything.
</success_criteria>

<output>
Create `.planning/quick/260817-jfy-two-changes-on-the-run-free-movement-tab/260817-jfy-SUMMARY.md` when done
</output>
