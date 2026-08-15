---
status: complete
phase: 04-playback-engine
source: [04-VERIFICATION.md]
started: 2026-08-15T17:45:00Z
updated: 2026-08-15T20:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Full playback run
expected: Run `npm run dev`, select a bundled sample, press Play. The UR3e and rail carriage animate continuously along the whole toolpath, holding the final pose at the end; the teal marker rides the line in step with the flange; the slider and percentage readout advance live; the button icon toggles Play/Pause correctly.
result: issue
reported: "Well the rail carriage dosen't move in any g-code sample so it's not checkable if will work. There isn't any teal line visible on the page while and after the animation is running. The UR3e robot does what's intended to do. Let's modify some things.Make the robot start from the right side of the rig ( the distance from the center is to your decision) and left side for milling. In this way the rig rail has a motive for being there. Let's do other modifications. Let the user choose only the g-code sample for printing in the when printing tab is on , and the same for milling."
severity: major

### 2. Drag-to-pause-and-seek (D-04)
expected: With a sample loaded, press Play, then drag the scrub slider while the robot is moving. Playback stops immediately at the dragged position, the button returns to the play icon, and the robot stays where the drag left it until Play is pressed again.
result: pass

### 3. Rapid-vs-cut weighted timing (D-02)
expected: Load the milling sample and press Play. The robot covers non-cutting positioning moves noticeably faster than cutting passes, and the whole run still finishes in about ten seconds — the same total as the printing sample.
result: skipped
reason: "Deferred follow-up: Mostly pass, but it seems that it's moving too fast for now but it's mostly a visual problem, no need to fix now just note for when the complete version of the product is done"

### 4. Continuous blended motion + manual scrub agreement
expected: Load a sample and press Play; then pause and drag the slider slowly end to end. The arm and marker move smoothly and continuously with no per-step ticking during playback; the marker stays on the drawn toolpath and the flange stays on the marker throughout manual scrubbing, matching Phase 3's behaviour.
result: pass

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

- gap_id: G-04-1
  truth: "The UR3e and rail carriage animate continuously along the whole toolpath; the teal marker rides the line in step with the flange."
  status: resolved
  resolution: |
    Closed by gap-closure plans 04-04 (traversed-path highlight + legible scrub
    marker + PlaybackClock mount-order fix), 04-05 (mode-tagged samples +
    mode-filtered picker), and 04-06 (per-mode rail station: printing 0.6m right
    of centre, milling 0.6m left, workbench travels with it). 04-06's blocking
    human-verification checkpoint went two rounds: round 1 found a real
    regression (mode-switch reselection forced a tight camera zoom instead of
    the wide rail-sweep framing), fixed in commit 8cf0c43 and re-verified; round
    2 the user replied "approved". Independently re-verified by 04-VERIFICATION.md
    (22/22 must-haves passed, full 1054-test suite green).
  reason: "User reported: Well the rail carriage dosen't move in any g-code sample so it's not checkable if will work. There isn't any teal line visible on the page while and after the animation is running. The UR3e robot does what's intended to do. Let's modify some things. Make the robot start from the right side of the rig (the distance from the center is to your decision) and left side for milling. In this way the rig rail has a motive for being there. Let's do other modifications. Let the user choose only the g-code sample for printing when the printing tab is on, and the same for milling."
  severity: major
  test: 1
  root_cause: |
    Two confirmed bugs plus two requested features, bundled in one report:
    (1) Teal "trajectory highlight" was never built. ROADMAP.md success criterion 2
    calls for both a "trajectory highlight AND TCP marker" tracking playback, but
    only ScrubMarker.tsx (a small sphere) was implemented in Phase 3 — Toolpath.tsx
    renders a static, playback-agnostic line with no highlight/traversed-segment
    coloring. Additionally the existing marker is tiny (~5mm radius via
    marker-scale.ts) relative to the ~150mm sample path swept in 10s, and
    ScrubMarker mounts before PlaybackClock in CellScene.tsx causing a 1-frame
    stale read of livePlayback.fraction — both make it easy to miss during autoplay.
    (2) Rail carriage motion is real and tested (rail.ts resolveRailPosition) but
    every bundled sample's toolpath is unconditionally X-centered onto
    RAIL_CENTER_X by the D-06 anchor step (toolpath-anchor.ts, parseToolpath.ts),
    so resolveRailPosition always lands back at/near center for both samples —
    not broken, just never exercised off-center.
    (3) & (4) are net-new feature requests, not bugs: mode-dependent rail start
    position (printing right-of-center, milling left-of-center) requires bridging
    uiShellStore.cellMode into cellStore/compileTrajectory, which today is
    explicitly walled off by design (uiShellStore.ts:5-8); and per-mode g-code
    sample filtering requires tagging GCODE_SAMPLES with a mode field and filtering
    SampleSelect.tsx's dropdown by active cellMode.
  artifacts:
    - path: "src/scene/Toolpath.tsx"
      issue: "Static line only; never reads trajectory/livePlayback/scrubFraction — no traversed-segment highlight"
    - path: "src/scene/ScrubMarker.tsx"
      issue: "Only existing playback-position indicator; too small to read clearly during full-speed autoplay"
    - path: "src/scene/marker-scale.ts"
      issue: "MARKER_RADIUS_FRACTION/SCRUB_MARKER_SCALE produce a ~5mm marker on the sample path scale"
    - path: "src/scene/CellScene.tsx"
      issue: "ScrubMarker mounted/registered before PlaybackClock — 1-frame stale fraction read during autoplay"
    - path: "src/gcode/toolpath-anchor.ts"
      issue: "TOOLPATH_ANCHOR_OFFSET.x hardcoded to RAIL_CENTER_X for every sample, masking rail resolution"
    - path: "src/gcode/parseToolpath.ts"
      issue: "D-06 anchor step re-centers every toolpath onto the fixed rail-center X"
    - path: "src/kinematics/rail.ts"
      issue: "resolveRailPosition works correctly but never sees off-center input; RAIL_CENTER_X has no mode awareness"
    - path: "src/trajectory/compile.ts"
      issue: "compileTrajectory has no mode parameter; calls resolveRailPosition with already-centered points"
    - path: "src/store/uiShellStore.ts"
      issue: "cellMode deliberately isolated from scene/trajectory/kinematics (header comment) — needs conscious revision to bridge for mode-based start position"
    - path: "src/store/cellStore.ts"
      issue: "selectSample/compileTrajectory call chain does not read cellMode"
    - path: "src/gcode/samples.ts"
      issue: "GcodeSample has no mode field; GCODE_SAMPLES entries not tagged printing/milling"
    - path: "src/ui/SampleSelect.tsx"
      issue: "Renders all GCODE_SAMPLES unconditionally; does not read cellMode to filter options"
  missing:
    - "Render a traversed-path highlight (e.g. recolor/overlay the drawn polyline up to current playback fraction) driven by livePlayback.fraction/scrubFraction"
    - "Enlarge the scrub marker and/or fix CellScene mount order (PlaybackClock before ScrubMarker) so position is visible during full-speed autoplay"
    - "Add a per-mode rail start-position bias (e.g. offset RAIL_CENTER_X right for printing, left for milling) and thread cellMode from uiShellStore through cellStore.selectSample into compileTrajectory/resolveRailPosition"
    - "Tag GCODE_SAMPLES entries with mode: 'printing' | 'milling' and filter SampleSelect.tsx's options by the active cellMode"

## Deferred Follow-Ups

- test: 3
  idea: "Rapid-vs-cut timing feels too fast visually right now — revisit pacing/tuning when the complete version of the product is done. Not a blocker for this phase."
  deferred_at: 2026-08-15
