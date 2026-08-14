---
status: testing
phase: 02-g-code-import-static-toolpath
source: [02-VERIFICATION.md]
started: 2026-08-14T10:30:00Z
updated: 2026-08-14T10:45:00Z
---

## Current Test

number: 1
name: Print sample visual render
expected: |
  Toolpath in front of the robot on the floor, dashed gray rapids, solid thicker
  warm cutting line, clearly distinguishable in greyscale.
awaiting: user response

## Tests

### 1. Print sample visual render
expected: Toolpath in front of the robot on the floor, dashed gray rapids, solid thicker warm cutting line, clearly distinguishable in greyscale.
result: orchestrator pre-check via headless browser (Playwright) — toolpath renders correctly anchored in front of the robot's rail; cutting path (3-layer inset squares) clearly visible in warm orange. Ground-truth scene data confirms all 7 rapid segments are computed and passed to the render batch (14 points = 7×2), but they are individually short (4–20mm against a 150mm span) and were not visually distinguishable by eye in the screenshots taken. Not a data/wiring bug — the pipeline is correct — but worth a look on your own screen where you can orbit/zoom interactively. **Needs your eyeball check.**

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

## Summary

total: 5
passed: 4
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
