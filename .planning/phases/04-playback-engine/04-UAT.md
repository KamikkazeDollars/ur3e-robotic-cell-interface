---
status: complete
phase: 04-playback-engine
source: [04-VERIFICATION.md]
started: 2026-08-15T17:45:00Z
updated: 2026-08-15T18:20:00Z
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
passed: 2
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- gap_id: G-04-1
  truth: "The UR3e and rail carriage animate continuously along the whole toolpath; the teal marker rides the line in step with the flange."
  status: failed
  reason: "User reported: Well the rail carriage dosen't move in any g-code sample so it's not checkable if will work. There isn't any teal line visible on the page while and after the animation is running. The UR3e robot does what's intended to do. Let's modify some things. Make the robot start from the right side of the rig (the distance from the center is to your decision) and left side for milling. In this way the rig rail has a motive for being there. Let's do other modifications. Let the user choose only the g-code sample for printing when the printing tab is on, and the same for milling."
  severity: major
  test: 1
  artifacts: []
  missing: []

## Deferred Follow-Ups

- test: 3
  idea: "Rapid-vs-cut timing feels too fast visually right now — revisit pacing/tuning when the complete version of the product is done. Not a blocker for this phase."
  deferred_at: 2026-08-15
