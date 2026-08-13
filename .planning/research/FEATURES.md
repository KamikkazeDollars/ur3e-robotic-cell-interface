# Feature Research

**Domain:** Browser-based 3D robotic cell control/simulation interface (UR3e, 7th-axis rail, print/mill tool-changer)
**Researched:** 2026-08-13
**Confidence:** MEDIUM (domain conventions cross-checked across multiple independent sources; UR3e-specific facts corroborated across vendor/community sources; no single authoritative "robot HMI feature spec" exists, so synthesis is opinionated)

## Context Recap

This is a **technical interview assignment**, simulation-only, tight (few-day) timeline. The 3D toolpath simulation (g-code import → color-coded animated playback in the 3D cell) is the must-nail centerpiece. Dashboard, Vision, Calibrate, Setup, I/O, and Optimization are secondary tabs that should look credible and be internally consistent with the simulation data, but must not consume time that belongs to the simulator. Every recommendation below is filtered through that lens: **table stakes = what makes the demo look like it understands the domain; differentiators = cheap, real wins that show depth; anti-features = anything that implies live hardware, real safety systems, or open-ended scope.**

## Feature Landscape

### Table Stakes (Users Expect These)

Features an interviewer evaluating a "robotic cell interface" will look for. Missing these makes the demo feel like a generic 3D viewer rather than a robotics/CAM tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Color-coded move types (rapid/joint vs. linear/cutting) in the 3D toolpath | Universal convention across every CNC/CAM/slicer viewer (NCViewer, CIMCO, Vericut, Cura, PrusaSlicer all do this); an uncolored toolpath reads as unfinished | LOW | Convention: dashed/thin line + one color (e.g. blue) for rapid/joint moves, solid + a second color for linear/cutting moves. Reuse this exact idiom — it's what evaluators expect to see. |
| Distinct per-operation start/end markers on the trajectory | Standard in CAM simulators; lets a viewer see operation boundaries without scrubbing | LOW | Small sphere/marker + operation index label at each transition. |
| Operations tree ordered by sequence, with per-operation timing | Every CAM/robot OLP tool (Fusion 360, RobotStudio, RoboDK) has an operation/program list; timing per op is what "cycle time" reporting looks like | LOW–MED | Can be derived directly from g-code parsing (segment count × feed rate), no simulation math needed beyond arithmetic. |
| Play/pause/scrub timeline synced to 3D animation | Table stakes for any "simulation" claim — static toolpath rendering alone is a viewer, not a simulator | MED | This is core to the Core Value in PROJECT.md; already scoped as must-have. |
| Interactive 3D camera (orbit/pan/zoom) + view-cube style navigation | Fusion 360, SolidWorks, RobotStudio, RoboDK all have this; its absence makes a 3D scene feel unfinished | LOW–MED | Already scoped. Three.js has established patterns (OrbitControls + a small on-screen gizmo). |
| Joint angles + TCP Cartesian pose (X,Y,Z,RX,RY,RZ) on the Dashboard | This is literally what a UR teach pendant and RTDE feed expose as core state; any "robot dashboard" without joint/TCP data looks incomplete | LOW–MED | Values are computable from forward kinematics driven by playback position — matches PROJECT.md's "computed from toolpath playback, not mock data" constraint. |
| TCP speed / feed-rate readout during playback | Paired with position; a speed-less dashboard looks static even while playing | LOW | Derived from delta-position / delta-time of playback, or directly from parsed feed rate per segment. |
| 7th-axis (rail) position + remaining travel in each direction | Explicitly required in PROJECT.md; also standard on any linear-track-equipped cell (7th-axis controllers always expose carriage position and min/max travel limits) | LOW–MED | Simple linear-range widget (position + two remaining-distance numbers) tied to the rail's current coordinate. |
| Depth-of-engagement color change during milling cuts | Explicitly required in PROJECT.md; also standard in professional milling simulators (CWE — cutter/workpiece engagement — is a first-class concept in tools like CUTPRO, Vericut) | MED–HIGH | Full physical material-removal simulation (dexel/voxel models) is out of scope for a few-day build. A simplified proxy is enough: color-ramp the cutting segment by a synthetic "depth" derived from Z relative to stock surface, or from g-code Z/plunge values — visually communicates engagement without physically simulating material removal. |
| Force/torque or contact-detection readout on Vision tab | UR e-Series ships with built-in joint-current-based F/T sensing used specifically for contact/collision detection — this is the single most "on-brand" sensor for a UR cell and directly matches what a real UR3e would expose | LOW–MED (simulated) | Since there's no hardware, this is a computed/simulated signal: show near-zero force during free motion, a spike/plateau during tool-engaged segments (mill contact) or extrusion contact (print), framed explicitly as "estimated from joint current" — matches real UR3e behavior and avoids overclaiming precision. |
| Basic I/O status table (digital in/out, tool signals) | Every UR-class controller surfaces I/O status; an "I/O tab" that's empty or fake-looking undermines credibility | LOW | Static/derived list is fine — e.g., toggle DO signals for "tool changer engaged," "spindle on," "extruder heating" tied to operation state. |
| Home position / joint calibration controls on Calibrate tab | Table stakes for any teach-pendant-adjacent UI; UR PolyScope explicitly separates "home position" and per-waypoint joint teaching | LOW–MED | Can be a form of joint-angle sliders/inputs that update the robot's home pose and re-run FK preview; doesn't need to persist across a backend. |
| Print/Mill mode switch with tool-changer representation | Explicitly required; also table stakes for any dual-process cell — a tool-changer that isn't visually represented (e.g. spindle vs. print head swap in the 3D scene) breaks the "single cell, two modes" narrative | MED | Swap the end-effector mesh at the tool-changer station in the 3D scene when switching tabs/modes; even a simple geometry swap sells the concept. |

### Differentiators (Competitive Advantage)

Cheap-to-build features that meaningfully raise perceived sophistication, chosen because they align with the Core Value (toolpath simulation) rather than spreading effort thin across secondary tabs.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Feed-rate/speed override slider that live-affects playback speed and dashboard speed readout | This is the single most standard "optimization" control in every CNC/robot controller (feed override %) — cheap to build (multiply playback clock) and immediately demonstrable live in front of interviewers | LOW | Directly reuses existing playback engine; no new simulation logic. High demo value per unit effort. |
| Jerk/acceleration limit sliders that visibly smooth or roughen the animated motion curve | Shows understanding that trajectory execution isn't just "connect the dots" — real robot controllers enforce accel/jerk limits, and this is a well-documented concept (time-jerk optimal trajectory planning is an active robotics research area) | MED | Can be approximated with an easing function applied to segment transitions (e.g., trapezoidal/S-curve velocity profile) rather than a full time-optimal solver — visually convincing without heavy math. |
| Cycle-time estimate that updates live as override/smoothing parameters change | Turns the Optimization tab from static controls into a feedback loop — "change a parameter, see the effect" is the single most convincing simulation-only interaction | LOW–MED | Just re-sum segment durations under the current override/smoothing settings; no physics needed. |
| Color-by-feedrate mode for the toolpath (in addition to color-by-move-type) | A more advanced visualization mode used by real tools (CIMCO 2025 added exactly this); toggling between "by move type" and "by feed rate" signals extra polish for minimal extra work once move-type coloring exists | LOW | Same rendering pipeline, different color-mapping function — reuse, don't rebuild. |
| Layer/pass scrubbing analogous to slicer preview ("show path up to current point") | Directly mirrors how every 3D-printing slicer (Cura, PrusaSlicer, OrcaSlicer) previews prints — a familiar, polished interaction pattern that's cheap since it's just a playback-position clip on already-rendered geometry | LOW | This is effectively the same mechanism as the required play/scrub timeline — a differentiator mainly in framing/UI polish (e.g., "reveal so far" rendering), not new logic. |
| Simulated collision/near-limit warning (e.g., rail approaching end-of-travel, joint approaching limit) | Shows awareness of real safety-adjacent HMI conventions (ISA-101 alarm color standards: red/yellow/blue) without needing real collision geometry checks | LOW–MED | Threshold-based: flag when rail position is within X% of travel limit, or joint angle within X% of its range — pure arithmetic, framed with standard alarm coloring. |
| Nav-cube-synced standard views (Front/Top/Bottom/Back) | Already required in PROJECT.md; worth calling out as a differentiator because most take-home/interview 3D demos skip it — signals CAD/CAM tool fluency (this exact idiom is Fusion 360's ViewCube) | LOW–MED | Three.js: a small orthographic mini-scene mirroring the main camera's orientation, clickable faces snap the main camera. |

### Anti-Features (Do Not Build — Scope Traps for This Assignment)

Things that seem like they'd impress but are wrong for a simulation-only, few-day interview build. Each risks eating time that belongs to the toolpath simulator, or implies capabilities the brief explicitly excludes.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Real camera feed / actual computer-vision pipeline on Vision tab | "Vision tab" naming suggests literal camera video | No hardware exists (explicit Out of Scope); building even a fake video stream is disproportionate effort for a secondary tab and invites "is this actually working?" scrutiny | Show simulated/derived sensor readouts (force/contact, simple "part detected" boolean tied to operation state) with clear "simulated" labeling — matches the sim-only framing honestly. |
| Physically accurate material-removal simulation (voxel/dexel-based CWE) for milling | Real CAM tools (Vericut, CUTPRO) do this and it looks impressive | This is a serious computational-geometry subsystem on its own (professional tools dedicate entire simulation modules to it); wildly disproportionate to a few-day build and orthogonal to the Core Value of *toolpath* simulation | Depth-of-engagement color proxy (already listed as table stakes) gives 80% of the visual signal for ~2% of the effort. |
| Live RTDE/URScript connection, even mocked as "hardware-ready" plumbing | Tempting to future-proof or show "real" protocol knowledge | Explicit Out of Scope in PROJECT.md; building a socket/protocol layer with nothing real on the other end adds complexity and failure surface without demo payoff | If desired, mention RTDE/URScript awareness in written docs/README (shows domain knowledge) without building the plumbing. |
| Full physics-based collision detection / IK solver with singularity avoidance across the whole cell | Sounds like "real" robotics engineering | UR3e kinematics/singularity research is already separately scoped for this project; a general-purpose real-time collision engine is a multi-week problem (this is what dedicated tools like RoboDK/RobotStudio are built around) | Use precomputed/scripted joint trajectories from g-code + simple threshold-based limit warnings (see Differentiators) instead of solving IK/collision live. |
| Multi-robot / multi-cell support | Note 1 mentioned "swapping robots later" | Explicit Out of Scope; adds abstraction layers (robot config schema, generic kinematics) that don't pay off for a single UR3e demo | Hard-code UR3e DH parameters/mesh; keep the Setup tab's "configure which robot/devices are part of the cell" limited to toggling auxiliary devices (rail, tool-changer), not swapping robot models. |
| Persistent backend/database for user projects, accounts, or saved sessions | Feels like a "real product" feature | No requirement for multi-user or persistence in PROJECT.md; adds auth, storage, and deployment complexity to a tight timeline whose deployment target is just "reachable URL" | Client-side state only (in-memory or localStorage for the current g-code/session); redeploying resets state, which is fine for a demo. |
| General-purpose G-code editor / hand-authoring toolpaths in-app | Seems like a natural companion to "import g-code" | Scope creep: turns the app into a CAM authoring tool instead of a viewer/simulator; parsing+validating arbitrary hand-written g-code robustly is a much bigger problem than playing back known-good sample files | Ship a small set of curated sample g-code files (print + mill) alongside file import; import just needs to parse well-formed files, not be bulletproof against malformed ones. |
| Exhaustive Optimization tab covering every real CNC/robot parameter (spindle speed ramping, tool wear compensation, thermal compensation, etc.) | Research on "what a real controller exposes" surfaces dozens of parameters | Breadth-for-breadth's-sake dilutes the tab and time budget; interviewers care more about 2-3 parameters that visibly *do something* in the simulation than a long inert settings list | Cap Optimization at the 3-4 parameters listed under Differentiators (feed override, accel/jerk, cycle-time readout, path smoothing) — each wired to a visible effect. |

## Feature Dependencies

```
G-code import & parsing
    └──requires──> Toolpath geometry generation (segments + move type + feed rate)
                       ├──enables──> Color-coded move-type rendering (table stakes)
                       ├──enables──> Play/pause/scrub timeline (table stakes)
                       ├──enables──> Operations tree with timing (table stakes)
                       └──enables──> Dashboard telemetry (joint angles, TCP pose/speed)
                                        └──requires──> Forward kinematics (UR3e DH params + rail offset)

Toolpath playback engine
    ├──enables──> Feed-rate/speed override (differentiator)
    ├──enables──> Cycle-time live estimate (differentiator)
    ├──enables──> Layer/pass scrub-to-reveal (differentiator; same mechanism as timeline)
    └──enables──> Depth-of-engagement color proxy (table stakes, milling only)

Forward kinematics + rail model
    ├──enables──> Joint angle / TCP dashboard readout
    ├──enables──> 7th-axis position + remaining travel display
    └──enables──> Joint-limit / rail-limit threshold warnings (differentiator)

3D scene + camera controls
    └──enables──> Nav-cube synced standard views (differentiator)

Tool-changer representation
    └──requires──> Print/Mill mode switch (table stakes)

Vision tab force/contact readout
    └──requires──> Toolpath playback engine (to know when tool is "engaged" vs. free-moving)

Optimization tab (feed override, accel/jerk, smoothing)
    └──requires──> Toolpath playback engine
    └──conflicts with──> Physically accurate material-removal simulation (anti-feature; don't build both)
```

### Dependency Notes

- **Everything downstream depends on g-code parsing + toolpath geometry generation.** This must land first; it is the true MVP root. Roadmap phase 1 should be exactly this plus the color-coded playback — nothing else can be built credibly before it.
- **Dashboard, Vision, and 7th-axis telemetry all require forward kinematics**, not just playback progress — joint angles and TCP pose need real DH-parameter math (already separately scoped for UR3e research), so budget kinematics work before wiring the Dashboard tab.
- **Optimization's differentiator controls (feed override, accel/jerk, cycle time) are cheap precisely because they reuse the playback engine** rather than requiring new simulation subsystems — this is why they're prioritized over deeper CAM features.
- **Depth-of-engagement coloring conflicts with (i.e., should not become) full material-removal simulation** — same visual goal, wildly different cost; explicitly pick the color-proxy approach and resist scope creep toward voxel/dexel simulation.
- **Vision tab force/contact readout depends on knowing when a segment is a "cutting"/"engaged" move** — this is the same classification already needed for move-type coloring, so it's nearly free once toolpath classification exists.

## MVP Definition

### Launch With (v1 — the interview deliverable)

- [ ] G-code import → parsed toolpath (segments, move type, feed rate) — root dependency for everything else
- [ ] 3D cell scene with UR3e + rail + tool at correct pose, orbit/pan/zoom camera, nav-cube standard views
- [ ] Color-coded toolpath (rapid/joint vs. linear/cutting) with per-operation start/end markers
- [ ] Play/pause/scrub animated playback synced to 3D robot motion
- [ ] Operations tree (sequence order + per-op timing)
- [ ] Depth-of-engagement color proxy on milling cut segments
- [ ] Dashboard: joint angles, TCP position/speed, 7th-axis rail position + remaining travel — all computed live from playback
- [ ] Print/Mill tab switch with tool-changer mesh swap in the 3D scene
- [ ] Vision tab: simulated force/contact readout tied to tool-engaged segments
- [ ] Calibrate tab: home position + per-op joint adjustment (simple sliders/inputs feeding FK preview)
- [ ] Setup tab: toggle which auxiliary devices (rail, tool-changer) are active in the cell
- [ ] I/O tab: static/derived digital I/O status list tied to operation state
- [ ] Optimization tab: feed-rate override slider + cycle-time live estimate (minimum viable version)

### Add After Core Is Solid (v1.x — only if time remains)

- [ ] Accel/jerk limit sliders with visible easing effect on motion
- [ ] Color-by-feedrate toggle mode for the toolpath
- [ ] Joint-limit / rail-limit threshold warnings (ISA-101-style alarm coloring)
- [ ] Path/corner smoothing control with visible corner-blending effect

### Future Consideration (post-interview, if project continues)

- [ ] Real RTDE/URScript live hardware connection (explicitly deferred per PROJECT.md)
- [ ] Multi-robot support (explicitly out of scope per PROJECT.md)
- [ ] Physically accurate material-removal (dexel/voxel) milling simulation
- [ ] Actual computer-vision camera pipeline
- [ ] Persistent multi-user backend

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Toolpath color-coding by move type | HIGH | LOW | P1 |
| Play/pause/scrub playback | HIGH | MEDIUM | P1 |
| Operations tree with timing | HIGH | LOW–MEDIUM | P1 |
| Depth-of-engagement color proxy | HIGH | MEDIUM | P1 |
| Dashboard joint/TCP/rail telemetry | HIGH | LOW–MEDIUM | P1 |
| Nav-cube synced views | MEDIUM | LOW–MEDIUM | P1 |
| Print/Mill switch + tool-changer swap | HIGH | MEDIUM | P1 |
| Vision tab force/contact readout | MEDIUM | LOW–MEDIUM | P1 |
| Calibrate tab (home + joint adjust) | MEDIUM | LOW–MEDIUM | P1 |
| Setup / I/O tabs | LOW–MEDIUM | LOW | P1 |
| Feed-rate override + cycle-time live estimate | HIGH | LOW | P1 |
| Accel/jerk sliders with easing | MEDIUM | MEDIUM | P2 |
| Color-by-feedrate toggle | LOW–MEDIUM | LOW | P2 |
| Limit-threshold warnings | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Path/corner smoothing control | LOW | MEDIUM | P3 |
| Real material-removal simulation | LOW (for this context) | VERY HIGH | Do not build |
| Live hardware connection | LOW (for this context) | HIGH | Do not build |

**Priority key:**
- P1: Must have for the interview deliverable
- P2: Should have, add once P1 tabs are solid and time remains
- P3: Nice to have, cut first if time runs short

## Competitor / Reference-Tool Feature Analysis

| Convention | CNC/CAM simulators (Vericut, CIMCO, NCViewer) | 3D-printing slicers (Cura, PrusaSlicer, OrcaSlicer) | Robot OLP/digital twin (RoboDK, ABB RobotStudio) | Our Approach |
|---------|--------------|--------------|--------------|--------------|
| Move-type distinction | Dashed/thin line for rapids (G00), solid colored line for cutting feeds (G01); some tools color by feedrate | Distinct colors per feature type: travel (2 shades of blue, indicating retraction state), perimeter, infill, wipe | Program/instruction list with move type per line, played back in 3D | Adopt the CNC convention (rapid/joint = dashed or muted color, linear/cutting = solid saturated color) since it maps directly to our joint-move vs. linear-move requirement |
| Engagement/depth feedback | CWE (cutter-workpiece engagement) computed via dexel/voxel material models in high-end tools | N/A (no cutting) | N/A (general motion, not process-aware) | Simplified color-ramp proxy driven by Z/plunge depth from g-code — not full CWE simulation |
| Playback/scrub | Step-through simulation with current-position indicator | Layer-by-layer "reveal so far" sequential rendering | Full program simulation against virtual controller, live 3D | Single unified play/scrub timeline serving both toolpath and dashboard sync |
| Optimization/override controls | Feed override %, look-ahead/smoothing settings on real controllers | Speed/flow overrides in some slicers' preview | Cycle-time analysis, singularity/collision pre-checks | Feed override + cycle-time readout as the core Optimization tab; skip singularity/collision solving (separately scoped elsewhere) |
| Vision/sensing | Not typically a CAM-simulator concern (that's CAM software, not cell HMI) | N/A | Some digital twins simulate sensor mocks for testing logic | Simulated force/contact readout tied to tool-engagement state, explicitly labeled as estimated/simulated |
| Cell configuration | N/A | N/A | Virtual controller config, device library selection | Setup tab limited to toggling rail/tool-changer presence, not full device/robot library |

## Sources

- [Force/Torque Sensing for Soft Grippers using an External Camera (arXiv)](https://arxiv.org/pdf/2210.00051) — LOW confidence (general web search, single-pass)
- [New e-Series Collaborative Robots Come with Built-In Force/Torque Sensing Feature — Thomasnet](https://news.thomasnet.com/fullstory/new-e-series-collaborative-robots-come-with-built-in-force-torque-sensing-feature-40013479) — MEDIUM confidence (corroborated across multiple sources)
- [Force-Torque Sensors on Cobots: When and Why to Use Them — Olympus Technologies](https://olympustechnologies.co.uk/end-of-arm-tooling-force-torque-sensors/) — MEDIUM confidence
- [Integrating a 6-Axis Force-Torque Sensor with Universal Robots e-Series — X-TECH Studio](https://www.x-tech.studio/blog/integrating-6-axis-ur-eseries) — MEDIUM confidence
- [Universal Robots e-Series User Manual UR3e (official PDF)](https://s3-eu-west-1.amazonaws.com/ur-support-site/41166/UR3e_User_Manual_en_Global.pdf) — HIGH-leaning source (official manufacturer manual), cross-checked
- [Force Function In UR3e Series — DoF / Robotiq Community](https://dof.robotiq.com/discussion/1584/force-function-in-ur3e-series) — LOW confidence (community forum)
- [Path smoothing and feed rate planning for robotic curved layer additive manufacturing — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0736584519303679) — MEDIUM confidence (peer-reviewed)
- [Time-Jerk Optimal Robotic Trajectory Planning Under Jerk and Continuity Constraints via Convex Optimization — MDPI](https://www.mdpi.com/2076-0825/14/6/272) — MEDIUM confidence (peer-reviewed)
- [Optimal Path Planning Algorithm with Built-In Velocity Profiling for Collaborative Robot — PMC/NCBI](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11359329/) — MEDIUM confidence (peer-reviewed)
- [Universal Robots — How to Jog the Robot](https://www.universal-robots.com/articles/ur/programming/how-to-jog-the-robot/) — MEDIUM confidence (official docs)
- [Teaching TCP Position — Universal Robots manuals (PolyScope SW5.25)](https://www.universal-robots.com/manuals/EN/HTML/SW5_25/Content/prod-usr-man/software/PolyScope/content/installation_g5/teaching_TCP_position.htm) — HIGH-leaning (official docs)
- [Color Toolpath by Feedrate in CIMCO Edit 2025 and NC Machine Simulation — CIMCO](https://www.cimco.com/2025/news/colour-by-feedrate/) — MEDIUM confidence
- [G-Code Simulators: The Ultimate Guide — Vericut](https://vericut.com/resources/guides/g-code-simulator) — MEDIUM confidence (vendor doc, corroborated by convention across other viewers)
- [Free Online G-code Viewer & Real-Time Simulator — UltraNC / NCViewer](https://freegcodeviewer.com/) — LOW confidence
- [RoboDK — Simulator for robot arms and offline programming](https://robodk.com/) — MEDIUM confidence (vendor doc)
- [QVIRO — ABB RobotStudio Specifications](https://qviro.com/product/abb/robotstudio-abb/specifications) — LOW confidence (third-party spec aggregator)
- [HMI Design Best Practices: ISA-101 Screens & Checklist — plcprogramming.io](https://plcprogramming.io/blog/hmi-design-best-practices-complete-guide) — MEDIUM confidence
- [SCADA HMI Design Standards, Guidelines and Best Practices — Industrial Monitor Direct](https://industrialmonitordirect.com/blogs/knowledgebase/scada-hmi-design-best-practices-and-industry-standards) — MEDIUM confidence
- [IoT-Cloud, VPN, and Digital Twin-Based Remote Monitoring and Control of a Multifunctional Robotic Cell — PMC/NCBI](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11644536/) — MEDIUM confidence (peer-reviewed, directly on-topic)
- [How to Read Slicer Preview Properly for Better 3D Printing Results — makeprintable.com](https://makeprintable.com/how-to-read-slicer-preview-properly/) — LOW confidence
- [GCode Viewer and Preview — OrcaSlicer DeepWiki](https://deepwiki.com/SoftFever/OrcaSlicer/3.3-gcode-viewer-and-preview) — MEDIUM confidence (codebase-derived documentation)
- [UltiMaker Cura Community — Cura slice preview / travel move colors discussions](https://community.ultimaker.com/topic/31933-cura-slice-preview-problem/) — LOW confidence (community forum, but corroborated by multiple threads)
- [Milling Simulator Module — CUTPRO / Mal Inc.](https://www.malinc.com/products/cutpro/milling-simulator/) — MEDIUM confidence (vendor doc)
- [Simulation-Based Analysis and Intuitive Visualization of the Cutting Edge Load in Micromilling — SCIRP](https://www.scirp.org/html/4-8101655_23222.htm) — MEDIUM confidence (peer-reviewed)
- [Robot 7th Axis & Linear Tracks: Ground Rail Guide — evsint.com](https://www.evsint.com/robot-7th-axis-linear-track-ground-rail-guide-2026/) — LOW confidence
- [Designing (seventh-axis) linear motion tracks for robotic positioning — Linear Motion Tips](https://www.linearmotiontips.com/designing-linear-motion-tracks-robotic-positioning/) — MEDIUM confidence

---
*Feature research for: browser-based robotic cell control/simulation interface*
*Researched: 2026-08-13*
