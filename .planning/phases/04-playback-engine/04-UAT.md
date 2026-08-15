---
status: testing
phase: 04-playback-engine
source: [04-VERIFICATION.md]
started: 2026-08-15T17:45:00Z
updated: 2026-08-15T17:45:00Z
---

## Current Test

number: 1
name: Full playback run
expected: |
  The UR3e and rail carriage animate continuously along the whole toolpath, holding the final pose at the end; the teal marker rides the line in step with the flange; the slider and percentage readout advance live; the button icon toggles Play/Pause correctly.
awaiting: user response

## Tests

### 1. Full playback run
expected: Run `npm run dev`, select a bundled sample, press Play. The UR3e and rail carriage animate continuously along the whole toolpath, holding the final pose at the end; the teal marker rides the line in step with the flange; the slider and percentage readout advance live; the button icon toggles Play/Pause correctly.
result: [pending]

### 2. Drag-to-pause-and-seek (D-04)
expected: With a sample loaded, press Play, then drag the scrub slider while the robot is moving. Playback stops immediately at the dragged position, the button returns to the play icon, and the robot stays where the drag left it until Play is pressed again.
result: [pending]

### 3. Rapid-vs-cut weighted timing (D-02)
expected: Load the milling sample and press Play. The robot covers non-cutting positioning moves noticeably faster than cutting passes, and the whole run still finishes in about ten seconds — the same total as the printing sample.
result: [pending]

### 4. Continuous blended motion + manual scrub agreement
expected: Load a sample and press Play; then pause and drag the slider slowly end to end. The arm and marker move smoothly and continuously with no per-step ticking during playback; the marker stays on the drawn toolpath and the flange stays on the marker throughout manual scrubbing, matching Phase 3's behaviour.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
