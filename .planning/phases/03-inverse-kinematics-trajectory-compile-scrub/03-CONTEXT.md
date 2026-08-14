# Phase 3: Inverse Kinematics + Trajectory Compile + Scrub - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can drag a scrub control to any point along the loaded toolpath and see the UR3e — including the 7th-axis rail — accurately re-pose to match that instant, via closed-form analytical inverse kinematics. This proves IK correctness in isolation before real-time animation is built on top of it (Phase 4). No play/pause, no animation clock, no real-time-duration semantics — scrubbing is the only interaction this phase supports. Covers SIM-05 (pause/scrub the playback timeline to any point in the operation).

Per the phase's own name, this also covers **trajectory compile**: the whole toolpath is run through IK once when a sample is selected (or re-selected), producing a precomputed, densely-sampled joint trajectory. Scrubbing becomes a lookup/interpolation over that precomputed array, not a live IK solve per drag event (ARCHITECTURE.md Pattern 1 — "Precompute-then-playback").

The robot no longer stays parked at the Phase 1 ready pose once a sample is selected — it must actually re-pose to match the scrub position. Phase 1's ready pose remains the seed/default only when nothing is scrubbed yet or no sample is loaded.

</domain>

<decisions>
## Implementation Decisions

### Rail Position Resolution
- **D-01:** One rail position is resolved for the *entire* selected toolpath, not per-operation or per-cluster. Phase 2's toolpath has no operations concept yet (that's Phase 6's Operations Tree) — so the research's "per-operation rail placement" heuristic degenerates to a single position for this phase's single continuous path. — **Reversibility:** costly — Phase 6 introduces true operations; if per-operation rail re-solving is wanted later, trajectory compile would need to accept a rail-position-per-operation-cluster input instead of one global value. Documented explicitly so this isn't mistaken for an oversight.
- **D-02:** The single rail X position is computed to *minimize the worst-case 3D reach distance* from `ROBOT_MOUNT_WORLD` to any point in the toolpath, clamped to `RAIL_TRAVEL` bounds — not hardcoded to `RAIL_CENTER_X`, and not simply "whatever the g-code says" (PITFALLS.md Pitfall 5's explicit warning). Because Phase 2's D-06 anchor already X-centers every toolpath's bounding box on `RAIL_CENTER_X`, and both bundled samples' X-spans (150mm, 120mm) sit well inside `ROBOT_REACH_ENVELOPE` (500mm) even with zero rail movement, this will likely resolve at or very near `RAIL_CENTER_X` for the two bundled samples. **This is the expected, correct outcome, not the rail being vestigial** — document this reasoning directly in the code/tests so a reviewer doesn't mistake "the rail barely moves for these samples" for redundancy being ignored (the exact failure mode Pitfall 5 warns about). The algorithm must be general enough that a toolpath large enough or positioned far enough off the anchor's X-center *would* visibly move the rail.

### IK Solution Continuity (locked by prior research, not re-litigated)
- **D-03:** Use the closed-form analytical UR inverse kinematics solver already scoped in `STACK.md`/`ARCHITECTURE.md` (up to 8 branches per Cartesian target: shoulder left/right × elbow up/down × wrist flip). For every solve after the first, select the branch with the smallest joint-space distance from the *previous scrub position's* solution (PITFALLS.md Pitfall 2 + Pitfall 3 — this single rule prevents both visible "flipping" and unrealistic joint snaps near singularities). The very first solve (before any scrub has happened) seeds from `UR3E_READY_POSE`.
- **D-04:** Trajectory compile precomputes a dense, arc-length-sampled array of `{ scrubFraction, railPos, joints[6], tcpPose }` once per toolpath selection (ARCHITECTURE.md Pattern 1) — re-running compile only when the selected sample changes, never on every scrub-drag event. Any IK solution that violates a joint limit (`isWithinJointLimits`, already in `src/kinematics/forward-kinematics.ts`) is rejected from the candidate branch set for that sample point (PITFALLS.md Pitfall 4) before the nearest-branch selection in D-03 runs.

### Scrub Control Semantics
- **D-05 (Claude's discretion, documented so it isn't re-litigated downstream):** The scrub control parameterizes progress as a **0–1 fraction of cumulative arc length** along the toolpath, not raw point/segment index (segment point density is uneven — a rapid move has 2 points, a tessellated arc has many) and not synthetic time (Phase 4 owns real feed-rate-based duration; introducing a fake "time" now would need to be thrown away or reconciled once Phase 4 lands). Arc-length fraction gives physically uniform scrub motion regardless of segment density, and Phase 4 can reuse the same precomputed trajectory by mapping real elapsed time onto this same fraction.

### Unreachable Point / IK Failure Handling
- **D-06 (Claude's discretion):** If no IK branch is valid for a given toolpath point (target outside the reach envelope, or every candidate branch violates a joint limit) — which should not occur for either bundled sample given Phase 2's D-06 anchor keeps all points within `ROBOT_REACH_ENVELOPE` — freeze the robot at the last valid pose and surface a clear, non-blocking status message. Never silently render a wrong/impossible pose and never crash. This continues the disclosure-over-silence discipline already established in Phase 2 (T-02-04, T-02-12): the store records only a status enum, never a raw exception, and the UI renders fixed copy.

### Scrub-Position Indicator
- **D-07 (Claude's discretion):** Render a small marker on the toolpath line at the current scrub position, distinct from the start/end markers Phase 2's gap-closure round already added (`src/scene/Toolpath.tsx`'s `liftMarker`-lifted spheres). This is a single "current position" indicator, not a per-operation marker (Phase 6 territory) — it exists to make the scrub-to-pose correspondence visually provable, which matters for a phase whose entire job is proving IK correctness before playback exists.

### Singularity Detection (build now, surface later)
- **D-08 (Claude's discretion):** Implement singularity detection (`src/kinematics/singularity.ts` per ARCHITECTURE.md's suggested structure — wrist/shoulder/elbow heuristics from the Singularities table) as a pure function of a joint solution, computed during trajectory compile and stored per sample, even though the Dashboard tab that displays `singularityFlags` doesn't exist until Phase 5. Building the detection now (while the IK code is fresh) means Phase 5 only has to wire up a UI, not derive new kinematics math. No UI surfaces this in Phase 3.

### Claude's Discretion
- Exact scrub control widget (slider styling, tick marks, numeric readout) — no specific visual reference was requested; match the existing minimal chrome (dropdown, Reset View button) from Phases 1–2.
- Arc-length sampling resolution for the precomputed trajectory array (implementation detail — dense enough for smooth-looking scrub interpolation, bounded enough to compile quickly for both bundled samples).
- Exact UR3e joint limit values — pull from Universal Robots' official datasheet per PITFALLS.md Pitfall 4's explicit instruction ("verify exact per-joint limits rather than assuming a uniform ±360°"), not from a third-party source. `src/kinematics/ur3e-dh.ts`'s current `UR3E_JOINT_LIMITS` placeholder comment already flags this as needing per-application confirmation.
- Whether the closed-form IK solver is hand-ported directly from the ROS-Industrial `universal_robot` formulation or an equivalent well-documented reference — STACK.md already locked "hand-rolled analytical IK, no third-party IK library" as the approach; the specific reference derivation is an implementation detail for the researcher/planner to pin down and cite.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Kinematics / IK approach (primary)
- `.planning/research/ARCHITECTURE.md` §"UR3e Kinematics / DH Representation" — official DH table (already implemented in `src/kinematics/ur3e-dh.ts`), closed-form IK approach and branch-selection rule.
- `.planning/research/ARCHITECTURE.md` §"7th-Axis Rail Composition (7-DOF Redundancy)" — the two rail-resolution strategies; this phase locks in strategy 1 (discrete/per-operation, degenerating to single-position per D-01/D-02).
- `.planning/research/ARCHITECTURE.md` §"Pattern 1: Precompute-then-playback" — the trajectory-compile architecture this phase implements (D-04).
- `.planning/research/ARCHITECTURE.md` §"Recommended Project Structure" — `kinematics/inverse-kinematics.ts`, `kinematics/rail.ts` (already exists, extend), `kinematics/singularity.ts`, `trajectory/compile.ts` as the suggested module layout.

### Known pitfalls for this phase
- `.planning/research/PITFALLS.md` §Pitfall 2 (singularities mishandled during animation) — governs D-03's continuity rule.
- `.planning/research/PITFALLS.md` §Pitfall 3 (multiple IK solutions cause pose flipping) — governs D-03.
- `.planning/research/PITFALLS.md` §Pitfall 4 (joint limits ignored) — governs D-04's limit-filtering step and the Claude's Discretion note on sourcing real UR3e joint limits.
- `.planning/research/PITFALLS.md` §Pitfall 5 (7th rail axis treated as fully determined instead of redundant) — governs D-01/D-02; the code/tests must explicitly document why the rail barely moves for the bundled samples so this isn't mistaken for the exact failure mode the pitfall describes.
- `.planning/research/PITFALLS.md` §Pitfall 13 (joint-space interpolation assumed to produce straight-line task-space motion) — relevant to D-05's arc-length sampling: sampling density must be driven by *task-space* (Cartesian) arc length along the toolpath, not by naive joint-angle interpolation between sparse IK solves, or the rendered TCP path would visibly deviate from the actual toolpath between samples.

### Phase 2 handoff (D-06 anchor contract — MUST read before touching placement)
- `src/gcode/toolpath-anchor.ts` — `TOOLPATH_ANCHOR_OFFSET`, `ROBOT_MOUNT_WORLD`, `WORKBENCH_TOP_Y`, `CARRIAGE_FRONT_FACE_Z` — the stable world-space contract Phase 2 explicitly built for this phase to consume. IK targets are the already-anchored `toolpath.segments[i].points` world-space coordinates — do not re-derive or re-anchor them.
- `.planning/phases/02-g-code-import-static-toolpath/02-01-PLAN.md` §D-06 — records the anchor's exact derivation and the ready-pose TCP world position computed against the real `forward-kinematics.ts` math (`≈ { x: -0.184, y: 0.826, z: 0.631 }` metres), useful as a sanity-check reference point for the new IK solver.

### Existing kinematics/scene surface this phase builds on
- `src/kinematics/index.ts` — barrel exporting `UR3E_DH`, `UR3E_JOINT_LIMITS`, `UR3E_HOME_POSE`, `UR3E_READY_POSE`, `forwardKinematics`, `isWithinJointLimits`, `RAIL_TRAVEL`, `RAIL_CENTER_X`, `railRemainingTravel`, `clampRailPosition` — the exact surface this phase extends with `inverse-kinematics.ts`/`singularity.ts`/rail-resolution logic, never restated.
- `src/kinematics/forward-kinematics.test.ts` — the established pattern of unit-testing FK against a known reference pose (Pitfall 1 discipline); the new IK solver must be round-trip tested against FK the same way (`IK(FK(joints)) ≈ joints` for a representative set of poses, plus at least one deliberately-central test path per Pitfall 2's stated verification approach).
- `src/gcode/parseToolpath.ts` / `ParsedToolpath` — `segments[]` with ordered, already-anchored world-space `points`; this is the IK solver's input data, already built and stable.
- `src/store/cellStore.ts` — established Zustand patterns (`toolpathLoadStatus` enum, monotonic request-guard pattern from `selectSample`) to follow for any new scrub/trajectory state; per Phase 1's rule, do NOT push per-scrub-frame values through this store if scrubbing ends up driving continuous drag updates at animation-like rates — write is fine at drag-release or throttled cadence, imperative Three.js refs otherwise (mirrors the R3F performance pattern from CLAUDE.md's Technology Stack section).

### Design system
- `.planning/phases/01-static-rig-kinematics-foundation/01-UI-SPEC.md` — Dominant/Secondary/Accent palette; any new scrub-position marker (D-07) must stay within the established color discipline (reuse `CUTTING_COLOR` or a documented new tone, never the reserved Accent blue).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/kinematics/forward-kinematics.ts` — `forwardKinematics(joints, railPos?)` and `isWithinJointLimits` are directly reusable: IK candidate branches get validated by running them back through FK/limit-checking rather than trusting the closed-form output blindly.
- `src/kinematics/rail.ts` — `RAIL_TRAVEL`, `clampRailPosition` — the new rail-position-resolution logic (D-02) must clamp its computed result through this existing helper, not reimplement range-clamping.
- `src/gcode/toolpath-anchor.ts` — `ROBOT_MOUNT_WORLD` is the correct origin for every reach/distance calculation this phase does (established in Phase 2: reach is measured from the mount, never from the ready-pose TCP, which is just a parked pose).
- `src/scene/RobotModel.tsx` — the `rotation.x = -Math.PI / 2` scene-frame rotation convention (DH z-up → scene y-up) that any new IK-driven pose-setting code must respect, matching the existing FK rendering path.

### Established Patterns
- Scene-composition constants live in one owning module and are imported everywhere else, never restated (Phase 1's "rail agreement" rule, reinforced by Phase 2's D-06 anchor and gap-closure round). The new rail-resolution/trajectory-compile constants must follow the same discipline.
- Asset-integrity / round-trip testing pattern (`forward-kinematics.test.ts`, `toolpath-anchor.test.ts`'s reach-envelope assertions) — the new IK solver should get the same treatment: test against known poses, not just "doesn't throw."
- Store `catch` blocks record only a status enum, never a raw exception (T-02-04 discipline) — the same pattern applies to D-06's IK-failure handling.

### Integration Points
- Trajectory compile (D-04) sits between `parseToolpath`'s output (already in the store as `toolpath`) and a new scrub-driven pose-setting component in the scene — likely mirroring how `ToolpathCameraFit.tsx` subscribes to store state and imperatively drives Three.js objects, rather than a new architectural pattern.
- The scrub control itself is DOM/React chrome (a slider), following the same "controlled component dispatches a store action, never touches the scene directly" convention as `SampleSelect.tsx`/`ResetViewButton.tsx`.

</code_context>

<specifics>
## Specific Ideas

No specific visual references beyond what's captured in Decisions above (arc-length-based scrub, single scrub-position marker, singularity detection built but not yet surfaced).

</specifics>

<deferred>
## Deferred Ideas

- **Real-time playback / play-pause (SIM-04)** — explicitly Phase 4's scope. Phase 3 is scrub-only; no animation clock exists.
- **Per-operation rail re-solving** — the user chose one rail position for the whole toolpath (D-01) rather than anticipating Phase 6's operations split now; noted here so Phase 6 planning knows this was a deliberate simplification, not an oversight.
- **Singularity UI display / warnings** — detection logic is built now (D-08) but the Dashboard surfacing is explicitly Phase 5's job.
- **Depth-of-engagement mill coloring, per-operation start/end markers, operations tree** — explicitly Phase 6's scope, unchanged from Phase 2's own deferred-ideas list.
- **Calibrate-tab-driven home-position/per-operation joint overrides** — explicitly Phase 8's scope; Phase 3's IK always seeds from the fixed `UR3E_READY_POSE`, not a user-configurable calibration offset.

None else — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-inverse-kinematics-trajectory-compile-scrub*
*Context gathered: 2026-08-14*
