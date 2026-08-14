---
status: complete
phase: 03-inverse-kinematics-trajectory-compile-scrub
source: [03-VERIFICATION.md, Phase three problems.md]
started: 2026-08-14T18:26:44Z
updated: 2026-08-14T18:41:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Live interactive scrub-drag walkthrough (both bundled samples)
expected: With no sample loaded, select the print sample and slowly drag the scrub control from 0% to 100%; repeat for the mill sample. The UR3e's flange sweeps continuously along the drawn toolpath with no joint visibly whipping, snapping, or reversing mid-drag. A single large repositioning as the sample first loads (arm leaving the parked pose) is expected and correct.
result: issue
reported: "The robot goes into singularities when going over the workbench from home position. While doing that it also goes through the table." (from Phase three problems.md, item 1)
severity: blocker

### 2. Marker/robot pose correspondence from a live orbiting camera
expected: During a scrub drag, confirm the teal scrub marker visually reads as sitting at the exact point the robot's tool is reaching, from an orbiting camera (not just fixed screenshot angles). The marker and the arm's tool tip never visibly diverge at any scrub position.
result: pass

### 3. Known open issue — home-to-toolpath travel-move table clipping
expected: Drag the scrub control through the home-to-toolpath travel-move portion (roughly the first few percent, before the arm reaches the toolpath's first point) for both bundled samples, watching for the arm visually passing through the table geometry. The arm's travel move stays clear of the table at all times.
result: issue
reported: "The robot goes into singularities when going over the workbench from home position. While doing that it also goes through the table" and "it is very probable that the tools on the robot will go through the table" (from Phase three problems.md, items 1-2). Confirms the previously-documented known issue, with new detail: the travel move also passes through joint singularities, not just visual table clipping.
severity: blocker

### 4. Operation point count and marker visibility/sizing
expected: Not part of the original 3 formal checkpoints — user-reported during review.
result: issue
reported: "For printing and milling I see that there are three operations that are made but only two points. It should be 3. Also the vertical line that the point is on isn't very visible. Also compared to the whole trajectory the points are too big, you can make them smaller." (from Phase three problems.md, item 3)
severity: major

### 5. Click an operation start point to jump scrub/playback there
expected: Not part of the original 3 formal checkpoints — user feature request.
result: skipped
reason: "Deferred follow-up: I don't know if it will be implemented in phase 3 or 4, but I suggest that when the user clicks on the points where the printing/milling operation starts, the scrub/playback (when it's done) jumps from the start to there. (from Phase three problems.md, item 4)"

### 6. Rail rig / workbench / layout color differentiation
expected: Not part of the original 3 formal checkpoints — user preference/cosmetic report.
result: issue
reported: "The colors of the rail rig and workbench are the same and I don't like that, please make them into different colors, also make the layout a different color" (from Phase three problems.md, item 5)
severity: cosmetic

### 7. Simulated material addition/removal for print/mill operations
expected: Not part of the original 3 formal checkpoints — user feature request.
result: skipped
reason: "Deferred follow-up: Maybe it's better for this to be on the 4th phase but if we have a printing/milling g-code maybe we should also have a product for both of them. For the printing part there should appear material when the robot goes along the trajectory and for the milling part, it should eliminate material from an aluminium cube. For the size of the material you can use the g-code that you used and make them big enough that the g-code works on them. (from Phase three problems.md, item 6)"

## Summary

total: 7
passed: 1
issues: 4
pending: 0
skipped: 2
blocked: 0

## Gaps

- gap_id: G-03-1
  truth: "The UR3e's flange sweeps continuously along the drawn toolpath with no joint visibly whipping, snapping, or reversing mid-drag."
  status: failed
  reason: "User reported: the robot goes into singularities when going over the workbench from home position, and goes through the table while doing so."
  severity: blocker
  test: 1
  artifacts: []
  missing: []

- gap_id: G-03-3
  truth: "The arm's home-to-toolpath travel move stays clear of the table at all times."
  status: failed
  reason: "User confirms the known open issue is still present, and adds new detail: the travel move also passes through joint singularities (not just visually clipping the table). This is a stronger/more specific failure than the originally-diagnosed table-AABB-vs-TCP-point gap in 03-REVIEW.md's IN-02 — singularities suggest the travel waypoints themselves (parked pose -> lift -> approach -> descend) may be poorly chosen relative to the robot's reachable/well-conditioned workspace, not just geometrically colliding with the table."
  severity: blocker
  test: 3
  artifacts: []
  missing: []

- gap_id: G-03-4
  truth: "Each operation in a sample has its own distinct, visible start marker on the toolpath."
  status: failed
  reason: "User reported: 3 operations exist but only 2 points are shown; the vertical line a point sits on is not very visible; points are too large relative to the trajectory."
  severity: major
  test: 4
  artifacts: []
  missing: []

- gap_id: G-03-6
  truth: "Scene elements are visually distinguishable from each other by color."
  status: failed
  reason: "User reported: the rail rig and workbench currently share the same color, and the layout/floor should also be a distinct color."
  severity: cosmetic
  test: 6
  artifacts: []
  missing: []

## Deferred Follow-Ups

- test: 5
  idea: "When the user clicks on the points where a printing/milling operation starts, jump the scrub/playback position to that point. User is unsure whether this belongs in phase 3 or phase 4."
  deferred_at: 2026-08-14
- test: 7
  idea: "Simulate material addition (printing) / removal (milling, from an aluminium cube) as the trajectory plays, sized to fit the bundled g-code samples. User suggests this may belong in phase 4."
  deferred_at: 2026-08-14
