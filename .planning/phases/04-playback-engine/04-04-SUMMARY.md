---
phase: 04-playback-engine
plan: 04
subsystem: scene/playback
tags: [gap-closure, playback, scene, three-fiber, ik-trajectory]
dependency graph:
  requires:
    - src/trajectory/compile.ts (CompiledTrajectory, travelLength, toolpathLength)
    - src/trajectory/sample-lookup.ts (sampleAtFraction — the shared fraction->pose lookup pattern this plan mirrors, not calls)
    - src/scene/marker-scale.ts (markerRadiusFromBounds, scrubMarkerRadiusFromBounds)
    - src/playback/usePlaybackClock.ts (writer of livePlayback.fraction)
  provides:
    - src/scene/trail-progress.ts (TrailGeometry, buildTrailGeometry, traversedSegmentCount)
    - src/scene/PlaybackTrail.tsx (default export PlaybackTrail, TRAIL_COLOR)
    - src/scene/marker-scale.ts (MIN_SCRUB_MARKER_DIAMETER_FRACTION, added)
  affects:
    - src/scene/CellScene.tsx (mounts PlaybackTrail; moved PlaybackClock to mount first)
tech-stack:
  added: []
  patterns:
    - "Pure framework-free geometry/math module (trail-progress.ts) unit-tested under Vitest's node environment, mirroring marker-scale.ts's split"
    - "Per-frame imperative writes only (geometry.instanceCount, visible) inside useFrame, no allocation, mirroring ScrubMarker.tsx's getState() idiom"
    - "Structural disk-read test (cell-scene-order.test.ts) as a regression guard for mount-order invariants invisible to every other automated check"
key-files:
  created:
    - src/scene/trail-progress.ts
    - src/scene/trail-progress.test.ts
    - src/scene/PlaybackTrail.tsx
    - src/scene/cell-scene-order.test.ts
  modified:
    - src/scene/CellScene.tsx
    - src/scene/marker-scale.ts
    - src/scene/marker-scale.test.ts
decisions:
  - "Hardcoded PlaybackTrail's line width (9) as a literal strictly greater than Toolpath.tsx's unexported CUTTING_LINE_WIDTH (6), with a comment citing the current value, rather than exporting CUTTING_LINE_WIDTH from Toolpath.tsx — keeps the new artifact list exactly as scoped in the plan's must-haves."
  - "traversedSegmentCount adds a 1e-9 floor epsilon before Math.floor to correct floating-point roundoff when a fraction lands exactly on an interior sample's own scrubFraction, without affecting genuine midpoint-between-samples cases (which differ by orders of magnitude more)."
  - "Raised SCRUB_MARKER_SCALE from 1.75 to 3.5 and added an asserted MIN_SCRUB_MARKER_DIAMETER_FRACTION (0.12) legibility floor, so a future edit that shrinks the multiplier fails a test instead of silently shipping an invisible marker again."
metrics:
  duration: 25min
  completed: 2026-08-15
status: complete
actuals:
  tokens: 8092
  tasks: 2
  commits: 3
---

# Phase 4 Plan 04: Traversed-Path Highlight and Marker Legibility (Gap Closure G-04-1) Summary

Added a growing teal highlight over the toolpath line that tracks playback progress via a floored, monotonically-increasing segment count, and fixed the invisible-during-autoplay scrub marker by both enlarging it (with an asserted legibility floor) and correcting a one-frame-stale read caused by `PlaybackClock` being mounted after its own readers.

## What Was Built

**Task 1 — `trail-progress.ts` + `PlaybackTrail.tsx`.** A pure, framework-free module (`buildTrailGeometry`, `traversedSegmentCount`) derives the highlight's polyline from a `CompiledTrajectory`, excluding the prepended parked-pose travel move by filtering on the compiler's own `travelLength`/`toolpathLength` boundary fraction rather than matching point coordinates. `traversedSegmentCount` floors (never rounds/ceils) the fraction-to-segment mapping so the highlight's leading end can never claim traversal the arm has not performed — asserted against both hand-built fixtures and a real compiled square-toolpath trajectory (uniform-step and no-overshoot invariants). `PlaybackTrail.tsx` renders this as a drei `<Line>` whose ref is a `Line2 | LineSegments2` from `three-stdlib`; every frame it writes only the geometry's `instanceCount` and the object's `visible` flag — no allocation inside the frame callback. Mounted in `CellScene.tsx` immediately after `Toolpath`, before `ScrubMarker`.

**Task 2 — marker legibility and frame-order correction.** `SCRUB_MARKER_SCALE` raised from 1.75 to 3.5 in `marker-scale.ts`, with a new exported `MIN_SCRUB_MARKER_DIAMETER_FRACTION` (0.12) legibility floor asserted in `marker-scale.test.ts` against both bundled samples' real spans (0.150m, 0.120m) plus a mid-range span — so a future multiplier regression fails a test rather than shipping an invisible marker again. Separately, `PlaybackClock` — the writer of `livePlayback.fraction` — was moved to mount first in `CellScene.tsx` (immediately after `PerspectiveCamera`), ahead of `RailRig` (carrying `RobotPose`), `PlaybackTrail`, and `ScrubMarker`; R3F runs `useFrame` callbacks in mount/subscription order, so every reader was previously observing the *previous* frame's fraction. `cell-scene-order.test.ts` reads `CellScene.tsx` from disk and structurally asserts the writer-before-readers invariant, since the staleness itself is invisible to every other automated check.

## Deviations from Plan

None — plan executed exactly as written, including the TDD RED→GREEN sequence for Task 1 (`trail-progress.test.ts` committed first against a non-existent module, confirmed failing, then `trail-progress.ts`/`PlaybackTrail.tsx`/`CellScene.tsx` committed together to turn it green).

## Verification

- `npm test` — 255/255 passing (21 test files), including the new `trail-progress.test.ts` (27 tests) and `cell-scene-order.test.ts`, and the extended `marker-scale.test.ts`.
- `npm run build` (`tsc -b && vite build`) — green, no type errors.
- `npm run lint` — pre-existing, non-functional ESLint config (missing `eslint.config.js`, flagged since Phase 2's `01-REVIEW.md`; unrelated to this plan's files, not fixed — out of scope per the plan's own scope boundary).
- Visual confirmation deferred to the blocking human-verification checkpoint in plan 04-06 (per plan's own `<verification>` section).

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed RED→GREEN: `test(04-04)` commit `6799fcd` (confirmed failing — module did not exist) before `feat(04-04)` commit `23926d2` (confirmed passing, 27/27). No REFACTOR commit was needed.

## Self-Check: PASSED

- `src/scene/trail-progress.ts` — FOUND
- `src/scene/trail-progress.test.ts` — FOUND
- `src/scene/PlaybackTrail.tsx` — FOUND
- `src/scene/cell-scene-order.test.ts` — FOUND
- `src/scene/CellScene.tsx` (modified) — FOUND
- `src/scene/marker-scale.ts` (modified) — FOUND
- `src/scene/marker-scale.test.ts` (modified) — FOUND
- Commit `6799fcd` (test) — FOUND in `git log`
- Commit `23926d2` (feat) — FOUND in `git log`
- Commit `30b3745` (fix) — FOUND in `git log`
