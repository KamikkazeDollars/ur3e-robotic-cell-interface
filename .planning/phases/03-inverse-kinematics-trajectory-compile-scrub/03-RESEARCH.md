# Phase 3: Inverse Kinematics + Trajectory Compile + Scrub - Research

**Researched:** 2026-08-14
**Domain:** Closed-form 6-DOF analytical inverse kinematics for a UR-series arm + 7th-axis rail redundancy resolution + arc-length-parameterized trajectory scrubbing (browser-side, pure TypeScript)
**Confidence:** MEDIUM-HIGH (IK algorithm structure and UR3e joint limits are now directly sourced/cross-checked against official/official-adjacent sources this session; TCP-orientation-for-g-code and rail/DH frame-conversion guidance are this session's own reasoning grounded in the existing codebase, not an external authority)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One rail position is resolved for the *entire* selected toolpath, not per-operation or per-cluster. Phase 2's toolpath has no operations concept yet — so the research's "per-operation rail placement" heuristic degenerates to a single position for this phase's single continuous path. Reversibility: costly — Phase 6 introduces true operations; if per-operation rail re-solving is wanted later, trajectory compile would need to accept a rail-position-per-operation-cluster input instead of one global value.
- **D-02:** The single rail X position is computed to *minimize the worst-case 3D reach distance* from `ROBOT_MOUNT_WORLD` to any point in the toolpath, clamped to `RAIL_TRAVEL` bounds — not hardcoded to `RAIL_CENTER_X`, and not simply "whatever the g-code says" (Pitfall 5). Because Phase 2's D-06 anchor already X-centers every toolpath's bounding box on `RAIL_CENTER_X`, and both bundled samples' X-spans (150mm, 120mm) sit well inside `ROBOT_REACH_ENVELOPE` (500mm) even with zero rail movement, this will likely resolve at or very near `RAIL_CENTER_X` for the two bundled samples. This is the expected, correct outcome, not the rail being vestigial — document this reasoning directly in code/tests. The algorithm must be general enough that a toolpath large enough or positioned far enough off the anchor's X-center *would* visibly move the rail.
- **D-03:** Use the closed-form analytical UR inverse kinematics solver (up to 8 branches per Cartesian target: shoulder left/right × elbow up/down × wrist flip). For every solve after the first, select the branch with the smallest joint-space distance from the *previous scrub position's* solution (Pitfall 2 + Pitfall 3). The very first solve (before any scrub has happened) seeds from `UR3E_READY_POSE`.
- **D-04:** Trajectory compile precomputes a dense, arc-length-sampled array of `{ scrubFraction, railPos, joints[6], tcpPose }` once per toolpath selection — re-running compile only when the selected sample changes, never on every scrub-drag event. Any IK solution that violates a joint limit (`isWithinJointLimits`, already in `src/kinematics/forward-kinematics.ts`) is rejected from the candidate branch set for that sample point (Pitfall 4) before the nearest-branch selection in D-03 runs.
- **D-05 (Claude's discretion, documented so it isn't re-litigated downstream):** The scrub control parameterizes progress as a **0–1 fraction of cumulative arc length** along the toolpath, not raw point/segment index and not synthetic time.
- **D-06 (Claude's discretion):** If no IK branch is valid for a given toolpath point, freeze the robot at the last valid pose and surface a clear, non-blocking status message. Never silently render a wrong/impossible pose and never crash. The store records only a status enum, never a raw exception.
- **D-07 (Claude's discretion):** Render a small marker on the toolpath line at the current scrub position, distinct from Phase 2's start/end markers. A single "current position" indicator, not per-operation.
- **D-08 (Claude's discretion):** Implement singularity detection (`src/kinematics/singularity.ts`) as a pure function of a joint solution, computed during trajectory compile and stored per sample, even though no UI surfaces it until Phase 5.

### Claude's Discretion

- Exact scrub control widget (slider styling, tick marks, numeric readout) — match existing minimal chrome (dropdown, Reset View button) from Phases 1–2.
- Arc-length sampling resolution for the precomputed trajectory array — dense enough for smooth-looking scrub interpolation, bounded enough to compile quickly for both bundled samples.
- Exact UR3e joint limit values — pull from Universal Robots' official datasheet, not a third-party source.
- Whether the closed-form IK solver is hand-ported directly from the ROS-Industrial `universal_robot` formulation or an equivalent well-documented reference.

### Deferred Ideas (OUT OF SCOPE)

- Real-time playback / play-pause (SIM-04) — Phase 4.
- Per-operation rail re-solving — Phase 6 territory, deliberate simplification not oversight.
- Singularity UI display / warnings — detection built now, Dashboard surfacing is Phase 5.
- Depth-of-engagement mill coloring, per-operation start/end markers, operations tree — Phase 6.
- Calibrate-tab-driven home-position/per-operation joint overrides — Phase 8; Phase 3's IK always seeds from the fixed `UR3E_READY_POSE`.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIM-05 | User can pause and scrub the playback timeline to any point in the operation | Closed-form IK derivation (§Standard Stack, §Code Examples), arc-length parameterization (§Code Examples), branch-continuity + joint-limit filtering (§Architecture Patterns), rail resolution (§Architecture Patterns), unreachable-point freeze/status handling (§Common Pitfalls, D-06 already locked) |

</phase_requirements>

## Summary

This phase has one true novel risk: porting a **closed-form analytical IK solver** for the UR3e correctly, then composing it with the already-built FK, DH table, and rail model without breaking any of their existing conventions. The algorithm itself is not in question — it's the well-documented Hawkins (2013) formulation, implemented as the de facto reference in ROS-Industrial's `universal_robot` package (`ur_kinematics/src/ur_kin.cpp`). This session fetched that source directly and extracted its literal step-by-step structure (θ1 → θ5 → θ6 → θ3 → θ2 → θ4, 8 solutions), which is reproduced in `Code Examples` below, adapted to this codebase's existing `UR3E_DH`/`JointAngles`/`Matrix4` types and its `T_i = Rot_z(θ) · Trans_z(d) · Trans_x(a) · Rot_x(α)` DH convention (the same standard-DH convention `ur_kin.cpp` assumes, so no re-derivation for a different convention is needed — Pitfall 1 is already satisfied by reusing the existing `forward-kinematics.ts` chain unmodified).

The UR3e joint limits already hardcoded in `src/kinematics/ur3e-dh.ts` (all joints ±360° except the elbow, artificially narrowed to ±180°, and wrist_3 unconstrained) were **independently re-verified this session** directly against `UniversalRobots/Universal_Robots_ROS2_Description`'s `config/ur3e/joint_limits.yaml`, whose header explicitly cites "Universal Robots e-Series, User Manual, UR3e, Version 5.8" as its source and explains *why* the elbow is narrowed (the shoulder_lift joint physically collides with it past ±180° due to the arm's own geometry). **No change to `ur3e-dh.ts`'s existing `UR3E_JOINT_LIMITS` values is needed** — the placeholder comment flagging them as "unconfirmed" can be resolved by citing this exact source.

The second real risk is **frame conversion**: toolpath points arrive in *scene*-space (metres, y-up, already anchored per `toolpath-anchor.ts`'s D-06 contract), but `forwardKinematics`/the new IK solver operate in the DH-native frame (z-up, pre-scene-rotation) that `RobotModel.tsx`'s `rotation.x = -Math.PI/2` and `toolpath-anchor.ts`'s own documented composition already establish. Every IK target must be converted scene→DH before solving, and the rail's contribution must be subtracted from the target before the 6-DOF solve runs (the 6-DOF solver only ever sees an arm-relative target, never a world-relative one) — get this backwards and the arm will silently pose at a plausible-looking but wrong location, exactly Pitfall 1's failure mode. This is spelled out precisely in `Architecture Patterns` below, verified against this session's read of `forward-kinematics.ts` and `toolpath-anchor.ts`.

Tool orientation is the one genuine open design question: g-code carries position only (`ClassifiedSegment.points: [number, number, number][]`, confirmed by reading `parseToolpath.ts` this session), so the IK solver's target *orientation* has no source data. No authoritative external reference gives a single named convention for this; the recommendation (a fixed tool-down orientation with the tool's approach axis on world −Y, X-axis derived from the local path tangent) is this session's own reasoning, consistent with this project's own `PITFALLS.md` Pitfall 9 guidance, and is logged in the Assumptions table below for explicit confirmation rather than presented as settled fact.

**Primary recommendation:** Port `ur_kin.cpp`'s algorithm verbatim (structure and variable roles, not the C++ syntax) into `src/kinematics/inverse-kinematics.ts`, reusing `UR3E_DH`'s existing `{a, d, alpha}` table and `forwardKinematics`'s existing DH convention with zero modification; solve at a rail-subtracted, DH-frame-converted target; filter candidate branches through `isWithinJointLimits` before applying the nearest-to-previous-solution continuity rule; and validate the whole thing with an `FK(IK(FK(joints))) ≈ joints` round-trip test plus at least one deliberately central/near-singular test pose, mirroring `forward-kinematics.test.ts`'s existing discipline.

## Architectural Responsibility Map

This project has no server/API tier (ARCHITECTURE.md: "ships as a static SPA with no backend") — tiers below are this project's own established layering (`kinematics/` pure math, `trajectory/` compiler, `store/` Zustand, `scene/` R3F, `ui/` DOM chrome), not the generic browser/API/CDN split.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Closed-form 6-DOF IK solve | Kinematics Engine (`kinematics/inverse-kinematics.ts`) | — | Framework-agnostic pure math, mirrors `forward-kinematics.ts`'s isolation (unit-testable, zero React/Three imports) |
| Rail position resolution (D-01/D-02) | Kinematics Engine (`kinematics/rail.ts`, extended) | Trajectory Compiler | Pure function of toolpath bounds + `ROBOT_MOUNT_WORLD`; must clamp through the existing `clampRailPosition` |
| Branch continuity selection (D-03) | Trajectory Compiler (new `trajectory/compile.ts`) | Kinematics Engine | IK returns up to 8 raw branches; the compiler (which alone knows "previous sample") picks the nearest one — this logic does not belong inside the stateless IK solver itself |
| Joint-limit filtering (D-04) | Kinematics Engine (`isWithinJointLimits`, existing) | Trajectory Compiler | Reused as-is; compiler calls it per-branch before continuity selection |
| Arc-length sampling / scrub-fraction→point mapping (D-05) | Trajectory Compiler | — | Computed once at compile time alongside the IK samples, not recomputed per scrub-drag event |
| Singularity detection (D-08) | Kinematics Engine (new `kinematics/singularity.ts`) | Trajectory Compiler | Pure function of a joint solution; compiler calls it once per compiled sample and stores the flag |
| Trajectory storage | Store (`cellStore.ts`, extended) | — | One coarse-cadence write per sample selection (compile result), never a per-scrub-frame write |
| Scrub control widget | UI (new component, DOM) | Store | Controlled slider dispatches a store action on drag, mirrors `SampleSelect.tsx`'s "never touch the scene directly" convention |
| Robot re-pose during scrub | Scene (R3F, imperative refs/`useFrame`) | Store | Reads the precomputed trajectory sample at the current scrub fraction and writes joint angles onto refs — never via React state per Phase 1's established anti-pattern rule |
| Scrub-position marker (D-07) | Scene (R3F) | — | New geometry, sibling to `Toolpath.tsx`'s existing marker spheres |
| Unreachable-point status (D-06) | Store (status enum) | UI (status overlay) | Mirrors `SceneStatusOverlay`/`toolpathLoadStatus` pattern already established |

## Standard Stack

### Core

No new runtime dependencies. Everything below is hand-rolled TypeScript extending existing modules, per `CLAUDE.md`'s locked "hand-rolled analytical IK, no third-party IK library" decision.

| Module | Status | Purpose | Why hand-rolled here |
|--------|--------|---------|----------------------|
| `src/kinematics/inverse-kinematics.ts` | New | Closed-form 6-DOF UR IK, up to 8 branches | No mature, well-maintained JS/TS UR-specific IK library exists (already established in `CLAUDE.md`'s "What NOT to Use": `glumb/kinematics` has unverified kinematic-chain assumptions and no UR validation) |
| `src/kinematics/singularity.ts` | New | Wrist/shoulder/elbow singularity flags (D-08) | Pure heuristic per ARCHITECTURE.md's Singularities table — no library needed |
| `src/trajectory/compile.ts` | New | Precompute dense `{scrubFraction, railPos, joints, tcpPose, singularityFlags}[]` array | Project-specific orchestration of the above; ARCHITECTURE.md Pattern 1 |
| `src/kinematics/rail.ts` | Extend | Add `resolveRailPosition(toolpath)` (D-02) alongside existing `RAIL_TRAVEL`/`clampRailPosition` | Existing module already owns rail travel geometry; this is the natural home |

### Supporting (already installed, confirmed this session)

| Library | Version (installed) | Purpose | When to Use |
|---------|---------|---------|-------------|
| `radix-ui` | `^1.6.7` (already a dependency) | Provides `Slider.Root`/`Slider.Thumb` primitives (`node_modules/radix-ui/dist/slider.*` confirmed present this session `[VERIFIED: node_modules/radix-ui/dist/slider.d.ts]`) | Use for the scrub control (D-05's UI) — no new package install needed, same umbrella import already used elsewhere in this project (`radix-ui`, not `@radix-ui/react-slider` as a separate package) |
| `vitest` | `^4.1.10` (already a dependency) | Unit tests for the new IK/trajectory modules | Follow `forward-kinematics.test.ts`'s existing pattern exactly (see `Code Examples`) |

**Installation:** None — no new packages required this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-ported closed-form IK | `glumb/kinematics` (generic 6-DOF JS IK) | Already rejected in `CLAUDE.md`: unverified kinematic-chain constraint, no UR-specific validation, sparse maintenance — unacceptable risk for a load-bearing module |
| Hand-ported closed-form IK | Numerical/iterative IK (CCD/FABRIK/Jacobian) | Slower, no deterministic branch enumeration (loses the shoulder/elbow/wrist branch semantics D-03's continuity rule depends on), convergence risk near singularities — explicitly the wrong tool per `ARCHITECTURE.md`'s IK section |
| `radix-ui`'s `Slider` | A native `<input type="range">` | Native range inputs are a legitimate simpler alternative (this project already uses a plain `<select>` in `SampleSelect.tsx` over a registry component, citing the same shadcn-CLI-version friction) — acceptable fallback if `Slider.Root`'s styling API proves more friction than value for a single control; flagged as a live implementation-time choice, not a hard requirement to use radix-ui's Slider |

## Package Legitimacy Audit

No external packages are installed this phase — `radix-ui`'s Slider primitive is bundled inside the already-audited, already-installed `radix-ui` umbrella package (confirmed present in `node_modules` this session, not a new install). This audit is not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[User drags scrub slider] (UI, DOM)
        │  onChange dispatches store action
        ▼
[cellStore.setScrubFraction(f)]  (Store, coarse-cadence write — one per drag tick, not per animation frame)
        │
        ▼
[cellStore.trajectory]  ← already precomputed once, see below
  lookup: samples[floor(f * (samples.length-1))]  (or lerp between the two bracketing samples)
        │  { railPos, joints[6], tcpPose, singularityFlags }
        ▼
┌───────────────────────────────┬─────────────────────────────┐
▼                                ▼                             ▼
[Scene: RobotRig-equivalent]   [Scene: scrub marker (D-07)]  [(Phase 5, not this phase) telemetry selectors]
  useFrame reads getState(),     positions a small sphere at
  writes joints[i] onto each     the interpolated point along
  joint ref's rotation           the toolpath geometry


═══ Trajectory compile (runs ONCE per sample selection, not per scrub drag) ═══

[cellStore.toolpath]  (Phase 2 output: ClassifiedSegment[], already D-06 anchored, scene-space)
        │
        ▼
[trajectory/compile.ts: resolveRailPosition(toolpath)]  (D-01/D-02, kinematics/rail.ts)
  → single railPos (clamped via clampRailPosition), minimizing worst-case reach
        │
        ▼
[trajectory/compile.ts: buildArcLengthTable(toolpath)]  (D-05)
  → cumulative-length array + total length, walking every segment's points in order
        │
        ▼
for each dense sample point s (sampled by arc-length fraction, not point index):
        │
        ▼
[scene→DH frame conversion]  (see "Frame Conversion" pattern below)
        │
        ▼
[kinematics/inverse-kinematics.ts: solveUR6IK(targetInDHFrame)]
  → up to 8 raw branches
        │
        ▼
[isWithinJointLimits filter]  (D-04, existing forward-kinematics.ts function, reused unmodified)
        │
        ▼
[pickClosestBranch(candidates, previousSample.joints ?? UR3E_READY_POSE)]  (D-03)
        │
        ▼
[kinematics/singularity.ts: classify(joints)]  (D-08, stored, not surfaced this phase)
        │
        ▼
append { scrubFraction: s, railPos, joints, tcpPose, singularityFlags } to trajectory.samples[]
        │
        ▼ (after all samples, or on first unreachable point per D-06)
[cellStore.trajectory = { samples, status: 'ready' | 'frozen-at-unreachable' }]
```

### Recommended Project Structure (additions to ARCHITECTURE.md's existing tree)

```
src/
├── kinematics/
│   ├── ur3e-dh.ts              # unchanged — DH table, joint limits already correct
│   ├── forward-kinematics.ts   # unchanged — reused as-is by IK round-trip tests
│   ├── inverse-kinematics.ts   # NEW — closed-form solver, up to 8 branches per target
│   ├── rail.ts                 # EXTEND — add resolveRailPosition(toolpath)
│   └── singularity.ts          # NEW — pure classify(joints) -> SingularityFlags
├── trajectory/
│   ├── compile.ts              # NEW — orchestrates the pipeline above
│   └── arc-length.ts           # NEW (or folded into compile.ts) — cumulative-length table + fraction->point
├── scene/
│   └── ScrubMarker.tsx         # NEW — D-07's current-position indicator
├── ui/
│   └── ScrubControl.tsx        # NEW — D-05's slider, mirrors SampleSelect.tsx's dispatch-only convention
```

### Pattern 1: Scene→DH frame conversion for IK targets

**What:** Toolpath points arrive in scene-space (`ClassifiedSegment.points`, metres, already D-06-anchored world coordinates `[VERIFIED: src/gcode/parseToolpath.ts:26-29]` — `"Ordered scene-space points (metres, world space, post D-06 anchor translation)"`). `forwardKinematics`/the new IK solver work in the DH-native frame the existing chain uses — the *same* frame `RobotModel.tsx` rotates by `rotation.x = -Math.PI / 2` to display, and the exact composition `toolpath-anchor.ts` documents: `[VERIFIED: src/gcode/toolpath-anchor.ts:36-38]` — `"scene-local x is the DH x, scene-local y is the DH z, scene-local z is the negated DH y"`. IK targets must be converted scene → DH before being handed to the solver: `dhX = scenePos.x - ROBOT_MOUNT_WORLD.x`, `dhY = -(scenePos.z - ROBOT_MOUNT_WORLD.z)`, `dhZ = scenePos.y - ROBOT_MOUNT_WORLD.y`.

**When to use:** Every call site that turns a toolpath point into an IK target — i.e., inside `trajectory/compile.ts`, nowhere else. Keep the conversion in exactly one function so it can't drift.

**Trade-offs:** None — this is a fixed, already-established convention; the only risk is *not* doing it (silently solving IK against scene-frame coordinates as if they were DH-frame, which "looks plausible" per Pitfall 1's exact failure description since both frames are metric and roughly co-located).

**Example:**
```typescript
// trajectory/compile.ts (new)
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor'

/** Converts a D-06-anchored scene-space point into the DH-native frame
 * `forwardKinematics`/the IK solver operate in, per the composition
 * documented in `toolpath-anchor.ts` (verified against RobotModel.tsx's
 * `rotation.x = -Math.PI/2` scene convention). */
function sceneToDhFrame(scenePoint: readonly [number, number, number]): {
  x: number
  y: number
  z: number
} {
  return {
    x: scenePoint[0] - ROBOT_MOUNT_WORLD.x,
    y: -(scenePoint[2] - ROBOT_MOUNT_WORLD.z),
    z: scenePoint[1] - ROBOT_MOUNT_WORLD.y,
  }
}
```

### Pattern 2: Rail-relative target before the 6-DOF solve

**What:** `forwardKinematics(joints, railPos)` composes as `cumulative = transX(railPos)` then the 6-joint DH chain `[VERIFIED: src/kinematics/forward-kinematics.ts:109-119]` — `"let cumulative = transX(railPos); for (let i = 0; i < 6; i++) { ... cumulative = multiply4(cumulative, jointTransform); }"`. The 6-DOF closed-form solver only ever operates on an *arm-relative* target (it has no rail concept at all). Before calling the IK solver, subtract the resolved rail position from the DH-frame target's x-component: `armRelativeTarget.x = dhFrameTarget.x - railPos`. This mirrors exactly how `forwardKinematics` composes the rail as a pure prepended translation.

**When to use:** Once per sample in `trajectory/compile.ts`, using the single `railPos` resolved by D-02 for the whole toolpath (not recomputed per-point).

**Trade-offs:** None if D-01's "one rail position for the whole toolpath" constraint holds (already locked) — this is a single scalar subtraction, not a per-point search.

**Example:**
```typescript
function toArmRelativeTarget(
  dhFrameTarget: { x: number; y: number; z: number },
  railPos: number,
): { x: number; y: number; z: number } {
  return { ...dhFrameTarget, x: dhFrameTarget.x - railPos }
}
```

### Pattern 3: Rail position resolution (D-01/D-02)

**What:** A pure function over the toolpath's points and `ROBOT_MOUNT_WORLD`, minimizing the worst-case 3D reach distance, clamped through the existing `clampRailPosition`. Since `ROBOT_MOUNT_WORLD` and the toolpath are both in scene-space, do this distance computation in scene-space (no DH conversion needed here — only the per-point IK target needs frame conversion, not this scalar optimization).

**When to use:** Once per toolpath selection, before any IK solving begins.

**Example:**
```typescript
// kinematics/rail.ts (extend)
import { ROBOT_MOUNT_WORLD } from '../gcode/toolpath-anchor' // careful: avoid a circular import —
// consider passing ROBOT_MOUNT_WORLD as a parameter instead of importing it here, since
// toolpath-anchor.ts itself imports from this kinematics barrel (RAIL_CENTER_X, forwardKinematics).

/** D-02: minimizes the worst-case reach distance from ROBOT_MOUNT_WORLD to any
 * toolpath point, by searching rail positions across RAIL_TRAVEL. A toolpath
 * whose bounding box is already X-centered on RAIL_CENTER_X (Phase 2's D-06
 * anchor) will resolve at or near RAIL_CENTER_X — expected, not vestigial
 * (see D-02's own note). */
export function resolveRailPosition(
  points: readonly [number, number, number][],
  mount: { x: number; y: number; z: number },
): number {
  // Candidate: the rail X that centers the toolpath's own X-span under the
  // mount, clamped to travel. This is the closed-form optimum for
  // "minimize max distance" when reach is dominated by the X-axis offset
  // (true here since Y/Z offsets are fixed by the anchor, not rail-adjustable).
  const xs = points.map((p) => p[0])
  const spanCenterX = (Math.min(...xs) + Math.max(...xs)) / 2
  return clampRailPosition(spanCenterX - mount.x + RAIL_CENTER_X)
}
```
Note: the exact closed-form derivation above (centering the toolpath's X-span under the mount) is this session's own reasoning — the planner/implementer should verify it against a brute-force/sampled search (evaluate reach at several candidate rail positions across `RAIL_TRAVEL` and pick the minimizing one) as a cross-check, since "minimize worst-case 3D reach" over a non-uniformly-distributed point set is not guaranteed to have its optimum exactly at the X-span midpoint if the toolpath's Y/Z extent is very uneven. A brute-force scan (sample ~50-100 candidate rail positions across `RAIL_TRAVEL`, compute max distance to `mount` for each, pick the minimum) is a safe, cheap, easy-to-verify fallback if the closed-form shortcut is contested in review.

### Anti-Patterns to Avoid

- **Solving IK against scene-frame coordinates directly:** Produces a plausible-looking but wrong pose (Pitfall 1's exact failure mode) — always convert scene→DH first (Pattern 1).
- **Re-solving the rail position per scrub sample:** D-01 locks one rail position for the whole toolpath; recomputing per-sample would violate D-01 and risk rail jitter (Pitfall 5's "rail visibly jitters between adjacent waypoints" warning sign).
- **Selecting IK branches per-point in isolation:** Causes visible flipping (Pitfall 3) — always compare against the *previous compiled sample's* joints, seeded from `UR3E_READY_POSE` for the very first sample (D-03).
- **Interpolating joint angles directly between two IK solutions to increase sampling density:** Produces a curved, physically arbitrary path in task space even though each individual solved sample is correct (Pitfall 13) — always solve IK independently at each arc-length-sampled *task-space* point, never lerp joint angles between two already-solved samples to "fill in" density.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 6-DOF IK math from scratch (deriving your own geometric solution) | A novel geometric IK derivation | The Hawkins/`ur_kin.cpp` structure, ported (not re-derived) | Re-deriving UR IK from first principles under a tight timeline is exactly the kind of "looks plausible, subtly wrong" risk `PITFALLS.md` Pitfall 1 warns about — a well-documented, widely-implemented reference exists; use it |
| Rail-position optimization (7-DOF redundancy) as a full Jacobian pseudoinverse solve | Damped-least-squares/null-space optimization | The simple deterministic heuristic in Pattern 3 | `ARCHITECTURE.md` already explicitly scopes this out as "research-grade robotics complexity disproportionate to a few-day project" — D-01/D-02 already lock the simpler approach |
| A general-purpose arc-length/curve library | `d3-shape`, `curve-interpolator`, or similar npm packages | The ~20-line cumulative-distance-array technique in `Code Examples` | This is textbook computational geometry (confirmed via this session's research — no domain-specific library adds value over a direct implementation for a polyline that's already fully known at compile time); adding a dependency for this is unjustified surface area |

**Key insight:** Every piece of math this phase needs (closed-form IK, rail optimization, arc-length parameterization) has either an existing, citable reference implementation to port, or is simple enough that a library would add dependency risk without reducing implementation risk. The only genuinely novel decision is the tool-orientation assumption (no library or reference solves this because g-code itself doesn't carry the data).

## Common Pitfalls

### Pitfall A: Frame mismatch between toolpath scene-space and IK's DH-native space (new, specific to this codebase)

**What goes wrong:** The IK solver is called with a target position taken directly from `ClassifiedSegment.points` (scene-space) without converting to the DH frame `forwardKinematics` uses. Because both frames are metric and roughly co-located (same scale, similar origin), the resulting pose looks *plausible* — the arm moves toward the right general area — but is measurably wrong (axes permuted/sign-flipped).
**Why it happens:** `forwardKinematics` and the toolpath pipeline were built by different phases with different frame conventions, each internally consistent but not directly interchangeable without the documented conversion.
**How to avoid:** Route every IK target through the single `sceneToDhFrame` conversion function (Pattern 1) — never call the IK solver with a raw `ClassifiedSegment.points` entry.
**Warning signs:** The round-trip test (`Code Examples` below) still passes (it never touches this conversion), but a full compile-and-render smoke test shows the robot's TCP marker visibly offset from the rendered toolpath line, or moving along a mirrored/rotated version of the actual path.

### Pitfall B: Elbow joint limit narrower than the other joints — but only if the placeholder logic changes

**What goes wrong:** `UR3E_JOINT_LIMITS`'s existing ±π elbow narrowing is *correct* (independently re-verified this session), but a future edit "fixing" it to match the other joints' ±2π (because a uniform limit "looks more consistent") would silently reintroduce a real UR3e mechanical impossibility.
**Why it happens:** The narrowing looks like an inconsistency at a glance (5 joints at ±2π, one at ±π) unless the comment explaining *why* (physical self-collision with `shoulder_lift`, per `ros-industrial/universal_robot#265`) is read.
**How to avoid:** Leave `UR3E_JOINT_LIMITS` as-is; this research session's re-verification (§Sources) is the citation to add to the existing placeholder comment, not a reason to change the values.
**Warning signs:** A code review or later phase "cleaning up" the joint limits table to a uniform range.

### Pitfall C: Tool-orientation assumption silently baked in without being flagged as an assumption

**What goes wrong:** Since g-code carries no orientation data, *some* fixed convention must be chosen for the IK target's rotation matrix. If this choice is implemented without a comment/flag, a later phase or reviewer may reasonably assume it came from the g-code itself (it didn't) or is an official UR/CAM convention (it isn't, per this session's research — no single authoritative source specifies this).
**Why it happens:** The gap between "g-code has X/Y/Z" and "IK needs a full 6-DOF pose" is easy to paper over silently since nothing crashes either way.
**How to avoid:** Implement the fixed-tool-down convention as a named, commented constant/function (e.g., `DEFAULT_TOOL_ORIENTATION` or `buildTargetOrientation(tangent)`), explicitly citing this research's Assumption A1 (below) in the comment, matching Pitfall 9's existing guidance to document this as a deliberate scoping decision.
**Warning signs:** No visible symptom in casual demo use (this is exactly Pitfall 9's own warning) — only surfaces if an interviewer specifically asks "how is tool orientation determined?" and the answer isn't already documented in code.

(Pitfalls 1–5, 13 from `PITFALLS.md` remain directly applicable and are threaded through `Architecture Patterns` above rather than restated here.)

## Code Examples

### The closed-form IK algorithm structure (ported from `ur_kin.cpp`, adapted to this codebase's types)

`[CITED: https://github.com/ros-industrial/universal_robot/blob/kinetic-devel/ur_kinematics/src/ur_kin.cpp]` — fetched and extracted this session. The variable roles below (`d1, a2, a3, d4, d5, d6`) map onto `UR3E_DH` as: `d1 = UR3E_DH[0].d`, `a2 = UR3E_DH[1].a`, `a3 = UR3E_DH[2].a`, `d4 = UR3E_DH[3].d`, `d5 = UR3E_DH[4].d`, `d6 = UR3E_DH[5].d` (the only nonzero `a`/`d` values in the table, `[VERIFIED: src/kinematics/ur3e-dh.ts:21-28]`).

```typescript
// kinematics/inverse-kinematics.ts (new)
// Ported from ur_kin.cpp's inverse() (ros-industrial/universal_robot,
// kinetic-devel), itself implementing Hawkins (2013) "Analytic Inverse
// Kinematics for the Universal Robots UR-5/UR-10 Arms". Same standard-DH
// convention as forward-kinematics.ts — no re-derivation needed (Pitfall 1
// already satisfied by reusing UR3E_DH unmodified).
import { UR3E_DH, isWithinJointLimits, type JointAngles, type Matrix4 } from '.'

const EPS = 1e-8

/** One candidate branch before limit filtering. */
type Candidate = JointAngles

/**
 * Solves for up to 8 joint-angle branches placing the flange at `target`
 * (a full 4x4 pose, DH-native frame, arm-relative — i.e. rail already
 * subtracted per Pattern 2). Mirrors ur_kin.cpp's `inverse()` structure:
 * theta1 (2 sols) -> theta5 (2 sols/theta1) -> theta6 -> theta3 (2 sols,
 * elbow up/down) -> theta2 -> theta4.
 */
export function solveUR6IK(target: Matrix4): Candidate[] {
  const [d1, , ,] = [UR3E_DH[0].d, 0, 0, 0]
  const a2 = UR3E_DH[1].a
  const a3 = UR3E_DH[2].a
  const d4 = UR3E_DH[3].d
  const d5 = UR3E_DH[4].d
  const d6 = UR3E_DH[5].d

  const T = target // row-major, T[row][col]
  const solutions: Candidate[] = []

  // --- theta1: up to 2 solutions ---
  const A = d6 * T[1][2] - T[1][3]
  const B = d6 * T[0][2] - T[0][3]
  const R = A * A + B * B
  const theta1Candidates: number[] = []
  if (Math.abs(d4 * d4 - R) < EPS * EPS ? d4 * d4 <= R : d4 * d4 <= R) {
    const acosVal = Math.acos(Math.min(1, Math.max(-1, d4 / Math.sqrt(R))))
    const atan2Val = Math.atan2(-B, A)
    theta1Candidates.push(acosVal + atan2Val, -acosVal + atan2Val)
  }

  for (const theta1 of theta1Candidates) {
    // --- theta5: up to 2 solutions per theta1 ---
    const numer = T[0][3] * Math.sin(theta1) - T[1][3] * Math.cos(theta1) - d4
    const div = Math.min(1, Math.max(-1, numer / d6))
    const acosT5 = Math.acos(div)
    for (const theta5 of [acosT5, -acosT5]) {
      // --- theta6 ---
      const s1 = Math.sin(theta1)
      const c1 = Math.cos(theta1)
      const s5 = Math.sin(theta5)
      let theta6 = 0
      if (Math.abs(s5) > EPS) {
        const sign = s5 > 0 ? 1 : -1
        theta6 = Math.atan2(
          sign * -(T[0][1] * s1 - T[1][1] * c1),
          sign * (T[0][0] * s1 - T[1][0] * c1),
        )
      } // else: wrist-2 singularity (Pitfall 2) -- theta6 underdetermined,
      // keep previous branch's theta6 (handled by the caller's continuity
      // selection, D-03) rather than an arbitrary 0.

      // --- theta2, theta3 (elbow, 2 solutions), theta4 ---
      const c5 = Math.cos(theta5)
      const s6 = Math.sin(theta6)
      const c6 = Math.cos(theta6)
      const x04x =
        -s5 * (T[0][2] * c1 + T[1][2] * s1) -
        c5 * (s6 * (T[0][1] * c1 + T[1][1] * s1) - c6 * (T[0][0] * c1 + T[1][0] * s1))
      const x04y = c5 * (T[2][0] * c6 - T[2][1] * s6) - T[2][2] * s5
      const p13x =
        d5 * (s6 * (T[0][0] * c1 + T[1][0] * s1) + c6 * (T[0][1] * c1 + T[1][1] * s1)) -
        d6 * (T[0][2] * c1 + T[1][2] * s1) +
        T[0][3] * c1 +
        T[1][3] * s1
      const p13y = T[2][3] - d1 - d6 * T[2][2] + d5 * (T[2][1] * c6 + T[2][0] * s6)

      const c3 = (p13x * p13x + p13y * p13y - a2 * a2 - a3 * a3) / (2 * a2 * a3)
      if (Math.abs(c3) > 1) continue // target unreachable at this branch (D-06)
      const acosT3 = Math.acos(c3)

      for (const theta3 of [acosT3, -acosT3]) {
        const denom = a2 * a2 + a3 * a3 + 2 * a2 * a3 * Math.cos(theta3)
        const s3 = Math.sin(theta3)
        const Acoef = a2 + a3 * Math.cos(theta3)
        const Bcoef = a3 * s3
        const theta2 = Math.atan2(
          (Acoef * p13y - Bcoef * p13x) / denom,
          (Acoef * p13x + Bcoef * p13y) / denom,
        )
        const c23 = Math.cos(theta2 + theta3)
        const s23 = Math.sin(theta2 + theta3)
        const theta4 = Math.atan2(c23 * x04y - s23 * x04x, x04x * c23 + x04y * s23)

        solutions.push([theta1, theta2, theta3, theta4, theta5, theta6])
      }
    }
  }

  return solutions
}

/** D-04: filters branches through the existing limit-checker before D-03's
 * continuity selection ever runs. */
export function validBranches(candidates: Candidate[]): Candidate[] {
  return candidates.filter(isWithinJointLimits)
}

/** D-03: nearest-in-joint-space selection, seeded from UR3E_READY_POSE for
 * the very first sample (caller's responsibility to pass that in). */
export function pickClosestBranch(candidates: Candidate[], previous: JointAngles): Candidate | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestDist = jointSpaceDistance(best, previous)
  for (const candidate of candidates.slice(1)) {
    const dist = jointSpaceDistance(candidate, previous)
    if (dist < bestDist) {
      best = candidate
      bestDist = dist
    }
  }
  return best
}

function jointSpaceDistance(a: JointAngles, b: JointAngles): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0))
}
```

**Implementation note:** the `theta1` reachability guard above is a placeholder for `ur_kin.cpp`'s more careful three-case branching (the `|A| < threshold` / `|B| < threshold` / general `d4² ≤ R` cases the WebFetch summary in this session's research captured) — the planner/implementer should re-fetch `ur_kin.cpp` directly during implementation and port the *exact* three-case logic rather than the simplified single-case version shown here, which was condensed for readability in this research document. Treat the code above as **structure and formula reference**, not verbatim-ready-to-paste production code — the exact conditional branching around near-singular divisions must be re-verified against the source file at implementation time.

### Round-trip test strategy (extends `forward-kinematics.test.ts`'s existing discipline)

```typescript
// kinematics/inverse-kinematics.test.ts (new)
import { describe, it, expect } from 'vitest'
import { forwardKinematics } from './forward-kinematics'
import { solveUR6IK, validBranches, pickClosestBranch } from './inverse-kinematics'
import { UR3E_READY_POSE, UR3E_HOME_POSE, type JointAngles } from './ur3e-dh'

describe('solveUR6IK', () => {
  const representativePoses: JointAngles[] = [
    UR3E_HOME_POSE,
    UR3E_READY_POSE,
    [0.3, -1.0, 0.8, -1.2, 0.9, 0.2], // arbitrary non-trivial pose
    // Pitfall 2's required deliberately-central/near-singular test:
    [0, -Math.PI / 2, 0, -Math.PI / 2, 0, 0], // wrist singularity candidate (theta5 ~ 0)
  ]

  it.each(representativePoses)('FK(IK(FK(joints))) recovers the original joints (or an equivalent branch)', (joints) => {
    const target = forwardKinematics(joints).matrix
    const candidates = validBranches(solveUR6IK(target))
    expect(candidates.length).toBeGreaterThan(0) // D-06: must never silently return nothing for a reachable pose
    const closest = pickClosestBranch(candidates, joints)!
    const recoveredFK = forwardKinematics(closest)
    const originalFK = forwardKinematics(joints)
    expect(recoveredFK.tcpPosition.x).toBeCloseTo(originalFK.tcpPosition.x, 4)
    expect(recoveredFK.tcpPosition.y).toBeCloseTo(originalFK.tcpPosition.y, 4)
    expect(recoveredFK.tcpPosition.z).toBeCloseTo(originalFK.tcpPosition.z, 4)
  })
})
```

### Arc-length parameterization (standard technique, `[CITED: general computational-geometry technique, cross-checked this session]`)

```typescript
// trajectory/arc-length.ts (new)
export interface ArcLengthTable {
  /** Cumulative distance up to and including point i, same length as `points`. */
  cumulative: number[]
  totalLength: number
}

export function buildArcLengthTable(points: readonly [number, number, number][]): ArcLengthTable {
  const cumulative: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0, z0] = points[i - 1]
    const [x1, y1, z1] = points[i]
    const segLen = Math.hypot(x1 - x0, y1 - y0, z1 - z0)
    cumulative.push(cumulative[i - 1] + segLen)
  }
  return { cumulative, totalLength: cumulative[cumulative.length - 1] ?? 0 }
}

/** Maps a 0-1 scrub fraction to an interpolated point along `points`,
 * using `table` (built once at compile time). */
export function pointAtFraction(
  points: readonly [number, number, number][],
  table: ArcLengthTable,
  fraction: number,
): [number, number, number] {
  const targetLength = Math.max(0, Math.min(1, fraction)) * table.totalLength
  // Linear scan is fine here: compile-time cost, not per-frame (dense
  // samples but a one-time cost per toolpath selection).
  let i = 1
  while (i < table.cumulative.length && table.cumulative[i] < targetLength) i++
  if (i >= points.length) return points[points.length - 1]
  const segStart = table.cumulative[i - 1]
  const segEnd = table.cumulative[i]
  const segFraction = segEnd > segStart ? (targetLength - segStart) / (segEnd - segStart) : 0
  const [x0, y0, z0] = points[i - 1]
  const [x1, y1, z1] = points[i]
  return [x0 + (x1 - x0) * segFraction, y0 + (y1 - y0) * segFraction, z0 + (z1 - z0) * segFraction]
}
```

Note: `points` here must be the toolpath's *flattened, ordered* point sequence across all segments (concatenate every `ClassifiedSegment.points`, in segment order — do **not** use `toRenderBuckets`'s rapid/cutting split, which reorders points into two separate buckets and would corrupt arc-length ordering).

## State of the Art

Not applicable in the "library churn" sense this section usually covers — the UR closed-form IK algorithm (Hawkins 2013) and its ROS-Industrial reference implementation have been the stable, unchanged standard for over a decade; there is no newer approach to adopt. The one relevant "state of the art" note: newer alternative formulations exist in the academic literature (e.g., subproblem-decomposition-based general 6-DOF solvers, closure-polynomial methods for the UR10e/other arms — surfaced in this session's search results but not pursued further), but none of them change the recommendation for this project's timeline — the well-documented, widely-ported Hawkins/`ur_kin.cpp` approach remains the correct choice for a few-day build with a hard correctness bar.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fixed tool-down orientation (approach axis on world −Y / DH −Z-equivalent, tangent-derived X axis) is an acceptable IK target-orientation convention for g-code that carries position only | Summary, Pitfall C | If an interviewer expects tilted-tool milling support, this reads as a real gap rather than a documented, deliberate scoping choice — mitigated by explicitly commenting the assumption in code (already this project's established pattern per Pitfall 9) |
| A2 | The closed-form rail-position optimum (Pattern 3) is well-approximated by centering the toolpath's X-span under the mount, rather than requiring a brute-force search over `RAIL_TRAVEL` | Architecture Patterns, Pattern 3 | Low risk for the two bundled samples (their X-spans are small relative to `ROBOT_REACH_ENVELOPE`, so almost any reasonable heuristic converges near `RAIL_CENTER_X` per D-02's own prediction) but could be measurably suboptimal for a hypothetical toolpath with very uneven Y/Z extent; the brute-force fallback noted in Pattern 3 resolves this if contested |
| A3 | The simplified single-branch `theta1` computation shown in the IK code example needs re-verification against `ur_kin.cpp`'s actual three-case conditional logic before being used as production code | Code Examples | If implemented as literally shown (rather than re-fetching the exact three-case branching), near-singular targets (where `|A|` or `|B|` is small) could produce `NaN`/incorrect `theta1` instead of the correct degenerate-case formula — must be caught by D-06's freeze-and-status handling regardless, but better avoided at the source |

## Open Questions

1. **Exact arc-length sampling resolution (fixed distance vs. fixed sample count vs. adaptive)**
   - What we know: Denser sampling gives smoother scrub interpolation and a more accurate straight-line/arc trace (Pitfall 13); this project's bundled samples are small (hundreds of points, not tens of thousands per `ARCHITECTURE.md`'s scaling table).
   - What's unclear: The exact resolution constant (e.g., one IK solve per 2mm of arc length vs. per 5mm) — left to Claude's discretion per CONTEXT.md.
   - Recommendation: Start with a fixed distance-based resolution (e.g., every 3-5mm of arc length, or a fixed sample count like 300-500 samples for the whole toolpath, whichever is simpler to implement first) and empirically verify against both bundled samples' compile time (should be well under a second given closed-form IK's O(1)-per-point cost, per `ARCHITECTURE.md`'s scaling table).

2. **Whether `resolveRailPosition`'s closed-form shortcut (Pattern 3) needs the brute-force cross-check before or after initial implementation**
   - What we know: For both bundled samples, the outcome is expected to land at/near `RAIL_CENTER_X` regardless of which method is used (D-02's own stated expectation).
   - What's unclear: Whether the closed-form shortcut's optimality guarantee matters enough to implement the brute-force cross-check as a permanent code path (not just a one-time sanity check during development).
   - Recommendation: Implement the closed-form shortcut first (simpler); add the brute-force cross-check as a one-time dev-time assertion/test (e.g., a Vitest test asserting the closed-form result never exceeds the brute-force-found minimum reach by more than a small tolerance) rather than shipping both as runtime code paths.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` `[VERIFIED: package.json:45]` |
| Config file | none dedicated — Vite's own config / Vitest defaults (matches existing `forward-kinematics.test.ts`, `rail.test.ts` which run with no separate `vitest.config.ts` present in the repo) |
| Quick run command | `npm run test -- src/kinematics/inverse-kinematics.test.ts` |
| Full suite command | `npm run test` (= `vitest run` `[VERIFIED: package.json:11]`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-05 | `FK(IK(FK(joints))) ≈ joints` for representative poses including a near-singular one | unit | `npm run test -- src/kinematics/inverse-kinematics.test.ts` | ❌ Wave 0 |
| SIM-05 | Branch continuity: consecutive IK solves along a path never jump more than a small joint-space distance when a closer branch exists | unit | `npm run test -- src/kinematics/inverse-kinematics.test.ts` | ❌ Wave 0 |
| SIM-05 | Joint-limit filtering rejects out-of-range branches before continuity selection | unit | `npm run test -- src/kinematics/inverse-kinematics.test.ts` | ❌ Wave 0 |
| SIM-05 | Rail position resolves within `RAIL_TRAVEL` and at/near `RAIL_CENTER_X` for both bundled samples | unit | `npm run test -- src/kinematics/rail.test.ts` | ❌ Wave 0 (extends existing file) |
| SIM-05 | Arc-length table's `totalLength` matches a manually-summed reference distance for a small hand-built polyline | unit | `npm run test -- src/trajectory/arc-length.test.ts` | ❌ Wave 0 |
| SIM-05 | `pointAtFraction(0)` and `pointAtFraction(1)` return the toolpath's exact first/last points | unit | `npm run test -- src/trajectory/arc-length.test.ts` | ❌ Wave 0 |
| SIM-05 | Trajectory compile end-to-end: compiling a known small toolpath produces a non-empty, monotonically-fraction-ordered sample array | unit/integration | `npm run test -- src/trajectory/compile.test.ts` | ❌ Wave 0 |
| SIM-05 | Dragging the scrub slider re-poses the visible robot with no visual snapping/flipping, at any point in the timeline, for both bundled samples | manual (no e2e/browser test tooling installed in this project — confirmed no Playwright/Cypress in `package.json`) | UAT walkthrough, mirroring `01-UAT.md`/`02-UAT.md`'s existing pattern | N/A — manual only |

### Sampling Rate

- **Per task commit:** `npm run test -- src/kinematics/inverse-kinematics.test.ts src/kinematics/rail.test.ts src/trajectory/` (fast, kinematics-scoped)
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual scrub UAT walkthrough

### Wave 0 Gaps

- [ ] `src/kinematics/inverse-kinematics.test.ts` — covers SIM-05's IK correctness/round-trip/continuity/limit-filtering behaviors
- [ ] `src/trajectory/arc-length.test.ts` — covers SIM-05's arc-length table and fraction-to-point mapping
- [ ] `src/trajectory/compile.test.ts` — covers SIM-05's end-to-end trajectory compile
- [ ] `src/kinematics/rail.test.ts` extension — add `resolveRailPosition` cases (existing file, existing framework, no new setup needed)
- [ ] Framework install: none — Vitest already configured and running (`forward-kinematics.test.ts`, `rail.test.ts` already pass)

## Security Domain

ASVS L1 `[VERIFIED: .planning/config.json — "security_asvs_level": 1]`. This phase is pure client-side numeric computation over already-validated data (the toolpath was parsed, bounds-checked, and NaN/Infinity-rejected in Phase 2 per `parseToolpath.ts`'s `isFiniteVector` guard, read this session) — no new network input, no new file parsing, no auth/session surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this app |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user local app |
| V5 Input Validation | yes | The IK solver must treat every internal division/`acos`/`asin` domain edge (near-zero denominators, `|x| > 1` arguments) as an ordinary "no valid branch" case — clamp `acos`/`asin` arguments to `[-1, 1]` before calling (already shown in the `Code Examples` port) and reject via `validBranches`/D-06's freeze-and-status path rather than letting `NaN` propagate into the rendered scene |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `NaN`/`Infinity` propagating from a near-singular IK division into the rendered robot pose (a silent-corruption class of bug, not a classic external-attacker threat, but still a Tampering-adjacent data-integrity concern within ASVS V5's scope) | Tampering (data integrity) | Clamp all `acos`/`asin` arguments before calling; filter every candidate branch through `Number.isFinite` in addition to `isWithinJointLimits` before it can reach `pickClosestBranch`; D-06's existing freeze-at-last-valid-pose contract is the correct terminal handling |
| Trajectory compile running on an extremely dense/adversarial toolpath (very large uploaded g-code, out of this phase's scope but worth noting since Phase 2 already caps `MAX_TOOLPATH_SEGMENTS = 5000` `[VERIFIED: src/gcode/parseToolpath.ts:65]`) causing excessive compile-time CPU (a mild Denial-of-Service-adjacent concern, client-side only, no shared resource) | Denial of Service (client-side only, self-inflicted) | Already bounded by Phase 2's existing `MAX_TOOLPATH_SEGMENTS` ceiling — no new cap needed this phase; closed-form IK is O(1) per point so total compile cost scales linearly and predictably with the already-capped segment count |

## Sources

### Primary (HIGH confidence)

- `raw.githubusercontent.com/UniversalRobots/Universal_Robots_ROS2_Description/rolling/config/ur3e/joint_limits.yaml` — fetched directly via `curl` this session; explicitly cites "Universal Robots e-Series, User Manual, UR3e, Version 5.8" as its own source and explains the elbow-joint narrowing rationale (physical collision with shoulder_lift past ±180°, referencing `ros-industrial/universal_robot#265`). Official Universal-Robots-maintained GitHub org repository. `[VERIFIED: fetched this session via curl]`

### Secondary (MEDIUM confidence)

- `github.com/ros-industrial/universal_robot/blob/kinetic-devel/ur_kinematics/src/ur_kin.cpp` — fetched via WebFetch this session; extracted the literal step-by-step IK algorithm structure reproduced in `Code Examples`. Widely-used, actively-referenced ROS-Industrial reference implementation of the Hawkins (2013) closed-form UR IK. `[CITED, fetched this session]`
- Kelsey P. Hawkins, "Analytic Inverse Kinematics for the Universal Robots UR-5/UR-10 Arms" (2013) — the original derivation `ur_kin.cpp` implements; identified via WebSearch this session (direct PDF fetch from the Georgia Tech repository was blocked by a 403). `[CITED via secondary WebSearch summary, primary PDF not directly readable this session]`
- Standard arc-length parameterization technique (cumulative-distance-array + interpolation) — cross-checked across multiple independent computational-geometry references this session, no single authoritative source needed since this is established, textbook technique. `[CITED, cross-checked]`

### Tertiary (LOW confidence)

- General CAM/offline-programming tool-orientation conventions (RoboDK, Robotmaster, RobMach) — WebSearch only, no direct confirmation of a specific "fixed tool-down" convention as a named industry standard; informs Assumption A1 but does not settle it. `[ASSUMED — flagged in Assumptions Log]`

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps, hand-rolled IK): HIGH — no external library risk, decision already locked in `CLAUDE.md`/CONTEXT.md
- IK algorithm structure: MEDIUM-HIGH — directly fetched and extracted from the reference implementation this session, but the code example itself needs re-verification against the exact source at implementation time (Assumption A3)
- UR3e joint limits: HIGH — directly cross-verified this session against an official-source-citing config file; matches the codebase's existing (previously placeholder-flagged) values exactly
- Frame-conversion guidance (scene↔DH, rail-relative target): HIGH — derived from this session's direct reads of `forward-kinematics.ts` and `toolpath-anchor.ts`'s own documented composition, not external speculation
- Tool orientation: LOW — genuinely unresolved by any external authority; flagged as Assumption A1 for confirmation
- Arc-length parameterization: HIGH — standard, well-established technique, low implementation risk

**Research date:** 2026-08-14
**Valid until:** Indefinite for the IK algorithm/joint-limits/frame-conversion findings (stable, decade-old references and this project's own fixed conventions) — the tool-orientation assumption (A1) should be reconfirmed if the project's g-code sample scope changes (e.g., if a milling sample with genuinely tilted cuts is added later).
