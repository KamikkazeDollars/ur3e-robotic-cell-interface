# Phase 3: Inverse Kinematics + Trajectory Compile + Scrub - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/kinematics/inverse-kinematics.ts` | utility (pure math) | transform (Cartesian → joint-space) | `src/kinematics/forward-kinematics.ts` | exact |
| `src/kinematics/inverse-kinematics.test.ts` | test | transform round-trip | `src/kinematics/forward-kinematics.test.ts` | exact |
| `src/kinematics/singularity.ts` | utility (pure math) | transform (joints → flags) | `src/kinematics/forward-kinematics.ts` (`isWithinJointLimits`) | role-match |
| `src/kinematics/rail.ts` (extend: `resolveRailPosition`) | utility, extended | transform (points → scalar) | `src/kinematics/rail.ts` (existing `clampRailPosition`/`railRemainingTravel`) | exact (same file) |
| `src/kinematics/rail.test.ts` (extend) | test | — | `src/kinematics/rail.test.ts` (existing) | exact (same file) |
| `src/trajectory/arc-length.ts` | utility | transform (points → cumulative table) | `src/gcode/parseToolpath.ts` (geometry helpers) | role-match |
| `src/trajectory/arc-length.test.ts` | test | — | `src/gcode/parseToolpath.test.ts` / `forward-kinematics.test.ts` | role-match |
| `src/trajectory/compile.ts` | service (orchestrator) | batch/transform (toolpath → sample array) | `src/gcode/parseToolpath.ts` | role-match |
| `src/trajectory/compile.test.ts` | test | — | `src/gcode/parseToolpath.test.ts` | role-match |
| `src/store/cellStore.ts` (extend) | store | event-driven (coarse-cadence write) | `src/store/cellStore.ts` (existing `selectSample` async action + stale-request guard) | exact (same file) |
| `src/ui/ScrubControl.tsx` | component (controlled DOM control) | request-response (dispatch-only) | `src/ui/SampleSelect.tsx` | exact |
| `src/scene/ScrubMarker.tsx` | component (R3F scene) | event-driven (store-subscribed, imperative geometry) | `src/scene/Toolpath.tsx` (marker-sphere portion) | exact |
| Robot re-pose during scrub (likely new `src/scene/RobotPose.tsx` or extension of `src/scene/RobotModel.tsx`) | component (R3F scene) | event-driven (store read → imperative joint set) | `src/scene/RobotModel.tsx` (`setJointValue` loop) + `src/scene/ToolpathCameraFit.tsx` (store-subscribing imperative effect) | exact |
| Unreachable-point status surfacing | store + UI | event-driven | `src/store/cellStore.ts` (`toolpathLoadStatus` enum) + `src/ui/SceneStatusOverlay.tsx` / `src/ui/scene-status-copy.ts` | exact |

## Pattern Assignments

### `src/kinematics/inverse-kinematics.ts` (utility, transform)

**Analog:** `src/kinematics/forward-kinematics.ts`

**Imports pattern** (lines 1-10):
```typescript
// Hand-written standard-DH forward-kinematics chain for the UR3e.
// This module is deliberately framework-free (no rendering engine, no
// robot-loader, no UI framework import) so it is directly unit-testable...
import { UR3E_DH, UR3E_JOINT_LIMITS, type JointAngles } from './ur3e-dh';
```
The new IK module should follow the same discipline: import only from `./ur3e-dh` and reuse `Matrix4`/`JointAngles` types exported by `forward-kinematics.ts` (via the barrel `./index`), zero React/Three/urdf-loader imports.

**Core pattern — matrix algebra style** (lines 20-89 of `forward-kinematics.ts`):
```typescript
function multiply4(a: Matrix4, b: Matrix4): Matrix4 { /* explicit triple loop, no external matrix lib */ }
function rotZ(theta: number): Matrix4 { /* explicit 4x4 literal */ }
function dhTransform(theta: number, d: number, a: number, alpha: number): Matrix4 {
  return multiply4(multiply4(multiply4(rotZ(theta), transZ(d)), transX(a)), rotX(alpha));
}
```
Copy this "explicit 4x4 literal, no library" convention for any new matrix helper the IK solver needs (e.g. building a target `Matrix4` from position + assumed tool-down orientation).

**Reuse point — do not reimplement:**
```typescript
export function isWithinJointLimits(joints: JointAngles): boolean {
  return joints.every((angle, i) => {
    const { min, max } = UR3E_JOINT_LIMITS[i];
    return angle >= min && angle <= max;
  });
}
```
`inverse-kinematics.ts`'s `validBranches` must call this existing function unmodified (per D-04/RESEARCH.md), never reimplement limit checking.

**Function-doc / provenance comment convention** — every exported function in `forward-kinematics.ts` carries a multi-line doc comment citing the exact convention/spec it encodes (e.g. lines 100-106 citing `ARCHITECTURE.md`'s `T_rail(x) . T1(theta1) . ...` composition). The new `solveUR6IK` must carry an equivalent comment citing the `ur_kin.cpp`/Hawkins(2013) port, per RESEARCH.md's Code Examples section.

---

### `src/kinematics/inverse-kinematics.test.ts` (test)

**Analog:** `src/kinematics/forward-kinematics.test.ts`

**Header provenance comment** (lines 1-6):
```typescript
// Pitfall 1 (PITFALLS.md) — mandatory reference-pose test.
// Reference values below are typed in from 01-RESEARCH.md's independently
// cross-verified DH table + tool-computed home-pose matrix ... They are
// NEVER derived from this module's own output — that would make the test
// self-confirming (see T-01-06).
```
Apply the same discipline: IK round-trip test values must come from `forwardKinematics` (already trusted/tested), never be hand-derived and never self-confirming against the IK solver's own output alone.

**Test structure** (`describe`/`it` per behavior, `toBeCloseTo` with explicit precision):
```typescript
it('matches the known home-pose (all-zero joints) TCP position', () => {
  const T = forwardKinematics(UR3E_HOME_POSE);
  expect(T.tcpPosition.x).toBeCloseTo(-0.45675, 5);
  ...
});
```
RESEARCH.md's own `Code Examples` section already provides a ready-to-adapt `it.each(representativePoses)` block for the FK(IK(FK)) round trip — follow `forward-kinematics.test.ts`'s existing `toBeCloseTo(..., 5)` precision convention and its `RAIL_TRAVEL`-agreement test pattern (line 74-78) as the template for a rail-relative-target IK test.

---

### `src/kinematics/singularity.ts` (utility, new)

**Analog:** `src/kinematics/forward-kinematics.ts`'s `isWithinJointLimits` (pure predicate over `JointAngles`)

**Pattern to copy:** a small, framework-free pure function taking `JointAngles` and returning a plain data structure (mirror `isWithinJointLimits`'s `joints: JointAngles => boolean` shape, but returning a flags object instead of a boolean). Export type alongside function, same as `ForwardKinematicsResult` is exported alongside `forwardKinematics`.

---

### `src/kinematics/rail.ts` (extend — `resolveRailPosition`)

**Analog:** same file's existing `clampRailPosition`/`railRemainingTravel`

**Imports/header convention** (lines 1-19):
```typescript
// 7th-axis rail travel geometry.
// Provenance note (RESEARCH.md Assumption A4 / Open Question #1): ...
export const RAIL_TRAVEL = { min: -1.5, max: 1.5 } as const;
export const RAIL_CENTER_X = (RAIL_TRAVEL.min + RAIL_TRAVEL.max) / 2;
export function clampRailPosition(x: number): number {
  return Math.min(RAIL_TRAVEL.max, Math.max(RAIL_TRAVEL.min, x));
}
```
`resolveRailPosition` must be added as a new export in this same file, calling `clampRailPosition` on its result (never reimplementing clamping), and carry the same kind of provenance/rationale comment block explaining the D-01/D-02 "minimize worst-case reach" derivation — mirroring how the existing constants explain *why* 3m/centered was chosen, not just *what* the value is. RESEARCH.md's Pattern 3 flags a circular-import risk (`toolpath-anchor.ts` imports from this kinematics barrel) — take `mount`/points as parameters rather than importing `ROBOT_MOUNT_WORLD` directly, exactly as RESEARCH.md's own example signature does.

---

### `src/trajectory/arc-length.ts` (new module, new directory)

**Analog:** `src/gcode/parseToolpath.ts` (closest existing "pure geometry transform over point arrays" module — read for its point-array/vector conventions)

**Imports pattern** — no analog file in this codebase currently has a sibling `arc-length.test.ts`-style geometry helper; follow `forward-kinematics.ts`'s "framework-free, unit-testable in isolation" convention: no React/Three/store imports, operates purely on `readonly [number, number, number][]`.

**Core pattern:** RESEARCH.md's own `Code Examples` section provides the full implementation (`buildArcLengthTable`, `pointAtFraction`) — use it directly as the reference, adapted to this project's existing point-tuple type (`readonly [number, number, number]`, matching `ClassifiedSegment.points`'s type from `parseToolpath.ts`).

**Caution documented in RESEARCH.md:** must consume the toolpath's segments in original order (concatenated), NOT `toRenderBuckets`'s rapid/cutting split (`src/gcode/parseToolpath.ts`), which would corrupt ordering.

---

### `src/trajectory/compile.ts` (new module, orchestrator)

**Analog:** `src/gcode/parseToolpath.ts` (closest "parse/transform raw input into a validated, store-ready structure" orchestrator)

**Structure to mirror:** `parseToolpath.ts` (not fully read here, but referenced throughout CONTEXT.md/RESEARCH.md as: takes raw input, validates/classifies, returns a typed result object consumed directly by the store). `compile.ts` should follow the same shape: `compileTrajectory(toolpath: ParsedToolpath): TrajectoryCompileResult`, pure/sync (no fetch), called from the store's existing `selectSample` action (see cellStore pattern below) immediately after `parseToolpath` succeeds.

**Reuse points:**
```typescript
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor'
import { resolveRailPosition, clampRailPosition } from '../kinematics/rail'
import { solveUR6IK, validBranches, pickClosestBranch } from '../kinematics/inverse-kinematics'
import { classify } from '../kinematics/singularity'
import { buildArcLengthTable, pointAtFraction } from './arc-length'
```

**Error/never-throw discipline** — mirrors `cellStore.ts`'s `selectSample` try/catch (T-02-04 discipline: store only a status enum, never raw exception). D-06's "freeze at last valid pose" must be implemented as a pure return value (`{ samples, status: 'ready' | 'frozen-at-unreachable' }`), never a thrown exception that the store has to catch generically.

---

### `src/trajectory/compile.test.ts` / `src/trajectory/arc-length.test.ts` (new tests)

**Analog:** `src/kinematics/forward-kinematics.test.ts` / `src/kinematics/rail.test.ts` — `describe`/`it`, `toBeCloseTo(..., 5)`, testing against independently-known reference values, never self-confirming.

---

### `src/store/cellStore.ts` (extend)

**Analog:** same file's existing `selectSample` action + `resetToken` monotonic-token pattern

**Imports pattern** (lines 1-3):
```typescript
import { create } from 'zustand'
import { GCODE_SAMPLES } from '../gcode/samples'
import { parseToolpath, type ParsedToolpath } from '../gcode/parseToolpath'
```
Add `import { compileTrajectory, type TrajectoryCompileResult } from '../trajectory/compile'`.

**Coarse-cadence write discipline** (lines 5-14, the file's own header comment):
```typescript
/**
 * Minimal, coarse-cadence Zustand store...
 * this store carries UI-cadence intent only, never per-frame values...
 * pushing per-frame values through Zustand/React state forces a
 * full re-render every animation tick.
 */
```
New `scrubFraction`/`trajectory` state must respect this: `setScrubFraction` writes once per drag tick (or throttled), never per animation frame; the robot re-pose itself reads `trajectory` + `scrubFraction` and drives Three.js refs imperatively (mirrors `ToolpathCameraFit.tsx`'s pattern, not a new React-state-driven re-render path).

**Stale-request-guard / monotonic-token pattern to copy** (lines 63-116):
```typescript
let selectSampleRequestId = 0
...
selectSample: async (sampleId) => {
  selectSampleRequestId += 1
  const requestId = selectSampleRequestId
  ...
  try {
    ...
    if (requestId !== selectSampleRequestId) return
    set({ toolpath, toolpathLoadStatus: 'ready' })
  } catch (err) {
    console.error('Failed to load g-code sample:', err)
    if (requestId !== selectSampleRequestId) return
    set({ toolpathLoadStatus: 'error', toolpath: null })
  }
},
```
Trajectory compile should run inside this same `selectSample` action right after `parseToolpath` succeeds (compile once per sample selection, per D-04) — reusing the exact same request-id guard so a stale compile from a superseded selection can't stomp a newer one. Errors/`frozen-at-unreachable` status follow the same `console.error` + status-enum-only `set(...)` pattern (never store the raw exception, per T-02-04).

**resetToken monotonic-counter idiom** (lines 27-36) — reusable pattern if scrub needs a similar "fire every time even if value repeats" signal; likely not needed since `scrubFraction` itself is a distinct float per drag tick.

---

### `src/ui/ScrubControl.tsx` (new component)

**Analog:** `src/ui/SampleSelect.tsx`

**Imports pattern** (lines 1-2):
```typescript
import { useCellStore } from '../store/cellStore'
import { GCODE_SAMPLES } from '../gcode/samples'
```

**Dispatch-only convention** (component doc comment, lines 31-36):
```typescript
/**
 * Sample-selection dropdown (D-02). Reads `selectedSampleId` and dispatches
 * `selectSample` on change — mirroring `ResetViewButton.tsx`'s convention
 * that a DOM control only dispatches a store action and never touches the
 * scene, camera or parser directly.
 */
```
`ScrubControl.tsx` must follow the identical convention: read `scrubFraction`/`trajectory` from `useCellStore`, dispatch `setScrubFraction` on drag — never import from `scene/` or touch Three.js objects directly.

**Styling convention** (lines 11-29): inline `React.CSSProperties` objects built from the project's CSS custom properties (`var(--space-sm)`, `var(--color-secondary)`, `var(--text-label)`) — reuse the same custom-property names for the new slider's track/thumb/label styling, not a new one-off palette. Per RESEARCH.md, `radix-ui`'s `Slider.Root`/`Slider.Thumb` is available (already installed) but a native `<input type="range">` is an explicitly sanctioned fallback if `Slider` styling friction arises — `SampleSelect.tsx`'s own comment (lines 4-10) already documents the precedent of choosing the plain native element over a registry component for exactly this reason.

**Status-note convention** (lines 72-78) — conditional `<span role="status">` rendering a UI-facing message driven off store state, never a raw error — reuse this pattern for D-06's "frozen at unreachable point" message if surfaced inline near the scrub control (or route it through `SceneStatusOverlay`/`scene-status-copy.ts` instead — see below).

---

### `src/scene/ScrubMarker.tsx` (new component)

**Analog:** `src/scene/Toolpath.tsx` (the existing start/end marker-sphere portion, lines 76-110)

**Core pattern to copy:**
```typescript
const liftMarker = (point: readonly [number, number, number]): [number, number, number] => [
  point[0],
  point[1] + MARKER_RADIUS,
  point[2],
]
...
<mesh position={liftMarker(endpoints.start)}>
  <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
  <meshStandardMaterial color={CUTTING_COLOR} />
</mesh>
```
`ScrubMarker.tsx` renders one sphere (not two) at `pointAtFraction(points, table, scrubFraction)`, using the same "lift by radius so it doesn't clip the workbench surface" logic, and per D-07 must use a distinct tone from `CUTTING_COLOR`/`RAPID_COLOR` (both already claimed by `Toolpath.tsx`) — pick a new documented color, never the reserved Accent blue (`#2563EB`), consistent with `Toolpath.tsx`'s own header comment on color discipline (lines 6-9).

**Data-read pattern:** `useCellStore((state) => state.toolpath)` / new `state.trajectory` / `state.scrubFraction` selectors, `useMemo` for derived geometry — mirrors `Toolpath.tsx`'s `useMemo(() => {...}, [toolpath])` for `buckets`/`endpoints`.

---

### Robot re-pose during scrub (new — likely `src/scene/RobotPose.tsx` or extends `RobotModel.tsx`)

**Analog:** `src/scene/RobotModel.tsx`'s `setJointValue` loop (lines 36-38) + the store-subscribing imperative-effect pattern in `src/scene/ToolpathCameraFit.tsx` (not fully read, but referenced in RESEARCH.md's Integration Points as the model to mirror: "subscribes to store state and imperatively drives Three.js objects")

**Core pattern to copy:**
```typescript
UR3E_JOINT_NAMES.forEach((jointName, i) => {
  loadedRobot.setJointValue(jointName, UR3E_READY_POSE[i])
})
```
The new scrub-driven pose-setter reads the current trajectory sample's `joints` (looked up/interpolated by `scrubFraction`) and calls `setJointValue` the same way, plus sets the rail carriage's X translation to the sample's `railPos`. Per RESEARCH.md's architecture diagram, this must be driven via `useFrame` reading `getState()` (imperative, not a React-state-triggered re-render) once scrubbing is live-dragged — but since D-04 already precomputes the trajectory, a simpler `useEffect` keyed on `scrubFraction` may suffice if drag-rate writes stay coarse enough; confirm against CLAUDE.md's per-frame anti-pattern rule at implementation time.

**Frame-rotation convention that must be respected** (lines 26-30 of `RobotModel.tsx`):
```typescript
// The description uses a z-up frame; the scene is y-up. Rotating
// about x preserves the world x axis...
loadedRobot.rotation.x = -Math.PI / 2
```
The IK solver's joint outputs are already in the DH-native frame `setJointValue` expects directly (no further rotation needed for joint angles themselves — only Cartesian *targets* need the scene→DH conversion per RESEARCH.md Pattern 1).

---

### Unreachable-point status surfacing (D-06)

**Analog:** `src/store/cellStore.ts`'s `toolpathLoadStatus` enum + `src/ui/SceneStatusOverlay.tsx` + `src/ui/scene-status-copy.ts`

**Store pattern** (cellStore.ts lines 20-23):
```typescript
export type ToolpathLoadStatus = 'idle' | 'parsing' | 'ready' | 'error'
```
Add an equivalent status enum for trajectory/IK state, e.g. `'ready' | 'frozen-at-unreachable'`, stored alongside `trajectory` — never a raw caught exception (T-02-04 discipline, restated in `SceneStatusOverlay.tsx`'s own header comment lines 41-43: "the store already discards the exception object and keeps only the status enum").

**UI overlay pattern** (`SceneStatusOverlay.tsx`, lines 45-83): priority-ordered status check (robot > toolpath, here likely toolpath > trajectory), copy sourced from a dedicated `scene-status-copy.ts`-style module (never inlined strings) so copy is unit-testable independent of the component, matching `src/ui/scene-status-copy.ts` / `scene-status-copy.test.ts`'s existing split.

---

## Shared Patterns

### Framework-free pure kinematics/math modules
**Source:** `src/kinematics/forward-kinematics.ts` (header comment, lines 1-9)
**Apply to:** `inverse-kinematics.ts`, `singularity.ts`, `rail.ts` extension, `arc-length.ts`
```typescript
// This module is deliberately framework-free (no rendering engine, no
// robot-loader, no UI framework import) so it is directly unit-testable and
// reusable independent of the renderer.
```

### Store coarse-cadence discipline + stale-request guard
**Source:** `src/store/cellStore.ts` lines 5-14, 63-116
**Apply to:** any new `cellStore.ts` state/actions for `scrubFraction`, `trajectory`, unreachable-point status.
```typescript
let selectSampleRequestId = 0
// ...
if (requestId !== selectSampleRequestId) return
set({ toolpathLoadStatus: 'error', toolpath: null })
```

### Status-enum-only error handling (never store raw exceptions)
**Source:** `src/store/cellStore.ts` catch block (lines 109-115), `SceneStatusOverlay.tsx` header comment (lines 41-43)
**Apply to:** D-06's IK-failure handling, `compile.ts`'s return shape.

### DOM controls dispatch-only, never touch the scene
**Source:** `src/ui/SampleSelect.tsx` component doc comment (lines 31-36)
**Apply to:** `src/ui/ScrubControl.tsx`

### Provenance/citation comments on every non-obvious constant or algorithm
**Source:** `src/kinematics/rail.ts` header (lines 1-13), `src/gcode/toolpath-anchor.ts` throughout
**Apply to:** `resolveRailPosition` (cite D-02's reasoning), `solveUR6IK` (cite `ur_kin.cpp`/Hawkins 2013), tool-orientation assumption (cite Assumption A1).

### Color discipline (Dominant/Secondary/Accent)
**Source:** `src/scene/Toolpath.tsx` lines 6-9
**Apply to:** `src/scene/ScrubMarker.tsx` — pick a new documented tone, never the reserved Accent blue `#2563EB`.

## No Analog Found

None — every new/modified file has at least a role-match analog in the existing codebase.

## Metadata

**Analog search scope:** `src/kinematics/`, `src/trajectory/` (new), `src/store/`, `src/ui/`, `src/scene/`, `src/gcode/`
**Files scanned:** 24 (full `src/**/*.{ts,tsx}` glob)
**Pattern extraction date:** 2026-08-14
