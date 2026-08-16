---
phase: quick
plan: 260816-qym
subsystem: manual-control-input
tags: [react, zustand, stale-closure, stl-parsing, forward-kinematics, ui]

requires:
  - phase: quick 260816-nup
    provides: manualJog/manualJogError, commitManualJog/validateManualPose gate, NumberField onBlur/Enter commit cadence, grown-but-still-wrong RailRig track overhang
provides:
  - src/ui/manual-pose-readback.ts (single joint/rail display-value derivation)
  - src/ui/number-field-commit.ts (drift-free commit primitive, live store read-back)
  - src/scene/robot-footprint.ts (measured UR3e footprint constants, zero-import)
  - Re-derived RailRig.TRACK_OVERHANG/TRACK_LENGTH from the measured footprint
  - JogControl (renamed NumberField) with a bound slider per axis
  - cellStore.homeManualPose() + Dashboard "Home / Reset Position" button
affects:
  - src/ui/tabs/DashboardPanel.tsx
  - src/store/cellStore.ts
  - src/scene/RailRig.tsx

actuals:
  tokens: 14413
  tasks: 6
  commits: 6

tech-stack:
  added: []
  patterns:
    - "React 'adjust state when a prop changes' render-time pattern (no useEffect) for syncing a controlled field's draft to external store writes"
    - "Binary STL parsing (80-byte header, uint32 triangle count at offset 80, 50 bytes/triangle) as a build/test-time-only measurement, never shipped to the browser bundle"
    - "Zero-import measured-constants module (robot-footprint.ts) as the pattern for feeding a real asset measurement into a module that must not gain a new edge into an existing import cycle"

key-files:
  created:
    - src/ui/manual-pose-readback.ts
    - src/ui/number-field-commit.ts
    - src/ui/manual-input-drift.test.ts
    - src/ui/dashboard-input-hardening.test.ts
    - src/scene/robot-footprint.ts
    - src/scene/robot-footprint.test.ts
  modified:
    - src/ui/tabs/DashboardPanel.tsx
    - src/scene/RailRig.tsx
    - src/scene/rail-rig-geometry.test.ts
    - src/store/cellStore.ts
    - src/store/cellStore.test.ts

key-decisions:
  - "Both off-by-one leads were real, independently-confirmed defects — see the dedicated finding section below, not a single-cause fix."
  - "TRACK_END_MARGIN reduced 0.3 -> 0.2 deliberately: it now stacks on a real measured worst-case footprint instead of an under-measured carriage-box stand-in, so real clearance still increased despite the smaller margin literal."
  - "TRACK_LENGTH grew to ~5.07m, over the plan's own 5m soft-flag threshold — kept rather than trimmed, correctness over compactness, per the plan's explicit instruction."
  - "Camera-framing hypothesis ruled OUT: neither CameraResetListener.tsx nor ToolpathCameraFit.tsx translates the camera/OrbitControls target with the carriage's rail position — both key off resetToken/toolpathLoadStatus only. The track-end framing in Robot Problem.png was the real geometric mesh end, not a camera crop, confirming Task 4's fix was the correct target."
  - "Unit-scale hypothesis ruled OUT: the base mesh's measured radial half-extent (0.105m) falls inside the ~0.04-0.12m band consistent with the UR3e's published ~128mm base diameter — the shipped STL assets are metres-native, agreeing with this project's metres-native rail/kinematics geometry. No unit mismatch exists."

requirements-completed: [DASH-01, DASH-03, SCENE-04]

coverage:
  - id: D1
    description: "Typing an absolute value into any of the 7 manual-jog fields (6 joints + rail) lands the robot on exactly that value, with no drift and no stale-value snap-back"
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "src/ui/manual-input-drift.test.ts — full suite (14 cases across all 6 joints + rail, including refusal/unparseable/clamp cases)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 7 checkpoint item 1 — live npm run dev typed-entry pass"
        status: unknown
    human_judgment: true
    rationale: "Task 1's test proves the STORE-level round-trip is drift-free against the real useCellStore, but the reported defect was first observed live in a browser; a human must confirm the fix holds end-to-end in the actual rendered UI (Task 7, not yet run)."
  - id: D2
    description: "No mouse wheel or arrow key can nudge a manual-jog field's value (native numeric spinner surface removed)"
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "src/ui/dashboard-input-hardening.test.ts — 'contains zero occurrences of the spinner-capable native input type declaration'"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 7 checkpoint item 1 — live wheel/arrow-key browser check"
        status: unknown
    human_judgment: true
    rationale: "A structural guard proves the source no longer declares a native number input, but wheel/arrow-key behavior is a real-browser interaction that only a human driving an actual browser can confirm is inert (Task 7, not yet run)."
  - id: D3
    description: "A refused manual-jog commit reverts the field to the value the robot is actually holding, with the rejection message shown"
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "src/ui/manual-input-drift.test.ts — refusal case; src/store/cellStore.test.ts — manualJogError describe block"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rail track's visible length derives from a MEASURED robot footprint (shipped STL assets + FK sweep), not the abstract carriage-box constant, and the robot stays visibly over the track at both ±1.5m travel extremes"
    requirement: SCENE-04
    verification:
      - kind: unit
        ref: "src/scene/robot-footprint.test.ts (7 cases) + src/scene/rail-rig-geometry.test.ts (footprint-derived assertions)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 7 checkpoint item 3 — live visual check against Robot Problem.png"
        status: unknown
    human_judgment: true
    rationale: "The geometry is mechanically proven (measured constants, sweep-derived margin, regression guard against the superseded carriage-derived figure), but 'looks correct in the rendered 3D scene, from more than one camera angle' is inherently a visual judgment only a human can make (Task 7, not yet run)."
  - id: D5
    description: "All 6 joints and the rail have a slider bound to the store value, committing through the identical gated onCommit path as the typed field — no bypass"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "src/ui/dashboard-input-hardening.test.ts — Task 5 describe block (range input presence, shared onCommit handler, store-action allowlist)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 7 checkpoint item 4 — live drag-into-refused-region check"
        status: unknown
    human_judgment: true
    rationale: "The structural guard proves there is no second write path, but confirming the thumb visibly snaps back on a refused drag (rather than merely not-crashing) requires a human watching the live UI (Task 7, not yet run)."
  - id: D6
    description: "One Home/Reset click parks all 6 joints and the rail, stops the clock, and is usable mid-playback, through the same gated commit path"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "src/store/cellStore.test.ts — homeManualPose describe block (6 cases covering every behaviour bullet)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 7 checkpoint item 5 — live mid-playback Home/Reset check"
        status: unknown
    human_judgment: true
    rationale: "Store-level behaviour is fully proven; visually confirming the fields/sliders update and playback control shows paused requires a human in the live UI (Task 7, not yet run)."

duration: not precisely recorded (single continuous execution session, Tasks 1-6)
completed: 2026-08-16
status: halted
---

# Quick Task 260816-qym: Fix off-by-one manual-input bug at its root cause Summary

Root-caused and fixed the manual-jog input drift at two independently-confirmed defect sites (a stale-closure display bug and the native number-input spinner surface), replaced the rail track's overhang derivation with a real measurement of the shipped UR3e STL assets via an FK keypoint sweep, added bound sliders for all 7 manual-jog axes, and added a gated Home/Reset Position action — all six automated tasks complete and green; the plan's final task (Task 7, a blocking human-verify browser checkpoint) has NOT been run and requires the actual human user.

## Performance

- **Duration:** not precisely recorded (single continuous session)
- **Completed:** 2026-08-16
- **Tasks:** 6 of 7 (Tasks 1-6 complete; Task 7 is a blocking human-verify checkpoint, not yet run)
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments

- **Task 1 — Drift-free manual-input commit primitive (U-1).** `src/ui/manual-pose-readback.ts` (single joint/rail display-value derivation) and `src/ui/number-field-commit.ts` (`commitNumberFieldDraft`, reading the TRUE post-commit value live from the store instead of a stale pre-edit render closure) proven end-to-end against the real `useCellStore` in `src/ui/manual-input-drift.test.ts` (14 cases: all 6 joints + rail, accepted/refused/unparseable/clamped). Committed as `a0c774b`.
- **Task 2 — Rewired the Dashboard's fields, removed the native spinner (U-1).** `DashboardPanel.tsx`'s `NumberField` now delegates its commit body to `commitNumberFieldDraft`, gained a render-time (no `useEffect`) re-sync so external store writes reach the field, and declared its inputs as decimal-mode TEXT entry instead of `type="number"` — eliminating the wheel/arrow-key spinner surface entirely. Both the reactive `value` prop and the `readCommitted` closure now read the SAME `manual-pose-readback` selector. `src/ui/dashboard-input-hardening.test.ts` structurally guards all of this. Committed as `e234f94`.
- **Task 3 — Measured the robot's real rendered footprint (U-2).** `src/scene/robot-footprint.ts` holds three constants derived by `robot-footprint.test.ts` from the seven shipped binary STL collision meshes (parsed by hand: 80-byte header, uint32 triangle count, 50 bytes/triangle) plus an FK keypoint sweep of joints 0-3 across `UR3E_JOINT_LIMITS` (9 steps/joint, wrists 2/3 parked). The module declares zero imports (test-enforced) so it adds no edge into the pre-existing `RailRig -> cellStore -> compile -> toolpath-anchor -> RailRig` cycle. Committed as `0d55dcc`.
- **Task 4 — Re-derived the rail track length (U-2).** `RailRig.tsx`'s `TRACK_OVERHANG` now reads `ROBOT_FOOTPRINT_HALF_WIDTH_X` (the measured worst-case reach) instead of `CARRIAGE_BASE_WIDTH / 2` (the mounting plate's own half-width — the wrong object, root cause of the first fix attempt's failure). `rail-rig-geometry.test.ts`'s carriage-derived assertions were replaced with footprint-derived ones plus a regression guard against the superseded figure. Collision suite re-confirmed unchanged-green. Committed as `b795f07`.
- **Task 5 — Sliders for all 7 axes (U-3).** `NumberField` renamed `JogControl`, now rendering a bound `<input type="range">` under each typed field, `value` sourced from the store (not the local draft) and `onChange` dispatching the SAME `onCommit` the typed field uses — no second write path. Committed as `ba0916a`.
- **Task 6 — Home/Reset Position (U-4).** `cellStore.homeManualPose()` pauses playback first, then parks all 6 joints at `UR3E_PARKED_POSE` and the rail at `RAIL_CENTER_X` through the existing `commitManualJog`/`validateManualPose` gate — deliberately leaving `scrubFraction`/`trajectory`/`toolpath`/`uploadedJobs` untouched (a recovery action, not a job reset). Dashboard gained an always-enabled "Home / Reset Position" button. Committed as `64163f5`.

## Task Commits

1. **Task 1: Drift-free manual-input commit primitive** - `a0c774b` (feat)
2. **Task 2: Rewire Dashboard fields, remove native spinner** - `e234f94` (feat)
3. **Task 3: Measure robot's real rendered footprint** - `0d55dcc` (feat)
4. **Task 4: Re-derive rail track length from measured footprint** - `b795f07` (fix)
5. **Task 5: Add sliders for all 6 joints and the rail** - `ba0916a` (feat)
6. **Task 6: Add Home/Reset Position action and button** - `64163f5` (feat)

_No TDD refactor commits were needed — every GREEN pass landed clean on the first implementation attempt._

## Files Created/Modified

- `src/ui/manual-pose-readback.ts` - single derivation of a manual-jog axis's displayed value (Task 1)
- `src/ui/number-field-commit.ts` - drift-free commit primitive reading the live post-commit store value (Task 1)
- `src/ui/manual-input-drift.test.ts` - end-to-end store-level drift regression suite (Task 1)
- `src/ui/dashboard-input-hardening.test.ts` - structural guards: no native spinner, no bypass write path, slider wiring (Tasks 2, 5)
- `src/ui/tabs/DashboardPanel.tsx` - `JogControl` (renamed from `NumberField`) with slider + Home/Reset button (Tasks 2, 5, 6)
- `src/scene/robot-footprint.ts` - measured UR3e footprint constants, zero imports (Task 3)
- `src/scene/robot-footprint.test.ts` - STL parser + FK sweep measurement/verification suite (Task 3)
- `src/scene/RailRig.tsx` - `TRACK_OVERHANG`/`TRACK_END_MARGIN` re-derived from the measured footprint (Task 4)
- `src/scene/rail-rig-geometry.test.ts` - footprint-derived geometry assertions, regression guard (Task 4)
- `src/store/cellStore.ts` - `homeManualPose()` action (Task 6)
- `src/store/cellStore.test.ts` - `homeManualPose` behaviour suite (Task 6)

## Measured Findings (required first-class recording per PLAN.md's `<output>` spec)

**Measured constants (`src/scene/robot-footprint.ts`, Task 3):**

| Constant | Value | Meaning |
|---|---|---|
| `UR3E_BASE_MESH_RADIUS_M` | `0.10499331070699057` m | Base link collision mesh's radial half-extent about its own origin |
| `UR3E_MAX_LINK_HALF_EXTENT_M` | `0.28589462096533896` m | Largest radial half-extent across all 7 collision link meshes |
| `ROBOT_FOOTPRINT_HALF_WIDTH_X` | `0.8347446209653391` m | Worst-case mount-relative footprint half-width along world X (joints 0-3 swept over `UR3E_JOINT_LIMITS`, 9 steps/joint, wrists 2/3 parked, plus the measured link half-extent) |

**Resulting `TRACK_LENGTH` (`src/scene/RailRig.tsx`, Task 4):** `RAIL_TRAVEL.max - RAIL_TRAVEL.min + TRACK_OVERHANG * 2` = `3 + 2 * (0.8347446209653391 + 0.2)` ≈ **5.0695 m**. This exceeds the plan's own ~5m soft-flag threshold; per the plan's explicit instruction ("correctness over compactness"), the figure was kept rather than the margin trimmed below 0.15.

**Camera-framing hypothesis — RULED OUT.** Inspected `src/scene/CellScene.tsx`, `src/scene/camera-defaults.ts`, `src/scene/CameraResetListener.tsx`, and `src/scene/ToolpathCameraFit.tsx`. Neither camera-affecting component reacts to the carriage's rail position: `CameraResetListener` keys only on `resetToken` and always restores the fixed `DEFAULT_CAMERA_POSITION`/`DEFAULT_CAMERA_TARGET`; `ToolpathCameraFit` keys only on `toolpathLoadStatus` and fits to the parsed toolpath's own bounds (or defers to the same fixed reset framing for a mode-sync reselection) — neither ever reads `railPos`/`trajectory.railPos`/`manualJog.railPos`. The camera framing is therefore entirely fixed and independent of where the carriage sits; the track-end visible in `Robot Problem.png` at the travel extremes was the real geometric end of the rendered mesh, not an artifact of camera cropping. This confirms Task 4's geometry fix was the correct target, not a camera-side workaround.

**Unit-scale hypothesis — RULED OUT.** The base mesh's measured radial half-extent (0.105m) falls inside the 0.04-0.12m band consistent with the UR3e's published ~128mm base diameter (`robot-footprint.test.ts`'s SCALE CHECK, passing). The shipped STL collision assets are confirmed metres-native, agreeing with this project's already metres-native rail travel (`src/kinematics/rail.ts`) and DH kinematics (`ur3e-dh.ts`) constants. No unit mismatch exists anywhere in the asset pipeline.

**Which off-by-one lead the evidence supports — BOTH were genuine, independently-confirmed defects, not a single-cause bug:**

1. **Stale-closure defect (CONFIRMED via targeted reproduction against the real store, not merely inferred):** the pre-fix `NumberField.commitDraft` body called `setDraft(value.toFixed(1))` using the `value` PROP CAPTURED IN THE CURRENT RENDER'S CLOSURE — captured before `onCommit` runs, and (since React batches the resulting re-render) still stale by the time `setDraft` executes. An empirical reproduction (built and run against the real store during this session, then deleted — not part of the shipped diff) confirmed: after committing `"200"` to a field previously holding `180`, the STORE correctly held `200`, but the OLD code's `setDraft` would have displayed `"180.0"` — the full PRE-EDIT value, not a `+1` drift. This is a genuine, reproducible defect in DISPLAY fidelity (the number shown could never be trusted to match what the robot actually held after ANY commit — accepted, refused, or clamped), and a real risk vector for compounding drift if a user re-edited starting from that wrong displayed baseline.
2. **Native spinner defect (the lead that most directly explains a literal "+1 unit above typed" landing):** a focused native `<input type="number">` accepts wheel-scroll and Up/Down-arrow-key nudges of its OWN default step (1) entirely outside React's control. Because this project's commit cadence is onBlur/Enter (not onChange), a user typing `"200"` and then, while the field is still focused (a natural cursor position immediately after typing), incidentally scrolling the mouse wheel by one tick before tabbing away would see the DOM value silently become `"201"` — which then commits as the "typed" value on blur. This is a well-documented, real browser behavior, and precisely matches the reported symptom's shape (the ROBOT itself landing 1 unit high, not merely a display glitch).

Task 2 closes BOTH leads in one pass: the commit body no longer trusts a captured `value` (closes #1), and the spinner surface is removed entirely by declaring the fields as decimal-mode text instead of a numeric input (closes #2).

## Decisions Made

- Renamed `NumberField` to `JogControl` in Task 5 once it grew a bound slider — the component is no longer "just a number field."
- `TRACK_END_MARGIN` reduced from `0.3` to `0.2` in Task 4: it now stacks on a real measured worst-case extent rather than an under-measured carriage-box stand-in, so total real clearance still increased despite the smaller margin literal — documented in `RailRig.tsx`'s own doc comment to prevent a future "restore the bigger number" regression.
- `robot-footprint.ts` deliberately declares zero module-level imports (test-enforced) to avoid adding a new edge into the pre-existing `RailRig -> cellStore -> compile -> toolpath-anchor -> RailRig` module cycle.
- Home/Reset (`homeManualPose`) calls `pause()` before swapping the pose, specifically so the displayed playing/paused UI state cannot ever disagree with the parked robot the user sees on screen.

## Deviations from Plan

None — all six automated tasks executed as written, matching the plan's `<action>` bodies task-for-task. No Rule 1-4 auto-fixes were needed; every task's `<verify>` passed on the first implementation attempt with no debugging iteration beyond the expected TDD RED-phase value discovery in Task 3 (the plan explicitly directs measuring real values via the test itself, which is what happened — not a bug fix).

## Issues Encountered

**Full-suite test count discrepancy (informational, not a defect):** the prior quick task's summary (`260816-nup-SUMMARY.md`) recorded "1127/1127 tests" on the post-merge main branch. This worktree's actual test suite — verified via `git ls-tree` at this plan's own base commit (`ea580da`) — contains 31 test files / ~377 individual test cases before this plan's additions, growing to 34 files / 411 cases after. The two figures describe different tree states (a broader merged-main snapshot vs. this specific worktree's branch), not a regression introduced by this plan; the relevant, actually-verified fact is that THIS worktree's full suite is 100% green (411/411) after every task, `npx tsc -b` is clean, and `npm run build` succeeds.

## User Setup Required

None — no external service configuration required.

## Task 7 — NOT RUN: Live human browser verification (blocking checkpoint)

Per this plan's own frontmatter (`autonomous: false`) and the executor's explicit operating constraints for this session, Task 7's `gate="blocking"` `checkpoint:human-verify` was NOT attempted, faked, or auto-approved. This environment has no browser automation tooling (confirmed by both prior quick tasks' own summaries). All five of Task 7's checks remain outstanding and require the actual human user running `npm run dev`:

1. **Off-by-one (item 1 — the priority).** Type an absolute target into each of the 6 joint fields and the rail field, press Enter; the field must read exactly the typed value and stay there, matching the robot's actual held angle. Repeat via blur-by-clicking-the-scene instead of Enter. With a field focused, confirm mouse wheel and Up/Down arrow keys do nothing.
2. **Refusal still reverts.** Drive the Shoulder field progressively more negative until an entry is refused — the error message appears, the field snaps back to the value the robot is holding, the robot does not move; a subsequent valid entry clears the message.
3. **Rail model (item 2).** At both `±1500mm` extremes, the carriage AND the whole robot arm must sit clearly within the visible rail track from multiple camera angles, matching the corrected framing against `Robot Problem.png`.
4. **Sliders (item 3).** Each of the 7 sliders must track drag live and match the typed field; dragging into a refused region must snap the thumb back with the error shown.
5. **Home/Reset (item 4).** Mid-playback, one click must park all 6 joints + rail, show paused, update every field/slider to the parked values, and Play afterward must resume the toolpath normally.

Also to be reconfirmed live: the compact Printing/Milling toggle with Upload .gcode stays at the top of the scene, per-mode upload/auto-load still works across a mode switch, and the scrub bar still appears only after Play.

**Automated verification already passed, ahead of the human checkpoint (per PLAN.md's `<verification>` block):**
- `npx vitest run` — 411/411 PASSED (this worktree's full suite, including all new tests from this plan).
- `npx tsc -b` — PASSED, clean.
- `npm run build` — PASSED, clean production build (pre-existing >500kB chunk-size warning only, not a new regression).

## Next Phase Readiness

- All code changes for this quick task are complete, committed, and self-consistent (six atomic commits, `a0c774b` through `64163f5`).
- **Blocked on Task 7.** This SUMMARY is written with `status: halted` per the harness's own instruction, so the orchestrator can route the live browser verification to the actual human user before this quick task is marked complete. Once Task 7's five checks pass (or produce follow-up findings), a continuation should re-run this plan's final `<verification>` block once more and update this SUMMARY's `status` to `complete`.

---
*Phase: quick*
*Completed: 2026-08-16 (Tasks 1-6; Task 7 pending human verification)*

## Self-Check: PASSED

All 6 created files verified present on disk; all 6 task commit hashes (`a0c774b`, `e234f94`, `0d55dcc`, `b795f07`, `ba0916a`, `64163f5`) verified present in `git log --oneline --all`. No missing items.
