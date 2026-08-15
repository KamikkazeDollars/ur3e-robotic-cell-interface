---
phase: 04-playback-engine
verified: 2026-08-15T17:45:00Z
status: human_needed
score: 18/20 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 17/20
  gaps_closed:
    - "selectSample leaves isPlaying false and livePlayback.fraction at 0 on every one of its store writes, so choosing a new sample mid-playback stops the clock instead of animating a stale position against a fresh trajectory (04-01-PLAN.md must_haves.truths)."
  gaps_remaining: []
  regressions: []
deferred: []
behavior_unverified_items:
  - truth: "User can press play and watch the UR3e animate continuously along the full toolpath in real time, synced to the visible trajectory line (ROADMAP Phase 4 Success Criterion 1)."
    test: "Run `npm run dev`, select a bundled sample, press Play."
    expected: "The UR3e and its rail carriage animate continuously from the parked pose along the whole toolpath with no visible stepping or stutter, the teal scrub marker rides the drawn line in step with the flange, the slider handle and percentage readout advance while it runs, and the button shows a pause icon while running and a play icon once the run completes."
    why_human: "Continuous, stutter-free visual motion and 'synced to the visible trajectory line' are runtime-rendering qualities no headless Vitest assertion can observe — this project's test environment has no jsdom/RTL/WebGL rendering harness. The underlying state machine (fraction reaches 1, monotonic, isPlaying returns to false) IS covered by a headless test (src/playback/clock-step.test.ts's 'a full play run...' case using a real compiled trajectory), but that test uses UNIFORM_FRACTION_MAPPING rather than the production buildDurationMapping (04-REVIEW.md WR-03), so the exact production integration is not exercised end-to-end by any automated test either."
  - truth: "During playback, the trajectory highlight and TCP marker track the robot's current position smoothly, driven by an imperative render loop rather than per-frame React state updates (ROADMAP Phase 4 Success Criterion 2)."
    test: "Load a sample, press Play, and watch the arm and the teal scrub marker while the run plays; then pause and drag the slider slowly end to end."
    expected: "The arm and the marker move smoothly and continuously with no per-sample ticking or stair-stepping; the marker stays on the drawn toolpath and the flange stays on the marker throughout."
    why_human: "The 'imperative render loop rather than per-frame React state' architectural half of this criterion IS statically verified — RobotPose.tsx and ScrubMarker.tsx both read trajectory/livePlayback via useCellStore.getState() inside useFrame (never a reactive selector for the per-frame position), and livePlayback is a referentially-stable object mutated by direct property assignment, confirmed never replaced via set() (unit-tested). Only the 'smoothly'/'no stepping' visual-continuity half of the claim remains unverifiable without rendering the scene."
human_verification:
  - test: "Run `npm run dev`, select a bundled sample, press Play."
    expected: "The UR3e and rail carriage animate continuously along the whole toolpath, holding the final pose at the end; the marker rides the line in step with the flange; the slider and percentage readout advance live; the button icon toggles Play/Pause correctly."
    why_human: "Visual animation smoothness and cross-component sync cannot be confirmed by this project's Vitest suite (no jsdom/rendering harness)."
  - test: "With a sample loaded, press Play, then drag the scrub slider while the robot is moving."
    expected: "Playback stops immediately at the dragged position, the button returns to the play icon, and the robot stays where the drag left it until Play is pressed again (D-04)."
    why_human: "The actual drag-to-pause gesture and its visual seek result require in-browser interaction."
  - test: "Load the milling sample and press Play."
    expected: "The robot covers the non-cutting positioning moves noticeably faster than the cutting passes, and the whole run still finishes in about ten seconds — the same total as the printing sample (D-02)."
    why_human: "Relative visual traverse speed and perceived total duration are not assertable from a headless unit test."
  - test: "Load a sample and press Play; then pause and drag the slider slowly end to end."
    expected: "The arm and marker move smoothly and continuously with no per-step ticking during playback; the marker stays on the drawn toolpath and the flange stays on the marker throughout manual scrubbing, matching Phase 3's behaviour."
    why_human: "Continuous joint-space-blended motion quality and marker/flange visual agreement require rendering the scene."
---

# Phase 4: Playback Engine Verification Report

**Phase Goal:** Users can press play and watch the UR3e execute the full toolpath in real time, completing the "must not fail" core simulation before any secondary tab work begins
**Verified:** 2026-08-15T17:45:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (commit `d93b93a`, "fix(04): reset scrub position on every selectSample() branch")

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (roadmap): Press Play animates UR3e continuously along the full toolpath in real time, synced to the trajectory line | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wired end-to-end (PlaybackControl → store → usePlaybackClock → RobotPose/ScrubMarker); headless test (`clock-step.test.ts`) proves the state machine reaches fraction 1 monotonically and terminates correctly on a real compiled trajectory, but visual continuity/"synced to the line" is a rendering quality no test observes, and that same headless test uses `UNIFORM_FRACTION_MAPPING`, not the production `buildDurationMapping` (WR-03) |
| 2 | SC2 (roadmap): trajectory highlight/TCP marker track position smoothly, via imperative loop not per-frame React state | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Architecture half VERIFIED by code (both components read `livePlayback` via `getState()` inside `useFrame`, never a reactive selector for the per-frame position; `livePlayback` object identity confirmed stable by unit test); "smoothly" is a rendering quality requiring visual confirmation |
| 3 | `PLAYBACK_TOTAL_DURATION_SECONDS` is exactly 10, a single module constant (D-01) | ✓ VERIFIED | `src/playback/clock-step.ts:15`; asserted in `clock-step.test.ts` |
| 4 | `stepClock` clamps delta to `MAX_FRAME_DELTA_S` (0.1s), coerces non-finite/negative delta to 0 | ✓ VERIFIED | `clock-step.ts:111-113`; unit-tested for 5s, NaN, and negative-delta cases |
| 5 | `stepClock` reports `finished`/`fraction===1` at total duration; `usePlaybackClock` calls `pause()` on that frame (D-06) | ✓ VERIFIED | `clock-step.ts:118-121`, `usePlaybackClock.ts:76-82`; headless run test asserts final fraction is 1 and `isPlaying` is false after finishing |
| 6 | `resumeElapsedSeconds` resumes from current `scrubFraction` (D-05) and restarts near-1 via `RESUME_EPSILON`, never exact equality (D-07) | ✓ VERIFIED | `clock-step.ts:77-82`; unit-tested at 0.5, 1, 0.9999997, NaN |
| 7 | `livePlayback` is referentially stable across `play()`/`pause()`/`setScrubFraction()` | ✓ VERIFIED | `cellStore.ts:149`; asserted with `toBe` identity in both `clock-step.test.ts` and `cellStore.test.ts` |
| 8 | `setScrubFraction` writes the same clamped value into both `scrubFraction` and `livePlayback.fraction`; NaN/Infinity → 0 | ✓ VERIFIED | `cellStore.ts:138-145`; unit-tested for 0.42, NaN, Infinity, -1, 2 |
| 9 | `setScrubFraction` never touches `isPlaying` (Pitfall 4 — the clock's own throttled sync cannot pause itself) | ✓ VERIFIED | `cellStore.ts:138-145` (no `isPlaying` write); "Pitfall 4 guard" test in `cellStore.test.ts:164-168` |
| 10 | `selectSample` leaves `isPlaying` false AND `livePlayback.fraction` at 0 on every one of its store writes | ✓ VERIFIED (re-checked) | **Closed by commit `d93b93a`.** `src/store/cellStore.ts` now resets both `get().livePlayback.fraction = 0` and `scrubFraction: 0` at all four `set()` sites inside `selectSample`: the unknown-sample branch (line 159 + 166), the "start parsing" branch (line 174 + 181), the success branch (line 207 + 208, unchanged), and the catch/error branch (line 214 + 215). Three new regression tests in `cellStore.test.ts`'s "`useCellStore — selectSample resets scrub position on every branch (04-REVIEW WR-01)`" block seed a non-zero `scrubFraction`/`livePlayback.fraction` (0.6) and assert both read back 0 after each of the unknown-sample, parsing-start (via a never-resolving stubbed `fetch`), and fetch-failure branches. Re-ran `npx vitest run src/store/cellStore.test.ts` (139/139 pass, up from 129) and the full suite (`npx vitest run`, 976/976 pass, up from 973), `npx tsc -b` clean, `npm run build` clean. |
| 11 | A headless run seeding a real `compileTrajectory` output, calling `play()`, and stepping at 1/60s reaches fraction 1, is monotonic, and ends `isPlaying=false` | ✓ VERIFIED | `clock-step.test.ts` "a full play run reaches fraction 1..." — passes against a real square-toolpath fixture |
| 12 | No module under `src/playback/` solves inverse kinematics | ✓ VERIFIED | `! grep -rq 'solveUR6IK' src/playback/` succeeds |
| 13 | D-04: dragging the scrub slider mid-playback pauses immediately, then seeks | ✓ VERIFIED (mechanism) / visual seek is human item | `ScrubControl.tsx:91-92` calls `pause()` before `setScrubFraction`; Pitfall 4 test confirms the setter itself cannot self-pause |
| 14 | `CompiledTrajectory.travelLength + toolpathLength` equals the total arc length used to derive `scrubFraction` | ✓ VERIFIED | `compile.ts:299-301`; boundary-fraction assertion in `compile.test.ts` within 1e-9 (toolpath half) / documented 5mm bound (travel half, discretization) |
| 15 | D-02: rapid segment consumes strictly less playback time than an equal-length cut segment; `RAPID_SPEED_WEIGHT > CUT_SPEED_WEIGHT` | ✓ VERIFIED | `duration-mapping.ts:27-28`; hand-computed Fixture A/B tests in `duration-mapping.test.ts` |
| 16 | `buildDurationMapping`'s mapping is monotonic, exactly anchored at 0/1, round-trips within 1e-9, finite for degenerate input | ✓ VERIFIED | `duration-mapping.test.ts` — monotonic sweep, boundary exactness, round-trip, 4 degenerate cases, all passing |
| 17 | `usePlaybackClock` builds its mapping via `buildDurationMapping(toolpath, trajectory)`, rebuilt only on toolpath identity change | ✓ VERIFIED | `usePlaybackClock.ts:5,45-47` |
| 18 | `sampleAtFraction`: exact endpoints at 0/1, span-weighted interior blend, ratio clamp so a truncated trajectory returns its last solved sample (no extrapolation) | ✓ VERIFIED | `sample-lookup.ts:93-117`; 16 unit tests including truncated-fixture and real-compiled-trajectory density check |
| 19 | `sampleAtFraction` returns `null` for empty `samples`; finite output for NaN/Infinity/out-of-range fraction | ✓ VERIFIED | `sample-lookup.ts:95,98-99`; unit-tested |
| 20 | `RobotPose`/`ScrubMarker` both call `sampleAtFraction` on the same `livePlayback.fraction`; neither retains its own index derivation | ✓ VERIFIED | `RobotPose.tsx:54`, `ScrubMarker.tsx:80`; `! grep -q 'rawIndex'` succeeds on both files |

**Score:** 18/20 truths verified (0 failed, 2 present + wired but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/playback/clock-step.ts` | Pure playback clock core | ✓ VERIFIED | Exports all required constants/functions; framework-free; 13 unit tests pass |
| `src/playback/clock-step.test.ts` | D-01/05/06/07 unit coverage + headless run | ✓ VERIFIED | 13 tests, 2 describe blocks (pure clock behavior + headless end-to-end run) |
| `src/playback/usePlaybackClock.ts` | R3F hook driving clock + dual-cadence writes | ✓ VERIFIED | Mounted via `PlaybackClock` leaf in `CellScene.tsx`; no dedicated test file (WR-03) |
| `src/ui/PlaybackControl.tsx` | Play/Pause DOM control | ✓ VERIFIED | `variant="secondary"`, disabled with no trajectory, mounted in `App.tsx` |
| `src/store/cellStore.ts` | `isPlaying`/`play`/`pause`/`livePlayback` surface | ✓ VERIFIED | Dual-cadence channel present and correctly wired for the play/pause/scrub paths; `selectSample`'s reset gap (WR-01) is now closed on all four branches |
| `src/playback/duration-mapping.ts` | D-02 weighted mapping | ✓ VERIFIED | `RAPID_SPEED_WEIGHT`/`CUT_SPEED_WEIGHT`/`buildDurationMapping` all exported and unit-tested |
| `src/playback/duration-mapping.test.ts` | Weighting/monotonicity/boundary/degenerate coverage | ✓ VERIFIED | 14 tests, all against hand-computable synthetic fixtures — never against a real `compileTrajectory` output (WR-03) |
| `src/trajectory/compile.ts` | `travelLength`/`toolpathLength` on `CompiledTrajectory` | ✓ VERIFIED | Populated at both return sites; additive, no change to solved poses |
| `src/trajectory/sample-lookup.ts` | Shared interpolated lookup | ✓ VERIFIED | `sampleAtFraction` exported, framework-free, 16 unit tests |
| `src/trajectory/sample-lookup.test.ts` | Endpoint/blend/clamp/degenerate/density coverage | ✓ VERIFIED | All behavior-block items covered |
| `src/scene/RobotPose.tsx` | Per-frame pose driver reading shared lookup | ✓ VERIFIED | `sampleAtFraction(trajectory, livePlayback.fraction)`, `toUrdfJointAngles` intact |
| `src/scene/ScrubMarker.tsx` | Per-frame marker driver reading shared lookup | ✓ VERIFIED | Same lookup call; `scrubMarkerRadius` sizing intact |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `usePlaybackClock.ts` | `cellStore.ts` | `useCellStore.getState()` inside `useFrame`, writes `livePlayback.fraction` every frame, `setScrubFraction` only on throttle tick | ✓ WIRED | Confirmed at `usePlaybackClock.ts:35-73` |
| `RobotPose.tsx` | `cellStore.ts` | reads `livePlayback.fraction` inside `useFrame` | ✓ WIRED | `RobotPose.tsx:51,54` |
| `ScrubMarker.tsx` | `cellStore.ts` | reads `livePlayback.fraction` inside `useFrame` | ✓ WIRED | `ScrubMarker.tsx:71,80` |
| `CellScene.tsx` | `usePlaybackClock.ts` | `PlaybackClock` leaf mounted inside `<Canvas>` | ✓ WIRED | `CellScene.tsx:21-24,118-120` |
| `App.tsx` | `PlaybackControl.tsx` | mounted in bottom-left overlay next to `ScrubControl` | ✓ WIRED | `App.tsx:4,40` |
| `duration-mapping.ts` | `gcode/parseToolpath.ts` | reads `segment.type` per segment | ✓ WIRED | `duration-mapping.ts:131` |
| `duration-mapping.ts` | `trajectory/compile.ts` | reads `travelLength`/`toolpathLength` | ✓ WIRED | `duration-mapping.ts:105-106` |
| `usePlaybackClock.ts` | `duration-mapping.ts` | `buildDurationMapping(toolpath, trajectory)` assigned into mapping ref | ✓ WIRED | `usePlaybackClock.ts:46` |
| `RobotPose.tsx` | `sample-lookup.ts` | `sampleAtFraction(...)` feeds `toUrdfJointAngles` | ✓ WIRED | `RobotPose.tsx:54,57` |
| `ScrubMarker.tsx` | `sample-lookup.ts` | `sampleAtFraction(...)` feeds `mesh.position.set` | ✓ WIRED | `ScrubMarker.tsx:80,92` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `RobotPose.tsx` | `sample.joints` → `robot.setJointValue` | `sampleAtFraction(trajectory, livePlayback.fraction)` ← real `CompiledTrajectory.samples` (IK-solved, from `compileTrajectory`) | Yes | ✓ FLOWING |
| `ScrubMarker.tsx` | `sample.point` → `mesh.position.set` | Same `sampleAtFraction` call, same `trajectory.samples` | Yes | ✓ FLOWING |
| `ScrubControl.tsx` | `scrubFraction` → slider value + percent readout | `cellStore.scrubFraction`, written by `usePlaybackClock`'s throttled sync or manual drag | Yes | ✓ FLOWING |
| `PlaybackControl.tsx` | `isPlaying` → icon + disabled state | `cellStore.isPlaying`/`trajectory` | Yes | ✓ FLOWING |

Confirmed empirically: both bundled samples (`public/gcode/print-sample.gcode`, `public/gcode/mill-sample.gcode`) compile to `status: 'ready'` (never `'frozen-at-unreachable'`) with 1330 and 1137 samples respectively — the WR-04 frozen-trajectory timing gap (see Anti-Patterns below) does not affect either sample this phase's UI actually offers, so the core "press play, watch it run" path is not degraded by it for real, in-app usage.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Playback clock core + headless end-to-end run (real compiled trajectory) | `npx vitest run src/playback/clock-step.test.ts` | 13/13 pass | ✓ PASS |
| D-02 weighted duration mapping | `npx vitest run src/playback/duration-mapping.test.ts` | 14/14 pass | ✓ PASS |
| Shared interpolated sample lookup | `npx vitest run src/trajectory/sample-lookup.test.ts` | 16/16 pass | ✓ PASS |
| Store playback contract incl. WR-01 regression tests (`cellStore.ts`) | `npx vitest run src/store/cellStore.test.ts` | 139/139 pass (up from 129 pre-fix) | ✓ PASS |
| Bundled samples never freeze (ad hoc check, removed after run) | one-off `compileTrajectory` against both bundled `.gcode` files | print: `ready`, 1330/1330; mill: `ready`, 1137/1137 | ✓ PASS |
| Full workspace suite (re-run after fix) | `npx vitest run` | 976/976 pass (up from 973 pre-fix) | ✓ PASS |
| Type-check (re-run after fix) | `npx tsc -b` | clean | ✓ PASS |
| Production build (re-run after fix) | `npm run build` | `tsc -b && vite build` clean, `dist/` produced | ✓ PASS |
| In-browser Play/Pause/scrub visual behavior | — | not run (no browser harness) | ? SKIP — routed to human verification |

### Probe Execution

No probes declared for this phase (no `scripts/*/tests/probe-*.sh` files and no probe references in the plans or SUMMARYs). Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SIM-04 | 04-01, 04-02, 04-03 | User can press play to animate the UR3e robot following the toolpath in real time, synced to the visible trajectory | ✓ SATISFIED (human confirmation pending) | Full Play/Pause/scrub/weighted-timing/interpolated-lookup pipeline present, wired, and unit-tested, with no open code-level gaps remaining; REQUIREMENTS.md already marks SIM-04 complete, mapped only to Phase 4 — no orphaned Phase 4 requirements found |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/store/cellStore.ts` | 156-166, 174-181, 209-215 | ~~Incomplete `livePlayback.fraction`/`scrubFraction` reset across `selectSample`'s non-success branches~~ | ✅ CLOSED | Fixed in commit `d93b93a`. All four `set()` sites now reset both channels; 3 new regression tests cover the previously-untested branches. Re-verified above. |
| `src/playback/duration-mapping.ts` | 104-165 vs `src/trajectory/compile.ts` 299-301 | `buildDurationMapping`'s elapsed-time axis is built from the toolpath's full *intended* length, never truncated for a `frozen-at-unreachable` trajectory (04-REVIEW.md WR-04) | ⚠️ Warning | On a frozen trajectory, the robot reaches its frozen pose early and then visibly sits motionless while the clock/slider keep advancing to 100%. Neither bundled sample triggers `frozen-at-unreachable` (confirmed empirically above), so this does not affect the phase's demonstrable "must not fail" path today, but it is a real, untested gap against the plan's own transparency prohibition for any g-code that does freeze. Recommend fixing or explicitly accepting+testing before relying on user-supplied g-code beyond the two bundled samples. |
| `src/playback/clock-step.ts`, `src/playback/duration-mapping.ts`, `src/store/cellStore.ts`, `src/trajectory/sample-lookup.ts` | multiple | Finite-then-clamp-to-[0,1] logic independently reimplemented 4 times (04-REVIEW.md WR-02) | ℹ️ Info | All four copies currently agree; no shared source of truth to catch future drift. Code-quality follow-up, not a functional defect today. |
| `src/playback/duration-mapping.test.ts`, `src/playback/usePlaybackClock.ts` | whole files | The production integration (`compileTrajectory` + `buildDurationMapping` + `usePlaybackClock`) is never exercised together in one test; `usePlaybackClock.ts` itself has no dedicated test file (04-REVIEW.md WR-03) | ℹ️ Info | Each layer is independently well-tested; the seam where all three meet at runtime has no direct automated coverage. Recommend an integration test before this becomes load-bearing for a later phase. |
| `src/trajectory/sample-lookup.ts` | 57-63 | `blendJoints` uses a double cast (`as unknown as TrajectorySample['joints']`) that suppresses tuple-arity checking (04-REVIEW.md WR-05) | ℹ️ Info | Code-quality/type-safety follow-up, not a runtime defect observed. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file modified by this phase.

### Human Verification Required

### 1. Full playback run

**Test:** Run `npm run dev`, select a bundled sample, press Play.
**Expected:** The UR3e and rail carriage animate continuously along the whole toolpath, holding the final pose at the end; the teal marker rides the line in step with the flange; the slider and percentage readout advance live; the button icon toggles Play/Pause correctly.
**Why human:** Visual animation smoothness and cross-component sync cannot be confirmed by this project's Vitest suite (no jsdom/rendering harness).

### 2. Drag-to-pause-and-seek (D-04)

**Test:** With a sample loaded, press Play, then drag the scrub slider while the robot is moving.
**Expected:** Playback stops immediately at the dragged position, the button returns to the play icon, and the robot stays where the drag left it until Play is pressed again.
**Why human:** The actual drag gesture and its visual seek result require in-browser interaction.

### 3. Rapid-vs-cut weighted timing (D-02)

**Test:** Load the milling sample and press Play.
**Expected:** The robot covers non-cutting positioning moves noticeably faster than cutting passes, and the whole run still finishes in about ten seconds — the same total as the printing sample.
**Why human:** Relative visual traverse speed and perceived total duration are not assertable from a headless unit test.

### 4. Continuous blended motion + manual scrub agreement

**Test:** Load a sample and press Play; then pause and drag the slider slowly end to end.
**Expected:** The arm and marker move smoothly and continuously with no per-step ticking during playback; the marker stays on the drawn toolpath and the flange stays on the marker throughout manual scrubbing, matching Phase 3's behaviour.
**Why human:** Continuous joint-space-blended motion quality and marker/flange visual agreement require rendering the scene.

### Gaps Summary

**Previous gap closed.** The one concrete, testable must-have from 04-01-PLAN.md that was unmet at initial verification — `selectSample` resetting both `isPlaying` and `livePlayback.fraction`/`scrubFraction` on every one of its four `set()` sites — is now fully satisfied. Commit `d93b93a` ("fix(04): reset scrub position on every selectSample() branch") adds the missing `get().livePlayback.fraction = 0` + `scrubFraction: 0` writes to the unknown-sample, "start parsing", and catch/error branches (the success branch already had them), and adds three regression tests in `cellStore.test.ts` that seed a non-zero scrub position and assert it's reset to 0 on each of those three branches. Re-verified directly against the current code: all four `set()` sites confirmed to reset both channels; the full suite is green at 976/976 (up from 973), `npx tsc -b` is clean, and `npm run build` is clean. No regressions found in anything previously verified.

No FAILED must-haves remain. Two items are present, wired, and unit-tested at the mechanism level but require human/in-browser confirmation before the phase can be called fully done, per this project's own `human_verify_mode: end-of-phase` config and the plans' own `<verify><human-check>` blocks: (1) visually continuous, stutter-free playback synced to the drawn trajectory line, and (2) smooth marker/arm tracking. Both are explicitly declared `verification: backstop` in the plans' own must-haves — they were always deferred to this end-of-phase checkpoint, not skipped. Four human-verification items (harvested from the three plans' own `<human-check>` blocks) are listed above and cover these plus D-04 drag-to-pause-and-seek and D-02's rapid-vs-cut visual timing.

One further item remains flagged for awareness but does not block this verification: WR-04 (the weighted duration mapping does not account for a truncated/frozen trajectory) is real and untested, but neither bundled sample ever reaches `frozen-at-unreachable` status (confirmed empirically), so it does not affect the phase's actual, in-app "must not fail" demonstration today. Recommend addressing before any future phase relies on user-supplied or wider-ranging g-code.

---

*Verified: 2026-08-15T17:45:00Z*
*Verifier: Claude (gsd-verifier)*
