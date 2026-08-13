# Architecture Research

**Domain:** Browser-based 3D robot cell simulation/HMI (g-code-driven UR3e toolpath playback with print/mill tool-changer)
**Researched:** 2026-08-13
**Confidence:** MEDIUM-HIGH (kinematics theory and UR3e DH parameters are HIGH/official-source; g-code viewer and urdf-loader ecosystem patterns are MEDIUM, drawn from widely-used open-source references; project-specific tab/telemetry composition is architectural reasoning, not sourced from a single canonical reference)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         TABBED UI SHELL (React)                        │
│  Setup │ Dashboard │ Vision │ Calibrate │ I/O │ Optimization │ Simulation│
│  (each tab = thin view subscribing to slices of the shared store)      │
├───────────────────────────────────────────────────────────────────────┤
│                        GLOBAL STATE STORE (Zustand)                    │
│  cellConfig │ parsedToolpath │ jointTrajectory │ playback │ activeTool │
│  activeTab  │ calibration    │ ioState         │ singularityFlags      │
└───────┬───────────────┬───────────────┬───────────────┬───────────────┘
        │ read/write    │ read          │ read          │ derive (selector)
        ▼               ▼               ▼               ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐
│ G-CODE PARSER │ │  KINEMATICS │ │  PLAYBACK    │ │ TELEMETRY SELECTORS │
│ (pure, no 3D) │ │  ENGINE     │ │  CONTROLLER  │ │ (pure functions of  │
│ text → moves[]│→│ (pure math) │→│ (time → pose)│→│  playback state)    │
│               │ │ DH/FK + IK  │ │              │ │                     │
└───────────────┘ └─────────────┘ └──────┬───────┘ └─────────┬───────────┘
                                          │ robotPose, tcpPose │
                                          ▼                    ▼
                              ┌────────────────────────────────────┐
                              │   3D SCENE / RENDERER (R3F/Three)   │
                              │  robot rig + rail + tool + toolpath │
                              │  line + nav cube + camera controls  │
                              └────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| G-code Parser | Text → ordered list of moves `{type, start, end, feedrate, toolState, lineNumber}`. No knowledge of 3D, robot, or store. | Pure TS module (or adapt `gcode-parser`/`cncjs` conventions); runs in a Web Worker for large files |
| Toolpath Generator | Annotates parsed moves with derived data: cumulative time, arc length, color-code category (rapid/linear/mill-engaged), operation grouping, start/end markers | Pure TS, operates on parser output, produces `Toolpath` object |
| Kinematics Engine | Owns DH table, joint limits, forward kinematics (joint angles → link/TCP transforms), closed-form 6-DOF IK for the UR arm, rail-position resolution, singularity detection | Pure math module (Matrix4/quaternion math via `three`'s `Matrix4` or `gl-matrix`), zero rendering dependencies, unit-testable in isolation |
| Trajectory Compiler | Runs every toolpath point through the kinematics engine once (not per-frame) to produce a precomputed `jointTrajectory`: array of `{t, railPos, joints[6], tcpPose, moveIndex}` | Pure TS; this is the bridge between "path in Cartesian space" and "playback in joint space" |
| Playback Controller | Owns the animation clock (`currentTime`, `isPlaying`, `speedMultiplier`). Advances time via `requestAnimationFrame`, looks up/interpolates the trajectory at `currentTime`, writes the resulting pose into the store | Small class or hook (`usePlaybackClock`) driving store updates imperatively, not via React re-render per frame |
| Global State Store | Single source of truth: cell config, parsed toolpath, trajectory, playback state, active tool, active tab, calibration offsets, I/O mock state | Zustand store (or Redux Toolkit) — flat, normalized slices |
| Telemetry Selectors | Derive Dashboard values (TCP position, speed, joint angles, rail position/remaining travel, singularity warnings) purely from `playback.currentTime` + `jointTrajectory`. No independent simulation loop. | Memoized selectors (`zustand` selector functions or `reselect`) |
| 3D Scene/Renderer | Renders robot rig (rail + 6 joints + active tool), toolpath polyline (color-coded, per-segment), nav cube, camera rig. Reads pose from store; never computes kinematics itself | React Three Fiber (`@react-three/fiber`, `@react-three/drei` for OrbitControls/GizmoHelper nav cube) |
| Tool-Changer Registry | Defines available tools (print head, mill spindle), their TCP offset transforms, and the changer station pose. Exposes `activeTool` and attach/detach logic | Config object + small state machine (`idle → moving-to-changer → detached → attached → idle`) |
| Tabbed UI Shell | Routes between Setup/Dashboard/Vision/Calibrate/I/O/Optimization/Simulation; each tab is a "dumb" consumer of store slices | React Router (or simple tab-state) + component-per-tab, all siblings of the Simulation tab's 3D canvas |

## Recommended Project Structure

```
src/
├── kinematics/                 # Pure math, zero React/Three deps — unit-testable
│   ├── ur3e-dh.ts              # DH table + joint limit constants (official values)
│   ├── forward-kinematics.ts   # joints[] + railPos → link transforms + TCP pose
│   ├── inverse-kinematics.ts   # TCP target → closed-form UR joint solutions (8 branches) + branch selection
│   ├── rail.ts                 # Rail axis composition (prismatic "joint 0")
│   └── singularity.ts          # Wrist/shoulder/elbow singularity detection
├── gcode/                      # Pure parsing, zero React/Three deps
│   ├── parser.ts                # text → Move[] (worker-safe)
│   ├── toolpath.ts              # Move[] → Toolpath (color-coding, ops grouping, timing)
│   └── worker.ts                # Web Worker entry for large-file parsing
├── trajectory/
│   └── compile.ts               # Toolpath + kinematics engine → JointTrajectory (precomputed once)
├── playback/
│   └── usePlaybackClock.ts      # rAF loop, time → interpolated frame, writes to store
├── tools/
│   ├── registry.ts              # print-head / mill-spindle definitions + TCP offsets
│   └── toolchange.ts            # attach/detach state machine
├── store/
│   └── cellStore.ts              # Zustand store: config, toolpath, trajectory, playback, activeTool, activeTab
├── scene/                        # React Three Fiber components only — read store, never compute
│   ├── RobotRig.tsx              # rail carriage + 6-joint chain, posed from store
│   ├── ToolMount.tsx             # flange child, swaps active tool mesh
│   ├── ToolpathLine.tsx          # color-coded polyline, current-position highlight
│   ├── NavCube.tsx               # Fusion-360-style view cube synced to camera
│   └── CellScene.tsx             # composes the above + OrbitControls
├── ui/
│   ├── tabs/                     # Setup, Dashboard, Vision, Calibrate, IO, Optimization, Simulation
│   └── shell/                    # tab bar, layout
└── App.tsx
```

### Structure Rationale

- **`kinematics/` and `gcode/` are framework-agnostic on purpose:** they contain the highest-risk, must-be-correct logic (DH math, IK branch selection, parsing edge cases). Keeping them free of React/Three imports means they can be unit-tested directly and reused if the rendering layer changes.
- **`trajectory/compile.ts` is the seam between "what the g-code says" and "how the robot plays it back."** It runs once per g-code load, not per frame — this is the single most important performance and correctness decision in the whole system (see Anti-Patterns).
- **`scene/` components are intentionally "dumb":** they read pose/toolpath data from the store and render it. No component in `scene/` should call the kinematics engine directly — that would let visual state drift from telemetry state, which is exactly what corrupted the Dashboard requirement ("computed from toolpath playback, not mock data").
- **`store/` is singular.** One store, not one-per-tab. Dashboard, Simulation, and the operations tree all read the same `playback` and `jointTrajectory` slices — this is what guarantees they can never desync.

## Architectural Patterns

### Pattern 1: Precompute-then-playback (trajectory compiled once, not solved per frame)

**What:** When a g-code file is loaded, immediately run the entire toolpath through IK once, producing a dense array of `{t, railPos, joints[6], tcpPose}` samples. Playback then becomes pure interpolation/array lookup over precomputed data — no IK solving happens during the animation loop.
**When to use:** Always, for this project. The toolpath is known in full ahead of time (it's a file, not a live/reactive target), so there is no reason to pay IK cost every frame.
**Trade-offs:** Uses more memory (trajectory array scales with move count × sample density) but that's cheap relative to the correctness and performance win. Avoids IK jitter/instability that live per-frame solving can introduce near singularities.

**Example:**
```typescript
// trajectory/compile.ts
function compileTrajectory(toolpath: Toolpath, prevJoints: JointAngles): JointTrajectory {
  const samples: TrajectorySample[] = [];
  let railPos = resolveRailPositionForOperation(toolpath); // fixed per operation, not per point
  let lastJoints = prevJoints;
  for (const point of sampleToolpath(toolpath)) {
    const solutions = solveUR6IK(point.tcpTarget, railPos);      // closed-form, up to 8 branches
    lastJoints = pickClosestBranch(solutions, lastJoints);        // continuity heuristic
    samples.push({ t: point.t, railPos, joints: lastJoints, tcpPose: point.tcpTarget, moveIndex: point.moveIndex });
  }
  return { samples };
}
```

### Pattern 2: Store-driven imperative rendering (no per-frame React state)

**What:** The playback clock updates the Zustand store at 60fps via a ref/imperative path; Three.js objects subscribe directly to store values inside `useFrame` (R3F) rather than via React prop re-renders.
**When to use:** Any time animation runs faster than is reasonable for React's reconciler (i.e., always, for a scrubbing/playing 3D robot).
**Trade-offs:** Slightly more imperative code, less "pure React," but this is the standard R3F pattern for animation and avoids frame drops.

**Example:**
```typescript
// scene/RobotRig.tsx
useFrame(() => {
  const { joints, railPos } = getInterpolatedFrame(useCellStore.getState());
  jointRefs.forEach((ref, i) => ref.current.rotation[axis[i]] = joints[i]);
  railRef.current.position.x = railPos;
});
```

### Pattern 3: Tool as a pluggable leaf node, not a second robot

**What:** The kinematic chain (rail + 6 UR joints) is one fixed rig. The end effector is a swappable child object attached to the flange (end of joint 6), selected by an `activeTool` enum in the store. Each tool definition carries its own TCP offset transform, which the kinematics engine consults when solving IK or computing telemetry.
**When to use:** Whenever the "robot" needs to support more than one end effector without duplicating the arm.
**Trade-offs:** Requires the kinematics engine to be parameterized by TCP offset (small extra argument) rather than hardcoding TCP = joint-6 frame. This is a small upfront cost that avoids a much larger one (two parallel robot models to keep in sync).

**Example:**
```typescript
// tools/registry.ts
export const TOOLS = {
  printHead:   { id: 'print-head',   tcpOffset: mat4Translate(0, 0, 0.14), changerSlot: 'A' },
  millSpindle: { id: 'mill-spindle', tcpOffset: mat4Translate(0, 0, 0.22), changerSlot: 'B' },
} as const;

// kinematics/forward-kinematics.ts
function computeTcpPose(joints: JointAngles, railPos: number, activeTool: ToolId): Matrix4 {
  const flange = forwardKinematics(joints, railPos);      // rig-only, tool-agnostic
  return flange.multiply(TOOLS[activeTool].tcpOffset);     // tool-specific offset applied last
}
```

## Data Flow

### Primary Flow: g-code → rendered, telemetry-backed playback

```
[User uploads .gcode/.nc file]
    ↓
[gcode/parser.ts]  text → Move[] {type, start, end, feedrate, ...}
    ↓
[gcode/toolpath.ts]  Move[] → Toolpath {segments[] with color-code, operations[], timing}
    ↓  (stored in cellStore.parsedToolpath)
[trajectory/compile.ts]  Toolpath + activeTool + kinematics engine → JointTrajectory (precomputed samples)
    ↓  (stored in cellStore.jointTrajectory)
[playback/usePlaybackClock.ts]  rAF loop advances cellStore.playback.currentTime
    ↓
[interpolate(jointTrajectory, currentTime)]  → {joints[6], railPos, tcpPose, moveIndex}
    ↓                                              ↓
[scene/RobotRig.tsx, ToolMount.tsx]        [telemetry selectors]
  poses the 3D rig + tool mesh               derive position/speed/joint angles/
  highlights current toolpath segment        rail remaining travel/singularity flags
    ↓                                              ↓
[3D Canvas: visible robot motion]          [Dashboard tab, operations tree: numbers/highlights]
```

Both the 3D scene and the telemetry/operations-tree panels read from the **same** `playback.currentTime` + `jointTrajectory`, so they cannot desync — this directly satisfies "Dashboard shows telemetry computed from toolpath playback, not mock data."

### State Management

```
cellStore (Zustand)
    ↓ subscribe (selector)
[Simulation tab: 3D canvas, playback controls, operations tree]
[Dashboard tab: telemetry readouts]           ←→ read-only selectors, no direct writes
[Setup tab: cell/tool config]                 ←→ writes cellConfig, activeTool
[Calibrate tab: home position, per-op joints]  ←→ writes calibration offsets (consumed by trajectory compile)
[Optimization tab: feed override, smoothing]   ←→ writes process params (triggers trajectory recompile)
[Vision/I-O tabs: sensor/IO mock state]        ←→ writes simulated sensor/IO values, independent of playback
```

### Key Data Flows

1. **Toolpath import → trajectory recompile:** Any change that affects the physical path (new g-code file, calibration offset change, rail-position strategy, active tool change) must re-run `compileTrajectory`. Treat this as a derived/cached value keyed on `(toolpath, calibration, activeTool)`, not something mutated in place.
2. **Playback tick → derived views:** `playback.currentTime` is the only thing that changes at animation speed. Everything downstream (scene pose, telemetry, operations-tree highlight, mill engagement color) is a pure function of `(jointTrajectory, currentTime)` — this is the core invariant to protect.
3. **Tool-change events:** Represented as boundaries within the trajectory (either derived from tool-change markers in the g-code, e.g. custom M-codes, or from switching between the separate Printing-tab and Milling-tab g-code files). Crossing a tool-change boundary during playback updates `activeTool` in the store, which swaps the `ToolMount` child mesh and changes which TCP offset the kinematics engine uses for subsequent samples.

## UR3e Kinematics / DH Representation

Use the **official Universal Robots DH parameters** (standard/Hartenberg convention; UR's `a` = Wikipedia's `r`), sourced directly from Universal Robots' published kinematics article. These are HIGH-confidence, official values — do not approximate:

| Joint (i) | a [m] | d [m] | alpha [rad] |
|---|---|---|---|
| 1 (shoulder pan) | 0 | 0.15185 | π/2 |
| 2 (shoulder lift) | -0.24355 | 0 | 0 |
| 3 (elbow) | -0.2132 | 0 | 0 |
| 4 (wrist 1) | 0 | 0.13105 | π/2 |
| 5 (wrist 2) | 0 | 0.08535 | -π/2 |
| 6 (wrist 3) | 0 | 0.0921 | 0 |

`theta_i` (the variable joint angle) is not a fixed DH constant — it's the live joint value from the trajectory/playback state.

```typescript
// kinematics/ur3e-dh.ts
export const UR3E_DH = [
  { a: 0,        d: 0.15185, alpha:  Math.PI/2 },
  { a: -0.24355, d: 0,       alpha:  0         },
  { a: -0.2132,  d: 0,       alpha:  0         },
  { a: 0,        d: 0.13105, alpha:  Math.PI/2 },
  { a: 0,        d: 0.08535, alpha: -Math.PI/2 },
  { a: 0,        d: 0.0921,  alpha:  0         },
] as const;

// UR e-series joints are software-limited to roughly ±360° (±2π) each by default,
// with narrower limits configurable per application/safety config. Treat exact
// application limits as a Setup/Calibrate-tab configurable, not a hardcoded constant
// — confirm exact defaults against UR's published joint range spec if precision matters.
export const UR3E_JOINT_LIMITS = [
  { min: -2 * Math.PI, max: 2 * Math.PI }, // repeat per joint; refine per app requirements
  // ...
];
```

**Forward kinematics:** standard DH homogeneous transform chain — `T_flange = T_rail(x) · T1(θ1) · T2(θ2) · ... · T6(θ6)`, each `Ti` built from `(a_i, d_i, alpha_i, theta_i)` via the classic DH matrix. Implement with `THREE.Matrix4` composition or a small custom 4x4 matrix utility; this is ~30 lines and should be unit tested against known UR poses (e.g., "all zeros" home pose has a well-known TCP position you can assert against).

**Inverse kinematics:** UR-series 6-DOF arms have a well-documented **closed-form analytic IK** (not general numerical IK) because of their spherical-wrist-like structure — this yields up to 8 valid joint solutions per Cartesian target (shoulder left/right × elbow up/down × wrist flip). Recommended approach: implement the analytic solver (ported from the well-known "ur_kinematics" formulation used across the ROS-Industrial `universal_robot` ecosystem and academic references), then pick the returned branch closest to the previous trajectory sample (minimize joint-space distance) to keep motion continuous and avoid visible "flips." This is both simpler and more numerically stable than a generic Jacobian/numerical IK solver, and it is the standard approach used by UR-focused tooling (e.g., RoboDK's UR support, offline programming tools).

## 7th-Axis Rail Composition (7-DOF Redundancy)

Model the rail as an **additional prismatic joint prepended to the chain**, not as a separate system:

```
worldTransform(t) = T_rail_translate(x_rail(t)) · T_base · [ T1(θ1) · ... · T6(θ6) ]
```

The rail contributes one translational DOF along its rail axis; combined with the arm's 6 rotational DOF, the full chain is kinematically redundant (7 DOF for a task that only needs 6 to place a TCP pose). Two ways to resolve that redundancy, in order of recommendation for this project:

1. **Discrete/per-operation rail placement (recommended for MVP).** Since the trajectory is precomputed from a known g-code file (not a live reactive target), pick a single rail position per operation (or per contiguous cluster of toolpath points) that keeps the whole operation's reach comfortably inside the UR arm's workspace — e.g., minimize the maximum required arm reach across the operation, or center the operation's Cartesian bounding box relative to the arm's base. Then solve ordinary 6-DOF closed-form IK for the arm at that fixed rail position. This sidesteps continuous 7-DOF redundancy resolution entirely and is dramatically simpler to implement correctly under a short timeline, while still faithfully modeling "the robot lives on a rail and the rail matters for reach."
2. **Continuous numerical redundancy resolution (stretch/future).** If the project later needs the rail to move *during* a single continuous path (not just between operations), use a damped-least-squares Jacobian pseudoinverse with a null-space secondary objective (e.g., keep the rail centered, or keep the arm's elbow away from limits) — this is the standard technique in 7-DOF-with-external-axis robotics (documented in multiple KUKA-linear-axis and general 7-DOF redundant-manipulator references). Flag this as a candidate for deeper phase-specific research if it becomes a real requirement; it is out of scope for a g-code-playback MVP.

**Singularities to detect and surface (not necessarily avoid) in the UI:**

| Singularity | Cause | Detection heuristic |
|---|---|---|
| Wrist singularity | Joint 4 and joint 6 axes become collinear (wrist 2 / joint 5 angle ≈ 0) | `abs(theta5) < epsilon` |
| Shoulder singularity | Wrist center lies on the joint-1 rotation axis (arm reaching directly overhead/through the base column) | Distance from wrist center to joint-1 axis < epsilon |
| Elbow singularity | Arm fully extended or fully folded (joint 3 ≈ 0 or ≈ π) | `abs(theta3)` near 0 or π |

Expose these as a `singularityFlags` derived value (Pattern: telemetry selector) consumed by the Dashboard — this is a UI/warning concern layered on top of the precomputed trajectory, not something that should block trajectory compilation or playback.

## Tool-Changer: Scene Graph and State Model

**State model (single source of truth in the store):**
```typescript
type ToolId = 'print-head' | 'mill-spindle';
interface ToolChangerState {
  activeTool: ToolId;
  changerSlots: Record<ToolId, { pose: Matrix4; occupied: boolean }>;
  changeInProgress: boolean; // true only during the brief swap animation, if simulated
}
```

**Scene graph:** one robot rig; the flange (end of joint 6) owns a single `ToolMount` group. `ToolMount` re-parents whichever tool's `Object3D` matches `activeTool` as its sole child; the other tool's mesh lives docked at its changer-station slot in the scene, not inside the kinematic chain, when inactive. This is the mechanism that avoids "hardcoding two entirely separate robots" — there is exactly one arm+rail hierarchy; only the terminal leaf and its TCP offset change.

```
CellScene
└── RailCarriage (prismatic, driven by railPos)
    └── UR3eBase
        └── Joint1 → Joint2 → Joint3 → Joint4 → Joint5 → Joint6
            └── ToolMount (flange)
                └── [activeTool === 'print-head'  ? <PrintHeadMesh/>  : null]
                └── [activeTool === 'mill-spindle' ? <MillSpindleMesh/> : null]
ChangerStation (fixture, fixed in world space)
├── SlotA (docked mesh when print-head inactive)
└── SlotB (docked mesh when mill-spindle inactive)
```

**Printing vs. Milling tabs** are then just two views over the same rig, parameterized by `activeTool` + the corresponding g-code file/trajectory — not two robots and not two scenes. Switching tabs sets `activeTool`, loads/points at the relevant `parsedToolpath`, and triggers a trajectory recompile (Pattern 1) using that tool's TCP offset.

**Mill depth-of-engagement color coding:** since this is g-code-driven simulation (not physical cutting), derive "in contact with material" as a property of the parsed toolpath segment (e.g., Z below a configured stock-surface height, or an explicit cutting-move type vs. rapid-retract type from the g-code), not a real collision/contact simulation. Store it as a per-segment attribute on `Toolpath.segments[i].engagement: 'none' | 'partial' | 'full'` computed once during `gcode/toolpath.ts`, then consumed identically by the toolpath-line color coding and (optionally) a telemetry readout.

## Suggested Build Order (Vertical MVP)

This order is chosen so each phase produces a visibly working, demoable increment, and so the "must not fail" core (import → animated, color-coded, telemetry-backed toolpath playback) is complete before any secondary tab is built.

| Phase | Delivers | Depends on | Why this order |
|---|---|---|---|
| 1. Static rig | UR3e (rig + rail) rendered at a fixed pose in an orbit/pan/zoom 3D scene, nav cube working | Kinematics constants (DH table), scene component structure | Nothing else can be validated until forward kinematics renders a recognizable, correctly-jointed robot |
| 2. G-code import + static toolpath | Upload a file, parse it, render the resulting polyline (color-coded by move type) and a static operations list — robot still static | Phase 1 scene to render into; `gcode/parser.ts`, `gcode/toolpath.ts` | Proves parsing/toolpath-generation correctness independent of kinematics/animation risk |
| 3. Trajectory compile + scrub | Precompute the joint trajectory (IK) for the parsed toolpath; add a scrub slider that poses the robot at any point in time | Phases 1+2; `kinematics/inverse-kinematics.ts`, `trajectory/compile.ts` | Isolates "does IK correctly place the robot along the path" from "does animation work" — much easier to debug a static scrub than a moving playback |
| 4. Playback engine | Play/pause/speed controls; robot animates continuously; toolpath line highlights current position; TCP marker moves | Phase 3's trajectory + `playback/usePlaybackClock.ts` | This completes the "must not fail" core value in isolation |
| 5. Telemetry / Dashboard | Position, speed, joint angles, rail position + remaining travel, all derived from the same playback state | Phase 4's playback state (pure selectors, no new logic) | Cheap once Phase 4 exists — proves the store-driven architecture pays off |
| 6. Operations tree refinement + mill engagement coloring | Per-operation timing, distinct start/end markers, mill-contact color coding | Phase 2's toolpath segmentation + Phase 4 playback | Polish on top of an already-working core |
| 7. Tool-changer + Printing/Milling tabs | `activeTool` state, `ToolMount` swap, changer station, tab switch triggers recompile with new TCP offset | Phases 1–4's rig/trajectory pattern | Requires the trajectory-compile and rig architecture to already support tool-offset parameterization (built into Pattern 3 from the start, not bolted on) |
| 8. Remaining tabs (Setup, Vision, Calibrate, I/O, Optimization) | Config/status panels reading/writing store slices | Store shape stabilized by Phases 1–7 | Lowest risk, least dependent on kinematics correctness — safe to cut scope here first if time runs out |

**Do not build tabs 5–8 before the Phase 1–4 core is solid.** They are all thin consumers of the same store; building them early risks locking in a store shape before the trajectory/playback architecture (the actual hard problem) is proven, and risks time being spent on breadth instead of the one thing explicitly called out as must-not-fail.

## Anti-Patterns

### Anti-Pattern 1: Two robot instances for Printing vs. Milling

**What people do:** Build a separate robot model/scene (or duplicate the rig hierarchy) per tab because "printing mode" and "milling mode" feel like different setups.
**Why it's wrong:** Doubles the kinematics/rendering surface, makes calibration and rail-limit state diverge between modes, and contradicts the project's own framing (one UR3e cell, two operation modes via a tool-changer).
**Do this instead:** One rig, one `activeTool` flag, a pluggable `ToolMount` leaf node (Pattern 3), and per-tool TCP offsets consumed by the kinematics engine.

### Anti-Pattern 2: Telemetry as an independently-running "fake" simulation

**What people do:** Build a second timer/loop that generates telemetry numbers (position, speed) separately from whatever drives the 3D animation, because it's easier to fake plausible-looking numbers than to wire up real derivation.
**Why it's wrong:** Directly violates the explicit requirement that Dashboard telemetry be "computed from toolpath playback, not mock data" — and the two loops will visibly desync (Dashboard says one position, robot renders another).
**Do this instead:** Telemetry is a pure selector over `(jointTrajectory, playback.currentTime)` — the same values the 3D scene reads. There is exactly one clock.

### Anti-Pattern 3: Solving IK every animation frame

**What people do:** Call the IK solver inside the `requestAnimationFrame`/`useFrame` loop, solving for "wherever the path is right now" on every tick.
**Why it's wrong:** Wastes CPU on a fully-known, precomputable path; risks visible jitter/branch-flipping near singularities when solved independently frame-to-frame instead of with trajectory-wide continuity; makes scrubbing/reversing playback expensive.
**Do this instead:** Precompute the whole trajectory once on g-code load (Pattern 1); playback is lookup/interpolation only.

### Anti-Pattern 4: Coupling the g-code parser to Three.js

**What people do:** Parse g-code directly into Three.js `Vector3`/`Line` objects inline in a React component.
**Why it's wrong:** Makes the parser untestable without a renderer, unusable in a Web Worker (Three.js objects aren't structured-cloneable), and hard to reuse if the rendering approach changes.
**Do this instead:** Parser and toolpath generator emit plain data (arrays of numbers/plain objects); a separate `scene/ToolpathLine.tsx` component converts that data into `BufferGeometry`/`Line2` for rendering.

### Anti-Pattern 5: React state driving per-frame 3D updates

**What people do:** Store joint angles in `useState`/Redux and let React re-render the whole component tree 60 times a second during playback.
**Why it's wrong:** React's reconciliation isn't built for 60fps churn; causes dropped frames and jank, especially once Dashboard/telemetry components are also subscribed.
**Do this instead:** Pattern 2 — imperative `useFrame` updates driven by a ref/`getState()` read, with React state reserved for discrete UI changes (play/pause toggle, tab switch, file load), not continuous animation values.

## Scaling / Performance Considerations

This is a single-user demo/interview app, not a multi-tenant system — "scaling" here means file size and frame budget, not concurrent users.

| Concern | Small g-code file (hundreds of moves) | Large g-code file (10k+ moves) |
|---|---|---|
| Parsing | Synchronous, main thread is fine | Move to a Web Worker (`gcode/worker.ts`) to avoid blocking the UI thread |
| Toolpath rendering | Individual `Line`/`Line2` segments fine | Use a single `BufferGeometry`/`Line2` with per-vertex color attributes rather than many separate mesh objects |
| Trajectory storage | Plain object arrays fine | Prefer typed arrays (`Float32Array`) for joint samples to reduce GC pressure during playback |
| IK solving | Negligible cost, closed-form | Still negligible — closed-form UR IK is O(1) per point; this scales fine even into the tens of thousands of points |

### Priorities

1. **First likely bottleneck:** rendering a very long toolpath as many discrete Three.js objects (draw call overhead). Fix: single buffered geometry with color attributes.
2. **Second likely bottleneck:** parsing a large file synchronously blocking the upload UI. Fix: Web Worker parse, or simple chunked parsing with a progress indicator.

Neither is likely to matter for an interview-scale demo file, but the architecture (pure parser/kinematics modules, precomputed trajectory) supports both fixes without restructuring if needed.

## Integration Points

### External Services

None required for v1. This is explicitly simulation-only (no live UR3e/RTDE connection per project scope) and g-code files are processed entirely client-side. The app can ship as a static SPA with no backend, which simplifies the "deploy to a public URL" constraint considerably (static hosting: Vercel/Netlify/GitHub Pages/Cloudflare Pages are all sufficient — no server-side kinematics or file processing needed).

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `gcode/` ↔ `trajectory/` | Plain data (`Toolpath` object) | No shared mutable state; trajectory compile is a pure function of toolpath + config |
| `kinematics/` ↔ everything else | Pure function calls, no store access | Keep the kinematics engine ignorant of Zustand/React entirely — makes it trivially unit-testable |
| `store/` ↔ `scene/` | Zustand subscriptions (`useCellStore`, `getState()` inside `useFrame`) | Scene never mutates kinematics inputs directly; it only reads derived pose |
| `store/` ↔ `ui/tabs/*` | Zustand subscriptions + action dispatchers | Tabs write config (Setup, Calibrate, Optimization); they never write `playback.currentTime` directly except via the playback controller's own actions |
| Tool registry ↔ kinematics engine | `activeTool` → TCP offset lookup, consumed as a parameter | Keeps tool-specific data out of the core DH/IK math |

## Sources

- Universal Robots, official DH parameters article (HIGH confidence, official/primary source): https://www.universal-robots.com/articles/ur/application-installation/dh-parameters-for-calculations-of-kinematics-and-dynamics/
- Universal Robots, DH parameters / robot motion developer docs (HIGH confidence, official): https://www.universal-robots.com/developer/hardware-and-motion/robot-motion-dh-parameters/
- `gkjohnson/urdf-loaders` (three.js URDF loader, actively maintained reference architecture for browser robot visualization/joint control) — MEDIUM-HIGH confidence, widely used open-source project: https://github.com/gkjohnson/urdf-loaders
- `cncjs/gcode-parser` (established open-source g-code parser conventions) — MEDIUM confidence: https://github.com/cncjs/gcode-parser
- three.js official G-code loader example (rendering convention reference) — MEDIUM confidence: https://threejs.org/examples/webgl_loader_gcode.html
- 7-DOF-with-external-linear-axis redundancy resolution references (Jacobian pseudoinverse, null-space methods) — MEDIUM confidence, academic/community sources: https://github.com/Walid-khaled/7DOF-KUKA-Linear-Axis-Forward-and-Inverse-Kinematics ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8587006/
- G-code rapid (G00) vs. feed (G01) move conventions — MEDIUM confidence, standard CNC references: https://www.cnccookbook.com/g00-g01-cnc-g-code/
- General robotics knowledge (DH-based forward/inverse kinematics theory, UR closed-form IK approach, singularity classification) — treated as HIGH-confidence established engineering theory; recommend validating the specific closed-form IK implementation against a reference (e.g., the widely-cited "ur_kinematics" formulation) during Phase 3 implementation rather than deriving from scratch.

---
*Architecture research for: browser-based UR3e robot cell simulation/HMI (toolpath playback, dual-mode print/mill, 7-axis kinematics)*
*Researched: 2026-08-13*
