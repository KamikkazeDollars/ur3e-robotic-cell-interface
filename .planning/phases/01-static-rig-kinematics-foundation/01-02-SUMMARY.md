---
phase: 01-static-rig-kinematics-foundation
plan: 02
subsystem: kinematics
tags: [dh-parameters, forward-kinematics, ur3e, rail, vitest, typescript]

# Dependency graph
requires: [01-01]
provides:
  - "src/kinematics/ur3e-dh.ts — UR3E_DH, UR3E_JOINT_LIMITS, UR3E_JOINT_NAMES, UR3E_HOME_POSE, UR3E_READY_POSE, JointAngles type"
  - "src/kinematics/forward-kinematics.ts — forwardKinematics(joints, railPos?), isWithinJointLimits(joints)"
  - "src/kinematics/rail.ts — RAIL_TRAVEL, RAIL_CENTER_X, railRemainingTravel, clampRailPosition"
  - "src/kinematics/index.ts — barrel export of the full public kinematics surface"
  - "Vitest suite (14 tests, 2 files) green against externally-computed reference values"
affects: [01-03, 01-04, phase-3-ik-trajectory, phase-5-telemetry, phase-8-calibration]

# Actuals (#2632)
actuals:
  tokens: 3462
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-written 4x4 matrix helper (identity/multiply/rotZ/transZ/transX/rotX) composed per standard-DH convention, independent of urdf-loader's internal rendering math"
    - "Rail position enters forwardKinematics as a prepended pure translation along world x (left-multiplied before the joint chain)"
    - "TDD RED/GREEN per task: failing test committed first (reference literals typed in from RESEARCH.md), implementation committed second"

key-files:
  created:
    - src/kinematics/ur3e-dh.ts
    - src/kinematics/forward-kinematics.ts
    - src/kinematics/forward-kinematics.test.ts
    - src/kinematics/rail.ts
    - src/kinematics/rail.test.ts
    - src/kinematics/index.ts
  modified: []

key-decisions:
  - "Implemented the DH chain by composing four primitive 4x4 transforms (rotZ, transZ, transX, rotX) via a generic matrix-multiply helper, rather than the algebraically-equivalent single closed-form matrix — matches the plan's explicit action step wording ('rotate about z... translate along z... translate along x... rotate about x... and compose them in order') and keeps each DH primitive independently auditable."
  - "Independently hand-verified the home-pose matrix chain (6-step matrix multiplication by hand) before implementing, to confirm the composition order and DH convention reproduce RESEARCH.md's published (-0.45675, -0.22315, 0.0665) TCP position and rotation submatrix — not just trusted the research doc's literals blind."
  - "frames[] excludes the rail's leading translation as a separate entry — cumulative starts at transX(railPos) internally but only the 6 post-joint cumulative matrices are pushed to frames, matching the plan's 'exactly 6 entries, one per revolute joint' requirement while the rail offset is still baked into frames[5] (== tcpPosition)."

requirements-completed: [SCENE-04]

coverage:
  - id: K1
    description: "Forward kinematics reproduces the externally-verified home-pose TCP position (-0.45675, -0.22315, 0.0665) to 5 decimal places"
    requirement: "SCENE-04"
    verification:
      - kind: automated
        ref: "npx vitest run src/kinematics/forward-kinematics.test.ts -- 'matches the known home-pose (all-zero joints) TCP position'"
        status: pass
    human_judgment: false
  - id: K2
    description: "Home-pose rotation submatrix matches the RESEARCH.md-published matrix"
    requirement: "SCENE-04"
    verification:
      - kind: automated
        ref: "npx vitest run src/kinematics/forward-kinematics.test.ts -- 'rotation submatrix'"
        status: pass
    human_judgment: false
  - id: K3
    description: "Rail position enters as a pure prepended translation; elbow joint limit is +/- pi not +/- 2*pi; rail and FK agree on total travel"
    requirement: "SCENE-04"
    verification:
      - kind: automated
        ref: "npx vitest run (full suite, 14 tests) && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: K4
    description: "Kinematics module is framework-free (no three/urdf-loader/react import in any non-test source file)"
    requirement: "SCENE-04"
    verification:
      - kind: automated
        ref: "node framework-import scan script from the plan's <verify> block"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-13
status: complete
---

# Phase 1 Plan 02: Static Rig Kinematics Foundation Summary

**Hand-written UR3e forward kinematics (standard-DH chain, framework-free) reproduces the externally-verified home-pose TCP position and orientation to 5 decimal places, with the 7th-axis rail as a prepended translation and URDF-corrected asymmetric joint limits — all proven by a green 14-test Vitest suite against typed-in reference values, before any 3D rendering exists to trust.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 of 2 complete
- **Files created:** 6

## Accomplishments

- `src/kinematics/ur3e-dh.ts` — officially-sourced `UR3E_DH` standard-DH table (cross-verified this research session against Universal Robots' official DH page and the flattened UR3e URDF's joint origin offsets), `UR3E_JOINT_LIMITS` with the URDF-corrected narrower elbow range (+/- pi vs +/- 2*pi for the other five joints), `UR3E_JOINT_NAMES`, `UR3E_HOME_POSE` (test pose), `UR3E_READY_POSE` (D-08 display pose, distinct from the test pose), and the `JointAngles` tuple type
- `src/kinematics/forward-kinematics.ts` — hand-written standard-DH transform chain (`Rot_z . Trans_z . Trans_x . Rot_x` per joint, composed via a local 4x4 matrix-multiply helper), `forwardKinematics(joints, railPos?)` returning `{ frames, matrix, tcpPosition }`, `isWithinJointLimits(joints)`; independently implemented from — and never delegating to — `urdf-loader`'s internal joint math
- `src/kinematics/forward-kinematics.test.ts` — Pitfall 1's mandatory reference-pose test plus rotation-submatrix, rail-offset, chain-length, joint-limit-asymmetry, and rail/FK-agreement assertions; all reference literals typed in from `01-RESEARCH.md`, never derived from the implementation
- `src/kinematics/rail.ts` — `RAIL_TRAVEL` (3 m total, robot centred, explicitly flagged as a deliberately-chosen value with no hardware source per RESEARCH.md Assumption A4), `RAIL_CENTER_X` (computed, not restated), `clampRailPosition`, `railRemainingTravel` — the single source of truth the 3D rail geometry and Phase 5's DASH-03 readout will both consume
- `src/kinematics/index.ts` — barrel export of all 11 public symbols; internal matrix helpers (`identity4`, `multiply4`, `rotZ`, `transZ`, `transX`, `rotX`, `dhTransform`) intentionally kept out of the contract boundary
- Full Vitest suite green (14 tests, 2 files); `npx tsc --noEmit` clean; framework-free assertion script confirms no `three`/`urdf-loader`/`react`/`@react-three` import in any non-test source under `src/kinematics/`
- TDD gate sequence followed for both tasks: failing test committed first (RED, confirmed via `npx vitest run` showing import-resolution failure before implementation existed), implementation committed second (GREEN)

## Task Commits

1. **Task 1 — RED:** `52c3eeb` (test) — failing reference-pose test for UR3e forward kinematics
2. **Task 1 — GREEN:** `3a0fa33` (feat) — UR3e DH-based forward kinematics implementation
3. **Task 2 — RED:** `7cbba53` (test) — failing tests for rail travel geometry and rail composition
4. **Task 2 — GREEN:** `46b3dea` (feat) — rail travel geometry and kinematics barrel export

## Files Created/Modified

- `src/kinematics/ur3e-dh.ts` — DH table, joint limits, joint names, pose constants, `JointAngles` type
- `src/kinematics/forward-kinematics.ts` — DH transform chain, `forwardKinematics`, `isWithinJointLimits`
- `src/kinematics/forward-kinematics.test.ts` — 9 tests: home-pose TCP position, home-pose rotation submatrix, rail-offset, chain-length, limit acceptance/rejection (elbow vs shoulder-pan asymmetry), ready-pose validity, rail/FK travel agreement
- `src/kinematics/rail.ts` — `RAIL_TRAVEL`, `RAIL_CENTER_X`, `clampRailPosition`, `railRemainingTravel`
- `src/kinematics/rail.test.ts` — 5 tests: range/total-travel, centre/clamp-idempotence, clamp boundary behavior, symmetric remaining-travel at centre, zero/full remaining-travel at the limits
- `src/kinematics/index.ts` — barrel re-export of the public kinematics surface

## Decisions Made

See `key-decisions` in frontmatter: composed the DH chain from four primitive matrix transforms (not the algebraically-equivalent closed-form single matrix) to match the plan's explicit step-by-step wording and keep each primitive auditable; independently hand-verified the 6-step home-pose matrix chain before implementing to confirm the composition order itself (not just the literals) produces the reference pose; `frames[]` holds exactly the 6 post-joint cumulative transforms (rail offset baked in, not a separate 7th entry).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<behavior>`, `<action>`, and `<acceptance_criteria>` sections were implemented literally; no auto-fixes, no architectural changes, no scope additions.

## Verification Evidence

- `npx vitest run` (full suite): **14/14 tests passed**, 2 test files.
- `npx tsc --noEmit`: clean, no errors.
- Framework-free assertion script (from the plan's `<verify>` block): exits 0, `"kinematics module is framework-free"`.
- Barrel-export assertion script (from the plan's `<verify>` block): exits 0, `"barrel exports complete"` — all 11 public symbols (`UR3E_DH`, `UR3E_JOINT_LIMITS`, `UR3E_JOINT_NAMES`, `UR3E_HOME_POSE`, `UR3E_READY_POSE`, `forwardKinematics`, `isWithinJointLimits`, `RAIL_TRAVEL`, `RAIL_CENTER_X`, `railRemainingTravel`, `clampRailPosition`) confirmed present.

## TDD Gate Compliance

Both tasks followed the RED -> GREEN sequence with no shortcuts:

- Task 1: `52c3eeb` (test, RED — confirmed failing via unresolved-import error before `ur3e-dh.ts`/`forward-kinematics.ts` existed) -> `3a0fa33` (feat, GREEN — all 8 assertions in the file passed on first implementation run).
- Task 2: `7cbba53` (test, RED — confirmed failing via unresolved `./rail` import) -> `46b3dea` (feat, GREEN — all 6 new assertions passed, full suite 14/14).

No REFACTOR commits were needed — both implementations were correct and clean on the first GREEN pass (verified in part by the independent hand-computation of the home-pose matrix chain performed before writing `forward-kinematics.ts`).

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 01-02 is fully complete. `src/kinematics/index.ts`'s 11-symbol public surface is stable and ready for plan 01-03 (which poses the rendered UR3e via `urdf-loader`'s `setJointValue`, using `UR3E_JOINT_NAMES`/`UR3E_READY_POSE`/`RAIL_CENTER_X` to compose the rail rig, and can cross-check `forwardKinematics`'s TCP output against the rendered robot's flange position as a sanity check) and for plan 01-04's rail-rig geometry (`RAIL_TRAVEL` for end-stop placement, `RAIL_CENTER_X` for the static-pose carriage position). Phase 3's inverse kinematics and trajectory compiler, Phase 5's telemetry selectors, and Phase 8's calibration preview all extend `forwardKinematics`'s signature and `UR3E_DH`'s shape directly — both are now proven correct against an externally-computed reference, not just "looks right."

No blockers for downstream plans.

---
*Phase: 01-static-rig-kinematics-foundation*
*Completed: 2026-08-13*

## Self-Check: PASSED

All claimed files found on disk (`src/kinematics/ur3e-dh.ts`, `src/kinematics/forward-kinematics.ts`, `src/kinematics/forward-kinematics.test.ts`, `src/kinematics/rail.ts`, `src/kinematics/rail.test.ts`, `src/kinematics/index.ts`); all commit hashes (`52c3eeb`, `3a0fa33`, `7cbba53`, `46b3dea`) found in `git log --oneline --all`.
