---
phase: 02-g-code-import-static-toolpath
plan: 04
subsystem: 3d-scene
tags: [r3f, three.js, kinematics, gcode-toolpath-anchor, vitest]

# Dependency graph
requires:
  - phase: 02-g-code-import-static-toolpath (plans 01-03)
    provides: parsed/classified toolpath (parseToolpath.ts), D-06 anchor scaffolding, camera auto-fit
provides:
  - "A workbench mesh (src/scene/Workbench.tsx) the toolpath visibly rests on"
  - "Re-derived D-06 anchor (TOOLPATH_ANCHOR_OFFSET.y/.z) sourced from the carriage's real geometry and a documented workbench height, not the floor plane or a reach-envelope fraction"
  - "CARRIAGE_FRONT_FACE_Z, WORKBENCH_TOP_Y, TOOLPATH_CLEARANCE_MARGIN exported from toolpath-anchor.ts as a stable contract for later phases"
affects: [phase-3-ik-trajectory, phase-4-playback]

actuals:
  tokens: 3400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Anchor derivations trace to real rendered geometry (CARRIAGE_BASE_DEPTH/CARRIAGE_BLOCK_DEPTH) plus a named clearance constant, never a fraction of an unrelated quantity like ROBOT_REACH_ENVELOPE"
    - "Scene furniture (Workbench.tsx) derives every dimension from the anchor module's exports, never restating a position/height as a second guessed literal"

key-files:
  created:
    - src/scene/Workbench.tsx
  modified:
    - src/scene/RailRig.tsx
    - src/gcode/toolpath-anchor.ts
    - src/gcode/toolpath-anchor.test.ts
    - src/scene/CellScene.tsx

key-decisions:
  - "Re-derived TOOLPATH_ANCHOR_OFFSET.z from CARRIAGE_FRONT_FACE_Z (the carriage's own real forward-most depth, exported from RailRig.tsx) plus a named 0.12m TOOLPATH_CLEARANCE_MARGIN, replacing the prior derivation (RIG_Z_OFFSET + ROBOT_REACH_ENVELOPE/2) that had no relationship to the rig's physical footprint and produced a real ~1.5cm overlap (G-02-02)"
  - "Derived WORKBENCH_TOP_Y as exactly half the ready pose's own TCP world-space Y, computed by calling the real forwardKinematics(UR3E_READY_POSE) rather than hand-transcribing a literal, so it can never drift from forward-kinematics.ts"
  - "Treated 02-01-PLAN.md's 'costly to reverse' rating on D-06 as superseded by the user's own live UAT feedback, per the plan's explicit rationale that Phase 3 has zero downstream consumers of the anchor yet — changed the derivation directly rather than routing through checkpoint:decision"

patterns-established:
  - "Pitfall-D export widening: module-private scene dimension constants (CARRIAGE_BASE_DEPTH, CARRIAGE_BLOCK_DEPTH) get `export` plus a one-line doc comment naming the cross-module consumer, matching CARRIAGE_TOP_Y's existing pattern"

requirements-completed: [SIM-01, SIM-02]

coverage:
  - id: D1
    description: "TOOLPATH_ANCHOR_OFFSET.y sits on a derived workbench height instead of the floor plane; TOOLPATH_ANCHOR_OFFSET.z clears CARRIAGE_FRONT_FACE_Z by a named margin instead of a reach-envelope fraction"
    requirement: "SIM-02"
    verification:
      - kind: unit
        ref: "src/gcode/toolpath-anchor.test.ts#D-06 anchor: bundled samples clear the carriage front face (G-02-02)"
        status: pass
      - kind: unit
        ref: "src/gcode/toolpath-anchor.test.ts#D-06 anchor: bundled samples land inside the robot reach envelope"
        status: pass
      - kind: unit
        ref: "src/gcode/toolpath-anchor.test.ts#D-06 anchor: ready-pose TCP world position sits above the anchor and within reach horizontally"
        status: pass
    human_judgment: false
  - id: D2
    description: "A workbench mesh renders under the toolpath, clearly above floor level, with a visible gap between the carriage and the toolpath's near edge, for both bundled samples; camera auto-fit and Reset View remain correct"
    requirement: "SIM-01"
    verification:
      - kind: unit
        ref: "npm run build (exit 0) + npm test (67/67 pass)"
        status: pass
    human_judgment: true
    rationale: "Deferred per project human_verify_mode: end-of-phase config — the plan's <human-check> visual confirmation (workbench visible above floor, visible clearance gap, camera auto-fit/Reset View unaffected) was not run interactively during this autonomous execution and needs a human/orchestrator pass over the live app for both bundled samples."

duration: 6min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 04: Gap Closure (G-02-01, G-02-02) Summary

**Re-derived the D-06 toolpath anchor from the carriage's real rendered geometry and a workbench mesh's height, replacing a floor-level Y and a reach-envelope-fraction Z that produced a real ~1.5cm overlap with the rail rig's carriage.**

## Performance

- **Duration:** 6 min (task commits 11:25:39 → 11:28:07 UTC+3; plus read/verify overhead)
- **Started:** 2026-08-14T11:23:00+03:00 (approx, precondition check)
- **Completed:** 2026-08-14T11:28:07+03:00
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Widened `CARRIAGE_BASE_DEPTH` and `CARRIAGE_BLOCK_DEPTH` to exports in `RailRig.tsx`, following the existing `CARRIAGE_TOP_Y` Pitfall-D pattern
- Rewrote `toolpath-anchor.ts`'s D-06 derivation: added `CARRIAGE_FRONT_FACE_Z` (the carriage's real forward-most face), `WORKBENCH_TOP_Y` (half the ready-pose TCP's own world height, computed from the real `forwardKinematics` module), and `TOOLPATH_CLEARANCE_MARGIN` (0.12m named clearance) — `TOOLPATH_ANCHOR_OFFSET.y`/`.z` now derive from these instead of the floor plane and a reach-envelope fraction
- Added a new `describe` block to `toolpath-anchor.test.ts` proving G-02-02 mechanically: both bundled samples' minimum anchored Z strictly exceeds `CARRIAGE_FRONT_FACE_Z`
- Built `Workbench.tsx`: a tabletop slab + four legs, every dimension derived from `toolpath-anchor.ts`'s exports (`CARRIAGE_FRONT_FACE_Z`, `TOOLPATH_ANCHOR_OFFSET`, `WORKBENCH_TOP_Y`), mounted in `CellScene.tsx` between the rail rig and the toolpath

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive the D-06 anchor from the carriage's real geometry and the workbench height** - `6f50625` (fix)
2. **Task 2: Build the workbench mesh and mount it in the scene** - `b510143` (feat)

**Plan metadata:** (this SUMMARY commit, pending)

## Files Created/Modified
- `src/scene/RailRig.tsx` - Widened `CARRIAGE_BASE_DEPTH`/`CARRIAGE_BLOCK_DEPTH` to exports with Pitfall-D doc comments
- `src/gcode/toolpath-anchor.ts` - Added `CARRIAGE_FRONT_FACE_Z`, `WORKBENCH_TOP_Y`, `TOOLPATH_CLEARANCE_MARGIN`; rewrote `TOOLPATH_ANCHOR_OFFSET.y`/`.z` derivation and doc comment
- `src/gcode/toolpath-anchor.test.ts` - Added a `describe` block proving the carriage-clearance property for both bundled samples
- `src/scene/Workbench.tsx` (new) - Tabletop + four-leg table mesh, positioned/sized entirely from `toolpath-anchor.ts` exports
- `src/scene/CellScene.tsx` - Mounted `<Workbench />` between the rail-rig-mount group and `<Toolpath />`; updated composition-order comment

## Decisions Made
- Changed D-06 directly rather than opening a `checkpoint:decision`, per the plan's explicit rationale that Phase 3 has not yet been planned/executed and there are zero downstream consumers of the prior anchor values — the user's live UAT feedback supersedes the earlier "costly to reverse" rating
- Chose `TOOLPATH_CLEARANCE_MARGIN = 0.12` (documented ~12cm) as a clearly visible gap relative to the toolpath's ~15cm scale, per the plan's explicit instruction
- Chose workbench standoff/pad/leg constants (0.02m standoff, 0.15m far pad, 0.5m width, 0.04m thickness, 0.03m leg section, 0.04m leg inset) as reasonable values within the plan's specified ranges; each is a named, commented constant, not a second restated anchor value

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep checks, `npx vitest run`, `npm run build`, `npm test`) all pass.

## Issues Encountered

None. Manual arithmetic check of every derived Workbench dimension (`TABLETOP_DEPTH` ≈ 0.25m, `LEG_HEIGHT` ≈ 0.373m, `LEG_HALF_WIDTH` ≈ 0.21m) confirmed all values are strictly positive before relying on the visual human-check, satisfying the plan's T-02-13 mitigation (no degenerate geometry from a negative computed dimension).

## Deferred Human-Check Items

Per this project's `human_verify_mode: end-of-phase` and the parallel-execution instructions for this plan, the two `<human-check>` verification notes in the plan (Task 2's `<verify>`) were **not** run interactively during this autonomous execution. They are deferred to end-of-phase sign-off:

1. Run `npm run dev`, select the print sample: confirm a workbench/table sits under the toolpath, clearly above floor level, and the toolpath no longer overlaps or reads as underneath the rail rig's carriage — a visible gap should exist between the carriage and the toolpath's near edge. Repeat for the mill sample.
2. Re-confirm camera auto-fit still works: selecting each sample re-frames the camera to that sample's own bounds, and Reset View still returns to the wide Phase 1 default.

Automated proxies for both were run and passed: the new `toolpath-anchor.test.ts` clearance assertions (mechanical proof of item 1's overlap claim) and `npm run build` + full `npm test` (67/67 pass, no regression to camera-fit logic since this plan did not touch `ToolpathCameraFit.tsx` or `parseToolpath.ts`'s bounds computation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-02-01 and G-02-02 (both major-severity UAT gaps) are closed pending the deferred human-check sign-off above
- `CARRIAGE_FRONT_FACE_Z`, `WORKBENCH_TOP_Y`, `TOOLPATH_CLEARANCE_MARGIN` are now part of the stable D-06 contract Phase 3 will read from
- Remaining open UAT gaps from `02-UAT.md` not addressed by this plan: G-02-03 (thicker toolpath lines + start/end markers, minor severity) and G-02-04 (nav cube opacity, cosmetic severity) — out of scope for this plan (`gap_ids: [G-02-01, G-02-02]` only)

---
*Phase: 02-g-code-import-static-toolpath*
*Completed: 2026-08-14*
