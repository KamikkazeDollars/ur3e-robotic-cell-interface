---
status: complete
phase: 02-g-code-import-static-toolpath
source: [02-VERIFICATION.md, user: "Phase two problems.md"]
started: 2026-08-14T10:30:00Z
updated: 2026-08-14T11:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Print sample visual render
expected: Toolpath in front of the robot on the floor, dashed gray rapids, solid thicker warm cutting line, clearly distinguishable in greyscale.
result: pass
note: "Original issue (position/clearance/workbench/line-thickness) resolved by gap-closure plans 02-04 and 02-05, re-verified live in browser: toolpath now rests on a visible workbench well clear of the carriage, lines are thicker, and start/end markers render as full orange spheres (a marker-clipping regression found during this re-check was fixed directly — see commit 8921e1d)."

### 2. Mill sample visual render
expected: 3 depth passes at visibly distinct heights, smooth curved corners (not chorded), no seam at arc-to-line junctions.
result: orchestrator pre-check via headless browser — rounded-rectangle contour renders with smooth curved corners (arc tessellation confirmed working visually, not just numerically). **Confirmed by orchestrator; spot-check optional.**

### 3. Camera auto-fit + Reset View independence
expected: Each sample selection re-frames the camera to fit that sample's own bounding box; Reset View returns to the wide Phase-1 default, not either toolpath fit.
result: orchestrator pre-check — confirmed live: selecting print then mill produced two visibly different camera framings (screenshots captured). This directly exercises the CR-01 fix (camera-fit effect was dead code before the fix landed this session). **Confirmed by orchestrator; spot-check optional.**

### 4. Missing-sample error surface
expected: An error message appears over the canvas (not a blank scene, not a console-only failure).
result: orchestrator pre-check — confirmed via a genuine intercepted 404 (renaming the file on disk was a false-negative test path due to Vite dev-server SPA fallback masking 404s as 200s in dev mode only — not a production concern). With a real 404, the overlay reads "Couldn't load that sample. Check your connection and try again." — clean and visible. **Confirmed by orchestrator; spot-check optional.**

### 5. Unit disclosure visibility
expected: A label stating samples are interpreted in millimetres is visible beside the dropdown.
result: orchestrator pre-check — "Samples are interpreted in mm." is visible beside the dropdown in every screenshot taken. **Confirmed by orchestrator; spot-check optional.**

### 6. Nav cube axis-triad visibility
expected: The XYZ axis triad on the navigation cube's back corner is visible through the cube's faces, not fully occluded by them.
result: pass
note: "Resolved by gap-closure plan 02-05 (opacity=0.6 on GizmoViewcube). Re-verified live: all three axis arrows and all six face labels visible simultaneously."

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-01
  truth: "The toolpath sits well above floor level (roughly half the robot's height) on a visible workbench, not floating over the bare floor."
  status: resolved
  resolved_by: 02-04-PLAN.md
  resolved_at: 2026-08-14
  reason: "User reported (Phase two problems.md #1, #3): print position too low; needs a workbench under it since resting directly on the floor plane reads as illogical."
  severity: major
  test: 1
  root_cause: "TOOLPATH_ANCHOR_OFFSET.y (src/gcode/toolpath-anchor.ts) is hardcoded to 0 (world floor plane) and no workbench mesh exists anywhere in the scene — the toolpath's Y=0 min-point sits directly on the bare floor plane rendered in CellScene.tsx."
  artifacts: [src/gcode/toolpath-anchor.ts, src/scene/CellScene.tsx]
  missing: ["A Workbench scene component (new mesh) whose top surface height becomes the new TOOLPATH_ANCHOR_OFFSET.y target", "toolpath-anchor.test.ts assertions updated for the new anchor height"]
- gap_id: G-02-02
  truth: "The toolpath sits clearly in front of the robot/rail rig's carriage with a visible clearance gap, never overlapping or reading as underneath it."
  status: resolved
  resolved_by: 02-04-PLAN.md
  resolved_at: 2026-08-14
  reason: "User reported (Phase two problems.md #2): trajectory shouldn't be behind/under the rig; needs more distance from it."
  severity: major
  test: 1
  root_cause: "Traced numerically against the live constants: robot mount is at world Z=RIG_Z_OFFSET=0.5; TOOLPATH_ANCHOR_OFFSET.z = RIG_Z_OFFSET + ROBOT_REACH_ENVELOPE/2 = 0.75, so the toolpath's bounding-box center sits at Z=0.75. The print sample's own Z half-extent is ~0.075m, mill sample's ~0.06m, so each sample's near (robot-facing) edge lands at roughly Z=0.675-0.69 — the carriage's own front face (CARRIAGE_BASE_DEPTH/2 = 0.19m forward of the mount) extends to Z=0.69. The print sample's near edge (0.675) is measurably BEHIND the carriage's front face (0.69) — a real ~1.5cm overlap, not a visual illusion. Root cause: TOOLPATH_ANCHOR_OFFSET.z was derived as a fraction of ROBOT_REACH_ENVELOPE with no accounting for the carriage's own physical footprint depth."
  artifacts: [src/gcode/toolpath-anchor.ts, src/scene/RailRig.tsx]
  missing: ["Anchor Z derivation that adds explicit clearance beyond CARRIAGE_BASE_DEPTH/2 (or CARRIAGE_BLOCK_DEPTH/2, whichever is the true forward-most rig extent), not just a flat fraction of the reach envelope", "toolpath-anchor.test.ts assertion that both samples' near-Z-edge clears the carriage's front face by a positive, named margin"]
- gap_id: G-02-03
  truth: "The rendered toolpath lines are visibly thicker, and the start and end of the toolpath are marked with clearly visible, thicker point markers in the same warm-orange family."
  status: resolved
  resolved_by: 02-05-PLAN.md
  resolved_at: 2026-08-14
  reason: "User reported (Phase two problems.md #4): make the trajectory line thicker; add start/end bullet-point markers, same orange, thicker than the line."
  severity: minor
  test: 1
  root_cause: "src/scene/Toolpath.tsx sets lineWidth=2 (rapid) / lineWidth=3 (cutting) on drei's <Line>, both quite thin at scene scale; no marker geometry exists anywhere for path start/end. Note: this phase's toolpath is one continuous parsed path, not yet split into a named-operations list — that structure is ROADMAP Phase 6 (\"Operations Tree + Mill Engagement Coloring\" — per-operation start/end markers). For Phase 2, the closest honest scope is marking the OVERALL toolpath's start and end points, not per-operation markers; flag to the user that granular per-operation markers are Phase 6's job."
  artifacts: [src/scene/Toolpath.tsx]
  missing: ["Increased lineWidth on both Line batches", "Small sphere/marker meshes at toolpath.segments[0].points[0] (start) and the last point of the last segment (end), colored CUTTING_COLOR, sized visibly larger than the line width"]
- gap_id: G-02-04
  truth: "The navigation cube's XYZ axis triad is visible through the cube's faces."
  status: resolved
  resolved_by: 02-05-PLAN.md
  resolved_at: 2026-08-14
  reason: "User reported (Phase two problems.md #5): cube opacity should be reduced so axes show through."
  severity: cosmetic
  test: 6
  root_cause: "src/scene/NavCube.tsx renders <GizmoViewcube color=\"#FAFAFA\" .../> with no opacity prop — drei's GizmoViewcube defaults to opacity=1 (confirmed in installed source, node_modules/@react-three/drei/core/GizmoViewcube.js: FaceMaterial sets transparent:true, opacity given as a prop, defaulting to 1). The axis triad (three arrowHelpers, already built as a Phase-1 checkpoint follow-up) is anchored at the cube's Left/Bottom/Back corner and is fully depth-occluded by the cube's own opaque near faces from the default viewing angle. Note this is a Phase 1 (NavCube.tsx) file, not Phase 2, but is included here per the user's combined report."
  artifacts: [src/scene/NavCube.tsx]
  missing: ["opacity prop passed to <GizmoViewcube> (drei already supports this — a one-line change), tuned so face labels stay legible while the axis triad reads through"]

## Deferred Follow-Ups

- test: N/A (Phase two problems.md #6)
  idea: "User asked whether the toolpath should eventually show the robot's own joint movement, not just the printed/milled path. Answer (not a gap): the Phase 2 line is intentionally the tool-tip g-code path only (SIM-01/SIM-02 scope). The robot's own motion along that path is Phase 3 (Inverse Kinematics + Trajectory Compile + Scrub) and Phase 4 (Playback Engine) — already on the roadmap, not missing scope."
  deferred_at: 2026-08-14
- test: N/A (Phase two problems.md #7)
  idea: "User asked whether print/mill toolpath color should differ, and whether robot-movement (once built) should use a different color family. Recommendation: keep rapid=gray/cutting=orange consistent across both samples (only one is ever shown at a time, so a second color axis adds no disambiguation value); when Phase 3/4 render robot joint motion, give it a visually distinct color family (not orange/gray) so it never reads as another toolpath class. No code change this phase — carry into Phase 3/4 UI-SPEC."
  deferred_at: 2026-08-14
