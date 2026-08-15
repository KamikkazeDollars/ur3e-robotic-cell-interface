---
phase: 04-playback-engine
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/App.tsx
  - src/playback/clock-step.test.ts
  - src/playback/clock-step.ts
  - src/playback/duration-mapping.test.ts
  - src/playback/duration-mapping.ts
  - src/playback/usePlaybackClock.ts
  - src/scene/CellScene.tsx
  - src/scene/RobotPose.tsx
  - src/scene/ScrubMarker.tsx
  - src/store/cellStore.test.ts
  - src/store/cellStore.ts
  - src/trajectory/compile.test.ts
  - src/trajectory/compile.ts
  - src/trajectory/sample-lookup.test.ts
  - src/trajectory/sample-lookup.ts
  - src/ui/PlaybackControl.tsx
  - src/ui/ScrubControl.tsx
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the playback clock core (`clock-step.ts`), the D-02 weighted duration mapping (`duration-mapping.ts`), the R3F `usePlaybackClock` hook that ties them together, the shared `sampleAtFraction` interpolation lookup, the `cellStore` playback channels (`scrubFraction`/`livePlayback`), and the UI controls (`PlaybackControl`, `ScrubControl`) plus their scene consumers (`RobotPose`, `ScrubMarker`).

The pure functional core (`stepClock`, `resumeElapsedSeconds`, `buildDurationMapping`, `sampleAtFraction`) is well-tested with hand-computed values and is internally consistent — I traced the finite/clamp/monotonicity guarantees through each module and did not find a correctness defect in that core math. No hardcoded secrets, injection vectors, or dangerous-function usage were found.

The issues found are all at the seams between the three parallel plans (04-01 clock core, 04-02 weighted mapping, 04-03 shared sample lookup) and their integration into `usePlaybackClock.ts`/`cellStore.ts`: real cross-plan duplication of clamp/coercion logic, a real integration test gap (the "headless end-to-end" test bypasses the actual production mapping), a stale-state gap on the sample-selection error path, and an unsafe type cast. None of these are blockers for the core "import g-code → watch it play back" path on a happy-path reachable toolpath, but several should be fixed before this phase is considered done.

## Warnings

### WR-01: `scrubFraction`/`livePlayback.fraction` are not reset when a new sample selection starts parsing or fails

**File:** `src/store/cellStore.ts:166-172` (parsing branch) and `src/store/cellStore.ts:199-205` (catch branch)

**Issue:** The success path of `selectSample` explicitly resets both channels to 0 (`get().livePlayback.fraction = 0` then `set({ ..., scrubFraction: 0, ... })`, lines 197-198), but the "start parsing" `set(...)` at lines 166-172 and the `catch` block at lines 199-205 do neither. If a user is mid-playback/mid-scrub at, say, `scrubFraction = 0.8` and then selects a sample that fails to fetch/parse (or is simply still in flight), `toolpath`/`trajectory` become `null` (so the scrub control correctly disables and `RobotPose`/`ScrubMarker` correctly stop reading `trajectory`), but `scrubFraction` and `livePlayback.fraction` remain stuck at `0.8` from the previous sample. The scrub slider then renders at a stale 80% position while disabled, and if the *next* successful selection's trajectory compile is skipped for any reason, the stale value persists indefinitely. This is an asymmetry between the three `set()` call sites in the same function that should all reset the playback position together.

**Fix:**
```ts
// in the "start parsing" set() at line 166 and the catch-block set() at line 199
get().livePlayback.fraction = 0
set({
  toolpathLoadStatus: 'parsing', // or 'error'
  toolpath: null,
  trajectory: null,
  isPlaying: false,
  scrubFraction: 0,
})
```

### WR-02: Fraction clamp/NaN-coercion logic is duplicated across four modules instead of being unified

**File:** `src/playback/clock-step.ts:47-55`, `src/playback/duration-mapping.ts:49-51,170,185`, `src/store/cellStore.ts:139`, `src/trajectory/sample-lookup.ts:98-99`

**Issue:** The same "coerce non-finite to 0, then clamp to `[0, 1]` (or `[0, PLAYBACK_TOTAL_DURATION_SECONDS]`)" logic is independently reimplemented four times:
- `clock-step.ts`'s private `clampFraction`/`clampElapsed` (not exported)
- `duration-mapping.ts`'s private `coerceFiniteOrZero` + inline `Math.min/Math.max`
- `cellStore.ts`'s `setScrubFraction`: `Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0`
- `sample-lookup.ts`'s `sampleAtFraction`: `Number.isFinite(fraction) ? fraction : 0` then `Math.min(1, Math.max(0, finiteFraction))`

This is exactly the kind of duplicated-logic-that-should-have-been-unified risk that shows up when three plans (04-01/04-02/04-03) each needed the same guard and each wrote their own copy rather than sharing one. All four happen to agree today, but there is no single source of truth enforcing that agreement — a future edit to one clamp (e.g. changing the NaN fallback, or the range) will not propagate to the other three, and nothing will catch the drift.

**Fix:** Export `clampFraction01` (rename/generalize `clock-step.ts`'s `clampFraction`) as a shared utility (e.g. in a small `src/playback/fraction-utils.ts` or directly from `clock-step.ts`) and have `duration-mapping.ts`, `cellStore.ts`, and `sample-lookup.ts` import and call it instead of reimplementing it.

### WR-03: The actual production integration (`compileTrajectory` + `buildDurationMapping` + `usePlaybackClock`) is never exercised together in any test

**File:** `src/playback/duration-mapping.test.ts` (whole file), `src/playback/clock-step.test.ts:173`, `src/playback/usePlaybackClock.ts` (no test file exists)

**Issue:**
- `duration-mapping.test.ts` only ever calls `buildDurationMapping` against hand-built `ParsedToolpath`/`CompiledTrajectory` fixtures (`buildToolpath`/`buildTrajectory` helpers) — it never calls it with a real `compileTrajectory(...)` output, so nothing verifies that `duration-mapping.ts`'s own independent re-walk of `toolpath.segments`' arc length stays consistent with `compile.ts`'s `travelLength`/`toolpathLength` fields on real, non-synthetic geometry (arcs, real bundled g-code, etc.).
- `clock-step.test.ts`'s "headless end-to-end playback run" (the file's own stated purpose: "this tracer task's runnable proof that the whole 'press Play, the robot runs the toolpath' path actually works") explicitly uses `UNIFORM_FRACTION_MAPPING` (line 173), not `buildDurationMapping` — the mapping `usePlaybackClock.ts` actually uses in production (`buildDurationMapping(toolpath, trajectory)`, `usePlaybackClock.ts:46`) is never exercised by this "end-to-end" test at all.
- `usePlaybackClock.ts` itself — the hook that owns the mapping-cache-by-`toolpath`-identity logic (lines 45-47) and the `wasPlayingRef` play-transition resume-seed logic (lines 55-61) — has no test file of its own; only the pure functions it composes (`stepClock`, `resumeElapsedSeconds`, `buildDurationMapping`) are unit tested in isolation.

Together, the seam where all three plans' outputs actually meet at runtime has zero direct coverage.

**Fix:** Add a test that calls `compileTrajectory` on a real fixture, feeds the result into `buildDurationMapping`, and asserts the same monotonicity/boundary/finite properties `duration-mapping.test.ts` already asserts against synthetic fixtures — and/or a React Testing Library test that mounts a minimal tree exercising `usePlaybackClock` via `useFrame` to catch regressions in the ref-caching/resume-seed logic itself.

### WR-04: `buildDurationMapping`'s elapsed-time axis does not account for a `frozen-at-unreachable` trajectory

**File:** `src/playback/duration-mapping.ts:104-165` vs `src/trajectory/compile.ts:299-301`

**Issue:** `compile.ts` computes `travelLength`/`toolpathLength` (and therefore `duration-mapping.ts`'s `boundaryFraction`/breakpoint table) from the toolpath's *full intended* arc length, computed once before the IK walk runs (`compile.ts:299-301`), and never truncates them when the walk freezes early (`status: 'frozen-at-unreachable'`). Meanwhile `trajectory.samples` only covers whatever fraction of that full length was actually solved before freezing. Because `buildDurationMapping` builds its elapsed-time↔scrubFraction breakpoints from the full intended length, `elapsedToFraction` keeps producing increasing `scrubFraction` values across the *entire* 10-second duration, well past the last fraction any real sample exists at. `sampleAtFraction`'s clamp-to-last-sample behavior (D-06) means this doesn't crash or extrapolate an invalid pose, but the visible effect is: on a frozen trajectory, the robot reaches its frozen pose early (proportional to how far into the path it got) and then visibly sits motionless for the remainder of the 10-second run while the scrub slider and clock keep advancing to completion. This is a real behavioral gap between what `compile.ts`'s `travelLength`/`toolpathLength` fields represent (intended, not actual) and what `duration-mapping.ts` assumes them to mean (the playable range), and it is untested (no test constructs a frozen trajectory and checks `buildDurationMapping`'s behavior against it).

**Fix:** Either have `buildDurationMapping` derive its total-length denominator from the trajectory's actually-solved samples (e.g. the last sample's own arc-length contribution) when `status === 'frozen-at-unreachable'`, or explicitly document this as accepted behavior and add a test pinning it down so a future change doesn't silently alter it.

### WR-05: Unsafe type cast in `blendJoints` bypasses tuple-arity checking

**File:** `src/trajectory/sample-lookup.ts:57-63`

**Issue:**
```ts
function blendJoints(a, b, ratio) {
  return a.map((value, i) => value + (b[i] - value) * ratio) as unknown as TrajectorySample['joints']
}
```
`Array.prototype.map` on a tuple type widens the result to `number[]`, so the function forces it back to the `JointAngles` tuple via `as unknown as`. This double-cast (`unknown` first) suppresses TypeScript's normal "not assignable" error entirely rather than doing a narrower, checkable assertion. If `JointAngles`' arity or element typing ever changes, this line will not surface a compile error, silently producing a wrong-length joints array at runtime instead.

**Fix:** Use a fixed-arity blend instead of `.map`, which both avoids the cast and is self-documenting about the tuple length:
```ts
function blendJoints(a: JointAngles, b: JointAngles, ratio: number): JointAngles {
  return [0, 1, 2, 3, 4, 5].map((i) => a[i] + (b[i] - a[i]) * ratio) as JointAngles
}
```
(or a single narrower `as` without the `unknown` hop, if the tuple-length guarantee is otherwise enforced elsewhere).

## Info

### IN-01: `compileTrajectory` is a very long, high-complexity function

**File:** `src/trajectory/compile.ts:245-370`

**Issue:** `compileTrajectory` is ~125 lines with a labeled `walk:` loop, a nested phase loop, multiple branches for the travel-vs-toolpath phase distinction, and several derived-value computations threaded through. It is heavily documented (the comments are excellent and explain *why*, not just *what*), which substantially mitigates the readability cost, but the cyclomatic complexity is still high for a single function. This predates Phase 4 (it's Phase 3's IK compiler, extended here with the `travelLength`/`toolpathLength` fields) but is in this review's scope.

**Fix:** Consider extracting the phase-walk loop body (points 317-364) into a named helper (e.g. `walkPhase(phase, railOffsetFromCenter, previousJoints)` returning `{ samples, lastJoints, frozen }`) to reduce the function's own branching, if this file is touched again in a later phase.

### IN-02: `usePlaybackClock`'s mapping cache is keyed only on `toolpath` identity, not `trajectory` identity

**File:** `src/playback/usePlaybackClock.ts:45-47`

**Issue:**
```ts
if (!mappingRecordRef.current || mappingRecordRef.current.toolpath !== toolpath) {
  mappingRecordRef.current = { toolpath, mapping: buildDurationMapping(toolpath, trajectory) }
}
```
This rebuilds the cached mapping only when the `toolpath` object reference changes. It relies on the implicit invariant that `cellStore.ts`'s `selectSample` always replaces `toolpath` and `trajectory` together (which it currently does — verified across both the success and stale-guard paths). If a future change ever updated `trajectory` independently of `toolpath` (e.g. a "recompile with different settings" feature), this cache would silently keep serving a mapping built against the stale trajectory. Nothing in the type system enforces this pairing.

**Fix:** No change required today, but worth a short comment noting the coupling to `cellStore.ts`'s write pattern, or keying the cache on `trajectory` identity instead (since a new `trajectory` object is always produced whenever `toolpath` is, per `selectSample`'s current implementation) so the invariant is enforced by the more directly-relevant identity.

---

_Reviewed: 2026-08-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
