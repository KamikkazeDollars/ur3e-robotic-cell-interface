# Requirements: UR3e Robotic Cell Interface

**Defined:** 2026-08-13
**Core Value:** The 3D toolpath simulation must work flawlessly end-to-end: import g-code → see it rendered as an accurately color-coded, animated robot motion in the 3D cell.

## v1 Requirements

Requirements for the interview deliverable. Each maps to roadmap phases.

### Simulation (Core)

- [ ] **SIM-01**: User can upload a g-code file and have the system parse it into a classified toolpath (move type, coordinates, feed rate per segment)
- [ ] **SIM-02**: User sees the parsed toolpath rendered in the 3D scene as a color-coded line — one style for rapid/joint moves, a different style for linear/cutting moves
- [ ] **SIM-03**: User sees a distinct start and end marker on the trajectory for each operation
- [ ] **SIM-04**: User can press play to animate the UR3e robot following the toolpath in real time, synced to the visible trajectory
- [ ] **SIM-05**: User can pause and scrub the playback timeline to any point in the operation
- [ ] **SIM-06**: During milling operations, the toolpath line changes color to reflect tool-to-workpiece engagement depth while cutting
- [ ] **SIM-07**: User sees an operations tree listing each operation in sequence order with its computed duration

### 3D Scene & Navigation

- [ ] **SCENE-01**: User can orbit, pan, and zoom the 3D camera around the robotic cell
- [x] **SCENE-02**: User can reset the camera to a centered view of the robot cell with one action
- [ ] **SCENE-03**: User sees a navigation cube/gizmo showing Front/Top/Bottom/Back view presets that rotates in sync with the camera; clicking a face snaps the camera to that view
- [x] **SCENE-04**: User sees the UR3e robot rendered at correct pose using its actual kinematic model (DH parameters), including its 7th external linear-rail axis

### Dashboard

- [ ] **DASH-01**: User sees live joint angles for the UR3e, computed from toolpath playback, not mock data
- [ ] **DASH-02**: User sees live TCP Cartesian position and speed, computed from toolpath playback
- [ ] **DASH-03**: User sees the 7th-axis rail's current position and remaining travel distance in each direction, computed from playback

### Tool-Changer

- [ ] **TOOL-01**: User can switch between a Printing tab and a Milling tab for the same UR3e cell
- [ ] **TOOL-02**: Switching tabs visually swaps the mounted tool (print head vs. mill spindle) at the tool-changer station in the 3D scene

### Vision

- [ ] **VISION-01**: User sees a simulated force/contact readout on the Vision tab that reflects near-zero force during free motion and a rise during tool-engaged (cutting/extrusion) segments, labeled as estimated/simulated

### Calibrate

- [ ] **CALIB-01**: User can adjust the robot's home position and preview the resulting pose via forward kinematics
- [ ] **CALIB-02**: User can adjust per-operation joint positions and preview the resulting pose

### Setup

- [ ] **SETUP-01**: User can toggle which auxiliary devices (rail, tool-changer) are active/present in the current cell configuration

### I/O

- [ ] **IO-01**: User sees a digital I/O status list (e.g. tool-changer engaged, spindle on, extruder heating) that reflects current operation state

### Optimization

- [ ] **OPT-01**: User can apply a feed-rate override percentage that live-adjusts playback speed and the dashboard speed readout
- [ ] **OPT-02**: User sees a live cycle-time estimate that updates as the feed-rate override changes

### Deployment

- [ ] **DEPLOY-01**: Project source code is version-controlled on GitHub
- [ ] **DEPLOY-02**: Project is deployed to a publicly reachable URL that stays in sync with the latest working version

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap — the first things to add back if time remains after v1 is solid.

### Optimization

- **OPT-03**: Accel/jerk limit sliders that visibly smooth or roughen the animated motion curve
- **OPT-04**: Path/corner smoothing control with visible corner-blending effect

### Simulation

- **SIM-08**: Color-by-feedrate toggle mode for the toolpath (in addition to color-by-move-type)

### Dashboard

- **DASH-04**: Joint-limit / rail-limit threshold warnings (ISA-101-style alarm coloring)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live RTDE/URScript hardware connection | No physical UR3e available; v1 is simulation-only |
| Physically accurate material-removal (voxel/dexel) milling simulation | Disproportionate effort for a few-day build; depth-of-engagement color proxy (SIM-06) gives most of the visual signal for a fraction of the cost |
| Real camera feed / computer-vision pipeline on Vision tab | No hardware exists; simulated force/contact readout (VISION-01) is honest and sufficient |
| Multi-robot / multi-cell support | Single UR3e cell only; swapping robot models is a future consideration |
| Persistent backend/database/accounts | No multi-user or persistence requirement; client-side state only |
| General-purpose g-code editor / hand-authoring toolpaths in-app | Scope creep from viewer/simulator into CAM authoring tool; curated sample files are sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM-01 | Phase 2 | Pending |
| SIM-02 | Phase 2 | Pending |
| SIM-03 | Phase 6 | Pending |
| SIM-04 | Phase 4 | Pending |
| SIM-05 | Phase 3 | Pending |
| SIM-06 | Phase 6 | Pending |
| SIM-07 | Phase 6 | Pending |
| SCENE-01 | Phase 1 | Pending |
| SCENE-02 | Phase 1 | Complete |
| SCENE-03 | Phase 1 | Pending |
| SCENE-04 | Phase 1 | Complete |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| TOOL-01 | Phase 7 | Pending |
| TOOL-02 | Phase 7 | Pending |
| VISION-01 | Phase 8 | Pending |
| CALIB-01 | Phase 8 | Pending |
| CALIB-02 | Phase 8 | Pending |
| SETUP-01 | Phase 8 | Pending |
| IO-01 | Phase 8 | Pending |
| OPT-01 | Phase 8 | Pending |
| OPT-02 | Phase 8 | Pending |
| DEPLOY-01 | Phase 1 | Pending |
| DEPLOY-02 | Phase 1 | Pending |

**Coverage:**

- v1 requirements: 25 total
- Mapped to phases: 25 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-13*
*Last updated: 2026-08-13 after roadmap creation*
