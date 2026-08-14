---
status: testing
phase: 03-inverse-kinematics-trajectory-compile-scrub
source: [03-VERIFICATION.md]
started: 2026-08-14T18:26:44Z
updated: 2026-08-14T18:26:44Z
---

## Current Test

number: 1
name: Live interactive scrub-drag walkthrough (both bundled samples)
expected: |
  With no sample loaded, select the print sample and slowly drag the scrub control from 0% to 100%; repeat for the mill sample.
  The UR3e's flange sweeps continuously along the drawn toolpath with no joint visibly whipping, snapping, or reversing mid-drag. A single large repositioning as the sample first loads (arm leaving the parked pose) is expected and correct.
awaiting: user response

## Tests

### 1. Live interactive scrub-drag walkthrough (both bundled samples)
expected: With no sample loaded, select the print sample and slowly drag the scrub control from 0% to 100%; repeat for the mill sample. The UR3e's flange sweeps continuously along the drawn toolpath with no joint visibly whipping, snapping, or reversing mid-drag. A single large repositioning as the sample first loads (arm leaving the parked pose) is expected and correct.
result: [pending]

### 2. Marker/robot pose correspondence from a live orbiting camera
expected: During a scrub drag, confirm the teal scrub marker visually reads as sitting at the exact point the robot's tool is reaching, from an orbiting camera (not just fixed screenshot angles). The marker and the arm's tool tip never visibly diverge at any scrub position.
result: [pending]

### 3. Known open issue — home-to-toolpath travel-move table clipping
expected: Drag the scrub control through the home-to-toolpath travel-move portion (roughly the first few percent, before the arm reaches the toolpath's first point) for both bundled samples, watching for the arm visually passing through the table geometry. The arm's travel move stays clear of the table at all times. NOTE: this is a known, already-open issue per prior instruction — not expected to pass yet; recording status here for the record, not as a new blocker.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
