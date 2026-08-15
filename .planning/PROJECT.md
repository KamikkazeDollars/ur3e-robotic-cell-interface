# UR3e Robotic Cell Interface

## What This Is

A browser-based 3D control/visualization interface for a Universal Robots UR3e mounted on a 7th external linear-rail axis, operating a single robotic cell that switches between printing and milling modes via an automatic tool-changer. Users import a g-code file and watch it play back as a color-coded, animated toolpath in an interactive 3D scene, while monitoring simulated telemetry, sensors, and setup/calibration parameters across dedicated tabs. Built as a technical interview assignment demonstrating full-stack + 3D/robotics capability under a tight deadline.

## Core Value

The 3D toolpath simulation must work flawlessly end-to-end: import g-code → see it rendered as an accurately color-coded, animated robot motion in the 3D cell. Everything else can be thinner if time runs short, but this cannot fail.

## Requirements

### Validated

- ✓ User can view the UR3e cell in an interactive 3D scene — Phase 1 (official UR3e model + 7th-axis rail rig rendered, DH-derived ready pose)
- ✓ User can orbit/pan/zoom the 3D camera, and reset the camera to center on the robot cell — Phase 1
- ✓ User sees a Fusion-360-style navigation cube (Front/Top/Bottom/Back views) in the 3D viewport that rotates in sync with the camera — Phase 1
- ✓ Project is version-controlled on GitHub and deployed to a publicly reachable URL — Phase 1
- ✓ User can select a bundled g-code sample and have the system parse it into a classified toolpath — Phase 2 (scoped to curated bundled samples, not general file upload; see D-01 below)
- ✓ Toolpath lines are color-coded by move type (rapid vs. cutting), rendered on a workbench in front of the robot — Phase 2
- ✓ User can start playback of the simulated toolpath and watch the robot follow it in real time — Phase 4 (dual-cadence imperative clock, move-type-weighted timing, traversed-path highlight, mode-filtered samples, per-mode rail station)

### Active

- [ ] For milling operations, the toolpath line changes color while the tool is in contact with the work body (e.g. cutting a hole), reflecting depth of engagement
- [ ] Each operation shows distinct start/end points on the trajectory
- [ ] User can see an operations tree ordered by sequence, showing per-operation timing
- [ ] User can switch between a Printing tab and a Milling tab for the same UR3e cell
- [ ] The UR3e's 7th external linear-rail axis is modeled, with the UI showing current position and remaining travel limits in each direction relative to the robot's position on the rail
- [ ] Dashboard tab shows real-time-style telemetry (position, speed, and other key parameters) computed from toolpath playback, not mock data
- [ ] Setup tab lets the user configure which robot(s)/auxiliary devices are part of the current cell
- [ ] I/O tab lets the user view/configure inputs and outputs for the active robot/devices
- [ ] Vision tab shows sensor status/data relevant to the operation (exact sensor set to be informed by research — likely force sensing and/or camera feedback)
- [ ] Calibrate tab lets the user adjust the robot's home position and per-operation joint positions
- [ ] Optimization tab lets the user adjust toolpath/process parameters, with additional options informed by research into standard robotic-cell optimization controls
- [ ] Automatic tool-changer behavior (switching between print head and mill spindle) is represented in setup and simulation
- [ ] Project is version-controlled on GitHub and deployed to a publicly reachable URL

### Out of Scope

- Live/physical UR3e hardware connection (e.g. RTDE/URScript control or monitoring) — v1 is simulation-only; explicitly deferred, may be revisited after the interview
- Support for robots other than the UR3e — original brief mentioned swapping robots later; not needed for this assignment

## Context

- Built for a technical interview assignment with a tight timeline (a few days). Must use GitHub for source control and be deployed somewhere reachable, not just run locally.
- The brief evolved across two source notes from the user:
  - **Note 1 (initial):** broader spec assuming a UR robot on a 7-axis setup (6-axis UR + external linear rail, with travel limits shown in UI), top tables for Setup/Optimization/Simulation, and left-side tabs for Dashboard/Vision/Calibrate/Setups/Simulation/I/O.
  - **Note 2 (refined):** narrows the robot to a UR3e, collapses the separate Toolpath and Simulation pages into a single Simulation page, and adds the operations tree and Fusion-360-style navigation cube.
  - Through questioning, the user confirmed the 7th-axis rail from Note 1 is still in scope, and that both the Optimization and Calibrate tabs from Note 1 should be kept even though Note 2 didn't restate them.
- The user explicitly wants research (not just implementation of what's already specified) on: UR3e kinematics, DH parameters, and singularity points; what belongs on a Vision page for a robotic printing/milling cell (sensor types); and what a general Optimization tab should contain for a robotic cell of this kind.
- A previously referenced file (`-aplicatie test-.md`) with additional toolpath requirements no longer exists on disk; the user confirmed Note 2 already captures everything that mattered from it.
- Unrelated files found on the user's machine reference a separate UFactory XArm5 MQTT project and a thesis ("Licenta") folder — not part of this project, noted only to avoid confusion.

## Constraints

- **Timeline**: A few days only — prioritize a working, polished core (3D toolpath simulation) over full tab breadth if time runs short.
- **Platform**: Browser-based web app (e.g. React + Three.js/WebGL for the 3D scene) — user chose web over desktop.
- **Hardware**: No physical UR3e available/connected. Simulation-only; all telemetry is computed from toolpath playback, not read from real hardware.
- **Source control & deployment**: Must be on GitHub; must be deployed to a live, reachable URL (deployment target to be decided during planning).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single UR3e cell with automatic tool-changer, exposed as two tabs (Printing/Milling) | User confirmed it's one robot with two operation modes, not two separate cells | — Pending |
| Keep the 7th external linear-rail axis in scope | User confirmed the rail from Note 1 is still wanted despite Note 2 omitting it | — Pending |
| Simulation-only for v1, no live robot connection | User confirmed sim-only; real hardware connection explicitly deferred | — Pending |
| Keep both Optimization and Calibrate tabs in v1 | User confirmed both wanted; Optimization to be expanded via research | — Pending |
| G-code import drives toolpath generation | Unchanged from the original brief | — Pending |
| Web app (browser-based) platform | User chose web app over desktop app | ✓ Confirmed — live on Vercel, Phase 1 |
| Prioritize 3D toolpath simulation as the must-nail centerpiece | Tight few-day timeline; user named this as the one thing that must impress | On track — 3D foundation (robot, rail, camera) shipped Phase 1 |
| Rail carriage parked at travel centre for the static Phase 1 pose, but rig positioned near the floor's front (camera-side) edge with extra floor depth behind it | Keeps rail travel visible in both directions while composing the scene so the rig doesn't read as centred/floating on an oversized floor | ✓ Shipped — Phase 1 (4 rounds of live-URL composition iteration) |
| G-code "upload" scoped to curated, bundled sample files for v1 (D-01) | Removes the risk of an unvetted file hitting a parser edge case during a live demo; general upload UI adds no interview value | ✓ Shipped — Phase 2 |
| Toolpath anchored on a dedicated workbench in front of the robot, not the bare floor, with an explicit clearance margin from the rail rig's carriage | User feedback after first look: floor placement read as "illogical" and the toolpath visually overlapped the rig; re-derived from the carriage's real measured geometry rather than an arbitrary fraction of reach envelope | ✓ Shipped — Phase 2 (gap-closure round) |
| `gcode-toolpath`/`gcode-parser` (both low-download-count `SUS` verdicts) approved for use after manual npm/GitHub source review | Age, license, source repo (cncjs org), and postinstall scripts all came back clean; low weekly downloads was the only flag | ✓ Shipped — Phase 2, blocking human checkpoint approved |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-15 after Phase 4: playback-engine*
