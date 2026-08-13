# Roadmap: UR3e Robotic Cell Interface

## Overview

This roadmap builds a browser-based 3D digital twin of a UR3e on a 7th-axis rail, one vertical MVP slice at a time, in the exact dependency order the domain forces: a kinematically-correct static rig and scene first, then g-code import as an independent data pipeline, then inverse kinematics and a precomputed joint trajectory (validated via scrub before any animation exists), then the real-time playback engine, then the telemetry dashboard that reads the same trajectory data the scene reads, then the visual polish that reuses that playback (operation markers, mill engagement coloring), then the tool-changer and Print/Mill tabs, and finally the remaining lower-risk tabs (Setup, Vision, Calibrate, I/O, Optimization). This order — inherited directly from `.planning/research/SUMMARY.md`'s architecture and pitfalls research — front-loads the two highest-risk, hardest-to-debug-after-the-fact concerns (DH/kinematics correctness and IK branch/redundancy handling) before any pixel of animation or any secondary tab is built, so the one thing that must not fail (import → accurate, color-coded, animated, telemetry-backed playback) is proven early and everything after it is a comparatively cheap, low-risk addition.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Static Rig + Kinematics Foundation** - UR3e + rail render at a correct static pose in an interactive, nav-cube-driven 3D scene; project is live on GitHub + a public URL from day one
- [ ] **Phase 2: G-code Import + Static Toolpath** - Upload a g-code file and see it parsed into a classified, color-coded static toolpath in the 3D scene
- [ ] **Phase 3: Inverse Kinematics + Trajectory Compile + Scrub** - Scrub the timeline and watch the UR3e (incl. rail) accurately re-pose along the toolpath via closed-form IK
- [ ] **Phase 4: Playback Engine** - Press play and watch the UR3e animate the full toolpath in real time, synced to the visible trajectory
- [ ] **Phase 5: Telemetry / Dashboard** - Live joint angles, TCP position/speed, and rail position/travel, all computed from the same playback data the scene reads
- [ ] **Phase 6: Operations Tree + Mill Engagement Coloring** - Per-operation start/end markers, a sequenced operations tree with computed durations, and depth-of-engagement coloring for milling cuts
- [ ] **Phase 7: Tool-Changer + Print/Mill Tabs** - Switch between Printing and Milling tabs for the same cell, with the tool-changer visually swapping the mounted tool
- [ ] **Phase 8: Remaining Tabs (Setup, Vision, Calibrate, I/O, Optimization)** - Setup device toggles, simulated force/contact readout, calibration controls, I/O status, and feed-rate override with live cycle-time estimate

## Phase Details

### Phase 1: Static Rig + Kinematics Foundation

**Goal**: Users can view an accurately-modeled UR3e (including its 7th-axis rail) in an interactive 3D scene at a correct static pose, and the project is deployed and reachable from the first day of work
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SCENE-01, SCENE-02, SCENE-03, SCENE-04, DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):

  1. User can orbit, pan, and zoom the 3D camera around the robot cell
  2. User can reset the camera to a centered view of the robot cell with one action
  3. User sees a Fusion-360-style navigation cube showing Front/Top/Bottom/Back presets that rotates in sync with the camera, and clicking a face snaps the camera to that view
  4. User sees the UR3e, including its 7th external linear-rail axis, rendered at a correct pose derived from its DH-parameter kinematic model (forward kinematics unit-tested against a known reference pose)
  5. Project source is on GitHub and the latest working build is live at a publicly reachable URL

**Plans**: 2/4 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold, deploy to GitHub + Vercel, and render the interactive nav-cube-driven 3D cell (SCENE-01, SCENE-03, DEPLOY-01, DEPLOY-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — DH-parameter forward kinematics and 7th-axis rail geometry, unit-tested against the reference home pose (SCENE-04, math half)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — shadcn/ui design-system layer, UI-SPEC token contract, and the one-action camera reset (SCENE-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — UR3e URDF + meshes rendered on the visible 7th-axis rail at the kinematics-derived ready pose (SCENE-04, rendering half; DEPLOY-02 re-verified)

**UI hint**: yes

### Phase 2: G-code Import + Static Toolpath

**Goal**: Users can upload a g-code file and see it parsed into a classified, color-coded toolpath rendered in the 3D scene, independent of any kinematics/animation risk
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SIM-01, SIM-02
**Success Criteria** (what must be TRUE):

  1. User can upload a g-code file and the system parses it into classified move segments (move type, coordinates, feed rate per segment)
  2. User sees the parsed toolpath rendered in the 3D scene as a color-coded line, with rapid/joint moves visually distinct from linear/cutting moves

**Plans**: TBD

### Phase 3: Inverse Kinematics + Trajectory Compile + Scrub

**Goal**: Users can scrub to any point in the operation's timeline and see the UR3e accurately posed along the parsed toolpath, proving IK correctness in isolation before live animation is built on top of it
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: SIM-05
**Success Criteria** (what must be TRUE):

  1. User can drag a scrub control to any point in the timeline and see the UR3e (including the rail axis) re-pose to accurately match the toolpath at that instant, with no visible snapping or flipping between IK solutions as the scrub position changes
  2. The 7th-axis rail is resolved to a consistent, documented position at each scrub point via a redundancy-resolution heuristic, keeping the robot within joint and travel limits across the full timeline

**Plans**: TBD

### Phase 4: Playback Engine

**Goal**: Users can press play and watch the UR3e execute the full toolpath in real time, completing the "must not fail" core simulation before any secondary tab work begins
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SIM-04
**Success Criteria** (what must be TRUE):

  1. User can press play and watch the UR3e animate continuously along the full toolpath in real time, synced to the visible trajectory line
  2. During playback, the trajectory highlight and TCP marker track the robot's current position smoothly, driven by an imperative render loop rather than per-frame React state updates

**Plans**: TBD

### Phase 5: Telemetry / Dashboard

**Goal**: Users see live telemetry on the Dashboard tab, computed directly from the same toolpath-playback data the 3D scene reads, never mock data
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):

  1. User sees live joint angles for all UR3e joints on the Dashboard tab, updating in sync with playback
  2. User sees the live TCP Cartesian position and speed on the Dashboard tab, updating in sync with playback
  3. User sees the 7th-axis rail's current position and remaining travel distance in each direction, updating in sync with playback

**Plans**: TBD
**UI hint**: yes

### Phase 6: Operations Tree + Mill Engagement Coloring

**Goal**: Users see a sequenced, timed operations tree and can visually distinguish tool-engaged milling cuts by depth of engagement, reusing Phase 2's segmentation and Phase 4's playback
**Mode:** mvp
**Depends on**: Phase 2, Phase 4
**Requirements**: SIM-03, SIM-06, SIM-07
**Success Criteria** (what must be TRUE):

  1. User sees a distinct start and end marker on the 3D trajectory for each operation
  2. During milling operations, the toolpath line changes color to reflect depth of tool-to-workpiece engagement while cutting
  3. User sees an operations tree listing every operation in sequence order along with its computed duration

**Plans**: TBD

### Phase 7: Tool-Changer + Print/Mill Tabs

**Goal**: Users can switch between Printing and Milling modes for the same UR3e cell, with the tool-changer station visually swapping the mounted tool via the tool-offset parameterization built into trajectory compile
**Mode:** mvp
**Depends on**: Phase 3, Phase 4
**Requirements**: TOOL-01, TOOL-02
**Success Criteria** (what must be TRUE):

  1. User can switch between a Printing tab and a Milling tab for the same UR3e cell
  2. Switching tabs visually swaps the mounted tool (print head vs. mill spindle) at the tool-changer station in the 3D scene

**Plans**: TBD

### Phase 8: Remaining Tabs (Setup, Vision, Calibrate, I/O, Optimization)

**Goal**: Users can configure the cell, monitor simulated sensor/IO state, calibrate positions, and adjust optimization parameters, rounding out the full tab set as thin consumers of the now-stabilized playback store
**Mode:** mvp
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: SETUP-01, VISION-01, CALIB-01, CALIB-02, IO-01, OPT-01, OPT-02
**Success Criteria** (what must be TRUE):

  1. User can toggle which auxiliary devices (rail, tool-changer) are active/present in the current cell configuration on the Setup tab
  2. User sees a simulated force/contact readout on the Vision tab that stays near-zero during free motion and rises during tool-engaged (cutting/extrusion) segments, labeled as estimated/simulated
  3. User can adjust the robot's home position and per-operation joint positions on the Calibrate tab and preview the resulting pose via forward kinematics
  4. User sees a digital I/O status list (e.g. tool-changer engaged, spindle on, extruder heating) that reflects the current operation state
  5. User can apply a feed-rate override percentage on the Optimization tab that live-adjusts playback speed, the Dashboard speed readout, and a live cycle-time estimate

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Static Rig + Kinematics Foundation | 2/4 | In Progress|  |
| 2. G-code Import + Static Toolpath | 0/? | Not started | - |
| 3. Inverse Kinematics + Trajectory Compile + Scrub | 0/? | Not started | - |
| 4. Playback Engine | 0/? | Not started | - |
| 5. Telemetry / Dashboard | 0/? | Not started | - |
| 6. Operations Tree + Mill Engagement Coloring | 0/? | Not started | - |
| 7. Tool-Changer + Print/Mill Tabs | 0/? | Not started | - |
| 8. Remaining Tabs (Setup, Vision, Calibrate, I/O, Optimization) | 0/? | Not started | - |
