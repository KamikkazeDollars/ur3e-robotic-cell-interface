---
phase: 03-inverse-kinematics-trajectory-compile-scrub
plan: 01
subsystem: robotics-kinematics
tags: [inverse-kinematics, forward-kinematics, urdf-loader, three.js, react-three-fiber, zustand, ur3e]

# Dependency graph
requires:
  - phase: 01-scene-foundation-robot-model
    provides: forwardKinematics/UR3E_DH DH chain, RobotModel.tsx's urdf-loader integration, rail geometry constants
  - phase: 02-g-code-import-static-toolpath
    provides: parseToolpath/ClassifiedSegment toolpath pipeline, toolpath-anchor.ts's D-06 anchor + workbench geometry
provides:
  - Closed-form 6-DOF analytical UR3e inverse kinematics (solveUR6IK), verified 400/400 round-trip against forwardKinematics
  - Brute-force D-02 rail-position resolver (resolveRailPosition)
  - Arc-length toolpath parameterisation (flattenToolpathPoints/buildArcLengthTable/pointAtFraction)
  - CompiledTrajectory contract: per-sample IK-solved joints, a prepended home-to-toolpath travel move, D-06 freeze-on-unreachable
  - Scrub-driven live re-posing of the rendered UR3e (RobotPose.tsx, ScrubControl.tsx)
  - toUrdfJointAngles: the render-boundary fix for a real 180-degree URDF frame divergence (base_link vs base_link_inertia)
affects: [04-playback-timeline-telemetry, 05-dashboard-sensors, 06-operations-tree, 07-tool-changer]

# Actuals (#2632)
actuals:
  tokens: 21969
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Closed-form analytical UR IK ported by reading target[row][col] directly (no ur_kin.cpp base-frame remap), pinned by an FK round-trip test rather than trusting the port"
    - "Two-phase arc-length parameterisation (prepended travel move + toolpath proper) stitched into one monotonic 0-1 scrubFraction via each phase's own exact-endpoint guarantee"
    - "URDF render-boundary conversion (toUrdfJointAngles) kept strictly separate from pure DH kinematics modules — forwardKinematics/solveUR6IK never know urdf-loader exists"
    - "Per-frame scene updates read the Zustand store via getState() inside useFrame, never a reactive selector"

key-files:
  created:
    - src/kinematics/inverse-kinematics.ts
    - src/kinematics/inverse-kinematics.test.ts
    - src/kinematics/urdf-joint-mapping.ts
    - src/kinematics/urdf-joint-mapping.test.ts
    - src/trajectory/arc-length.ts
    - src/trajectory/arc-length.test.ts
    - src/trajectory/compile.ts
    - src/trajectory/compile.test.ts
    - src/scene/RobotPose.tsx
    - src/ui/ScrubControl.tsx
  modified:
    - src/kinematics/rail.ts
    - src/kinematics/rail.test.ts
    - src/kinematics/index.ts
    - src/kinematics/ur3e-dh.ts
    - src/store/cellStore.ts
    - src/scene/RobotModel.tsx
    - src/App.tsx

key-decisions:
  - "Read target[row][col] directly in solveUR6IK rather than applying ur_kin.cpp's base-frame index remap — verified 400/400 round trip vs 0/400 with the remap applied"
  - "Fixed tool-down IK target orientation (Rot_x(180) rotation submatrix) as the resolution of Assumption A1 — g-code carries position only, so orientation is a scoped decision, not derived from a discontinuous path tangent"
  - "resolveRailPosition implemented as a brute-force 201-candidate scan rather than the closed-form x-span-midpoint shortcut, so it directly implements D-02's objective and retires (rather than inherits) the A2 optimality assumption"
  - "Discovered and fixed a real, pre-existing bug: the official UR3e URDF bakes a documented 180-degree-about-Z rotation into base_link -> base_link_inertia (REP-103 alignment). Proved algebraically this reduces to a single offset on shoulder_pan only, applied at one render-boundary conversion function (toUrdfJointAngles) rather than touching forwardKinematics.ts or inverse-kinematics.ts"
  - "Added UR3E_PARKED_POSE (checkpoint-approved scope expansion) as a genuinely off-table idle stance, kept separate from UR3E_READY_POSE (which stays untouched because toolpath-anchor.ts derives WORKBENCH_TOP_Y from it)"
  - "compileTrajectory now prepends a real, independently IK-solved travel move (parked pose -> lift waypoint inset toward the target -> above-target -> target) instead of jumping straight to the toolpath's first point, composed via a two-phase arc-length walk so scrubFraction 0 is the literal parked pose and the toolpath's own first point lands exactly at the travel/toolpath boundary"

patterns-established:
  - "IK port verification discipline: any ported kinematics algorithm gets an FK round-trip test against an independently-trusted reference before being trusted, never validated only against its own output"
  - "Render-boundary conversion functions for third-party-library frame conventions (toUrdfJointAngles) live in their own file, imported at every setJointValue call site, so a frame-convention fix is one change, not several"

requirements-completed: [SIM-05]

coverage:
  - id: D1
    description: "Dragging the scrub control re-poses the UR3e along the selected sample's toolpath via closed-form IK, continuous and FK-verifiable at every sample"
    requirement: "SIM-05"
    verification:
      - kind: unit
        ref: "src/trajectory/compile.test.ts#FK-reproduces every sample's own toolpath point to within 1e-6 metres"
        status: pass
      - kind: unit
        ref: "src/kinematics/inverse-kinematics.test.ts#solveUR6IK — round trip against forwardKinematics"
        status: pass
      - kind: automated_ui
        ref: "Playwright screenshots (print + mill samples, fractions 0/0.15/0.5/1) — flange tracks the drawn toolpath, tool-down orientation correct after the 180-degree fix"
        status: pass
    human_judgment: true
    rationale: "3D pose/orientation correctness ultimately needs a human looking at the rendered scene — the 180-degree URDF frame bug in this same plan was caught only by a human's live re-verification after automated checks had already passed, so automation alone is not sufficient evidence for this deliverable."
  - id: D2
    description: "Off-table parked home pose with a real IK-solved travel move to the toolpath's first point (checkpoint-approved scope addition)"
    verification:
      - kind: unit
        ref: "src/trajectory/compile.test.ts#compileTrajectory — travel move clears the table (checkpoint regression)"
        status: pass
      - kind: automated_ui
        ref: "Playwright screenshots + analytical footprint check (zero clipping samples for both bundled toolpaths)"
        status: fail
    human_judgment: true
    rationale: "KNOWN OPEN ISSUE — see Deviations/Known Issues below. The automated regression test and Playwright screenshots pass, but the user's own live visual re-test still shows the travel move clipping through the table. There is a real, unresolved gap between the regression test's model of the table's collision geometry and the actual rendered/visual collision — do not treat the passing automated check as proof this is fixed."

duration: ~4h (wall clock across three checkpoint round-trips; includes waiting time between coordinator messages, not continuous active work)
completed: 2026-08-14
status: complete
---

# Phase 3 Plan 1: Closed-Form IK, Trajectory Compile, and Scrub Control Summary

**Closed-form UR3e IK (verified 400/400 round-trip) driving a scrub-controlled trajectory that travels from an off-table parked pose through a real toolpath, plus a checkpoint-discovered fix for a genuine 180-degree URDF frame bug.**

## Performance

- **Duration:** ~4h wall clock (three checkpoint round-trips with the coordinator/user in between)
- **Started:** 2026-08-14T15:27:09+03:00 (session pickup, first plan commit ~15:57)
- **Completed:** 2026-08-14T20:29:37+03:00
- **Tasks:** 2 (Task 1: tracer end-to-end slice; Task 2: pinning tests)
- **Files modified:** 17

## Accomplishments

- Closed-form 6-DOF UR3e analytical inverse kinematics (`solveUR6IK`), reading `target[row][col]` directly against the project's own DH chain (no `ur_kin.cpp` base-frame remap), verified via a 400-pose round-trip against `forwardKinematics` during planning and pinned by a committed test suite this plan
- `compileTrajectory`: converts a parsed toolpath into a `CompiledTrajectory` of FK-verifiable, D-03-continuous, arc-length-parameterised IK samples, with D-06 freeze-on-unreachable and a resolved-once D-02 rail position
- Live scrub control: dragging the range input re-poses the rendered UR3e along the compiled trajectory every frame, driven imperatively (`useFrame` + `getState()`, never a reactive selector)
- Found and fixed a genuine, pre-existing bug (not introduced this plan, but only surfaced once this plan started rendering arbitrary dynamic poses): the official UR3e URDF's `base_link -> base_link_inertia` fixed joint bakes in a documented 180-degree rotation the project's DH convention never accounted for. Root-caused by reading the live Three.js scene graph's world matrices, proved algebraically that the fix reduces to a single `shoulder_pan` offset, and applied it at one render-boundary function (`toUrdfJointAngles`)
- Added (checkpoint-approved scope expansion) a genuinely off-table parked/home pose and a real, IK-solved travel move from that pose to the toolpath's first point, replacing the previous straight teleport

## Task Commits

Each task was committed atomically, plus two checkpoint-driven fix commits between them:

1. **Task 1: End-to-end "drag the scrub control, the UR3e re-poses along the toolpath"** - `c0de923` (feat)
2. **Checkpoint fix: 180-degree URDF frame mismatch + off-table parked pose/travel move** - `9130c34` (fix)
3. **Checkpoint fix: route the travel move around the table (attempted)** - `c44db2b` (fix — see Known Issues, still open per live re-test)
4. **Task 2: Pin the solver, rail resolver, and arc-length table with round-trip/continuity/limit/rail-resolution tests** - `01a1cce` (test)

## Files Created/Modified

- `src/kinematics/inverse-kinematics.ts` - `solveUR6IK`, `buildToolDownTarget`, `validBranches`, `pickClosestBranch`, `jointSpaceDistance`, `TOOL_FLANGE_OFFSET_Z`
- `src/kinematics/inverse-kinematics.test.ts` - FK round-trip, branch-count/normalisation, continuity + negative control, limit filtering, non-finite rejection
- `src/kinematics/urdf-joint-mapping.ts` - `toUrdfJointAngles`, the single render-boundary correction for the URDF's 180-degree `base_link_inertia` frame divergence
- `src/kinematics/urdf-joint-mapping.test.ts` - pins the offset behaviour, normalisation, and involution property
- `src/kinematics/rail.ts` - `resolveRailPosition`, `RAIL_RESOLUTION_CANDIDATES` (D-02 brute-force scan)
- `src/kinematics/rail.test.ts` - extended with `resolveRailPosition` coverage including the off-centre/A2 cross-check cases
- `src/kinematics/ur3e-dh.ts` - added `UR3E_PARKED_POSE`; `UR3E_READY_POSE` left unchanged (still feeds `WORKBENCH_TOP_Y`)
- `src/kinematics/index.ts` - barrel widened for all of the above
- `src/trajectory/arc-length.ts` - `flattenToolpathPoints`, `buildArcLengthTable`, `pointAtFraction`
- `src/trajectory/arc-length.test.ts` - ordering/dedup, hand-summable polyline, exact-endpoint + arc-length-not-index coverage
- `src/trajectory/compile.ts` - `compileTrajectory`, `sceneToDhFrame`/`dhFrameToScene`, the two-phase travel+toolpath sample walk
- `src/trajectory/compile.test.ts` - FK round-trip proof, travel-move boundary/composition assertions, table-clipping regression check against both real bundled samples
- `src/store/cellStore.ts` - `trajectory`, `scrubFraction`, `setScrubFraction`; compiles once per sample selection under the existing stale-request guard
- `src/scene/RobotPose.tsx` - imperative per-frame scrub-driven pose driver
- `src/scene/RobotModel.tsx` - mounts `RobotPose`; initial static pose now `UR3E_PARKED_POSE` (via `toUrdfJointAngles`)
- `src/ui/ScrubControl.tsx` - D-05 scrub range input
- `src/App.tsx` - mounts `ScrubControl` beneath `SampleSelect`

## Decisions Made

See `key-decisions` in frontmatter above. Two decisions are worth restating in prose:

1. **The 180-degree URDF fix is isolated to one render-boundary function, not spread across the kinematics modules.** `forwardKinematics.ts` and `inverse-kinematics.ts` remain pure DH math in the manufacturer/controller convention; only the hand-off to `urdf-loader`'s `setJointValue` (via `toUrdfJointAngles`) knows about the URDF's own `base_link_inertia` divergence. This was a deliberate choice per the checkpoint instruction to apply a fixed-frame offset "at the correct single source-of-truth location, not scattered."
2. **`UR3E_READY_POSE` was left untouched even though it no longer represents the robot's displayed pose**, because `toolpath-anchor.ts` derives `WORKBENCH_TOP_Y` (the whole table's world-space height) from it. Changing its values would have silently moved the table. `UR3E_PARKED_POSE` is a new, separate constant instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 180-degree URDF frame mismatch between this project's DH convention and `urdf-loader`'s rendered joint chain**
- **Found during:** Task 1 checkpoint re-verification (human visual check)
- **Issue:** The official UR3e URDF (`Universal_Robots_ROS2_Description`) bakes a documented 180-degree-about-Z rotation into the `base_link -> base_link_inertia` fixed joint (REP-103 alignment vs. controller frame). This project's `forwardKinematics`/`solveUR6IK` compute in the controller convention but handed raw joint values to `setJointValue`, which operates on the `base_link_inertia`-rooted chain — every dynamically-posed sample rendered visually wrong (previously undetected because Phase 1/2 only ever rendered `theta1=0` poses).
- **Fix:** Added `src/kinematics/urdf-joint-mapping.ts` (`toUrdfJointAngles`), proved algebraically that the correction is exactly "+pi on `shoulder_pan` only," and routed both `setJointValue` call sites (`RobotModel.tsx`, `RobotPose.tsx`) through it.
- **Files modified:** `src/kinematics/urdf-joint-mapping.ts` (new), `src/kinematics/urdf-joint-mapping.test.ts` (new), `src/scene/RobotModel.tsx`, `src/scene/RobotPose.tsx`, `src/kinematics/index.ts`
- **Verification:** Read live Three.js scene-graph world matrices before/after the fix; empirically confirmed both bundled samples' flanges land exactly on the drawn toolpath with the fix applied.
- **Committed in:** `9130c34`

### Scope Expansions (user-approved via checkpoint)

**2. Off-table parked pose + real travel move**
- **Requested by:** coordinator/user, during Task 1 checkpoint re-verification, explicitly approved as scope addition for this plan rather than deferred.
- **What changed:** Added `UR3E_PARKED_POSE` (a genuinely off-table idle stance) and a prepended, independently IK-solved travel move from that pose to the toolpath's first point. This revises the plan's original must-have "scrub fraction 0 is the toolpath's exact first point" to "the END of the home-to-start travel move lands exactly at the toolpath's first point" — the coordinator's own reframing, implemented via a two-phase arc-length walk with each phase's own exact-endpoint guarantee.
- **Files modified:** `src/kinematics/ur3e-dh.ts`, `src/trajectory/compile.ts`, `src/trajectory/compile.test.ts`, `src/scene/RobotModel.tsx`
- **Committed in:** `9130c34`, `c44db2b`

---

**Total deviations:** 1 auto-fixed bug (Rule 1) + 1 user-approved scope expansion. Both were required for the tracer's core claim (accurate, non-clipping robot posing) to actually hold, so this is not scope creep beyond what the checkpoint explicitly requested.

## Issues Encountered

**Table-clipping investigation (see Known Issues below for the still-open result).** The travel move originally clipped through the workbench. Two waypoint designs were tried and rejected before landing on the current one:
- Lifting straight up from the parked pose's own X/Z position pushed the IK target beyond the UR3e's ~0.5m reach envelope (`compileTrajectory` returned `frozen-at-unreachable`).
- A single waypoint directly above the toolpath's first point (no separate lift) is reachable, but an analytical line/footprint check found a genuine ~1cm clip near the table's front-left corner for the real print sample.

The current design (lift waypoint horizontally inset partway toward the target, at clearance height) passed both the reachability check and a rigorous analytical footprint check (reproducing `Workbench.tsx`'s own footprint derivation, checked against every compiled sample for both real bundled g-code files — zero clipping samples). **However, per the coordinator's final message, the user's own live visual re-test still shows clipping despite this passing check.** This is documented as an open issue below rather than marked resolved.

## Known Issues

**Travel-move table clipping — STILL OPEN, not resolved despite an apparently-passing automated check.**

- **Symptom:** During the prepended home-to-toolpath travel move, the rendered arm visibly passes through the table geometry, per the user's own live visual testing.
- **What was tried:** Three waypoint-routing designs (see "Issues Encountered" above); the current design passes both an IK-reachability check and a rigorous analytical footprint check (`src/trajectory/compile.test.ts`, "travel move clears the table" — checks every compiled sample's `point` against `Workbench.tsx`'s own footprint derivation for both real bundled g-code files, zero clipping samples found).
- **The likely gap (not yet root-caused):** the regression test and the reachability check both validate the TRAJECTORY SAMPLE'S TARGET POINT (the flange/TCP position) against a simplified table AABB (axis-aligned bounding box derived from `Workbench.tsx`'s tabletop dimensions). They do **not** model (a) the actual rendered mesh geometry of the table (legs, tabletop thickness, exact corner geometry) versus the simplified AABB used in the check, or (b) any part of the ARM'S OWN BODY other than the tracked flange point — a forearm or wrist link can visually intersect the table even when the flange itself never enters the AABB. Either gap (or both) is the most likely explanation for the analytical check passing while the live render still clips.
- **Deliberately not pursued further this plan:** per explicit coordinator direction, this is being deferred to a consolidated fix pass after Wave 2 (plans 03-02, 03-03) completes, alongside any other issues the user surfaces at that point.
- **For whoever picks this up:** start by checking whether the clip is the tracked TCP point itself or a different arm link, and whether it's the lift/traverse/descend waypoints as currently computed or the actual rendered `Workbench.tsx` mesh diverging from the AABB this plan's check assumes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `CompiledTrajectory` / `TrajectorySample` contract (`src/trajectory/compile.ts`) is stable and ready for Phase 4 (playback), Phase 5 (telemetry), and Phase 6 (operations tree) to read.
- Plan 03-02 (this same phase, wave 2) adds `singularityFlags` to `TrajectorySample` and moves the visual rail carriage to the resolved rail position — both already anticipated in this plan's doc comments.
- **Blocker/concern carried forward:** the table-clipping issue above should be included in whatever consolidated list the user compiles after Wave 2, and re-verified visually (not just via the automated regression test, which is known to pass while the live render still shows the bug) before being marked resolved.

---
*Phase: 03-inverse-kinematics-trajectory-compile-scrub*
*Completed: 2026-08-14*

## Self-Check: PASSED

All 10 created files verified present on disk (`src/kinematics/inverse-kinematics.ts`, `src/kinematics/inverse-kinematics.test.ts`, `src/kinematics/urdf-joint-mapping.ts`, `src/kinematics/urdf-joint-mapping.test.ts`, `src/trajectory/arc-length.ts`, `src/trajectory/arc-length.test.ts`, `src/trajectory/compile.ts`, `src/trajectory/compile.test.ts`, `src/scene/RobotPose.tsx`, `src/ui/ScrubControl.tsx`). All 4 commit hashes verified present in `git log` (`c0de923`, `9130c34`, `c44db2b`, `01a1cce`).
