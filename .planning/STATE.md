---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 03
current_phase_name: inverse-kinematics-trajectory-compile-scrub
status: executing
stopped_at: Completed 03-05-PLAN.md (marker sizing + guide visibility gap closure, human checkpoint approved)
last_updated: "2026-08-15T09:35:02.816Z"
last_activity: 2026-08-15
last_activity_desc: Phase 03 execution started
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 14
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-13)

**Core value:** The 3D toolpath simulation must work flawlessly end-to-end: import g-code → see it rendered as an accurately color-coded, animated robot motion in the 3D cell.
**Current focus:** Phase 03 — inverse-kinematics-trajectory-compile-scrub

## Current Position

Phase: 03 (inverse-kinematics-trajectory-compile-scrub) — GAP CLOSURE COMPLETE
Plan: 5 of 5
Status: All plans in Phase 03 executed (2 gap-closure plans: 03-04, 03-05); phase-level verification not run (--gaps-only scope)
Last activity: 2026-08-15 — Closed gaps G-03-6 and G-03-4

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 15min | 2 tasks | 6 files |
| Phase 01 P03 | 25min | 2 tasks | 16 files |
| Phase 01 P04 | 75min | 2 tasks | 20 files |
| Phase 03 P01 | 240min | 2 tasks | 17 files |
| Phase 03 P02 | 7min | 3 tasks | 10 files |
| Phase 03 P03 | 20min | 2 tasks | 3 files |
| Phase quick P260815-3cn | 20min | 3 tasks | 20 files |
| Phase 03 P05 | 18min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Followed research/SUMMARY.md's 8-phase vertical-MVP build order (kinematics foundation → g-code → IK/trajectory/scrub → playback → telemetry → operation polish → tool-changer → remaining tabs) rather than compressing to standard 4-6 phase granularity, because the phase split is driven by technical risk isolation (DH convention, IK branch selection, rail redundancy), not padding.
- [Roadmap]: DEPLOY-01/DEPLOY-02 mapped to Phase 1 since deployment is meant to start day one and be redeployed after every phase (per research Pitfall 15), even though it's an operating concern threaded through all phases.
- [Phase ?]: Composed the DH chain from four primitive matrix transforms (rotZ/transZ/transX/rotX via a generic multiply helper) rather than the algebraically-equivalent closed-form single matrix, to match the plan's step-by-step action wording and keep each DH primitive independently auditable.
- [Phase ?]: Independently hand-verified the 6-step home-pose matrix chain before implementing forward-kinematics.ts, confirming the composition order (not just the RESEARCH.md literals) reproduces the reference TCP position and rotation submatrix.
- [Phase ?]: [Phase 1, Plan 03]: Pinned shadcn CLI to 3.8.4 (not npm-latest 4.17.0), whose preset system (nova/vega/maia/...) replaced the classic neutral base-color flow the UI-SPEC and plan require.
- [Phase ?]: [Phase 1, Plan 03]: Modeled camera-reset as a monotonically increasing resetToken (not a boolean) so every repeated Reset View click fires distinctly, proven by a 7-test Vitest suite.
- [Phase ?]: [Phase 1, Plan 03]: Verified the shadcn CLI's radix-ui umbrella-package dependency delta against the npm registry (same radix-ui/primitives org, ~12M weekly downloads) rather than re-opening the package-legitimacy checkpoint, per coordinator instruction to continue.
- [Phase ?]: Sourced UR3e meshes from UniversalRobots/Universal_Robots_ROS2_Description's rolling branch (not main/master, which do not exist on that repo)
- [Phase ?]: Added node to tsconfig.app.json types after tsc -b (real build gate) caught a Node-builtin type-check failure that bare tsc --noEmit silently missed (root tsconfig files:[] checks nothing without -b)
- [Phase ?]: Checkpoint follow-up (2 rounds, user-directed, confirmed no later phase owns scene composition): axis triad on nav cube (verified GizmoViewcube face order from installed source), rig+robot shifted forward off world origin, footprint-sized asymmetric floor (front-positioned, not centered), twin-rail carriage geometry
- [Phase ?]: Investigated a reported floor/rig Z mismatch via three empirical methods (three.js matrixWorld simulation, full nested-group scene-graph reconstruction with forwardKinematics data, and DAE mesh matrix inspection) before concluding no coordinate bug existed and fixing the underlying design (floor's own asymmetric Z center) instead of chasing a nonexistent bug
- [Phase ?]: Checkpoint follow-up round 3: user reviewed round 2's asymmetric floor and explicitly requested the floor share the exact same Z as the rig after all; reverted to the simple symmetric design the round-2 empirical investigation had already proven correct
- [Phase 1]: Checkpoint follow-up round 4 (raised during UAT sign-off): user clarified — via a top-down diagram — that round 3's "same Z" fix wasn't what was wanted after all; the rig should sit near the floor's front edge with extra floor depth behind it. Re-confirmed and re-implemented directly (round 2's original math, now deliberately chosen rather than reverted) instead of routing through the full diagnose/gap-closure pipeline, since the change was fully specified by the user's confirmation.
- [Phase 1]: Phase 1 UAT passed 1/1 (live-URL visual sign-off, post round-4 fix); code review found 0 critical / 2 warning / 2 info (non-functional ESLint config, missing StrictMode cleanup guard on the async URDF load — logged, not blocking); security review closed all 14 phase-1 threats (threats_open: 0) via the plan-time STRIDE registers, no auditor spawn needed under the ASVS L1 short-circuit rule.
- [Phase ?]: [Phase 3, Plan 1]: Discovered and fixed a real, pre-existing 180-degree URDF frame divergence (base_link vs base_link_inertia, documented in the official UR3e URDF) via a single render-boundary conversion function (toUrdfJointAngles), rather than touching the pure DH kinematics modules.
- [Phase ?]: [Phase 3, Plan 1]: Checkpoint-approved scope expansion — added UR3E_PARKED_POSE (off-table idle stance, distinct from UR3E_READY_POSE which stays untouched since toolpath-anchor.ts derives WORKBENCH_TOP_Y from it) and a real IK-solved travel move, revising the must-have that scrub fraction 0 is the toolpath's first point to fraction 0 being the parked pose instead.
- [Phase ?]: Corrected shoulder-singularity distance check to compare against the joint-4 DH offset (its true theoretical floor), not zero
- [Phase ?]: RailRig reads trajectory.railPos via a reactive Zustand selector (not useFrame), matching the store's coarse-cadence performance discipline
- [Phase ?]: Chose #0F766E deep teal for the D-07 scrub marker, distinct from rapid/cutting/accent tones
- [Phase ?]: ScrubMarker.tsx duplicates RobotPose.tsx's sample-index derivation verbatim rather than sharing a helper, so the marker and the robot pose can never silently drift apart (SIM-05)
- [Phase ?]: [Quick 260815-3cn]: Renamed UI-SPEC role tokens from Tailwind-reserved --color-* to --ui-* — fixed a real bug where @theme inline silently overrode --color-secondary/-accent/-destructive with shadcn's own variables
- [Phase ?]: [Quick 260815-3cn]: Stood up static Phase 5-8 UI shell scaffolding (7-tab rail, mode bar, placeholder panels) ahead of Phase 4 playback engine, per requirements_status: scaffold-only — no data wired, no behaviour implemented
- [Phase ?]: [Phase 3, Plan 5]: marker-scale.ts derives all marker/guide sizing from ParsedToolpath.bounds (pure, unit-tested) rather than hardcoded literals; scrubMarkerRadiusFromBounds multiplies the endpoint radius so the scrub/endpoint size hierarchy holds by construction at every toolpath scale

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3]: Closed-form IK algorithm and 7th-axis rail redundancy-resolution heuristic are architecturally decided but not yet validated against actual UR3e DH values — flagged for a research/validation pass before/during planning.
- [Phase 2+]: Code review flagged a non-functional ESLint setup (no `eslint.config.js` despite ESLint/typescript-eslint being installed and CLAUDE.md mandating it) and a missing cleanup guard on `RobotModel.tsx`'s async URDF load under React StrictMode. Non-blocking; worth fixing early in Phase 2 before more scene code accumulates. See `01-REVIEW.md`.
- [Phase 3]: RESOLVED 2026-08-15 (commit `e9dceb1`) — the travel-move table-clipping/joint-whipping issue (previously listed here as a known open issue) was root-caused to two defects in `pickClosestBranch`'s wrap-unaware branch continuity scoring and a misoriented `UR3E_PARKED_POSE`. Fixed, regression-tested, and human-verified live in-app on both bundled samples. See `.planning/debug/resolved/table-clipping-singularities.md`.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | OPT-03 (accel/jerk limit sliders) | Deferred to v2 | Requirements definition |
| v2 | OPT-04 (path/corner smoothing control) | Deferred to v2 | Requirements definition |
| v2 | SIM-08 (color-by-feedrate toggle) | Deferred to v2 | Requirements definition |
| v2 | DASH-04 (joint/rail-limit threshold warnings) | Deferred to v2 | Requirements definition |

## Session Continuity

Last session: 2026-08-15T09:34:04.749Z
Stopped at: Completed 03-05-PLAN.md (marker sizing + guide visibility gap closure, human checkpoint approved)
Resume file: None
