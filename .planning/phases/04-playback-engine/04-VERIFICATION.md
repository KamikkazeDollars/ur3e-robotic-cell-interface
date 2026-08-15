---
phase: 04-playback-engine
verified: 2026-08-15T20:15:00Z
status: passed
score: 22/22 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 18/20
  gaps_closed:
    - "SC1/SC2 visual continuity — the previous verification's 2 PRESENT_BEHAVIOR_UNVERIFIED truths (continuous synced playback; smooth highlight/marker tracking) are now resolved by completed human UAT (04-UAT.md) plus the 04-06 blocking checkpoint's round-2 'approved' reply, after G-04-1's three gap-closure plans (traversed-path highlight, mode-filtered sample picker, per-mode rail station) were built and verified."
    - "G-04-1 (04-UAT.md test 1, major severity): no visible trajectory highlight, rail carriage never exercised off-centre, no per-mode sample filtering — closed by 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md; human-verified 'approved' after one checkpoint round of camera-framing fix (commit 8cf0c43)."
    - "CR-01 (04-REVIEW.md, critical): rail carriage snapped to hardcoded RAIL_CENTER_X during the async gap between reselection and trajectory compile — fixed in commit f6ebf05 (lastRailPos tracking), full suite green after fix."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "D-02 rapid-vs-cut visual pacing feels right at full playback speed (04-UAT.md test 3)"
    addressed_in: "explicit user decision, deferred_at 2026-08-15 (04-UAT.md 'Deferred Follow-Ups')"
    evidence: "User: 'Mostly pass, but it seems that it's moving too fast for now but it's mostly a visual problem, no need to fix now just note for when the complete version of the product is done.' Not a Phase 4 blocker; mechanism (RAPID_SPEED_WEIGHT > CUT_SPEED_WEIGHT, monotonic weighted mapping) remains unit-verified regardless of the deferred tuning."
  - truth: "WR-01 (duration-mapping.ts independently re-sums arc length instead of reusing compile.ts's own table), WR-02 (SampleSelect one-render stale <select> value after a mode switch), WR-03 (frozen-at-unreachable trajectory gives no timing cue), IN-01 (unsafe tuple cast in blendJoints)"
    addressed_in: "04-REVIEW.md — deferred by explicit user decision"
    evidence: "04-REVIEW.md frontmatter: 'WR-01/WR-02/WR-03/IN-01 deferred by user decision'; none of the four affects either bundled sample's demonstrable path (confirmed empirically in the prior verification pass: both samples compile 'ready', never 'frozen-at-unreachable')."
---

# Phase 4: Playback Engine Verification Report

**Phase Goal:** Users can press play and watch the UR3e execute the full toolpath in real time, completing the "must not fail" core simulation before any secondary tab work begins.
**Verified:** 2026-08-15T20:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (G-04-1: plans 04-04/04-05/04-06) and a post-hoc code review with one critical fix (CR-01, commit `f6ebf05`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC1 (roadmap):** Press Play animates the UR3e continuously along the full toolpath in real time, synced to the visible trajectory line | ✓ VERIFIED | Mechanism: `usePlaybackClock.ts` drives `stepClock`/`buildDurationMapping`, writing `livePlayback.fraction` every frame; `RobotPose.tsx`/`ScrubMarker.tsx`/`PlaybackTrail.tsx` all read it via `sampleAtFraction`. Visual: original UAT test 1 (04-UAT.md) found the robot's own motion already correct ("The UR3e robot does what's intended to do") but flagged the missing trajectory highlight as unreadable — closed by 04-04-PLAN.md's `PlaybackTrail`. Re-verified live via the 04-06 Task 3 blocking checkpoint (`npm run dev`, Play, both samples), human reply **"approved"** on round 2 (04-06-SUMMARY.md D4). |
| 2 | **SC2 (roadmap):** Trajectory highlight + TCP marker track position smoothly, via an imperative render loop, not per-frame React state | ✓ VERIFIED | Architecture: `RobotPose.tsx`, `ScrubMarker.tsx`, `PlaybackTrail.tsx` all read `livePlayback` through `useCellStore.getState()` inside `useFrame` (never a reactive selector for per-frame position); `livePlayback` confirmed referentially stable by unit test (`cellStore.test.ts`). Visual: highlight-growth and marker-legibility explicitly re-confirmed in the 04-06 checkpoint items 3-4, "approved" round 2. |
| 3 | `PLAYBACK_TOTAL_DURATION_SECONDS` is exactly 10, a single module constant (D-01) | ✓ VERIFIED | `src/playback/clock-step.ts:15`; `clock-step.test.ts` |
| 4 | `stepClock` clamps delta to `MAX_FRAME_DELTA_S`, coerces non-finite/negative delta to 0 | ✓ VERIFIED | `clock-step.ts:111-113`; unit-tested |
| 5 | `stepClock` reaches `finished`/`fraction===1` at total duration; clock pauses on that frame (D-06) | ✓ VERIFIED | `clock-step.ts:118-121`, `usePlaybackClock.ts:76-82`; headless run test |
| 6 | `resumeElapsedSeconds` resumes from current fraction (D-05), restarts near-1 via epsilon not exact equality (D-07) | ✓ VERIFIED | `clock-step.ts:77-82`; unit-tested at 0.5, 1, 0.9999997, NaN |
| 7 | `livePlayback` referentially stable across `play()`/`pause()`/`setScrubFraction()` | ✓ VERIFIED | `cellStore.ts:149`; `toBe` identity tests |
| 8 | `setScrubFraction` writes the same clamped value into `scrubFraction` and `livePlayback.fraction`; NaN/Infinity → 0 | ✓ VERIFIED | `cellStore.ts:138-145`; unit-tested |
| 9 | `setScrubFraction` never touches `isPlaying` (Pitfall 4) | ✓ VERIFIED | `cellStore.ts:138-145`; dedicated guard test |
| 10 | `selectSample` resets `isPlaying`/`livePlayback.fraction`/`scrubFraction` on every one of its `set()` branches | ✓ VERIFIED | All four branches confirmed; regression tests in `cellStore.test.ts` |
| 11 | `CompiledTrajectory.travelLength + toolpathLength` equals the arc length that derives `scrubFraction` | ✓ VERIFIED | `compile.ts:299-301`; assertion within 1e-9 |
| 12 | D-02: rapid segment consumes strictly less playback time than an equal-length cut segment; `RAPID_SPEED_WEIGHT > CUT_SPEED_WEIGHT` | ✓ VERIFIED (mechanism); visual pacing deferred | `duration-mapping.ts:27-28`; hand-computed fixtures. Visual "feels right" tuning explicitly deferred by user (see `deferred` above) — not a blocker. |
| 13 | `buildDurationMapping` monotonic, anchored at 0/1, round-trips within 1e-9, finite for degenerate input | ✓ VERIFIED | `duration-mapping.test.ts` |
| 14 | `sampleAtFraction`: exact endpoints, span-weighted blend, ratio-clamped for truncated trajectories | ✓ VERIFIED | `sample-lookup.ts:93-117`; 16 unit tests |
| 15 | `RobotPose`/`ScrubMarker` share the one `sampleAtFraction` call; neither retains a private index derivation | ✓ VERIFIED | `RobotPose.tsx:54`, `ScrubMarker.tsx:80`; `! grep -q 'rawIndex'` succeeds |
| 16 | A traversed-path highlight grows from the toolpath's start fraction to 1 as playback advances, excludes the travel-move leg, and never runs ahead of the marker (G-04-1) | ✓ VERIFIED | `trail-progress.ts` (`buildTrailGeometry`, `traversedSegmentCount` — floors, never rounds); `PlaybackTrail.tsx` writes only `instanceCount`/`visible` per frame; 27 unit tests including a real-fixture no-overshoot check. Human-confirmed in 04-06 checkpoint item 3, "approved". |
| 17 | The scrub marker clears a named legibility floor (`MIN_SCRUB_MARKER_DIAMETER_FRACTION`) for both bundled samples' spans | ✓ VERIFIED | `marker-scale.ts` (`SCRUB_MARKER_SCALE` 1.75→3.5); `marker-scale.test.ts` asserts the floor for both real sample spans |
| 18 | `PlaybackClock` (the writer of `livePlayback.fraction`) mounts ahead of every per-frame reader in `CellScene.tsx` | ✓ VERIFIED | `CellScene.tsx:111` (`<PlaybackClock />` first inside `<Canvas>`, before `<RailRig>`, `<Toolpath>`, `<PlaybackTrail>`, `<ScrubMarker>`) — confirmed directly by reading the file; structurally guarded by `cell-scene-order.test.ts` |
| 19 | Every `GCODE_SAMPLES` entry carries a mode; the picker offers only the active mode's samples; switching mode re-selects a matching sample (G-04-1) | ✓ VERIFIED | `src/gcode/samples.ts` (`samplesForMode`/`sampleMatchesMode`/`firstSampleIdForMode`, 9 unit tests); `SampleSelect.tsx:68-69` reads `samplesForMode(cellMode)`; `useCellModeSampleSync.ts` mounted in `App.tsx`. Human-confirmed in 04-06 checkpoint item 1, "approved". |
| 20 | `railStartXForMode('printing')`/`('milling')` park the carriage symmetrically on opposite sides of `RAIL_CENTER_X`; both bundled samples resolve at least 0.5m off-centre per mode with joint-identical motion to the centred compile (G-04-1) | ✓ VERIFIED | `src/kinematics/rail.ts:85,106` (`MODE_RAIL_START_OFFSET_M = 0.6`, clamped via `clampRailPosition`); `src/trajectory/mode-rail.test.ts` — both samples `'ready'` under both mode anchors, joints within 1e-6 rad of centred compile. Human-confirmed in 04-06 checkpoint item 2, "approved" (round 2, after camera-framing fix). |
| 21 | The rail carriage never falls back to a hardcoded `RAIL_CENTER_X` during the async gap between reselection and trajectory compile (04-REVIEW CR-01) | ✓ VERIFIED | Fixed in commit `f6ebf05`: `cellStore.ts` adds `lastRailPos`, written only on `selectSample`'s success branch; `CellScene.tsx:88` falls back to `state.lastRailPos`, never the constant. 97 lines of new regression tests in `cellStore.test.ts`; full suite green post-fix (confirmed independently in this pass: 1054/1054). |
| 22 | The full Vitest suite, `tsc -b`, and `npm run build` are green at the current HEAD | ✓ VERIFIED | Ran independently in this verification pass: `npx tsc -b` clean; `npx vitest run` → 1054/1054 passing, 105 files; git working tree has no uncommitted changes to any tracked source file |

**Score:** 22/22 truths verified (0 failed, 0 present-but-behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | D-02 rapid-vs-cut pacing "feels too fast" visually | Explicit user decision (04-UAT.md, deferred_at 2026-08-15) | User: "no need to fix now just note for when the complete version of the product is done" — not a Phase 4 blocker |
| 2 | 04-REVIEW.md WR-01, WR-02, WR-03, IN-01 (3 warnings, 1 info) | Explicit user decision (04-REVIEW.md frontmatter: "deferred by user decision") | None affect either bundled sample's actual in-app path; WR-03's frozen-trajectory timing gap confirmed empirically in the prior verification pass to not apply to either bundled sample (both compile to `'ready'`, never `'frozen-at-unreachable'`) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/playback/clock-step.ts` | Pure playback clock core | ✓ VERIFIED | All constants/functions exported, framework-free |
| `src/playback/usePlaybackClock.ts` | R3F hook driving clock + dual-cadence writes | ✓ VERIFIED | Mounted via `PlaybackClock` leaf, first in `CellScene.tsx` |
| `src/ui/PlaybackControl.tsx` | Play/Pause DOM control | ✓ VERIFIED | Mounted in `App.tsx` |
| `src/store/cellStore.ts` | `isPlaying`/`play`/`pause`/`livePlayback`/`lastRailPos` surface | ✓ VERIFIED | Dual-cadence channel + CR-01 fix present |
| `src/playback/duration-mapping.ts` | D-02 weighted mapping | ✓ VERIFIED | `RAPID_SPEED_WEIGHT`/`CUT_SPEED_WEIGHT`/`buildDurationMapping` exported, unit-tested |
| `src/trajectory/compile.ts` | `travelLength`/`toolpathLength` on `CompiledTrajectory` | ✓ VERIFIED | Populated at both return sites |
| `src/trajectory/sample-lookup.ts` | Shared interpolated lookup | ✓ VERIFIED | `sampleAtFraction` exported, framework-free |
| `src/scene/RobotPose.tsx` / `ScrubMarker.tsx` | Per-frame drivers reading shared lookup | ✓ VERIFIED | Both call `sampleAtFraction(trajectory, livePlayback.fraction)` |
| `src/scene/trail-progress.ts` | Trail geometry/segment-count math | ✓ VERIFIED | `TrailGeometry`/`buildTrailGeometry`/`traversedSegmentCount` exported |
| `src/scene/PlaybackTrail.tsx` | Traversed-path highlight component | ✓ VERIFIED | Mounted between `Toolpath` and `ScrubMarker`; per-frame writes only `instanceCount`/`visible` |
| `src/scene/cell-scene-order.test.ts` | Structural mount-order guard | ✓ VERIFIED | Asserts `PlaybackClock` index < `RailRig`/`Toolpath`/`PlaybackTrail`/`ScrubMarker` indices |
| `src/cell-mode.ts` | Dependency-free `CellMode` union | ✓ VERIFIED | No imports; re-exported from `uiShellStore.ts` |
| `src/gcode/samples.ts` | Mode-tagged samples + filter helpers | ✓ VERIFIED | `samplesForMode`/`sampleMatchesMode`/`firstSampleIdForMode` exported |
| `src/ui/useCellModeSampleSync.ts` | Mode-change reselection hook | ✓ VERIFIED | Mounted once in `App.tsx` |
| `src/kinematics/rail.ts` | Per-mode rail station | ✓ VERIFIED | `MODE_RAIL_START_OFFSET_M`, `railStartXForMode` exported |
| `src/gcode/toolpath-anchor.ts` | Mode-aware world-space anchor | ✓ VERIFIED | `toolpathAnchorForMode` exported |
| `src/trajectory/mode-rail.test.ts` | End-to-end mode/rail proof | ✓ VERIFIED | Both samples `'ready'` under both anchors, joint-identical to centred compile |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `usePlaybackClock.ts` | `cellStore.ts` | `getState()` inside `useFrame`, writes `livePlayback.fraction` every frame | ✓ WIRED | Confirmed |
| `RobotPose.tsx` / `ScrubMarker.tsx` | `sample-lookup.ts` | `sampleAtFraction(trajectory, livePlayback.fraction)` | ✓ WIRED | Confirmed |
| `PlaybackTrail.tsx` | `trail-progress.ts` | `traversedSegmentCount(trail, livePlayback.fraction)` → `geometry.instanceCount` | ✓ WIRED | Confirmed |
| `CellScene.tsx` | `usePlaybackClock.ts` | `PlaybackClock` leaf, first child of `<Canvas>` | ✓ WIRED | Confirmed — grep + direct read of `CellScene.tsx` |
| `SampleSelect.tsx` | `gcode/samples.ts` | `samplesForMode(cellMode)` supplies option list | ✓ WIRED | Confirmed |
| `useCellModeSampleSync.ts` | `cellStore.ts` | `selectSample(firstSampleIdForMode(mode), 'mode-sync')` on mode change | ✓ WIRED | Confirmed |
| `cellStore.ts` (`selectSample`) | `gcode/toolpath-anchor.ts` | `toolpathAnchorForMode(useUiShellStore.getState().cellMode)` before the fetch await | ✓ WIRED | Confirmed |
| `Workbench.tsx` | `gcode/toolpath-anchor.ts` | `toolpathAnchorForMode(cellMode).x` for tabletop + legs | ✓ WIRED | Confirmed |
| `CellScene.tsx` (`railPos`) | `cellStore.ts` | `state.trajectory?.railPos ?? state.lastRailPos` (CR-01 fix) | ✓ WIRED | Confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `RobotPose.tsx` | `sample.joints` → `robot.setJointValue` | `sampleAtFraction` ← real `CompiledTrajectory.samples` (IK-solved) | Yes | ✓ FLOWING |
| `ScrubMarker.tsx` | `sample.point` → `mesh.position.set` | Same `sampleAtFraction` call | Yes | ✓ FLOWING |
| `PlaybackTrail.tsx` | `traversedSegmentCount` → `geometry.instanceCount` | `buildTrailGeometry(trajectory)` ← real compiled samples | Yes | ✓ FLOWING |
| `CellScene.tsx` `railPos` | `RailRig` position prop | `trajectory.railPos` (real, resolver-computed) or `lastRailPos` (last real resolved value, never a hardcoded fallback) | Yes | ✓ FLOWING |
| `SampleSelect.tsx` | dropdown options | `samplesForMode(cellMode)` ← real `GCODE_SAMPLES` filtered by mode | Yes | ✓ FLOWING |
| `Workbench.tsx` | tabletop/leg X | `toolpathAnchorForMode(cellMode).x` ← real `railStartXForMode` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full workspace suite (independent re-run, this verification pass) | `npx vitest run` | 1054/1054 pass, 105 files | ✓ PASS |
| Type-check (independent re-run) | `npx tsc -b` | clean | ✓ PASS |
| Playback core + weighted mapping + sample lookup + store + trail + samples + rail + anchor + mode-rail (targeted re-run) | `npx vitest run src/scene/trail-progress.test.ts src/scene/cell-scene-order.test.ts src/gcode/samples.test.ts src/kinematics/rail.test.ts src/gcode/toolpath-anchor.test.ts src/trajectory/mode-rail.test.ts src/store/cellStore.test.ts` | 326/326 pass, 25 files | ✓ PASS |
| CR-01 fix present on disk | `grep -n "lastRailPos" src/scene/CellScene.tsx src/store/cellStore.ts` | 5 matches across both files, fallback confirmed at `CellScene.tsx:88` | ✓ PASS |
| Mount order (writer-before-readers) | `grep -n "PlaybackClock\|<RailRig\|<Toolpath\|<PlaybackTrail\|<ScrubMarker" src/scene/CellScene.tsx` | `<PlaybackClock />` at line 111, before `<RailRig>` (141), `<Toolpath>` (152), `<PlaybackTrail>` (158), `<ScrubMarker>` (163) | ✓ PASS |
| Debt-marker scan across all 25 phase-modified files | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` per file | No matches in any file | ✓ PASS |
| In-browser Play/Pause/scrub/highlight/mode/rail visual behavior | 04-06 Task 3 blocking checkpoint | Round 1: 4/5 items confirmed, 1 camera-framing issue found and fixed (commit `8cf0c43`). Round 2: human replied **"approved"** | ✓ PASS (human-confirmed) |

### Probe Execution

No probes declared for this phase (no `scripts/*/tests/probe-*.sh` files, no probe references in plans/SUMMARYs). Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SIM-04 | 04-01, 04-02, 04-03, 04-04, 04-05, 04-06 | User can press play to animate the UR3e robot following the toolpath in real time, synced to the visible trajectory | ✓ SATISFIED | Full Play/Pause/scrub/weighted-timing/interpolated-lookup/highlight/mode-filter/per-mode-rail pipeline present, wired, unit-tested, and human-confirmed via the 04-06 blocking checkpoint ("approved"). REQUIREMENTS.md already marks SIM-04 Complete, mapped only to Phase 4 — no orphaned Phase 4 requirements found. |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 25 files this phase (across all 6 plans) modified.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/playback/duration-mapping.ts` | 104-165 | WR-01: independently re-sums toolpath arc length instead of reusing `compile.ts`'s own table | ℹ️ Info (deferred by user decision) | Both copies currently agree for all real fixtures; would only diverge under a hypothetical inter-segment gap not currently producible by the parser. Not a blocker per 04-REVIEW.md's explicit user-decision deferral. |
| `src/ui/SampleSelect.tsx` | 64-94 | WR-02: `<select>` `value` can reference an id absent from that render's own `<option>` list for one render, right after a mode switch | ℹ️ Info (deferred by user decision) | Self-correcting within the same task tick; not visually perceptible. |
| `src/playback/usePlaybackClock.ts`, `duration-mapping.ts` | — | WR-03: a `frozen-at-unreachable` trajectory gives no timing cue that the run "finished early" | ℹ️ Info (deferred by user decision) | Confirmed in the prior verification pass that neither bundled sample ever reaches `'frozen-at-unreachable'`; does not affect this phase's actual demonstrable path. |
| `src/trajectory/sample-lookup.ts` | 57-63 | IN-01: unsafe `as unknown as` tuple cast in `blendJoints` | ℹ️ Info (deferred by user decision) | Type-safety follow-up, not a runtime defect observed. |
| `.planning/ROADMAP.md` | 132 | Stale summary line "6/6 plans executed (3/3 executed, 3 gap-closure plans pending)" — all 6 plans' checkboxes below it are correctly `[x]`, only this one summary sentence wasn't updated after 04-06 completed | ℹ️ Info | Documentation staleness only; does not affect verification of the actual codebase. |

### Human Verification Required

None. All items previously requiring human confirmation have been resolved:

1. **Full playback run / continuous synced animation (SC1)** — resolved via 04-06 Task 3 blocking checkpoint, human reply "approved" (round 2, after a camera-framing fix in round 1).
2. **Drag-to-pause-and-seek (D-04)** — passed in the original 04-UAT.md (test 2) and re-exercised in the 04-06 checkpoint (item 5), no regressions.
3. **Rapid-vs-cut visual timing (D-02)** — explicitly deferred by the user as a non-blocking cosmetic note (04-UAT.md "Deferred Follow-Ups"), not an open verification item.
4. **Continuous blended motion + manual scrub agreement (SC2)** — passed in the original 04-UAT.md (test 4) and re-exercised in the 04-06 checkpoint (item 5).
5. **Mode-filtered picker, per-mode rail sweep, trajectory highlight, marker legibility (G-04-1)** — all confirmed live in the 04-06 checkpoint, "approved".

### Gaps Summary

No gaps remain. This is a re-verification following a full cycle of: initial phase completion (04-01/02/03) → human UAT (04-UAT.md) → root-cause diagnosis → three gap-closure plans (04-04/05/06) closing the one major UAT finding (G-04-1: missing trajectory highlight, un-exercised rail motion, unfiltered sample picker) → a blocking human-verification checkpoint that caught and fixed a real UX regression (camera-zoom fighting the mode-switch rail sweep) before approving on round 2 → a post-hoc code review that found one Critical defect (CR-01: rail carriage falling back to a hardcoded center position during the async reselection gap) which was fixed (commit `f6ebf05`) and independently re-verified in this pass (full 1054-test suite green, `tsc -b` clean, fix present on disk and correctly wired).

Both ROADMAP Phase 4 success criteria are verified: (1) pressing Play animates the UR3e continuously along the full toolpath, synced to the trajectory line — now including a visible, growing highlight on that line, human-confirmed; (2) the highlight and TCP marker track position smoothly via an imperative `useFrame`/`getState()` loop, never a per-frame reactive Zustand write — verified both architecturally (code) and visually (human checkpoint).

Four Warning/Info-level code-review findings (WR-01, WR-02, WR-03, IN-01) and one visual-tuning note (D-02 pacing) remain open by explicit user decision, are non-blocking, and do not affect either bundled sample's actual in-app playback path. One documentation-staleness note (a ROADMAP.md summary sentence not updated after gap closure) is cosmetic only.

---

*Verified: 2026-08-15T20:15:00Z*
*Verifier: Claude (gsd-verifier)*
