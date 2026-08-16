---
phase: quick
plan: 260816-qym
type: execute
wave: 1
depends_on: []
files_modified:
  # created — drift-free manual-input commit primitive (U-1)
  - src/ui/manual-pose-readback.ts
  - src/ui/number-field-commit.ts
  - src/ui/manual-input-drift.test.ts
  # created — Dashboard structural guards (U-1, U-3)
  - src/ui/dashboard-input-hardening.test.ts
  # created — measured robot footprint (U-2)
  - src/scene/robot-footprint.ts
  - src/scene/robot-footprint.test.ts
  # modified
  - src/ui/tabs/DashboardPanel.tsx
  - src/scene/RailRig.tsx
  - src/scene/rail-rig-geometry.test.ts
  - src/store/cellStore.ts
  - src/store/cellStore.test.ts
autonomous: false

requirements:
  - DASH-01
  - DASH-03
  - SCENE-04

estimate:
  tokens: 480000
  raw_tokens: 220000
  tasks: 7
  confidence: low

must_haves:
  truths:
    - "U-1: Typing an absolute value into any of the 6 joint fields or the rail field and committing it leaves the field text AND the store holding exactly that value — no ±1 drift in that field's own unit (degrees for joints, millimetres for rail), and no snap-back to the pre-edit number."
    - "U-1: The manual-jog fields carry no native numeric-spinner surface at all, so neither a mouse wheel over a focused field nor an Up/Down arrow key can add or subtract a step behind the user's back."
    - "U-1: When a commit is REFUSED by the safety gate, the field returns to the value the robot is actually holding (read back from the store, never from a pre-edit render closure) and the rejection message still appears — the 260816-nup revert behaviour is preserved, not replaced."
    - "U-2: The rail track's required length beyond each travel limit is DERIVED from a measurement of the shipped UR3e assets, not from the abstract carriage box constants."
    - "U-2: At both RAIL_TRAVEL extremes (±1.5 m) the robot's measured worst-case rendered footprint sits inside the visible rail track with margin to spare."
    - "U-2: The rail's logical travel range is still exactly ±1.5 m — only cosmetic geometry changed."
    - "U-2: The camera-framing and unit-scale hypotheses are explicitly ruled in or out with a recorded finding, not left unexamined."
    - "U-3: Each of the 6 joints and the rail has a slider covering the same range in the same units as its typed field, synced bidirectionally with the same store value."
    - "U-3: A slider drag commits through setManualJointAngle/setManualRailPos → commitManualJog → validateManualPose exactly like a typed entry — there is no second write path into manualJog."
    - "U-4: One click of Home/Reset Position parks all 6 joints at UR3E_PARKED_POSE and the rail at RAIL_CENTER_X, and it works while a toolpath is playing or paused."
    - "U-4: Home/Reset also stops the playback clock, so the displayed playing/paused state cannot disagree with the parked robot on screen."
    - "U-4: Home/Reset routes through the same commitManualJog/validateManualPose path — it is not a bypass."
    - "No regression: joint/rail clamping, singularity+collision gating, per-mode upload/auto-load, playbackStarted scrub-gating, the ModeBar compact toggle layout, and the g-code import/playback pipeline all behave exactly as they did after 260816-nup."
  artifacts:
    - src/ui/manual-pose-readback.ts
    - src/ui/number-field-commit.ts
    - src/ui/manual-input-drift.test.ts
    - src/ui/dashboard-input-hardening.test.ts
    - src/scene/robot-footprint.ts
    - src/scene/robot-footprint.test.ts
  key_links:
    - "DashboardPanel's reactive `value` prop and its `readCommitted` read-back both derive from the SAME exported selector in manual-pose-readback.ts — one derivation, two call sites, so the displayed number and the read-back can never disagree."
    - "RailRig.TRACK_OVERHANG reads ROBOT_FOOTPRINT_HALF_WIDTH_X (measured) instead of CARRIAGE_BASE_WIDTH / 2 (abstract stand-in)."
    - "robot-footprint.ts declares NO module-level dependencies, so RailRig gains no new edge into the pre-existing RailRig → cellStore → compile → toolpath-anchor → RailRig cycle and TRACK_OVERHANG cannot evaluate against an uninitialised binding."
    - "Every joint/rail slider onChange and the Home button dispatch only setManualJointAngle / setManualRailPos / homeManualPose — all three funnel through commitManualJog → validateManualPose."
    - "homeManualPose calls pause() and commitManualJog in one store action, so playback state and the parked pose move together."
---

<objective>
Fix the four defects the user found while live-testing quick task 260816-nup:

1. Manual joint/rail input lands the robot 1 unit above the typed value (most serious).
2. The rail rig 3D model still shows the robot overhanging the visible track at the travel extremes — the first fix attempt did not resolve it.
3. No slider controls for the 6 joints and the rail (QoL).
4. No Home/Reset Position button usable mid-simulation (QoL).

Purpose: items 1 and 2 are the priority — the manual-control surface is unusable if typed values do not land where typed, and the rail model is the most visible remaining 3D defect. Items 3 and 4 make the manual-control surface actually pleasant and recoverable.

Output: a drift-free manual-input commit primitive with a deterministic store-level regression test, a measured (not assumed) robot footprint driving the rail track's length, sliders for all 7 axes, and a one-click Home/Reset.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260816-nup-manual-control-safety-block-singular-col/260816-nup-SUMMARY.md

@src/ui/tabs/DashboardPanel.tsx
@src/ui/manual-jog.ts
@src/store/cellStore.ts
@src/scene/RailRig.tsx
@src/collision/pose-collision.ts
@src/kinematics/rail.ts
@src/kinematics/joint-clamp.ts
@src/ui/ScrubControl.tsx
</context>

<constraints>
- **No new npm dependencies.** This project has no jsdom and no `@testing-library/react`, and Vitest runs `environment: 'node'`. The deterministic reproduction for item 1 is achieved by extracting the commit logic into a pure, framework-free module and driving it against the REAL `useCellStore` in a node test — the approach the task brief explicitly sanctions ("reasoning + fixing via careful manual/store-level tracing"). Do not add jsdom/testing-library; a dependency-install task would require a package-legitimacy checkpoint this task does not budget for.
- **Do not regress 260816-m6d or 260816-nup.** Specifically preserved unchanged: `clampJointAngle`/`clampRailPosition` behaviour, `validateManualPose` gating and its `manualJogError` revert semantics, per-mode upload/auto-load (`uploadedJobs`, `loadUploadedGcode`, `useModeJobSync`), `playbackStarted` scrub-gating, the `ModeBar` compact toggle layout, and the whole g-code import/playback pipeline.
- **One write path into `manualJog`.** `commitManualJog` stays the only function that writes it. Sliders and the Home button add no second path.
- **`RAIL_TRAVEL` stays exactly ±1.5 m.** Item 2 is a cosmetic-geometry fix only.
- **Do not restate a removed attribute value in a source comment.** Task 2 removes the manual-jog inputs' native numeric-spinner type declaration and Task 2's test greps `DashboardPanel.tsx` for its absence; writing that same attribute text into a nearby explanatory comment would make the file grep as still containing it and silently invalidate the gate. Explain the change in prose without quoting the removed attribute value.
</constraints>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Reproduce the manual-input drift end-to-end and eliminate it at the commit boundary</name>
  <files>src/ui/manual-pose-readback.ts, src/ui/number-field-commit.ts, src/ui/manual-input-drift.test.ts</files>
  <read_first>src/ui/tabs/DashboardPanel.tsx (the `NumberField` component and `commitDraft`), src/ui/manual-jog.ts, src/store/cellStore.ts (`setManualJointAngle`, `setManualRailPos`, `commitManualJog`)</read_first>
  <behavior>
    This is the thin vertical slice for the whole plan: typed text → parse → store commit → gate → read back → displayed text, proven end-to-end through the real store before any UI is touched.

    - Committing `"200"` to joint 0 (base) leaves the store holding exactly `toRadians(200)` and the read-back selector reporting exactly `200` degrees.
    - The draft string the commit cycle returns for that entry is exactly `"200.0"` — NOT the pre-edit value, and not `"201.0"`.
    - The same round-trip holds for the rail: committing `"-1200"` millimetres leaves the store at `-1.2` metres and returns `"-1200.0"`.
    - Repeating the exact same commit twice in a row is idempotent — the second commit returns the same string as the first (this is what a stale pre-edit closure cannot do).
    - A commit REFUSED by `validateManualPose` returns the draft string for the value the robot is still actually holding, and leaves `manualJogError` set.
    - An unparseable draft (`""`, `"-"`, `"abc"`) commits nothing and returns the draft string for the current committed value.
    - A value beyond the joint/rail limit still CLAMPS silently (no error) and the returned draft string is the clamped value, matching what the store holds.
  </behavior>
  <action>
    Write the failing tests in `src/ui/manual-input-drift.test.ts` FIRST, against the two modules below, then implement until green.

    Create `src/ui/manual-pose-readback.ts` — the single derivation of "what value is the Dashboard currently showing for this axis". Export two pure selectors that take a `CellState` snapshot:
    - `manualJointDegrees(state, jointIndex)` → `toDegrees((state.manualJog?.joints ?? UR3E_PARKED_POSE)[jointIndex])`
    - `manualRailMillimetres(state)` → `metresToMillimetres(state.manualJog?.railPos ?? state.trajectory?.railPos ?? state.lastRailPos)`
    These reproduce exactly the fallback chains `DashboardPanel.tsx` currently inlines for its `value` props and `CellScene.tsx` uses for the carriage — do not invent a different fallback order. Task 2 makes `DashboardPanel.tsx` consume these for BOTH its reactive selector and its post-commit read-back, so the two can never disagree. Import the unit helpers from `./manual-jog` and the pose constant from `../kinematics`; do not restate any conversion arithmetic.

    Create `src/ui/number-field-commit.ts` exporting `commitNumberFieldDraft(draft, onCommit, readCommitted)` returning the next draft string:
    - parse `draft` via `parseNumericInput` (imported from `./manual-jog`; do not reimplement parsing);
    - if it parses, call `onCommit(parsed)`;
    - then call `readCommitted()` and return `readCommitted().toFixed(1)`.
    The whole point is the third argument: the returned string is derived from the TRUE post-commit value read live from the store, never from a `value` prop captured in a render that happened before the store update. That closes the confirmed stale-closure defect in `NumberField.commitDraft`, where `setDraft(value.toFixed(1))` runs against the pre-edit prop and rewrites the field with the OLD number after a successful commit. `readCommitted` is passed in rather than imported so this module stays pure and node-testable with no store import of its own; Zustand's `set()` is synchronous, so a `getState()`-backed `readCommitted` observes the committed outcome immediately.
    Document in the module header that this function is the ONLY place a manual-jog field's post-commit display text is produced.

    In `src/ui/manual-input-drift.test.ts`, drive `commitNumberFieldDraft` against the real `useCellStore` (Zustand runs fine under `environment: 'node'` — `src/store/cellStore.test.ts` already does this). For each case build `onCommit` from the real store action and `readCommitted` from `useCellStore.getState()` piped through the matching `manual-pose-readback` selector. Reset the store between cases the same way `cellStore.test.ts` already does. Assert on BOTH the returned draft string AND the underlying store value in every case, so a fix that satisfies one but not the other cannot pass. Cover all six joints, not just joint 0, plus the rail — the reported symptom was uniform across every field, so the test must be uniform too. Pick joint values that the existing safety gate accepts (start from `UR3E_PARKED_POSE` and nudge; `260816-nup-SUMMARY.md` records which extremes are now legitimately refused, e.g. the elbow at ±180°) and include one deliberately-refused case.
  </action>
  <verify>
    <automated>npx vitest run src/ui/manual-input-drift.test.ts</automated>
  </verify>
  <done>`commitNumberFieldDraft` returns a draft string equal to the typed value for every accepted entry across all six joints and the rail, equal to the still-held value for every refused or unparseable entry, and equal to the clamped value for every out-of-range entry — with the store asserted to match in each case. `npx tsc -b` is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rewire the Dashboard's numeric fields onto the drift-free primitive and remove the native spinner surface</name>
  <files>src/ui/tabs/DashboardPanel.tsx, src/ui/dashboard-input-hardening.test.ts</files>
  <read_first>src/ui/tabs/DashboardPanel.tsx, src/ui/number-field-commit.ts, src/ui/manual-pose-readback.ts</read_first>
  <behavior>
    - After any commit, the field text equals the value the store actually holds — the stale pre-edit snap-back is gone.
    - When the store value changes from OUTSIDE the field (a slider drag in Task 5, the Home button in Task 6, `clearManualJog`, a job load), the field text re-syncs to it instead of holding a stale draft.
    - No wheel gesture and no Up/Down arrow key can change a field's value, because the fields no longer expose a native spinner at all.
    - `DashboardPanel.tsx` contains no direct write to `manualJog` — every commit still goes through `setManualJointAngle` / `setManualRailPos`.
  </behavior>
  <action>
    Rework `NumberField` in `DashboardPanel.tsx`:

    (a) Replace its `onCommit`-plus-captured-`value` commit body with a call to `commitNumberFieldDraft(draft, onCommit, readCommitted)` from `src/ui/number-field-commit.ts`, assigning the returned string to `draft`. Add a required `readCommitted: () => number` prop.

    (b) Add render-time re-sync so an external store write reaches the field. Keep a `lastValue` state alongside `draft`; during render, when `value !== lastValue`, set both `lastValue` to `value` and `draft` to `value.toFixed(1)` (React's documented "adjust state when a prop changes" pattern — no `useEffect`). Also update `lastValue` inside the commit handler from the same settled number the commit returned, so the freshly-committed value does not immediately re-trigger the sync branch. Without this, Task 5's sliders and Task 6's Home button would move the robot while the typed fields kept showing stale numbers.

    (c) Eliminate the native spinner surface, which is the second confirmed lead for a uniform +1-in-native-unit drift: in Chrome and Firefox a focused native numeric input increments by its step (default 1) on a mouse wheel and on Up/Down arrow keys, entirely outside React's control, and that is exactly the shape of the reported symptom (+1 degree on every joint, +1 mm on the rail). Declare both the joint and the rail inputs as `type="text"` with `inputMode="decimal"` and `autoComplete="off"` instead. Nothing is lost: `parseNumericInput` already does all validation and already rejects partial entries, the min/max hint is already rendered as adjacent text, and Task 5 adds sliders for the nudge affordance the spinners were providing. Keep the existing `onBlur`/Enter commit cadence from 260816-nup exactly as it is — do not move commits back to `onChange`. Per this plan's constraints, explain the change in prose without quoting the removed attribute value anywhere in the file.

    (d) In `DashboardPanel`, replace the inlined `value` derivations with the Task 1 selectors: compute the reactive `value` props via `manualJointDegrees` / `manualRailMillimetres` applied to the subscribed state, and pass `readCommitted` closures that apply the SAME selectors to `useCellStore.getState()`. Both call sites must read the one selector — do not hand-inline the fallback chain a second time.

    Create `src/ui/dashboard-input-hardening.test.ts` following this repo's existing structural-guard idiom (`src/collision/playback-path-unguarded.test.ts`, `src/scene/cell-scene-order.test.ts`): read `src/ui/tabs/DashboardPanel.tsx` from disk with `fs` and assert
    - the source declares the manual-jog inputs as textual entry with a decimal input mode;
    - the source contains zero occurrences of the spinner-capable native input type declaration (build the search pattern in the test file itself);
    - the source references `commitNumberFieldDraft` and both `manual-pose-readback` selectors;
    - the source contains no direct assignment to a `manualJog` store field — the only manual-pose store actions it may dispatch are `setManualJointAngle`, `setManualRailPos`, `clearManualJog`, and (from Task 6) `homeManualPose`.
  </action>
  <verify>
    <automated>npx vitest run src/ui/dashboard-input-hardening.test.ts src/ui/manual-input-drift.test.ts && npx tsc -b</automated>
  </verify>
  <done>The Dashboard's seven manual-jog fields commit through `commitNumberFieldDraft`, re-sync from external store writes, and expose no native spinner. The structural guard test passes and `npx tsc -b` is clean.</done>
</task>

<task type="auto">
  <name>Task 3: Measure the robot's real rendered footprint from the shipped assets; rule the camera and scale hypotheses in or out</name>
  <files>src/scene/robot-footprint.ts, src/scene/robot-footprint.test.ts</files>
  <read_first>src/collision/pose-collision.ts (`poseKeypointsWorld`), src/gcode/toolpath-anchor.ts (`ROBOT_MOUNT_WORLD`), src/scene/RailRig.tsx, src/scene/camera-defaults.ts, src/scene/CellScene.tsx</read_first>
  <action>
    The previous fix attempt grew `TRACK_OVERHANG` from `CARRIAGE_BASE_WIDTH / 2 + TRACK_END_MARGIN` and it did not resolve the reported defect, because `CARRIAGE_BASE_WIDTH` is an abstract carriage-box constant that describes the mounting plate, not the robot standing on it. Replace the assumption with a measurement.

    Create `src/scene/robot-footprint.test.ts` (node environment, `fs` — same on-disk asset-reading pattern as `src/scene/urdf-asset.test.ts`) that:

    (a) Parses the shipped binary collision meshes under `public/robots/ur3e/meshes/ur3e/collision/*.stl`. These are binary STL: an 80-byte header, a little-endian `uint32` triangle count at byte offset 80, then 50 bytes per triangle — a 12-byte normal followed by three 12-byte vertices, then a 2-byte attribute word. Read the three vertices of every triangle and reduce to an axis-aligned bounding box per mesh. Verify the parse by checking `84 + 50 * count === fileSize` for every file before trusting any extent.

    (b) Derives, for each link mesh, its maximum radial half-extent about its own mesh origin, and takes the largest across all seven links. This is the real, measured stand-in for `COLLISION_LINK_RADIUS_M = 0.04`, which `pose-collision.ts` itself documents as a chosen figure rather than a datasheet value.

    (c) SCALE CHECK (rules hypothesis (c) in or out): asserts the base mesh's radial half-extent falls in a band consistent with a real UR3e base (roughly 0.04–0.12 m, against the published ~128 mm base diameter). A pass proves the shipped meshes are metres-native and agree with the metres-native rail geometry in `src/kinematics/rail.ts`; a fail is the scale mismatch and must be reported instead of patched around. Record the measured number in the summary either way.

    (d) Computes the robot's worst-case footprint half-width along world X, mount-relative, by sweeping joints 0–3 (base, shoulder, elbow, wrist 1) over `UR3E_JOINT_LIMITS` on a coarse grid (9 steps per joint is enough) with wrists 2/3 held at `UR3E_PARKED_POSE`'s values, calling `poseKeypointsWorld(joints, RAIL_CENTER_X)` from `src/collision` for each pose, and taking `max(|keypoint.x - ROBOT_MOUNT_WORLD.x|)` plus the measured link half-extent from (b). Also compute the same figure for `UR3E_PARKED_POSE` alone and report both.

    Create `src/scene/robot-footprint.ts` holding the resulting measurements as plain numeric constants with full provenance doc comments naming the measuring test, the assets measured, and the sweep used:
    - `UR3E_BASE_MESH_RADIUS_M`
    - `UR3E_MAX_LINK_HALF_EXTENT_M`
    - `ROBOT_FOOTPRINT_HALF_WIDTH_X` (the worst-case figure from (d))

    HARD RULE for `robot-footprint.ts`: it must declare NO module-level dependencies — no imports at all. `RailRig.tsx` consumes it at module scope in Task 4, and `RailRig` already sits inside the pre-existing `RailRig → cellStore → compile → toolpath-anchor → RailRig` cycle; an import here would add an edge into that cycle and could leave `TRACK_OVERHANG` evaluating against an uninitialised binding at load time. The measuring test does all the importing (it is outside the browser bundle and outside the cycle). Add an assertion in the test that the module's source declares no ES module dependency, and assertions that each constant still equals its freshly-measured value to within 1e-6, so the baked numbers can never silently drift from the shipped assets.

    (e) CAMERA CHECK (rules hypothesis (b) in or out): inspect `src/scene/CellScene.tsx`, `src/scene/camera-defaults.ts`, `src/scene/CameraResetListener.tsx` and `src/scene/ToolpathCameraFit.tsx` and determine whether any of them translate the camera or its OrbitControls target with the carriage's rail position. Record the finding explicitly in the summary — if nothing follows the carriage, the framing is fixed and the track end visible in `Robot Problem.png` is the real geometric end of the mesh rather than a crop, which confirms the defect is geometric and Task 4 is the right fix. If something DOES follow the carriage, say so and reconsider Task 4 before growing any geometry.
  </action>
  <verify>
    <automated>npx vitest run src/scene/robot-footprint.test.ts</automated>
  </verify>
  <done>`src/scene/robot-footprint.ts` carries three measured constants, each asserted against a fresh measurement of the shipped STL assets and the FK keypoint sweep. The base-mesh scale check passes (or the scale mismatch is reported). The camera-framing hypothesis is recorded as ruled in or ruled out with the specific files inspected.</done>
</task>

<task type="auto">
  <name>Task 4: Re-derive the rail track length from the measured footprint</name>
  <files>src/scene/RailRig.tsx, src/scene/rail-rig-geometry.test.ts</files>
  <read_first>src/scene/RailRig.tsx, src/scene/rail-rig-geometry.test.ts, src/scene/robot-footprint.ts</read_first>
  <reversibility rating="reversible">Cosmetic scene geometry only — `RAIL_TRAVEL` and every kinematic bound are untouched, so this is a one-line revert if the framing looks wrong.</reversibility>
  <action>
    In `RailRig.tsx`, change `TRACK_OVERHANG` to read the measured robot footprint instead of the carriage box: `TRACK_OVERHANG = ROBOT_FOOTPRINT_HALF_WIDTH_X + TRACK_END_MARGIN`, importing `ROBOT_FOOTPRINT_HALF_WIDTH_X` from `./robot-footprint`. Rewrite the surrounding doc comment to state plainly why the previous derivation failed: `CARRIAGE_BASE_WIDTH` describes the mounting plate the robot is bolted to, not the robot's own rendered extent, so no amount of margin stacked on top of it could guarantee the arm stayed over the track — the constant was measuring the wrong object.

    Set `TRACK_END_MARGIN = 0.2`. It is being reduced from 0.3 deliberately and this is not a regression: the previous 0.3 existed to paper over an under-measured footprint, and it now stacks on top of a real measured worst-case extent rather than a stand-in. Verify the resulting `TRACK_LENGTH` before committing; if it exceeds about 5 m, note the figure in the summary and keep it — correctness over compactness — rather than trimming the margin below 0.15.

    Leave `RAIL_TRAVEL`, `RAIL_CENTER_X`, the end-stop block positions, `CARRIAGE_BASE_WIDTH`/`CARRIAGE_BLOCK_WIDTH` and every other exported constant untouched. `RIG_FOOTPRINT_WIDTH` already derives from `TRACK_LENGTH`, so the floor grows automatically — confirm it still fully contains the track.

    Update `src/scene/rail-rig-geometry.test.ts`:
    - keep the `RAIL_TRAVEL` is-still-±1.5 assertion verbatim;
    - keep the floor-contains-the-track assertion verbatim;
    - replace the two carriage-derived assertions with footprint-derived ones: at each travel extreme the track must extend at least `ROBOT_FOOTPRINT_HALF_WIDTH_X + TRACK_END_MARGIN` past the limit, and `TRACK_OVERHANG` must be strictly greater than the old carriage-derived figure it replaces (so this specific regression cannot come back);
    - replace the `TRACK_END_MARGIN >= 0.25` assertion, which encoded the superseded derivation, with one asserting the margin sits on top of the measured footprint rather than standing alone: `TRACK_OVERHANG - TRACK_END_MARGIN === ROBOT_FOOTPRINT_HALF_WIDTH_X`.

    Sanity-check that `src/collision/pose-collision.ts` still behaves as intended: it imports `TRACK_LENGTH` to build the rig's collision AABB, so a longer track means a slightly larger rail-collision envelope. Run the collision suite and confirm nothing that used to be safe is now refused; if anything flips, report it rather than loosening the gate.
  </action>
  <verify>
    <automated>npx vitest run src/scene src/collision && npx tsc -b</automated>
  </verify>
  <done>`TRACK_OVERHANG` derives from the measured `ROBOT_FOOTPRINT_HALF_WIDTH_X`, the geometry suite asserts the footprint-derived margin at both extremes, `RAIL_TRAVEL` is still ±1.5 m, and the collision suite is unchanged-green.</done>
</task>

<task type="auto">
  <name>Task 5: Add sliders for the 6 joints and the rail, through the same safety gate</name>
  <files>src/ui/tabs/DashboardPanel.tsx, src/ui/dashboard-input-hardening.test.ts</files>
  <read_first>src/ui/tabs/DashboardPanel.tsx, src/ui/ScrubControl.tsx, src/ui/manual-jog.ts</read_first>
  <action>
    Extend the `NumberField` component (rename it `JogControl` if that reads better, updating both call sites) so each axis renders a slider directly under its existing label row and typed input:

    - a plain `<input type="range">`, matching `ScrubControl.tsx`'s documented reason for a native range element over a registry Slider primitive, and styled with the same UI-SPEC custom properties already used in this file — no new colour token, and never the Accent tone reserved for the nav cube and Reset View;
    - `min`/`max` from the same `jointLimitsDegrees(i)` / `railLimitsMillimetres()` values the typed field's hint already displays — do not restate any bound;
    - `step={0.5}` for joints (degrees) and `step={5}` for the rail (millimetres);
    - `value={value}` — the store-derived number, NOT the local `draft`, so the thumb always reflects the pose the robot is actually holding;
    - `onChange` dispatches the SAME `onCommit(Number(event.target.value))` the typed field uses, so it lands on `setManualJointAngle`/`setManualRailPos` → `commitManualJog` → `validateManualPose`. There is no second write path and no bypass;
    - `aria-label` naming the axis and its unit, so the slider and the typed field are independently identifiable.

    A rejected drag position is correct behaviour, not a bug: `commitManualJog` leaves `manualJog` untouched, the controlled `value` therefore does not move, and the thumb visibly snaps back to the last safe pose while `manualJogError` explains why. Do not add any smoothing, deferral, or optimistic local slider state that would let the thumb travel through a refused region.

    Because commits fire per drag tick, confirm the existing error row is not visually jarring during a drag across a refused band — the message is already cleared by the next accepted commit, so no new clearing logic is needed.

    Extend `src/ui/dashboard-input-hardening.test.ts` with assertions that `DashboardPanel.tsx` renders a range input, that every range input's change handler routes to the same `onCommit` the typed field uses, and re-assert (now covering the sliders too) that the file dispatches no manual-pose store action other than `setManualJointAngle`, `setManualRailPos`, `clearManualJog`, and `homeManualPose`.
  </action>
  <verify>
    <automated>npx vitest run src/ui && npx tsc -b</automated>
  </verify>
  <done>All 6 joints and the rail have a slider covering the same range and units as the typed field, bound to the store value, committing through the same gated action. The structural guard proves no second write path into `manualJog` exists.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Add the Home/Reset Position action and button</name>
  <files>src/store/cellStore.ts, src/store/cellStore.test.ts, src/ui/tabs/DashboardPanel.tsx</files>
  <read_first>src/store/cellStore.ts (`commitManualJog`, `setManualJointAngle`, `play`, `pause`), src/store/cellStore.test.ts, src/ui/tabs/DashboardPanel.tsx</read_first>
  <behavior>
    - `homeManualPose()` from any starting state leaves `manualJog.joints` deep-equal to `UR3E_PARKED_POSE` and `manualJog.railPos` equal to `RAIL_CENTER_X`, in ONE store transition.
    - `homeManualPose()` while `isPlaying` is true leaves `isPlaying` false.
    - `homeManualPose()` clears `manualJogError`.
    - `homeManualPose()` called with a trajectory loaded and mid-scrub does not reset `scrubFraction`, `playbackStarted`, `trajectory`, `toolpath`, or `uploadedJobs` — it parks the robot, it does not unload the job.
    - `validateManualPose` is still consulted: the committed home pose passes the gate rather than skipping it.
  </behavior>
  <action>
    Add `homeManualPose: () => void` to `CellState` and implement it in the store body, next to `setManualJointAngle`/`setManualRailPos`:
    - call `get().pause()` first, so the playback clock stops before the pose is swapped and the displayed running/paused state cannot disagree with the parked robot the user is now looking at (the clock keeps advancing while `manualJog` visually overrides the rendered pose, which is exactly the silent disagreement this call removes);
    - then build `{ joints: clampJointAngles(UR3E_PARKED_POSE), railPos: clampRailPosition(RAIL_CENTER_X) }` and pass it to the existing `commitManualJog` — the same gated path everything else uses. Route through the clamps for consistency with the other two setters even though both values are already in range.
    Document in the field's doc comment that it deliberately does NOT touch `scrubFraction`, `trajectory`, or `playbackStarted`: this is a recovery action usable mid-simulation, not a job reset, and pressing Play afterwards already hands control back to the toolpath because `play()` calls `clearManualJog()`.

    Add the matching cases to `src/store/cellStore.test.ts` covering every bullet in this task's `<behavior>` block, following the existing manual-jog test conventions in that file.

    In `DashboardPanel.tsx`, add a "Home / Reset Position" `Button` in the `PanelSection` for the rail (or in its own section directly beneath it) that dispatches `homeManualPose`. It must be visible and enabled at all times — including while a job is playing or paused — since recovering a robot mid-run is the entire point. Use the existing `Button` import and the same `variant="secondary"` treatment as the existing "Return to toolpath" button; add no new colour. Keep "Return to toolpath" where it is — the two do different things (one hands control back to the trajectory, one parks the robot) and both are wanted.
  </action>
  <verify>
    <automated>npx vitest run src/store/cellStore.test.ts src/ui && npx tsc -b</automated>
  </verify>
  <done>One `homeManualPose()` call parks all 6 joints at `UR3E_PARKED_POSE` and the rail at `RAIL_CENTER_X`, stops playback, clears the error, leaves the loaded job and scrub position intact, and passes through `validateManualPose`. The Dashboard button dispatches it and stays enabled during playback.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Live browser verification of all four fixes</name>
  <what-built>
    All four items: the manual-input drift fix (Tasks 1–2), the measured-footprint rail track fix (Tasks 3–4), joint/rail sliders (Task 5), and the Home/Reset Position button (Task 6). Full suite, `npx tsc -b`, and `npm run build` all green.
  </what-built>
  <how-to-verify>
    Run `npm run dev` and open the printed URL. This project has no browser automation, so these five checks require the human who reported the defects.

    1. **Off-by-one (item 1 — the priority).** Open the Dashboard. Note the Base field's current value. Type an absolute target a good distance away (e.g. `200`), press Enter. The field must read exactly `200.0` and stay there, and the robot must hold exactly that angle — not `201`. Repeat on every one of the six joint fields and on the rail field (try `-1200`). Then repeat WITHOUT pressing Enter — click away onto the 3D scene to blur instead. Then, with a field focused, spin the mouse wheel over it and press Up/Down arrow keys: the value must not change at all.
    2. **Refusal still reverts.** Drive the Shoulder field progressively more negative (−60, −120, −200, −250, −270). At some point an entry must be refused: the red-toned message appears, the field snaps back to the value the robot is holding, and the robot does not move. Type a valid value afterwards — the message must clear.
    3. **Rail model (item 2).** Type `-1500` into the rail Position field, press Enter, then `1500`. At BOTH extremes the carriage AND the whole robot arm must sit clearly within the visible rail track, with track still showing beyond them. Orbit and zoom to confirm from more than one angle. Compare against `Robot Problem.png` at the project root — that framing must now look correct.
    4. **Sliders (item 3).** Drag each of the 7 sliders. The matching typed field must track the drag live. Drag a joint into a region the safety gate refuses — the thumb must snap back and the error must appear, i.e. the slider must NOT be able to reach a pose the typed field would refuse.
    5. **Home/Reset (item 4).** Load a sample, press Play, and while it is running click "Home / Reset Position". All six joints and the rail must jump to the parked pose in one click, the playback control must show as paused, and the typed fields and sliders must all update to the parked values. Press Play again — the robot must return to the toolpath and resume normally.

    Also confirm nothing regressed: the compact Printing/Milling toggle with the Upload .gcode button is still at the top of the scene, per-mode upload/auto-load still works across a mode switch, the scrub bar still appears only after Play, and playback/scrubbing behaves as before.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what is still wrong, with a screenshot for anything visual.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| human keyboard/pointer → manual-jog store actions | Typed text and slider drags cross into commanded robot state; the only untrusted input surface this task touches |
| shipped URDF/STL assets on disk → build-time measurement | Task 3's test reads binary asset files and derives constants baked into the scene geometry |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QYM-01 | Tampering | Task 5 slider `onChange` → `manualJog` | high | mitigate | Slider dispatches the identical `setManualJointAngle`/`setManualRailPos` actions as the typed field, so `commitManualJog` → `validateManualPose` runs on every drag tick; `dashboard-input-hardening.test.ts` structurally asserts `DashboardPanel.tsx` writes no other manual-pose store field |
| T-QYM-02 | Tampering | Task 6 `homeManualPose` | medium | mitigate | Routes through the existing `commitManualJog`, never `set({ manualJog })` directly; `cellStore.test.ts` asserts the gate is still consulted |
| T-QYM-03 | Denial of Service | Task 3 binary STL parser reading fixed-size local assets | low | accept | Test-time only, reads seven small (<110 KB) files shipped in this repo; never runs in the browser bundle and never parses user input |
| T-QYM-04 | Tampering | `robot-footprint.ts` constants drifting from the shipped meshes | medium | mitigate | The measuring test re-derives each constant from the assets on every run and fails on any mismatch beyond 1e-6 |
| T-QYM-05 | Information Disclosure | none — no network, no storage, no new dependency | low | accept | This task adds no npm package, no fetch, and no persistence; the whole change is local client-side computation |
| T-QYM-SC | Tampering | npm/pip/cargo installs | high | accept | No package-manager install task exists in this plan — the deterministic reproduction for item 1 is achieved without jsdom or testing-library, so no legitimacy checkpoint is required |
</threat_model>

<verification>
Run after every task, and once more before the human checkpoint:

```
npx vitest run
npx tsc -b
npm run build
```

The full suite stood at 1127/1127 after 260816-nup — it must be green again, with the new tests added, and with the two `rail-rig-geometry.test.ts` assertions replaced (Task 4) rather than deleted.
</verification>

<success_criteria>
- Typing an absolute value into any of the 7 manual-jog fields lands the robot on exactly that value, with the field text and the store proven equal by `src/ui/manual-input-drift.test.ts` across all six joints and the rail.
- Neither a mouse wheel nor an arrow key can nudge a manual-jog field, and the structural guard proves the spinner-capable input declaration is gone.
- The rail track's overhang beyond each travel limit derives from a measurement of the shipped UR3e assets, asserted against a fresh measurement on every test run.
- At ±1.5 m the robot's worst-case rendered footprint sits inside the visible track — confirmed geometrically by `rail-rig-geometry.test.ts` and visually at the human checkpoint.
- The camera-framing and unit-scale hypotheses are each recorded as ruled in or out, with the files/measurements that settled them.
- All 7 axes have sliders that cannot bypass `validateManualPose`.
- One Home/Reset click parks the robot and stops the clock, mid-run, through the same gated commit path.
- Nothing from 260816-m6d or 260816-nup regressed.
</success_criteria>

<output>
Create `.planning/quick/260816-qym-fix-off-by-one-manual-input-bug-root-cau/260816-qym-SUMMARY.md` when done.

The summary MUST record, as first-class findings rather than asides:
- the measured `UR3E_BASE_MESH_RADIUS_M`, `UR3E_MAX_LINK_HALF_EXTENT_M` and `ROBOT_FOOTPRINT_HALF_WIDTH_X`, and the resulting `TRACK_LENGTH`;
- the camera-framing hypothesis verdict and which files settled it;
- the unit-scale hypothesis verdict;
- which of the two off-by-one leads (stale closure / native spinner) the evidence actually supports, and whether both were genuine defects.

Copy the summary out of the worktree BEFORE removing it — the previous two quick tasks both lost their executor-written summary to a `git worktree remove --force` and had to reconstruct it.
</output>

