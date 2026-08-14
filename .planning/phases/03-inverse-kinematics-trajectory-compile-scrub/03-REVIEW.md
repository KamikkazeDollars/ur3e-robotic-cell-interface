---
phase: 03-inverse-kinematics-trajectory-compile-scrub
reviewed: 2026-08-14T18:08:20Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/App.tsx
  - src/kinematics/index.ts
  - src/kinematics/inverse-kinematics.test.ts
  - src/kinematics/inverse-kinematics.ts
  - src/kinematics/rail.test.ts
  - src/kinematics/rail.ts
  - src/kinematics/singularity.test.ts
  - src/kinematics/singularity.ts
  - src/kinematics/ur3e-dh.ts
  - src/kinematics/urdf-joint-mapping.test.ts
  - src/kinematics/urdf-joint-mapping.ts
  - src/scene/CellScene.tsx
  - src/scene/RailRig.tsx
  - src/scene/RobotModel.tsx
  - src/scene/RobotPose.tsx
  - src/scene/ScrubMarker.tsx
  - src/store/cellStore.ts
  - src/trajectory/arc-length.test.ts
  - src/trajectory/arc-length.ts
  - src/trajectory/compile.test.ts
  - src/trajectory/compile.ts
  - src/ui/SampleSelect.tsx
  - src/ui/ScrubControl.tsx
  - src/ui/scene-status-copy.test.ts
  - src/ui/scene-status-copy.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-14T18:08:20Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the closed-form UR3e IK solver, the arc-length trajectory compiler, singularity classification, the URDF frame-correction seam, and the scrub UI/scene components added in this phase. `npm test` (112/112) and `npm run build` both pass, and the underlying IK/FK round-trip math is well-tested and, as far as I traced it by hand, algebraically sound (theta1/theta5/theta6/theta2-3-4 branch pairing, frame conversions in `compile.ts`'s `sceneToDhFrame`/`dhFrameToScene`, and the arc-length parameterisation in `arc-length.ts` all check out).

Despite that, one genuine, provable correctness bug survived review and testing: `classifySingularity`'s wrist-singularity check only tests joint 5 near **zero**, but the actual degeneracy condition (`sin(theta5) ≈ 0`, the same condition `solveUR6IK` itself special-cases) is also true near **±π** — exactly the second branch the neighbouring `elbow` check in the same file correctly handles. This makes the wrist flag silently wrong for a real, reachable subset of poses, and no test exercises the missing branch.

Three further robustness/maintainability issues are documented below (a NaN-unsafe store setter that contradicts its own doc comment, a stale doc comment naming the wrong seed pose, and a scene component that now imports the store directly, adding an edge to an already-existing module cycle). Two minor info-level items round out the report. On the already-known, explicitly-flagged travel-move table-clipping issue: nothing in this review contradicts the SUMMARY's own root-cause hypothesis (the regression check only validates the tracked TCP point against a table AABB, never the arm's own link geometry) — see the note at the end of the Info section.

## Critical Issues

### CR-01: `classifySingularity`'s wrist check misses the theta5 ≈ ±π degenerate branch

**File:** `src/kinematics/singularity.ts:49`
**Issue:** The wrist-singularity family is supposed to detect when joints 4 and 6's axes become collinear, i.e. when `sin(theta5) ≈ 0`. That happens at **two** places in the joint's `(-pi, pi]` range: `theta5 ≈ 0` and `theta5 ≈ ±pi`. `solveUR6IK` itself already special-cases exactly this condition via `Math.abs(s5) < ZERO_THRESH` (`inverse-kinematics.ts:192`), which is true at both ends. The `elbow` check three lines below in this same file correctly handles both ends of its own analogous condition:

```ts
const elbow =
  Math.abs(theta3) < SINGULARITY_ANGLE_EPSILON ||
  Math.abs(Math.abs(theta3) - Math.PI) < SINGULARITY_ANGLE_EPSILON
```

but `wrist` only checks one end:

```ts
const wrist = Math.abs(theta5) < SINGULARITY_ANGLE_EPSILON
```

For any solved pose whose `theta5` lands near `+pi` or `-pi` (a real, reachable branch — `q5options` in `solveUR6IK` includes `2*Math.PI - arccosQ5`, which collapses toward `pi` exactly when `arccosQ5` is near `pi`, the mirror case of the already-tested `arccosQ5 ≈ 0` collapse), `classifySingularity` reports `wrist: false` for a pose that is, in fact, at or very near a wrist singularity. This is a silently-wrong result of exactly the kind this codebase's own comments repeatedly warn against (the "confident, plausible-looking, wrong" failure mode named in `inverse-kinematics.ts`'s own PORT NOTE). `singularity.test.ts` only exercises `theta5 = 0`, never `theta5 ≈ ±pi`, so this gap passed both the test suite and the plan's own review.

Concretely, this means Phase 5's Dashboard (the documented consumer of `singularityFlags`) will fail to warn the user about roughly half of the real wrist-singular configurations a compiled trajectory could pass through.

**Fix:**
```ts
const wrist =
  Math.abs(theta5) < SINGULARITY_ANGLE_EPSILON ||
  Math.abs(Math.abs(theta5) - Math.PI) < SINGULARITY_ANGLE_EPSILON
```
Add a companion test case mirroring the existing "flags wrist when joint 5 sits at zero" test, but with a joint tuple numerically driven to `theta5 ≈ pi` (the same discipline `singularity.test.ts`'s header comment already requires — derived, not hand-guessed).

## Warnings

### WR-01: `setScrubFraction` is not NaN-safe, contradicting its own doc comment

**File:** `src/store/cellStore.ts:70-72, 106`
**Issue:** The field doc comment states: "Clamps into [0, 1] before writing, so a scrub control can never push the store out of the range `pointAtFraction` accepts." The implementation is:
```ts
setScrubFraction: (fraction) => set({ scrubFraction: Math.min(1, Math.max(0, fraction)) }),
```
`Math.max`/`Math.min` propagate `NaN` rather than clamping it (`Math.max(0, NaN) === NaN`). If `fraction` is ever `NaN` — e.g. a future Phase 4 playback timer dividing elapsed time by a zero-length duration, or any other caller that isn't the current range input — `scrubFraction` becomes `NaN` in the store. Every per-frame consumer of it computes an index from it without a finiteness guard:
```ts
// RobotPose.tsx / ScrubMarker.tsx
const rawIndex = Math.round(scrubFraction * (samples.length - 1)) // NaN
const index = Math.min(samples.length - 1, Math.max(0, rawIndex)) // NaN
const sample = samples[index] // undefined
robot.setJointValue(jointName, urdfJoints[i]) // toUrdfJointAngles(undefined.joints) throws
```
This would throw inside `useFrame`, which — since Phase 4/5/6 are documented as building directly on this contract — is a real forward risk, not a hypothetical one, even though the current native `<input type="range">` cannot itself produce a NaN value.

**Fix:**
```ts
setScrubFraction: (fraction) =>
  set({ scrubFraction: Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0 }),
```

### WR-02: Stale doc comment names the wrong continuity-seed pose

**File:** `src/kinematics/inverse-kinematics.ts:290-296`
**Issue:** `pickClosestBranch`'s doc comment says:
> "the decision of WHAT `previous` is (the prior compiled sample, or `UR3E_READY_POSE` for the very first sample) belongs to the caller (`src/trajectory/compile.ts`)"

This was true before the checkpoint-approved scope expansion in this same plan (03-01), but `compile.ts` was changed to seed with `UR3E_PARKED_POSE`, not `UR3E_READY_POSE`:
```ts
// compile.ts:286
let previousJoints: JointAngles = UR3E_PARKED_POSE
```
The comment in `inverse-kinematics.ts` was never updated to match. This module is imported by, and its contract documented for, later phases (`affects: [04-playback-timeline-telemetry, 05-dashboard-sensors, 06-operations-tree, 07-tool-changer]` per the plan frontmatter) — a reader trusting this comment would look for the wrong constant when tracing continuity behaviour.

**Fix:** Update the comment to reference `UR3E_PARKED_POSE` (and note that this is intentionally the render-boundary-corrected parked stance, not the retired `UR3E_READY_POSE`).

### WR-03: `RailRig.tsx` now imports the store directly, adding an edge to an existing module cycle

**File:** `src/scene/RailRig.tsx:2, 133`
**Issue:** This phase added `import { useCellStore } from '../store/cellStore'` to `RailRig.tsx` so the carriage can read `trajectory.railPos`. `cellStore.ts` imports `compileTrajectory` from `trajectory/compile.ts`, which imports `ROBOT_MOUNT_WORLD`/`TOOLPATH_ANCHOR_OFFSET` from `gcode/toolpath-anchor.ts`, which imports `RIG_Z_OFFSET`/`CARRIAGE_TOP_Y`/`CARRIAGE_BASE_DEPTH`/`CARRIAGE_BLOCK_DEPTH` back from `scene/RailRig.tsx` — a direct cycle: `RailRig → cellStore → compile → toolpath-anchor → RailRig`.

To be fair to this phase: a cycle through this same set of modules already existed before Phase 3 (`RailRig → RobotModel → cellStore → parseToolpath → toolpath-anchor → RailRig`, since `RobotModel.tsx` already imported `cellStore` and `parseToolpath.ts` already imported `toolpath-anchor.ts`), and `npm test`/`npm run build` both pass today, so this is not a newly-introduced runtime failure. What this phase did do is add a **second, more direct** edge into that cycle from a component whose own file header elsewhere in the codebase (`RobotPose.tsx`) goes out of its way to avoid coupling scene/state concerns for exactly this kind of fragility reason. Circular module graphs are sensitive to import-order changes (a reordered import list, a new intermediate module, or a bundler/dev-server upgrade can turn a currently-benign cycle into a TDZ `ReferenceError` on a `const` that hasn't been assigned yet when the cyclic import is first resolved) — this is exactly the kind of latent fragility that is cheap to avoid now and expensive to diagnose later.

**Fix:** Have `CellScene.tsx` (which already imports both `RailRig` and, transitively via other components, the store) read `trajectory?.railPos` and pass it down as a prop:
```tsx
// CellScene.tsx
const railPos = useCellStore((s) => s.trajectory?.railPos ?? RAIL_CENTER_X)
// ...
<RailRig railPos={railPos} />
```
```tsx
// RailRig.tsx
export default function RailRig({ railPos }: { railPos: number }) {
  // drop the `useCellStore` import entirely
  ...
}
```
This keeps `RailRig.tsx` a pure presentational component again and removes the new edge without touching the pre-existing cycle.

### WR-04: `compile.ts`'s freeze detection can silently degrade to a near-empty trajectory with no distinct signal

**File:** `src/trajectory/compile.ts:305-321`
**Issue:** Not a logic bug, but a robustness gap worth flagging: if the very first IK-solved travel waypoint (`liftPoint`, `i === 1` of the travel phase) is unreachable, `compileTrajectory` freezes with `samples.length === 1` (only the literal parked-pose sample). `SampleSelect.tsx`'s frozen-trajectory note (`Reached {reachedCount} of {requestedCount}`) still renders correctly in this case, but `RobotPose.tsx`/`ScrubMarker.tsx` will then show the robot statically parked for the entire scrub range (since `samples.length - 1 === 0` collapses every fraction to index 0), which reads to a user as "scrubbing does nothing" rather than "this sample is unreachable." This is an edge case for the two bundled, already-verified samples, but the travel waypoint design (`TRAVEL_LIFT_INSET_FRACTION = 0.5`, a single fixed inset validated only against the two current samples) has no margin/fallback if a future third sample's geometry pushes the lift waypoint out of reach the same way the rejected `0`-inset design did.

**Fix:** Not urgent for the current two bundled samples, but worth a follow-up: either widen the frozen-trajectory disclosure to explicitly call out "including the approach move" when `samples.length` is very small relative to `travelSampleCount`, or give the lift-waypoint inset a small reachability fallback (e.g., retry at a slightly different inset before freezing) rather than a single hardcoded fraction.

## Info

### IN-01: Deliberate index-derivation duplication between `RobotPose.tsx` and `ScrubMarker.tsx`

**File:** `src/scene/RobotPose.tsx:40-42`, `src/scene/ScrubMarker.tsx:59-61`
**Issue:** Both components independently compute `Math.round(scrubFraction * (samples.length - 1))` clamped to bounds. The SUMMARY documents this as a deliberate choice (two independently-inspectable call sites rather than one shared helper neither call site can see is being used consistently), and that reasoning is sound for exactly two consumers. Flagging only so that if a third per-frame consumer of this derivation is added in a later phase, it's extracted into a shared helper at that point rather than triplicated.
**Fix:** No action needed now; revisit if a third consumer appears.

### IN-02: Note on the already-known travel-move table-clipping issue

**File:** `src/trajectory/compile.ts` / `src/trajectory/compile.test.ts`
This was flagged as a known, still-open issue in the phase's own SUMMARY and wasn't re-investigated as a primary finding here. One observation that's consistent with (not a replacement for) the SUMMARY's own stated hypothesis: `compile.test.ts`'s "travel move clears the table" regression check (lines 162-192) only tests `sample.point` — the tracked TCP/flange position — against an axis-aligned table footprint. It never evaluates any other point on the arm (forearm, elbow, wrist links), and it never accounts for the tool-down orientation's own geometry (the flange approach axis is always straight down per `buildToolDownTarget`, but the *link* connecting wrist_1→wrist_2→wrist_3 can still sweep sideways during the diagonal `homeTcpPoint → liftPoint` segment even while the TCP itself stays clear). This matches the SUMMARY's own stated "most likely gap" and doesn't change the fact that this is out of scope for a source-level fix in this review pass.

---

_Reviewed: 2026-08-14T18:08:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
