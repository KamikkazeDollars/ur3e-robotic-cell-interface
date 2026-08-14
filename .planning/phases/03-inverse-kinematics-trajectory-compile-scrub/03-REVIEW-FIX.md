---
phase: 03-inverse-kinematics-trajectory-compile-scrub
fixed_at: 2026-08-14T21:16:30Z
review_path: .planning/phases/03-inverse-kinematics-trajectory-compile-scrub/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-14T21:16:30Z
**Source review:** .planning/phases/03-inverse-kinematics-trajectory-compile-scrub/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04 — IN-01/IN-02 explicitly out of scope for this pass)
- Fixed: 5
- Skipped: 0

**Verification environment:** All edits, syntax checks, `npm test`, and `npm run build` ran inside an isolated git worktree (`.claude/worktrees/rf-03-35968-1786731154`, branch `gsd-reviewfix/03-35968`), fast-forwarded onto `master` after all fixes landed. The numbers below (118/118 tests, clean build) are reproducible by checking out the resulting `master` commits in the main working tree — they do not depend on any worktree-local state (no `node_modules` divergence; the worktree used the main checkout's install).

## Fixed Issues

### CR-01: `classifySingularity`'s wrist check misses the theta5 ≈ ±π degenerate branch

**Files modified:** `src/kinematics/singularity.ts`, `src/kinematics/singularity.test.ts`
**Commit:** 914209c
**Applied fix:** Changed the `wrist` check to test both degenerate branches of `sin(theta5) ≈ 0` — `theta5 ≈ 0` and `theta5 ≈ ±π` — mirroring the two-branch pattern the neighbouring `elbow` check already used. Added a regression test using the same joint tuple as the existing "theta5 = 0" test with only theta5 swapped to `Math.PI` (theta1-4 unchanged, so elbow/shoulder are still expected false, isolating the wrist-only change). `npx vitest run src/kinematics/singularity.test.ts` — 7/7 pass (up from 6).

### WR-01: `setScrubFraction` is not NaN-safe, contradicting its own doc comment

**Files modified:** `src/store/cellStore.ts`, `src/store/cellStore.test.ts`
**Commit:** ba4e1f4
**Applied fix:** `setScrubFraction` now falls back to `0` when the incoming `fraction` is not `Number.isFinite`, before the `Math.min`/`Math.max` clamp (which otherwise silently propagates `NaN`). Added regression tests for NaN, `+Infinity`, and `-Infinity` inputs, plus baseline clamp tests (above 1, below 0, in-range passthrough) since none previously existed for this setter. `npx vitest run src/store/cellStore.test.ts` — 18/18 pass (up from 13).

### WR-02: Stale doc comment names the wrong continuity-seed pose

**Files modified:** `src/kinematics/inverse-kinematics.ts`
**Commit:** e731450
**Applied fix:** Updated `pickClosestBranch`'s doc comment to name `UR3E_PARKED_POSE` (the actual seed `compile.ts` uses) instead of the retired `UR3E_READY_POSE`, and noted why (render-boundary-corrected parked stance). Comment-only change; verified via `tsc --noEmit` (no errors referencing this file) and full test suite.

### WR-03: `RailRig.tsx` imports the store directly, adding an edge to an existing module cycle

**Files modified:** `src/scene/RailRig.tsx`, `src/scene/CellScene.tsx`
**Commit:** 56ab548
**Applied fix:** Removed `RailRig.tsx`'s direct `useCellStore` import; it now receives `railPos` as a prop. `CellScene.tsx` (which already imports `RailRig` and, transitively, the store) reads `trajectory?.railPos ?? RAIL_CENTER_X` via a Zustand selector and passes it down. This removes the newly-added, more-direct cycle edge (`RailRig -> cellStore -> compile -> toolpath-anchor -> RailRig`) without touching the pre-existing cycle through `RobotModel.tsx`. Verified via `tsc --noEmit` (no errors in either file) and confirmed no other call site instantiates `<RailRig />` without the new required prop.

### WR-04: `compile.ts`'s freeze detection can silently degrade to a near-empty trajectory with no distinct signal

**Files modified:** `src/ui/SampleSelect.tsx`
**Commit:** d7dc8df
**Applied fix:** Chose the review's first suggested option (disclosure copy, not a reachability retry — lower risk, no change to IK/compile behavior). When the frozen-trajectory note renders and `reachedCount <= 1` (only the literal parked-pose sample landed — i.e. the very first IK-solved travel waypoint, the lift point, was already unreachable), the note now appends "including the approach move" so this reads as "this sample's approach move is unreachable" rather than "scrubbing does nothing." Verified via `tsc --noEmit` (no errors in this file); no existing test file for this component to extend.

## Skipped Issues

None — all 5 in-scope findings were fixed.

## Final Verification

- `npm test` — **118/118 pass** (up from 112 baseline; +6 new regression tests across CR-01 and WR-01).
- `npm run build` — succeeds (`tsc -b && vite build`), no new TypeScript errors. Pre-existing chunk-size-over-500kB warning is unrelated to this fix pass.
- IN-01 and IN-02 were intentionally left untouched per the fix scope for this pass.

---

_Fixed: 2026-08-14T21:16:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
