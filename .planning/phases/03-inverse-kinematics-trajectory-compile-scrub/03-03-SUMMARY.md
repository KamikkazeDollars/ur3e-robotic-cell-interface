---
phase: 03-inverse-kinematics-trajectory-compile-scrub
plan: 03
subsystem: robotics-kinematics
tags: [react-three-fiber, three.js, zustand, ui, scrub-control, ur3e]

# Dependency graph
requires:
  - phase: 03-inverse-kinematics-trajectory-compile-scrub (plan 03-01)
    provides: CompiledTrajectory/TrajectorySample contract, RobotPose.tsx's useFrame + getState() imperative pose driver, ScrubControl.tsx's initial minimal range input
provides:
  - D-07 current-scrub-position indicator (ScrubMarker.tsx) — a single teal sphere riding the drawn toolpath, driven from the exact same sample index that poses the robot
  - D-05 readable scrub control — percentage-of-path readout and an honest disabled empty state on ScrubControl.tsx
  - Phase 3's manual scrub sign-off (Playwright-driven, both bundled samples) — percentage readout, marker/robot agreement, rail centring, no unreachable-point note
affects: [04-playback-timeline-telemetry, 05-dashboard-sensors, 06-operations-tree]

# Actuals (#2632)
actuals:
  tokens: 2166
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "ScrubMarker.tsx mirrors RobotPose.tsx's index derivation (Math.round(scrubFraction * (samples.length - 1)), clamped) exactly, so two independent components can never disagree about which sample they're both reporting — the SIM-05 correspondence guarantee lives in that literal code duplication, not a shared abstraction, because the two consumers (a mesh position, a setJointValue call) have nothing else in common"
    - "Visibility toggled via mesh.visible inside useFrame rather than conditional JSX unmount, so the component still renders once (mounted, invisible) and the empty-trajectory check runs every frame without a React re-render"

key-files:
  created:
    - src/scene/ScrubMarker.tsx
  modified:
    - src/scene/CellScene.tsx
    - src/ui/ScrubControl.tsx

key-decisions:
  - "Chose #0F766E (deep teal) for the scrub marker — distinct from RAPID_COLOR (#9CA3AF), CUTTING_COLOR (#EA580C), and the reserved Accent blue (#2563EB), verified by grep against the acceptance criteria's colour-collision check"
  - "Marker radius (0.02m) set meaningfully larger than Toolpath.tsx's start/end MARKER_RADIUS (0.012m) so the current-position indicator reads as the primary marker, not a third same-size bullet"
  - "Kept the empty-state copy inline in ScrubControl.tsx rather than the shared status-copy module, per the plan's explicit instruction — that module is reserved for the loading/failure states the scene overlay renders"

patterns-established:
  - "A second useFrame consumer (ScrubMarker) reading the same store slice as an existing one (RobotPose) duplicates the index-derivation logic verbatim rather than extracting a shared helper — deliberate, since the failure mode being guarded against (marker and pose silently drifting apart) is best prevented by both sites being trivially inspectable and identical, not by trusting a shared function neither site can see is being called consistently"

requirements-completed: [SIM-05]

coverage:
  - id: D1
    description: "A single, distinctly-toned marker tracks the current scrub position along the toolpath, driven from the same trajectory sample index that poses the robot — never rendered before a trajectory exists"
    requirement: "SIM-05"
    verification:
      - kind: unit
        ref: "npm test — full Phase 1-3 suite, 104/104 passing, no regression"
        status: pass
      - kind: automated_ui
        ref: "Playwright-driven scrub walkthrough (both bundled samples, fractions 0/0.02/0.03/.../1) — zero console errors; close-range screenshots (ultra-frac0.png) confirm the teal marker renders at the tool tip, correctly occluded by the tool geometry when the tool points directly at its target, visible from off-angle views"
        status: pass
    human_judgment: true
    rationale: "Whether the marker's on-screen position genuinely reads as 'the same point the tool is reaching' from a live orbiting camera is a visual judgment call the plan's own human-check calls for — automated screenshots at fixed angles can show the marker is present and positioned correctly, but the felt correspondence during an interactive drag is not screenshot-provable."
  - id: D2
    description: "The scrub control reports its position as a percentage and disables itself with an explanation when there is no trajectory to scrub"
    requirement: "SIM-05"
    verification:
      - kind: unit
        ref: "npm test — full Phase 1-3 suite, 104/104 passing"
        status: pass
      - kind: automated_ui
        ref: "Playwright: pre-select disabled state + 'Select a sample...' note captured (01-initial.png); post-select percentage readout matches drag position exactly for all four checkpoints (0/15/50/100%) across both bundled samples"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase sign-off: both bundled samples scrub end to end with no visible joint snapping, and the rail carriage sits at the centre of its travel for both"
    requirement: "SIM-05"
    verification:
      - kind: automated_ui
        ref: "Playwright screenshots across dense fraction sweeps (wide-frac*, close-frac*, ultra-frac*) for the print sample — continuous, monotonic pose change with no reversal artifacts visible frame to frame; no unreachable-point note rendered at any sampled fraction for either sample"
        status: pass
    human_judgment: true
    rationale: "'No visible joint whipping/snapping mid-drag' is a continuous-motion judgment that a sequence of discrete screenshots approximates but cannot prove exhaustively — the plan's own human-check frames this as a live-drag observation, and 03-01-SUMMARY.md documents a case (the travel-move table clip) where an automated check passed while a live visual re-test caught a real issue automation missed."

duration: ~20min
completed: 2026-08-14
status: complete
---

# Phase 3 Plan 3: Scrub-to-Pose Visual Correspondence Summary

**A teal D-07 scrub marker rides the drawn toolpath at the robot's exact tool-tip position (identical sample-index derivation to the pose driver), plus a percentage readout and honest disabled state on the scrub control.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-14T20:36:12+03:00 (base merge)
- **Completed:** 2026-08-14T20:51:19+03:00
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `ScrubMarker.tsx`: a single imperative `useFrame` sphere, mounted in `CellScene.tsx` right after `Toolpath`, that resolves the exact same sample index `RobotPose.tsx` uses (`Math.round(scrubFraction * (samples.length - 1))`, clamped) — the marker and the robot's pose can never disagree about which sample they're reporting, because they're reading the same store slice through the same formula
- A new deep-teal tone (`#0F766E`), distinct from the toolpath's rapid/cutting colours and the reserved Accent blue, at a radius meaningfully larger than the existing start/end markers so it reads as the primary indicator
- `ScrubControl.tsx` now shows a whole-number percentage readout above the slider (wired via `aria-describedby`) and a one-line disabled-state explanation ("Select a sample before the toolpath can be scrubbed.") instead of a silently inert control
- Phase sign-off: drove the running app with a headless-Chromium Playwright script (no project devDependency added — used the browser binary already cached from 03-01's own verification) across both bundled samples, confirming the empty state, the percentage readout at four checkpoints each, zero console errors, and — via close-range zoomed screenshots — that the teal marker genuinely renders at the tool's target point, including the expected partial occlusion by the tool geometry itself when the tool points straight at its target

## Task Commits

1. **Task 1: Ride a current-position marker along the toolpath as the scrub moves** - `0870ae6` (feat)
2. **Task 2: Make the scrub position readable, handle the empty state, and take the phase sign-off** - `5c4465b` (feat)

## Files Created/Modified

- `src/scene/ScrubMarker.tsx` - D-07 imperative current-scrub-position marker; `useFrame` + `getState()`, no reactive subscription
- `src/scene/CellScene.tsx` - mounts `ScrubMarker` after `Toolpath`, before `OrbitControls`; extends the composition-order doc comment
- `src/ui/ScrubControl.tsx` - percentage readout, disabled-state copy, `aria-describedby` wiring

## Decisions Made

See `key-decisions` in frontmatter above. Worth restating in prose:

1. **The marker's index derivation is a deliberate, verbatim duplicate of `RobotPose.tsx`'s, not a shared helper.** The plan's load-bearing must-have is that the marker and the arm can never disagree about which sample they're both reporting. A shared function both sites call is one more layer a future edit could change in only one call site without anyone noticing; two components independently doing the identical trivial arithmetic, both readable at a glance, is easier to audit for staying in sync than trusting an abstraction neither call site can see the other uses.
2. **Marker occlusion by the tool geometry is expected, not a bug.** Because the marker's position is exactly the toolpath sample's `point` (the same value the tool is IK-targeting), when the tool points directly down at its target the marker sits almost entirely behind/under the visible tool nozzle from most camera angles. This was verified visually (see Issues Encountered) and is the correct behaviour — it's the strongest possible evidence the two are in agreement, not a rendering defect.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were needed; the acceptance-criteria greps all passed on the first implementation pass.

## Issues Encountered

**Initial visual read of the marker.** At the plan's suggested wide framing (the default `ToolpathCameraFit`-cropped view used for the first screenshot pass), the teal marker was not obviously visible — it reads as fully hidden behind/beside the tool nozzle at typical zoom levels, since it sits essentially where the tool tip is. This raised a question of whether the component was actually rendering. Resolved by zooming the (headless, scripted) camera in close on the wrist/tool region: the teal sphere is clearly visible peeking out beside the tool geometry at oblique angles (documented in the coverage `D1` verification), and disappears from view specifically when the tool points straight down at the table — exactly the geometric relationship the plan's design implies. No code change was needed; this was a verification-methodology finding, not a defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-07 (current-position indicator) and the readable D-05 scrub control are both complete; Phase 3's `must_haves.truths` for this plan are all satisfied.
- The Phase 3 wave (03-01 IK/trajectory/scrub, 03-02 singularity classification/DH refinement, 03-03 this plan) is now fully executed. Per the coordinator's stated plan, the still-open 03-01 known issue (home-to-toolpath travel move occasionally clipping the table visually despite passing its automated check) was explicitly out of scope for this plan and remains open for the user's consolidated post-Wave-2 review — not touched or re-investigated here.
- `CompiledTrajectory`/`TrajectorySample` and the scene composition order in `CellScene.tsx` (now including `ScrubMarker`) are stable for Phase 4 (playback/timeline) to build on.

---
*Phase: 03-inverse-kinematics-trajectory-compile-scrub*
*Completed: 2026-08-14*

## Self-Check: PASSED

All 4 files verified present on disk (`src/scene/ScrubMarker.tsx`, `src/scene/CellScene.tsx`, `src/ui/ScrubControl.tsx`, this SUMMARY.md). Both commit hashes (`0870ae6`, `5c4465b`) verified present in `git log`.
