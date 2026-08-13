# Project Research Summary

**Project:** Browser-based 3D robotic cell control/simulation interface (UR3e on a 7th linear-rail axis, print/mill toolpath playback)
**Domain:** Robotics HMI / CAM-simulator hybrid -- technical interview take-home assignment, simulation-only, few-day timeline
**Researched:** 2026-08-13
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is a browser-based digital twin of a UR3e collaborative robot mounted on a 7th-axis linear rail, dual-purposed as a 3D printer and CNC mill via an automatic tool-changer. It is best understood as a hybrid of a CAM/G-code simulator (Vericut, CIMCO, NCViewer) and a robot offline-programming/digital-twin tool (RoboDK, ABB RobotStudio), built entirely client-side with no live hardware connection. Experts build this class of tool with a strict separation between pure computation (G-code parsing, forward/inverse kinematics) and rendering (React Three Fiber scene graph driven by a single state store), because the single hardest and highest-payoff problem -- accurate, smooth, telemetry-consistent toolpath playback -- depends on getting that separation right from day one.

The recommended approach is: React 19 + Vite + TypeScript 5.9 (not the newly-GA TS 7.0, whose tooling is currently broken) for the shell; React Three Fiber + drei + urdf-loader for the 3D scene and UR3e visualization; a hand-rolled closed-form analytical IK solver (UR arms have no mature JS IK library, but the UR5/UR10-style closed-form algorithm is well-documented and ports cleanly to UR3e's DH parameters); gcode-toolpath/gcode-parser for G-code ingestion; and Zustand as the single global store, with all per-frame animation driven imperatively through R3F's useFrame (never through React state, which would tank performance). The architecture's central pattern is precompute-then-playback: the entire toolpath is run through IK once when a file loads, producing a dense joint-trajectory array, and playback becomes pure interpolation/lookup -- this sidesteps IK jitter, singularity flicker, and per-frame CPU cost simultaneously.

The dominant risk is not any single technology choice but sequencing and scope discipline: the research is unanimous that the 3D toolpath simulation (import to kinematically correct, color-coded, animated playback with live telemetry) is the one thing that must not fail, while six secondary tabs (Dashboard, Vision, Calibrate, Setup, I/O, Optimization) are explicitly lower priority and should be built only after the core is demo-ready. Secondary technical risks cluster around kinematics correctness (DH parameter convention ambiguity, IK solution "flipping" between waypoints, unhandled joint limits/singularities, and the redundant 7-DOF rail+arm system needing a deliberate, documented resolution heuristic rather than a full Jacobian solver) and G-code parsing edge cases (dialect variance, arc move edge cases, unit ambiguity). All of these have well-understood, cheap mitigations documented in PITFALLS.md and should be treated as must-do items in the earliest phases, not polish.

## Key Findings

### Recommended Stack

React 19 + Vite + TypeScript 5.9.3 (explicitly avoid TS 7.0 -- ecosystem tooling incompatible as of Aug 2026) forms the app shell. The 3D layer is React Three Fiber 9.7 + drei 10.7 over Three.js 0.185, chosen because the app is tab-heavy and state-synced (R3F's sweet spot) rather than a standalone canvas. urdf-loader loads the UR3e model (forward-kinematics/visualization only) from a pre-flattened URDF sourced from Universal Robots' official ROS2 description repo -- xacro should be converted once offline, never parsed at runtime. There is no mature UR-specific JS IK library, so inverse kinematics must be hand-rolled as a closed-form analytical solver using official UR3e DH parameters (medium-confidence but well-established algorithm family). G-code parsing uses the mature gcode-toolpath/gcode-parser pair (from the cncjs ecosystem) which exposes modal state and move classification needed for color-coding. Zustand is the state store of choice -- lightweight, readable from both React and imperative R3F code, unlike Context. The single most important architectural rule from stack research: never drive per-frame animation through Zustand/React state; use useFrame + refs and only write to the store at UI-relevant cadence.

**Core technologies:**
- React 19 + Vite + TypeScript 5.9.3 -- component-heavy multi-tab UI shell; TS 5.9 chosen over 7.0 for tooling stability
- React Three Fiber 9.7 + drei 10.7 + Three.js 0.185 -- declarative 3D scene with ready-made OrbitControls/ViewCube, avoids hand-rolled render-loop/React bridging
- urdf-loader 0.13.1 + official UR3e URDF -- mature, purpose-built FK/visualization loader; NOT an IK solver
- Hand-rolled closed-form analytical IK (custom TS) -- no trustworthy off-the-shelf UR IK library exists; well-documented algorithm to port from UR3e's own DH parameters
- gcode-toolpath 3.0 / gcode-parser 2.2 -- purpose-built G-code to classified-move-segment pipeline, battle-tested in the cncjs CNC sender project
- Zustand 5.0 -- single global store readable from both React and imperative Three.js code; per-frame values must bypass it via useFrame/refs

### Expected Features

Feature research frames this as "what makes the demo look like it understands the domain" vs. "what implies scope/hardware the assignment explicitly excludes." Nearly every table-stakes feature (color-coded move types, per-operation start/end markers, operations tree with timing, play/pause/scrub, orbit+nav-cube camera, joint/TCP dashboard telemetry, 7th-axis rail position, depth-of-engagement color proxy for milling, simulated force/contact readout, I/O status table, calibration controls, tool-changer visual swap) is derivable directly from the same toolpath-playback engine, which is why FEATURES.md and ARCHITECTURE.md converge on the same phase-1 priority: get G-code to toolpath to kinematics to playback right first, since everything else is a cheap derived view once that exists.

**Must have (table stakes):**
- Color-coded toolpath by move type (rapid/dashed vs. cutting/solid) + per-operation start/end markers
- Play/pause/scrub playback synced to 3D robot animation
- Operations tree with per-operation timing
- Dashboard joint angles + TCP pose/speed + 7th-axis rail position, all computed live from playback (never mock data)
- Depth-of-engagement color proxy for milling cuts (not full material-removal simulation)
- Print/Mill tab switch with visual tool-changer mesh swap
- Interactive orbit/pan/zoom camera with nav-cube standard views

**Should have (competitive/differentiators):**
- Feed-rate override slider that live-affects playback speed + dashboard readout (cheap, reuses playback engine)
- Live cycle-time estimate that updates as override/smoothing parameters change
- Color-by-feedrate toggle mode (reuses the same rendering pipeline)
- Accel/jerk easing sliders that visibly smooth motion
- Joint-limit/rail-limit threshold warnings (ISA-101-style alarm coloring)

**Defer / do not build (anti-features):**
- Real camera feed or actual CV pipeline on Vision tab (no hardware; use simulated/labeled readouts instead)
- Physically accurate voxel/dexel material-removal simulation (use the color-ramp proxy instead -- 80% of visual signal for 2% of effort)
- Live RTDE/URScript hardware connection (explicitly out of scope)
- Full physics-based collision/singularity-avoidance engine, multi-robot support, persistent backend/accounts, general-purpose G-code authoring tool

### Architecture Approach

The recommended architecture is a strict pipeline: a framework-agnostic gcode/ parser and kinematics/ engine (pure TS, zero React/Three dependencies, unit-testable in isolation) feed a trajectory/compile.ts step that runs the entire toolpath through IK once per load, producing a precomputed JointTrajectory. A playback/usePlaybackClock then does pure interpolation/lookup over that trajectory at animation speed, writing into one singular Zustand store. Both the 3D scene (scene/ -- R3F components that only read pose, never compute it) and the Dashboard/telemetry selectors read the same (jointTrajectory, currentTime) pair, which is the mechanism that structurally guarantees they can never desync -- directly satisfying the "telemetry computed from playback, not mock data" requirement. The tool-changer is modeled as a single pluggable leaf node (ToolMount) on one fixed rig, not two parallel robots, parameterized by a per-tool TCP offset consumed by the kinematics engine.

**Major components:**
1. gcode/ (parser + toolpath generator) -- text to classified move segments with color-code/timing/engagement metadata; pure, worker-safe
2. kinematics/ (DH table, forward kinematics, closed-form IK, rail resolution, singularity detection) -- pure math, zero rendering deps, the highest-risk correctness surface
3. trajectory/compile.ts -- the seam between "path in Cartesian space" and "playback in joint space"; runs once per load, not per frame
4. store/ (single Zustand store) -- the only source of truth; playback clock writes to it, everything else reads/selects from it
5. scene/ (R3F components) -- dumb renderers of rig pose, toolpath line (single batched geometry with vertex colors), nav cube, tool mount
6. tools/registry.ts -- print-head/mill-spindle definitions with TCP offsets, consumed by kinematics as a parameter

### Critical Pitfalls

1. **Wrong/ambiguous DH parameter convention** -- use only Universal Robots' official DH docs, pick one transform convention consistently, and unit-test forward kinematics against a hand-calculable reference pose before any rendering is built on top.
2. **IK solutions "flipping" between waypoints / singularity mishandling** -- always select the IK branch closest in joint-space to the previous waypoint's solution; this single rule prevents nearly all visible snapping/flipping without a full singularity-avoidance solver.
3. **7th-axis rail treated as fully determined instead of redundant** -- deliberately pick and document a simple heuristic (e.g., fixed rail position per operation, then solve 6-DOF IK), rather than silently ignoring the redundancy or attempting full Jacobian resolution.
4. **Joint-space interpolation assumed to produce straight-line Cartesian motion** -- interpolate the target TCP pose in task space and re-solve IK at each sample; naive joint-angle lerping produces a subtly bowed path that looks smooth but is kinematically wrong.
5. **Secondary tabs built out before the core simulation is solid** -- enforce via phase ordering: the core simulation (import to accurate, color-coded, animated, telemetry-backed playback) must reach demo-ready status before any time is spent on Dashboard/Vision/Calibrate/Setup/I/O/Optimization.
6. **Performance anti-patterns** (React state driving per-frame 3D updates, one Line object per toolpath segment, geometry recreated every frame) -- all have the same fix pattern: imperative useFrame/refs, single batched Line2/BufferGeometry with vertex-color attributes, and in-place attribute mutation instead of geometry recreation.

## Implications for Roadmap

Based on combined research (architecture's explicit "Suggested Build Order" plus features/pitfalls phase mappings, which converge strongly), the roadmap should follow a vertical-MVP core-first structure:

### Phase 1: Static Rig + Kinematics Foundation
**Rationale:** Nothing downstream can be validated until forward kinematics renders a correctly-jointed robot; this is also where the highest-risk pitfall (wrong DH convention) must be caught via unit tests before any visual work.
**Delivers:** UR3e + rail rendered at a fixed pose in an orbit/pan/zoom 3D scene with nav-cube navigation; DH table + FK module unit-tested against a known reference pose.
**Addresses:** Interactive 3D camera + nav-cube (table stakes)
**Avoids:** Pitfall 1 (wrong DH convention) -- must be resolved here, not discovered later

### Phase 2: G-code Import + Static Toolpath
**Rationale:** Proves parsing/toolpath-generation correctness independently of kinematics/animation risk; establishes the pure, worker-safe gcode/ module architecture.
**Delivers:** Upload, parse, render color-coded static polyline + static operations list (robot still static).
**Uses:** gcode-toolpath/gcode-parser
**Implements:** gcode/parser.ts, gcode/toolpath.ts (Anti-Pattern 4: never couple parser to Three.js -- emit plain data)
**Avoids:** Pitfalls 6/7/8 (dialect assumptions, arc edge cases, unit ambiguity) -- scope and test explicitly here

### Phase 3: Inverse Kinematics + Trajectory Compile + Scrub
**Rationale:** Isolates "does IK correctly place the robot along the path" from "does animation work" -- far easier to debug a static scrub than live playback.
**Delivers:** Closed-form UR3e IK solver; precomputed JointTrajectory from the parsed toolpath; a scrub slider that poses the robot at any timeline point.
**Uses:** Hand-rolled closed-form IK (Pattern 1: precompute-then-playback)
**Avoids:** Pitfalls 2/3/4/5/13 (singularities, IK flipping, joint limits, unresolved rail redundancy, joint-space-vs-task-space interpolation) -- all resolved together in this phase via the "nearest-to-previous-solution" + task-space-interpolation rules

### Phase 4: Playback Engine
**Rationale:** Completes the "must not fail" core value in isolation, before any secondary tab work begins.
**Delivers:** Play/pause/speed controls; continuous robot animation; toolpath highlight synced to playhead; TCP marker motion.
**Uses:** playback/usePlaybackClock.ts (Pattern 2: store-driven imperative rendering via useFrame)
**Avoids:** Pitfalls 10/11/12 (React-state-driven re-renders, unbatched line objects, geometry-recreation memory leaks)

### Phase 5: Telemetry / Dashboard
**Rationale:** Cheap once Phase 4 exists -- pure selectors over the same (jointTrajectory, currentTime) the 3D scene reads; proves the store-driven architecture pays off.
**Delivers:** Joint angles, TCP position/speed, rail position + remaining travel, all computed live.
**Addresses:** Dashboard telemetry (table stakes) -- explicitly "computed from playback, not mock data"
**Avoids:** Anti-Pattern 2 (telemetry as an independently-running fake simulation)

### Phase 6: Operations Tree Refinement + Mill Engagement Coloring
**Rationale:** Polish on an already-working core; low technical risk, reuses Phase 2's segmentation and Phase 4's playback.
**Delivers:** Per-operation timing, distinct start/end markers, depth-of-engagement color proxy for milling cuts.
**Addresses:** Depth-of-engagement coloring, operations tree timing (table stakes)

### Phase 7: Tool-Changer + Printing/Milling Tabs
**Rationale:** Requires the trajectory-compile and rig architecture to already support tool-offset parameterization (built in from Phase 3, not bolted on).
**Delivers:** activeTool state, ToolMount swap, changer station visualization, tab switch triggers trajectory recompile with new TCP offset.
**Implements:** Pattern 3 (tool as pluggable leaf node, not a second robot) -- avoids Anti-Pattern 1
**Addresses:** Print/Mill mode switch + tool-changer representation (table stakes)

### Phase 8: Remaining Tabs (Setup, Vision, Calibrate, I/O, Optimization)
**Rationale:** Lowest risk, least dependent on kinematics correctness -- the safe place to cut scope first if time runs short, per explicit project constraint.
**Delivers:** Config/status panels as thin consumers of the stabilized store; feed-rate override + cycle-time live estimate; simulated force/contact readout; joint/rail limit warnings.
**Addresses:** Remaining table-stakes tabs + differentiators (feed override, cycle-time readout, color-by-feedrate, limit warnings, accel/jerk easing)
**Avoids:** Pitfall 14 (secondary tabs built before core is solid) by construction -- this phase comes last

### Phase Ordering Rationale

- Dependency chain is strict and unanimous across all three research files: G-code parsing to kinematics/trajectory to playback to telemetry/tabs. Nothing in phases 5-8 can be built correctly before the trajectory/playback architecture (phases 1-4) is proven.
- Kinematics correctness (DH convention, IK branch selection, rail redundancy) is front-loaded into phases 1 and 3 specifically because these are "looks done but isn't" bugs -- they don't crash, they silently produce wrong results, so they must be caught via unit tests early rather than discovered during interview demo.
- Deployment should be treated as a standing concern threaded through every phase (deploy a minimal scaffold on day one, redeploy after each phase), per Pitfall 15 -- not a separate roadmap phase but an operational requirement starting immediately.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Kinematics Foundation):** DH convention ambiguity and UR3e joint-limit specifics need a research-phase pass to pull exact numeric constants from Universal Robots' official docs before implementation, per PITFALLS.md Pitfall 1/4.
- **Phase 3 (IK + Trajectory Compile):** Closed-form UR IK derivation and the 7th-axis redundancy resolution heuristic are architecturally decided but not yet implemented against a validated reference -- worth a focused research/validation pass against the "ur_kinematics" formulation before coding.

Phases with standard patterns (skip research-phase):
- **Phase 2 (G-code parsing):** gcode-toolpath/gcode-parser usage patterns are well-documented from the cncjs ecosystem.
- **Phase 4 (Playback engine):** R3F useFrame/imperative-update pattern is a standard, well-documented idiom.
- **Phase 5-8 (Telemetry, tool-changer, remaining tabs):** Straightforward store-selector and component composition work with no novel technical risk once the core is proven.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH for library/version choices (verified directly against npm registry); MEDIUM for robot-kinematics-specific packages (no single authoritative source) |
| Features | MEDIUM -- domain conventions cross-checked across multiple independent CAM/slicer/robot-OLP sources; no single canonical "robot HMI feature spec" exists, so synthesis is opinionated |
| Architecture | MEDIUM-HIGH -- kinematics theory and DH parameters are HIGH/official-source; g-code viewer and urdf-loader patterns MEDIUM; tab/telemetry composition is architectural reasoning, not a sourced canonical reference |
| Pitfalls | MEDIUM -- cross-checked across multiple independent sources per topic; no primary UR3e hardware or official kinematics SDK verified hands-on |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Exact UR3e joint limit values:** research recommends pulling precise per-joint software limits from Universal Robots' official datasheet rather than assuming a uniform range -- needs a final check during Phase 1 implementation.
- **Closed-form IK validation:** the analytical UR IK algorithm is well-established in the robotics community but has not been implemented/tested against this project's actual UR3e DH values yet -- flag for validation against a reference implementation (e.g. "ur_kinematics") during Phase 3.
- **7th-axis rail resolution strategy:** architecture research recommends a discrete per-operation rail-placement heuristic (not full Jacobian redundancy resolution) as the pragmatic MVP choice -- this is a deliberate scope decision that should be explicitly documented in the roadmap/README, not silently assumed.
- **G-code dialect scope:** the exact subset of G/M-codes to support (recommended: G0/G1/G2/G3, G20/G21, G90/G91, standard tool-change M-codes) should be explicitly finalized and documented as part of Phase 2 scope, with two structurally different sample files used to validate.

## Sources

### Primary (HIGH confidence)
- npm registry direct lookups (three, @react-three/fiber, @react-three/drei, urdf-loader, vite, react, typescript, zustand, gcode-parser, gcode-toolpath) -- fetched 2026-08-13
- Universal Robots official DH parameters documentation
- Universal Robots developer docs (robot motion / DH parameters)
- UR3e User Manual (official PDF, e-Series)

### Secondary (MEDIUM confidence)
- gkjohnson/urdf-loaders GitHub repo (widely-used open-source reference architecture)
- cncjs/gcode-parser / gcode-toolpath GitHub (established open-source G-code parsing conventions)
- Multiple 2025-2026 comparison articles: React Three Fiber vs raw Three.js, Zustand vs Redux adoption trends, TypeScript 7.0 ecosystem compatibility
- CAM/slicer/robot-OLP vendor documentation: Vericut, CIMCO, RoboDK, ABB RobotStudio, CUTPRO
- Peer-reviewed robotics sources on trajectory planning, jerk-optimal path planning, 7-DOF redundant manipulator kinematics
- R3F official performance docs and community pitfall write-ups (pmnd.rs, dev.to, three.js discourse)
- Take-home interview assignment best-practice sources (BigPanda Engineering, DEV Community)

### Tertiary (LOW confidence)
- Community forum threads (DoF/Robotiq force-sensing discussion, RoboDK forum threads) -- used only to corroborate, not as primary basis for recommendations
- Third-party spec aggregators (QVIRO) and single-pass general web search results -- flagged where used, not relied on for numeric constants

---
*Research completed: 2026-08-13*
*Ready for roadmap: yes*
