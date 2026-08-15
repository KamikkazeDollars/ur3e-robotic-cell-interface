---
phase: 04-playback-engine
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - src/playback/clock-step.ts
  - src/playback/clock-step.test.ts
  - src/playback/usePlaybackClock.ts
  - src/ui/PlaybackControl.tsx
  - src/store/cellStore.ts
  - src/store/cellStore.test.ts
  - src/App.tsx
  - src/scene/CellScene.tsx
  - src/scene/RobotPose.tsx
  - src/scene/ScrubMarker.tsx
  - src/ui/ScrubControl.tsx
  - src/playback/duration-mapping.ts
  - src/playback/duration-mapping.test.ts
  - src/trajectory/compile.ts
  - src/trajectory/compile.test.ts
  - src/trajectory/sample-lookup.ts
  - src/trajectory/sample-lookup.test.ts
  - src/scene/trail-progress.ts
  - src/scene/trail-progress.test.ts
  - src/scene/PlaybackTrail.tsx
  - src/scene/cell-scene-order.test.ts
  - src/scene/marker-scale.ts
  - src/scene/marker-scale.test.ts
  - src/cell-mode.ts
  - src/gcode/samples.test.ts
  - src/ui/useCellModeSampleSync.ts
  - src/gcode/samples.ts
  - src/store/uiShellStore.ts
  - src/ui/SampleSelect.tsx
  - src/gcode/toolpath-anchor.test.ts
  - src/trajectory/mode-rail.test.ts
  - src/scene/camera-fit-origin.ts
  - src/scene/camera-fit-origin.test.ts
  - src/kinematics/rail.ts
  - src/kinematics/rail.test.ts
  - src/kinematics/index.ts
  - src/gcode/toolpath-anchor.ts
  - src/gcode/parseToolpath.ts
  - src/scene/Workbench.tsx
  - src/scene/ToolpathCameraFit.tsx
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 4's playback engine (clock core, weighted duration mapping, sample interpolation, trail highlight, and the G-04-1 mode/rail gap-closure work) is unusually well documented and unusually well tested — most of the pure math modules (`clock-step.ts`, `duration-mapping.ts`, `sample-lookup.ts`, `trail-progress.ts`, `rail.ts`) have hand-computed unit fixtures that would catch the classic failure modes (inverted weighting, NaN propagation, off-by-one bracketing, wrap-around snaps). Several findings from prior review rounds are visibly already fixed in this codebase (`WR-01`/`WR-03`/`WR-04` follow-up comments in `cellStore.ts`, `CellScene.tsx`, `SampleSelect.tsx`).

That said, tracing the async data flow between `cellStore.selectSample`, `CellScene.tsx`'s rail-position prop, and the two UI-chrome stores turned up one real, reproducible defect (the rail carriage visibly snaps to the rail's centre position on every sample reselection, including every mode switch — directly touching the "3D toolpath simulation must work flawlessly end-to-end" core value from CLAUDE.md) and a couple of narrower consistency gaps between independently-computed values that no test currently cross-checks.

## Critical Issues

### CR-01: Rail carriage visibly snaps to `RAIL_CENTER_X` on every sample reselection (including every mode switch)

**File:** `src/scene/CellScene.tsx:76`
```ts
const railPos = useCellStore((state) => state.trajectory?.railPos ?? RAIL_CENTER_X)
```

**Issue:** `cellStore.selectSample` synchronously nulls out `trajectory` (and `toolpath`) the moment a new selection is dispatched, *before* the async fetch/parse/compile resolves — see `src/store/cellStore.ts:212-221` (entering `'parsing'`), `:196-206` (unknown id), and `:259-281` (success/failure). During that window `CellScene.tsx`'s `railPos` selector falls back to the fixed constant `RAIL_CENTER_X` (the rail's midpoint), because there is no other source of truth for "where the carriage currently is" once `trajectory` goes `null`.

`useCellModeSampleSync.ts` (mounted once at the shell level) dispatches exactly this kind of reselection on every mode-bar click, and `railStartXForMode` (`src/kinematics/rail.ts:106-109`) deliberately parks printing 0.6 m right of `RAIL_CENTER_X` and milling 0.6 m left of it — meaning a real mode switch moves the carriage from +0.6 m to *0 m* (the fallback) and then, a frame or two later once the new trajectory compiles, to -0.6 m. `Workbench.tsx` does **not** share this problem — it derives its X directly from `toolpathAnchorForMode(cellMode)` (`src/scene/Workbench.tsx:75-76`), so it jumps to the new station immediately and correctly. The net effect is a visible double-jump/flicker of the robot+rail rig through the rail's centre, momentarily disagreeing with the (already-correct) workbench position, on every sample/mode change after the first.

This is exactly the class of defect CLAUDE.md calls out as non-negotiable ("The 3D toolpath simulation must work flawlessly end-to-end... this cannot fail") and it is not covered by any existing test — every test in this phase exercises the pure functions synchronously; none simulates the async gap where `trajectory` is `null` but a previous, different `railPos` was already on screen.

**Fix:** Stop falling back to a hardcoded constant when there is no current trajectory. Track the last resolved rail position (updated only when a trajectory successfully compiles) and fall back to *that* instead of `RAIL_CENTER_X`:
```ts
// cellStore.ts — add a field that only ever moves forward to a real solve
lastRailPos: number // defaults to RAIL_CENTER_X, updated alongside `trajectory` on success only

// ...in the success branch of selectSample:
set({ toolpath, toolpathLoadStatus: 'ready', trajectory, lastRailPos: trajectory.railPos, ... })
// the null-out branches (unknown id / parsing / error) must NOT touch lastRailPos

// CellScene.tsx
const railPos = useCellStore((state) => state.trajectory?.railPos ?? state.lastRailPos)
```
Add a regression test that drives `selectSample('print')` then `selectSample('mill')` back to back and asserts the store never reports an intermediate rail position outside `[min(printX, millX), max(printX, millX)]`.

## Warnings

### WR-01: `duration-mapping.ts` recomputes the toolpath's total arc length independently instead of sourcing it from the compiler

**File:** `src/playback/duration-mapping.ts:126-154`

**Issue:** `buildDurationMapping` reads `trajectory.travelLength`/`trajectory.toolpathLength` (already computed once, correctly, by `compile.ts` via `buildArcLengthTable`/`flattenToolpathPoints`) only to derive `boundaryFraction`. For the rest of the breakpoint table it walks `toolpath.segments` itself and re-sums per-segment point-pair distances into its own `realCumulative`/`totalReal` (line 153), independently of `trajectory.toolpathLength`. The module's own doc comment states the boundary is read "from the contract, never re-derived from point coordinates" — but the same discipline is not applied to the rest of the arc-length parameterisation that the breakpoint `scrubFraction` values are built on.

Because each breakpoint's `scrubFraction` is `boundaryFraction + (real/totalReal) * (1-boundaryFraction)`, the table is internally self-normalizing (it always spans exactly `[boundaryFraction, 1]`), so this does not currently blow up into `NaN`/out-of-range values. But it *does* mean the intermediate `scrubFraction` values this module produces are only guaranteed to line up with the compiled trajectory's own `TrajectorySample.scrubFraction` values (used by `sampleAtFraction`, `traversedSegmentCount`, etc.) if `totalReal` (summed here, per-segment-only, skipping inter-segment gaps) happens to equal `trajectory.toolpathLength` (summed in `arc-length.ts` over the fully flattened point list). If a future toolpath ever produces a real gap between one segment's end point and the next segment's start point (not physically expected for continuous g-code, but never validated to be impossible either), or if `flattenToolpathPoints`'s own point-dedup logic differs from this module's naive per-segment loop, the two lengths silently diverge and `elapsedToFraction`/`fractionToElapsed` will target `scrubFraction`s that don't correspond to where the compiled samples actually are — subtly skewing perceived playback speed relative to path progress, with no test to catch it.

**Fix:** Either have `compile.ts` expose the per-vertex arc-length table it already builds (so `duration-mapping.ts` reuses the same numbers instead of re-deriving them), or add a test asserting `buildDurationMapping`'s internally-summed toolpath length equals `trajectory.toolpathLength` for both bundled real samples (mirroring the "real compiled trajectory" cross-checks `sample-lookup.test.ts`/`trail-progress.test.ts` already have).

### WR-02: `SampleSelect.tsx` can render a `<select>` `value` that isn't among its own rendered `<option>`s for one render, right after a mode switch

**File:** `src/ui/SampleSelect.tsx:64-94`, `src/ui/useCellModeSampleSync.ts:40-57`

**Issue:** `SampleSelect` filters its options via `samplesForMode(cellMode)` (a *reactive* subscription to `uiShellStore`) but sets the controlled `<select>`'s `value` from `selectedSampleId` (a *reactive* subscription to a *different* store, `cellStore`). When the mode bar changes `cellMode`, `SampleSelect` re-renders in the same commit with the new, filtered `availableSamples` list — but `selectedSampleId` is still whatever the *previous* mode had selected, because `useCellModeSampleSync`'s effect (the only thing that calls `selectSample` to update `selectedSampleId`) only runs *after* that render commits. For that one render, `value={selectedSampleId ?? ''}` references an id absent from the just-rendered `<option>` list, which the browser resolves by silently falling back to whatever option happens to be first in the DOM, momentarily out of sync with React's own `value` prop.

This is self-correcting (the effect fires synchronously afterward and both stores agree again within the same task), so it's unlikely to be visually perceptible, but it is a real, reasoned-through inconsistency between two stores that a future addition (e.g. more samples per mode, or a slower `selectSample`) could make worse.

**Fix:** Guard the displayed value against the currently-available list:
```tsx
const isSelectedInMode = availableSamples.some((s) => s.id === selectedSampleId)
// ...
<select value={isSelectedInMode ? selectedSampleId ?? '' : ''} ...>
```

### WR-03: `PlaybackControl`/duration mapping give no visual/timing distinction to a `frozen-at-unreachable` trajectory during autoplay

**File:** `src/playback/usePlaybackClock.ts:45-47`, `src/playback/duration-mapping.ts:104-119`

**Issue:** `buildDurationMapping` is built from `trajectory.travelLength`/`toolpathLength`, which `compile.ts` computes as the *full, untruncated* path length regardless of whether the compile walk actually froze partway (`compile.ts` computes `travelLength`/`toolpathLength` from the full point tables before the sample-solving walk even starts). So for a `frozen-at-unreachable` trajectory, the 10-second playback clock still runs to completion and reaches `fraction === 1` on schedule, even though `trajectory.samples` only covers a fraction of that range — `sampleAtFraction` correctly clamps to the last solved sample, so the robot just sits motionless for the remainder of the run. This isn't incorrect per the D-06 "freeze, never substitute" contract, but it means a user watching a frozen run gets no timing cue that the run "finished early" — the play button still shows the full 10 s elapsing while nothing moves for however much of that time was truncated. `SampleSelect.tsx` does show a static note about the freeze, but `PlaybackControl`/the clock give no indication once playback starts.

**Fix:** Optional/lower priority — consider scaling `PLAYBACK_TOTAL_DURATION_SECONDS` (or an early-`pause()`) to the truncated span for a frozen trajectory, or at minimum surface a same status note near the Play control while `isPlaying` is true and `trajectory.status === 'frozen-at-unreachable'`.

## Info

### IN-01: Unsafe array→tuple cast in `blendJoints`

**File:** `src/trajectory/sample-lookup.ts:57-63`
```ts
function blendJoints(
  a: TrajectorySample['joints'],
  b: TrajectorySample['joints'],
  ratio: number,
): TrajectorySample['joints'] {
  return a.map((value, i) => value + (b[i] - value) * ratio) as unknown as TrajectorySample['joints']
}
```
**Issue:** `.map` returns a loosely-typed `number[]`, and the `as unknown as ...` cast bypasses the tuple-length guarantee `JointAngles` presumably carries elsewhere in the kinematics layer. This is safe today only because `a`/`b` are always exactly 6-length arrays by construction; nothing in this function's own signature enforces that.

**Fix:** Mirror `blendPoint`'s explicit-index style instead of `.map` + cast, e.g. build the 6-tuple with named indices, or add a small `assertJointAngles(arr: number[]): JointAngles` helper that at least asserts `arr.length === 6` once, centrally, rather than casting blind at every call site.

---

_Reviewed: 2026-08-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
