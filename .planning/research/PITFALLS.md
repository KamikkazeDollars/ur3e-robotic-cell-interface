# Pitfalls Research

**Domain:** Browser-based 3D robotic cell control/simulation interface (UR3e on 7th external linear-rail axis, printing + milling via automatic tool-changer)
**Researched:** 2026-08-13
**Confidence:** MEDIUM (web-sourced, cross-checked across multiple independent sources per topic; no primary UR3e hardware or official Universal Robots kinematics SDK was verified hands-on — treat exact numeric constants as needing a final check against the official UR3e datasheet before locking them into code)

## Critical Pitfalls

### Pitfall 1: Wrong or ambiguous DH parameter convention

**What goes wrong:**
The kinematic chain (forward kinematics) is built from a DH parameter table copied from a generic robotics tutorial or a mismatched convention (standard/Denavit-Hartenberg-original vs. modified/Craig-style), producing a robot model that looks plausible in the 3D scene but places the TCP (tool center point) at the wrong location — errors compound down the chain, so joint 1 looks right and by joint 6 the tool tip is centimeters or fully off.

**Why it happens:**
Universal Robots' own documentation and third-party sources are inconsistent about whether UR's published parameters are "standard" or "modified" DH — the community itself disagrees on terminology (Craig-style is often called "modified," original Paul-style is called "standard," and UR's own numbers get mislabeled both ways in different places). Combined with the tight timeline, it's easy to grab the first DH table found without verifying which transform convention it assumes (whether rotation happens before or after translation in the per-joint homogeneous transform).

**How to avoid:**
Use Universal Robots' own official developer documentation (`universal-robots.com/developer/hardware-and-motion/robot-motion-dh-parameters/`) as the single source of truth for UR3e parameters, and pick ONE convention, then implement the exact same 4x4 transform formula consistently for every joint. Write a unit test that checks forward kinematics against a known pose (e.g. UR3e's published home/zero position and reach envelope, or a pose computed independently via a UR simulator/RoboDK export) before building anything visual on top of it. Do not eyeball correctness by looking at the 3D scene — verify against numbers first.

**Warning signs:**
The rendered arm reaches a target visually "close enough" but the reported joint angles disagree with expectations at simple test poses (e.g. arm fully extended along the rail should give a specific, easily-hand-calculated TCP position); the tool tip position drifts noticeably when the wrist rotates without any translation intended.

**Phase to address:**
Earliest technical phase (kinematics/engine foundation), before any 3D rendering or g-code work is layered on top — this is the load-bearing math the rest of the app depends on.

---

### Pitfall 2: Singularities mishandled during animation (wrist/shoulder/elbow)

**What goes wrong:**
Near a singularity (wrist: J4/J6 axes become parallel; shoulder: wrist center aligns with J1 axis; elbow: arm fully extended/flexed), a small change in target TCP pose can require a huge, physically implausible change in one or more joint angles. If the IK/animation code doesn't detect this, the robot appears to "snap" or spin a joint at unrealistic speed during playback, or the animation stalls/jitters as it approaches the singular configuration.

**Why it happens:**
Naive IK implementations solve for the nearest mathematical solution per waypoint independently, without considering joint-velocity continuity or checking the Jacobian determinant/conditioning near the singularity. This is easy to miss in a short project because most demo g-code paths won't happen to pass exactly through a singularity — until the reviewer picks a path (or the auto-generated toolpath from an uploaded file) that does, and the "flawless" playback the project must nail visibly breaks.

**How to avoid:**
When generating IK solutions along a path, pick solutions per-waypoint that minimize joint-space distance from the previous waypoint's solution (this alone prevents most visible jumps). Optionally clamp/smooth joint velocity between frames as a safety net. For a few-day project, full singularity-avoidance path planning is out of scope — the pragmatic bar is "no visible snapping," achieved via continuity-preserving solution selection, not physically rigorous singularity avoidance.

**Warning signs:**
Playing back a straight-line toolpath through the center of the workspace causes a joint to visibly whip around; scrubbing the timeline slowly near certain points shows a joint angle jumping discontinuously between adjacent samples.

**Phase to address:**
Kinematics/IK phase, verified during the 3D playback integration phase with at least one test path deliberately crossing the workspace center (a likely singularity zone).

---

### Pitfall 3: Multiple IK solutions cause pose "flipping" during playback

**What goes wrong:**
A 6-DOF arm generally has up to 8 valid joint-angle solutions (shoulder left/right x elbow up/down x wrist flip) for any single reachable TCP pose. If each waypoint's IK is solved independently without regard to the previous waypoint, consecutive frames can pick different solution branches, causing the rendered arm to instantaneously "flip" configuration (e.g. elbow-up to elbow-down) mid-animation even though the tool tip path is continuous.

**Why it happens:**
It's the natural result of solving IK per-point in isolation, which is the simplest and fastest implementation — exactly what a time-boxed project is likely to reach for first.

**How to avoid:**
After generating candidate solutions for each waypoint, always select the branch closest (in joint space) to the previous frame's joint configuration, seeded from a sensible starting/home configuration for the first waypoint. This single rule eliminates the vast majority of visible flipping without needing a full continuity-optimal path solver.

**Warning signs:**
Watching playback of any curved or long toolpath shows the elbow or wrist suddenly reversing orientation for no apparent reason.

**Phase to address:**
Same phase as Pitfall 2 (IK solution selection) — these two are best fixed together since they share the same "nearest to previous solution" mechanism.

---

### Pitfall 4: Ignoring joint limits — arm animates through mechanically impossible angles

**What goes wrong:**
A UR3e's joints have finite rotation ranges (not infinite rotation on every joint, despite e-series robots having extended range on some joints vs. earlier CB-series). If IK solutions or generated waypoints aren't checked against actual joint limits, the simulator will happily animate the robot through angles the real UR3e could never reach — which is both physically wrong and, if this project is later extended toward real hardware, dangerous.

**Why it happens:**
Joint limits are easy to omit because the math for IK and forward kinematics works identically whether or not limits are respected — nothing crashes, the animation just silently shows an impossible pose. This is a classic "looks done but isn't" gap that a demo may never surface unless someone specifically drives the arm near its limits.

**How to avoid:**
Pull the official UR3e joint range specs from Universal Robots' datasheet/support articles (verify exact per-joint limits rather than assuming a uniform ±360° across all joints) and reject/flag any IK solution or g-code-derived pose that falls outside them, surfacing this clearly in the UI (e.g. a warning on the operation in the ops tree) rather than silently clamping or ignoring it.

**Warning signs:**
No visible symptom in casual use — must be explicitly tested by feeding a toolpath that pushes joints toward their extremes, or by adding an assertion/log that flags out-of-range solutions during development.

**Phase to address:**
Kinematics/IK phase (limit-checking logic), with a UI surfacing step in the toolpath-visualization phase.

---

### Pitfall 5: The 7th external rail axis is treated as fully determined instead of redundant

**What goes wrong:**
Adding the linear rail as a 7th DOF makes the system kinematically redundant: for a given TCP target, there is no longer a single unique joint solution — there's a family of solutions parameterized by rail position. A project that treats the rail position as "whatever the g-code says" without a clear resolution strategy will either get inconsistent/jittery rail motion between waypoints, or will silently ignore the redundancy and always solve the 6-DOF arm at a fixed rail position (making the "7th axis" cosmetic rather than functional).

**Why it happens:**
Full Jacobian-based redundancy resolution (damped least squares, null-space projection, task augmentation) is real robotics-research complexity that's disproportionate to a few-day project — but skipping it entirely without picking *any* deliberate resolution strategy leaves an ambiguous, easy-to-criticize gap in exactly the area the project brief calls out for research (this was one of the two explicit research asks: kinematics/DH/singularities).

**How to avoid:**
Pick a simple, explainable, deterministic heuristic instead of a full redundancy solver: e.g. solve the rail position first (project the target TCP's along-rail coordinate into the rail's travel range, keeping the 6-DOF arm centered in its reach envelope relative to that target), then solve the remaining 6-DOF IK at that fixed rail position per waypoint. Document the chosen strategy explicitly — an interviewer will value "I deliberately chose X because Y, full null-space optimization was out of scope" far more than an unstated implicit assumption.

**Warning signs:**
The rail position in the UI barely moves regardless of where the toolpath is in space (redundancy being ignored, rail is vestigial), or the rail visibly jitters back and forth between adjacent waypoints (no continuity heuristic).

**Phase to address:**
Kinematics/IK phase — this is foundational and must be decided before toolpath playback is built, since it affects every waypoint's solve.

---

### Pitfall 6: G-code parser assumes a single dialect

**What goes wrong:**
G-code is not one standard — RepRap/Marlin (3D printing), LinuxCNC/Grbl (mills/routers), and industrial controllers (Fanuc/Haas/Siemens) diverge on modal-state defaults, arc-plane selection (G17/18/19), whether G0 respects feed limits, comment syntax, and more. A parser hard-coded against whichever sample file was tested first will silently misparse files from a different tool origin — especially risky here since the project has two modes (printing and milling) that may realistically originate from different upstream slicers/CAM tools with different dialect quirks.

**Why it happens:**
Under time pressure, it's natural to write a parser against one or two sample files and consider it "done" once those files play back correctly, without testing dialect edge cases.

**How to avoid:**
Explicitly scope which dialect(s) the parser supports (reasonable for this project: a common subset — G0/G1/G2/G3, G20/G21, G90/G91, standard M-codes for tool changes) and validate/reject unsupported codes with a clear error rather than silently ignoring or misinterpreting them. Test with at least two structurally different sample files (one printing-style, one milling-style) rather than one.

**Warning signs:**
The parser "works" on the one file it was developed against but throws or silently drops moves when a different real-world g-code export (e.g. from a different slicer or CAM tool) is loaded.

**Phase to address:**
G-code import/parsing phase, with a defined "supported dialect subset" documented as part of that phase's scope.

---

### Pitfall 7: Arc moves (G2/G3) mishandled — wrong center, wrong plane, or silently dropped

**What goes wrong:**
Arc moves are defined by an end point plus either a center offset (I/J, or I/J/K in 3D) or a radius (R) — and have real edge cases: at least one of I/J is required with the offset form; omitting X/Y with I/J traces a full circle; mixing I/J with R is invalid; omitting X/Y while using R is invalid. Getting these wrong produces arcs that render as straight lines, arcs in the wrong plane, or arcs that silently fail to parse (dropped from the toolpath), which is especially visible for milling operations where curved cuts are common.

**Why it happens:**
Arc parsing is more error-prone than linear-move parsing because of the several valid input forms, and it's tempting to implement only the most common case (I/J with explicit X/Y) and skip validation of the edge cases, which then surface unpredictably on real files.

**How to avoid:**
Implement arc parsing against the documented rule set explicitly (both I/J-center and R-radius forms, full-circle case, invalid-combination rejection) rather than pattern-matching only the happy path; tessellate arcs into line segments for rendering at a resolution fine enough to look smooth in the 3D viewport (a fixed max-chord-error or fixed segment-angle approach both work) but coarse enough not to blow up point counts for large arcs.

**Warning signs:**
Arcs in a test file render as straight chords instead of curves, or a file with a full-circle arc (no X/Y) fails to parse.

**Phase to address:**
G-code parsing phase, with visual verification during the toolpath-rendering phase (does a curved cut actually look curved in the 3D view).

---

### Pitfall 8: Unit ambiguity (mm vs inch) causes silent 25.4x scale errors

**What goes wrong:**
G20 (inch) / G21 (mm) only change how subsequent numbers are *interpreted* — they don't convert existing values. If a file omits an explicit unit directive, or the parser defaults to the wrong unit, every distance value (X/Y/Z, feed rate, arc radius) is off by a factor of 25.4, which for this project means the robot's simulated toolpath would be wildly out of scale relative to the modeled cell (either invisibly tiny or physically impossible for the arm to reach).

**Why it happens:**
It's tempting to just assume mm (reasonable default for a robotics project) and skip explicit unit detection, since most test files during development will be self-authored and consistent — the gap only shows up with a differently-authored file (e.g. an inch-based CAM export).

**How to avoid:**
Detect and honor G20/G21 explicitly in the parser; if neither is present, do not silently default — either surface a UI prompt asking the user to confirm the unit, or clearly flag the assumed default in the UI so it's an informed choice, not a hidden one. Always normalize to one internal unit (mm recommended, matching robotics/CAD convention) immediately after parsing so the rest of the pipeline never has to think about units again.

**Warning signs:**
A test toolpath appears either absurdly small (a few mm across when it should be tens of cm) or the arm is reported as unable to reach any point in it (workspace-limit errors on what should be a modest-sized path).

**Phase to address:**
G-code parsing phase — unit normalization should be one of the first transformations applied, before any geometry or IK work touches the parsed data.

---

### Pitfall 9: G-code's lack of native multi-axis orientation is not accounted for

**What goes wrong:**
Standard g-code (X/Y/Z/I/J/K) was designed for 3-axis CNC machines where tool orientation is fixed (always pointing along Z) — it has no native way to specify tool orientation for a 6+ DOF robot arm. A parser that reads only X/Y/Z per move and feeds that directly into IK, implicitly assuming a fixed constant tool-down orientation, will produce correct results only for operations that happen to keep that assumption true — and will misrepresent anything else as soon as tool orientation would actually need to vary (which is common in real milling toolpaths with tilted approaches, and worth being explicit about for print-head vs. mill-spindle tool-changer behavior).

**Why it happens:**
It's the path of least resistance: X/Y/Z is trivial to map into a target TCP position, and adding orientation handling requires deciding how orientation is represented in the input files (since it's not standard) and threading it through IK.

**How to avoid:**
For this project's scope, explicitly document the assumption: tool orientation is fixed/constant per operation (e.g. always pointing straight down along the rail-normal, or a fixed approach vector per tool), and clearly state this as a deliberate scoping decision in the write-up rather than an unstated bug. If time allows, support a simple orientation field per operation (not per g-code line) — e.g. a per-operation "approach vector" set in the Setup/Calibrate tab — which is far cheaper than full per-point orientation in the g-code itself.

**Warning signs:**
None visible in casual demo use if the fixed-orientation assumption holds for all test files — but this is exactly the kind of gap a technically sophisticated interviewer will probe by asking "what if the tool needs to tilt mid-cut?"

**Phase to address:**
G-code parsing / kinematics phase, addressed primarily through explicit scoping documentation rather than full implementation, given the timeline.

---

### Pitfall 10: React Three Fiber scene re-renders on every animation frame via React state

**What goes wrong:**
Driving toolpath playback by calling `setState` (position, joint angles, playhead time) 60 times per second triggers React's full reconciliation loop every frame, which is drastically slower than Three.js's own render loop — frame rate degrades noticeably within seconds, especially once the scene has more than a trivial number of objects (arm links, rail, toolpath lines, cell geometry).

**Why it happens:**
It's the natural instinct coming from typical React data-flow (state drives render), and it works fine at low object counts in early development, so the mistake doesn't surface until later in the project when the scene is fuller and the framerate problem looks like a mysterious performance cliff rather than an obvious architectural issue.

**How to avoid:**
Drive all per-frame animation (joint angle updates, TCP marker position, playhead-synced highlighting) through refs mutated inside `useFrame`, never through `useState`/`useReducer` in the render loop. Reserve React state for things that change at human-interaction frequency (play/pause, selected operation, tab switch), not simulation frequency. Use frame delta (`position.x += delta`, not a fixed increment) so playback speed is consistent across different hardware/frame rates.

**Warning signs:**
Frame rate drops as more of the scene is built out even though nothing "heavy" was obviously added; React DevTools profiler shows component re-renders happening at animation frequency.

**Phase to address:**
3D scene/playback architecture phase — this is a foundational pattern decision that's expensive to retrofit once dozens of components already read animation state via props/hooks instead of refs.

---

### Pitfall 11: Long toolpaths rendered as many small line objects instead of one batched geometry

**What goes wrong:**
Creating a separate `Line`/mesh object per toolpath segment (e.g. one per g-code move, to get per-segment color coding by move type or depth of engagement) causes the draw-call count — not the vertex count — to become the bottleneck; performance reports show visible degradation once individual line objects reach roughly 1000+, which a real toolpath (especially a milling operation with many small arc-tessellated segments) can easily exceed.

**Why it happens:**
Per-segment objects are the most natural way to think about "color-code this segment differently," so it's the first implementation most people reach for — the performance cliff only appears once the g-code file is large enough, which may not be true of small hand-authored test files used during development.

**How to avoid:**
Use a single `Line2`/`LineSegments2` (from Three.js's fat-lines examples) or a single `BufferGeometry`-based line with a per-vertex color attribute for the entire toolpath, updating the color attribute (not creating new geometry) when move-type or depth-of-engagement coloring needs to change. This gives per-segment color coding in one draw call instead of thousands.

**Warning signs:**
Playback frame rate is fine on a short test path but degrades sharply once a longer, more realistic g-code file (hundreds to thousands of moves) is loaded.

**Phase to address:**
Toolpath-rendering phase — decide the single-geometry-with-vertex-colors approach before building the color-coding feature, not after.

---

### Pitfall 12: Toolpath geometry is recreated every frame instead of updated, leaking memory

**What goes wrong:**
If the toolpath's `BufferGeometry` (or the playhead marker's geometry) is recreated on every state change or every animation frame rather than reused/updated in place, each new geometry allocation leaks VRAM since Three.js does not automatically garbage-collect GPU resources — a few minutes of playback/scrubbing can exhaust memory and cause the tab to slow down or crash, exactly the kind of failure that would be catastrophic if it happens live during an interview demo.

**Why it happens:**
React's declarative model encourages recreating objects from render inputs (e.g. `useMemo` without a matching disposal effect, or constructing a new geometry inline whenever playback position changes) — this works fine on the first few playback runs and only degrades with sustained use, so it's easy to miss during short dev-loop testing.

**How to avoid:**
Update existing `BufferAttribute` arrays in place (e.g. update a position or draw-range attribute to reflect current playhead progress) rather than constructing new `BufferGeometry` objects per frame. Where objects genuinely must be recreated (e.g. switching between an entirely different loaded toolpath file), explicitly call `.dispose()` on the old geometry/material before dropping the reference, or rely on R3F's automatic disposal on unmount for objects that are fully replaced via React's tree (not manually created outside it).

**Warning signs:**
Chrome DevTools Memory/Performance tab shows steadily climbing JS heap or GPU memory during extended playback/scrubbing sessions rather than a stable sawtooth pattern.

**Phase to address:**
Toolpath-rendering/playback phase, verified with a "let it run for several minutes / scrub back and forth repeatedly" manual test before considering that phase done.

---

### Pitfall 13: Joint-space interpolation assumed to produce straight-line task-space motion

**What goes wrong:**
For a linear g-code move (G1) between two points, naively interpolating linearly between the *joint angles* of the start and end IK solutions does not produce a straight line in Cartesian space — it produces a curved, physically arbitrary path, because joint space and task space are related nonlinearly. This is subtle: the animation still looks "smooth" (no visible glitches), so it can pass casual review while being kinematically wrong — exactly the kind of quiet inaccuracy that undermines the project's stated core value ("accurately color-coded, animated robot motion").

**Why it happens:**
Joint-space interpolation is by far the simpler implementation (just lerp N joint angles) compared to task-space interpolation (interpolate TCP position/orientation, then re-solve IK at each sampled point), so under time pressure it's the natural shortcut — and because the visual artifact is subtle rather than a hard failure, it's easy to not notice without deliberately checking.

**How to avoid:**
For linear (G1) and arc (G2/G3) moves, interpolate the *target TCP pose* in task space at a reasonable sampling resolution, then solve IK independently at each sampled point (using the "nearest to previous solution" rule from Pitfall 3 for continuity) — rather than interpolating joint angles directly. This is more computation but is the only way to guarantee the rendered path visually matches the intended straight/arc line.

**Warning signs:**
A straight-line g-code move, when played back, shows the TCP marker or tool tip visibly bowing away from a straight line rather than tracing one exactly.

**Phase to address:**
Kinematics/IK phase in combination with the toolpath-rendering phase — the sampling/interpolation strategy must be decided when IK-per-waypoint is implemented, not bolted on later.

---

### Pitfall 14: Secondary tabs (Vision/Calibrate/Optimization/I/O) get built out before the core simulation is solid

**What goes wrong:**
Given the breadth of the requirement list (Dashboard, Setup, I/O, Vision, Calibrate, Optimization tabs alongside the core Simulation view), it's tempting to make visible progress by building out several tabs in parallel with basic/placeholder content, while the core toolpath simulation — explicitly called out as the one thing that "cannot fail" — remains rough. This risks arriving at the deadline with several half-finished secondary features and a core experience that isn't polished enough to carry the demo.

**Why it happens:**
Secondary tabs feel individually tractable and give a sense of breadth/completeness quickly, while the core simulation (kinematics + g-code + rendering + performance) has the highest technical risk and the biggest payoff-to-effort ratio problem — exactly the kind of work that's tempting to defer because it's harder, even though it matters most.

**How to avoid:**
Sequence work so the core simulation (g-code import -> accurate toolpath -> animated playback with correct color coding) reaches a genuinely polished, demo-ready state before investing significant time in secondary tabs. Treat secondary tabs as a single "breadth" phase near the end, budgeted explicitly, where even a well-designed static/lightly-interactive version of each tab (populated from the same underlying playback state, e.g. Dashboard telemetry computed from the same toolpath data driving Simulation) is an acceptable and honest scope reduction if time runs short — per the project's own stated constraint.

**Warning signs:**
Time-tracking shows meaningful hours going into any secondary tab before the core Simulation tab has a working end-to-end demo (import -> play -> accurate visual result) with no known visual/kinematic bugs.

**Phase to address:**
Roadmap sequencing itself — this should be enforced by phase ordering (core simulation phases scheduled and substantially complete before secondary-tab phases begin), not left to in-the-moment prioritization under deadline pressure.

---

### Pitfall 15: Deployment/CI is left until the end, and the demo isn't reachable at interview time

**What goes wrong:**
The project requires a publicly reachable deployed URL, not just a working local dev environment — take-home-assignment research consistently shows the single most common failure mode isn't code quality, it's the reviewer being unable to run/reach the project at all (missing dependencies, broken build, wrong start command, or in this case, a deploy that was never actually set up or that breaks under a fresh production build). If deployment is treated as a final "just push it somewhere" afterthought, any build/environment mismatch surfaces with no time left to fix it.

**Why it happens:**
Deployment feels like a solved, low-risk problem ("it's just a static React app") right up until it isn't — 3D/WebGL apps have real gotchas in production builds (asset paths, bundle size from Three.js, CORS on loaded assets, environment-variable handling) that don't show up in local dev mode, and CI/deploy pipeline issues are exactly the kind of thing that eats disproportionate last-minute time when discovered late.

**How to avoid:**
Stand up a minimal deployed version (even an empty scaffold page) to the target hosting platform on day one, before feature work begins, so the deploy pipeline itself is proven working early and stays working incrementally as features are added (deploy after every meaningful chunk of work, not just once at the end). This turns deployment from a risky one-shot event into a continuously-verified non-issue.

**Warning signs:**
No deployed URL exists yet by roughly the midpoint of the timeline; the only environment the app has ever run in is local dev (`npm run dev`), never a production build (`npm run build` + serve).

**Phase to address:**
Very first phase (project skeleton), before any feature work — deploy the "hello world" shell immediately, then keep it live continuously.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Fixed/constant tool orientation instead of per-point orientation from g-code | Much simpler IK per waypoint, faster to implement | Cannot represent tilted-approach milling ops accurately | Acceptable for this timeline if explicitly documented as a scoping decision |
| Simple deterministic rail-position heuristic instead of full Jacobian redundancy resolution | Avoids research-grade robotics implementation | Rail motion may not be "optimal" (e.g. minimal travel) in all cases | Acceptable and expected for an interview-scope project — document the choice |
| Secondary tabs populated with static/lightly-interactive content instead of full interactivity | Delivers visible breadth quickly | Feels less "real" under close interview scrutiny | Acceptable only after the core Simulation tab is solid; never acceptable as a substitute for a working core |
| Supporting a narrow g-code dialect subset instead of universal parsing | Much less parsing edge-case work | Files from an unexpected dialect may fail to load | Acceptable if the supported subset is documented and validated with a clear error message for unsupported codes |
| Tessellating arcs at a fixed coarse resolution instead of adaptive/error-bounded | Simpler implementation | Very large arcs may look faceted, or very small arcs may waste points | Acceptable if resolution is tuned once against representative test files |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Per-frame `setState` driving Three.js object transforms | Frame rate degrades as scene grows; React DevTools shows renders at animation frequency | Use refs + `useFrame` for all per-frame mutation | Noticeable once scene has more than a handful of animated objects |
| One Object3D/Line per toolpath segment | Frame rate cliff on larger g-code files | Single batched `Line2`/`BufferGeometry` with vertex colors | Reports show degradation around ~1000+ individual line objects |
| Recreating `BufferGeometry` every frame/state change instead of mutating attributes | Steadily climbing memory during playback; eventual tab slowdown/crash | Update `BufferAttribute` data in place; dispose only on genuine object replacement | A few minutes of sustained playback/scrubbing |
| Solving full IK independently at every rendered frame instead of at sampled waypoints + interpolating | Unnecessary CPU cost, may cause frame drops on longer paths | Precompute joint solutions at a fixed waypoint sampling resolution once per loaded toolpath, then interpolate/render from cached results during playback | Long g-code files with many closely-spaced points |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Silently defaulting to mm when a g-code file has no unit directive | User gets a wildly wrong-scale toolpath with no explanation | Surface the assumed/detected unit clearly in the UI (e.g. next to the loaded file name) so it's an informed state, not a hidden guess |
| Silently rejecting or skipping unreachable/out-of-limit waypoints | User sees an incomplete or subtly wrong toolpath with no indication why | Flag unreachable operations explicitly in the operations tree (e.g. a warning icon) rather than silently dropping them |
| No visual distinction between rapid (G0) and cutting/print (G1/G2/G3) moves | User can't visually verify the toolpath is doing what's expected — directly undermines the stated color-coding requirement | Consistent, legible color coding by move type from the very first working version of the Simulation tab, not added late as polish |

## "Looks Done But Isn't" Checklist

- [ ] **Forward/inverse kinematics:** Often "looks right" visually but is unverified numerically — verify against at least one hand-calculable reference pose before trusting the 3D rendering.
- [ ] **7th-axis rail redundancy:** Often silently ignored (rail treated as fixed or cosmetic) rather than deliberately resolved — verify the rail actually moves meaningfully across a toolpath that spans a large X range.
- [ ] **Joint limits:** Often never checked because nothing crashes when violated — verify by testing a path that pushes toward workspace/joint extremes.
- [ ] **G-code arc edge cases (full circle, R-form, invalid combinations):** Often only the common I/J-with-endpoint case is implemented — verify with a deliberately edge-case test file.
- [ ] **Toolpath geometry disposal:** Often "works" in a quick manual test but leaks over sustained use — verify with several minutes of continuous playback/scrubbing while watching browser memory.
- [ ] **Deployed URL under a real production build:** Often only ever tested in local dev mode — verify by running the actual production build command and hitting the live deployed URL, not just `npm run dev`.
- [ ] **Straight-line move accuracy:** Often subtly wrong (joint-space interpolation bowing off a straight line) while still looking "smooth" — verify a straight G1 move visually traces an actual straight line, not just that it animates without glitching.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Wrong DH convention discovered late | MEDIUM | Isolate the per-joint transform function, re-derive against official UR3e parameters, re-run the reference-pose unit test — contained to one module if kinematics was properly isolated from rendering |
| Per-segment line objects causing performance cliff | MEDIUM | Refactor to a single batched geometry with vertex colors; mechanical but touches the rendering layer broadly |
| Memory leak from geometry recreation discovered late | LOW-MEDIUM | Add disposal calls / switch to attribute mutation at the specific hot path identified via memory profiling — usually localized to the playback update function |
| Deployment broken close to deadline | HIGH | Highest-cost recovery of all listed here since it's time-critical and environment-specific — this is exactly why it must be addressed on day one, not recovered from at the end |
| Scope creep leaves core simulation unpolished near deadline | HIGH | Requires cutting secondary-tab scope to redirect remaining time to the core — painful but recoverable if caught with at least a day of buffer left |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Wrong DH convention | Kinematics/engine foundation phase | Reference-pose unit test passes before any UI work begins |
| Singularity mishandling / IK solution flipping | Kinematics/IK phase | Manual playback test of a path crossing the workspace center shows no joint snapping |
| Ignored joint limits | Kinematics/IK phase | Deliberate test path pushing toward joint extremes is correctly flagged, not silently rendered |
| 7th-axis redundancy unresolved | Kinematics/IK phase | Rail position visibly and sensibly varies across a toolpath spanning a wide X range; strategy documented |
| G-code single-dialect assumption | G-code parsing phase | Two structurally different sample files (printing-style, milling-style) both parse correctly or fail with a clear error |
| Arc move edge cases | G-code parsing phase | Test file covering full-circle, R-form, and invalid-combination cases all handled per spec |
| Unit ambiguity (mm/inch) | G-code parsing phase | Explicit unit directive detection tested; missing-unit case surfaces in UI rather than silently defaulting |
| Missing multi-axis orientation in g-code | G-code parsing / kinematics phase | Scoping assumption explicitly documented; not silently absent |
| R3F full-scene re-render via state | 3D scene/playback architecture phase | React DevTools profiler shows no render activity during steady-state animation playback |
| Unbatched toolpath line rendering | Toolpath-rendering phase | Frame rate remains stable on a large (hundreds-to-thousands-of-moves) test g-code file |
| Geometry recreated per frame (memory leak) | Toolpath-rendering/playback phase | Extended playback/scrubbing session shows stable, not climbing, memory in DevTools |
| Joint-space interpolation instead of task-space | Kinematics/IK + toolpath-rendering phases | Straight G1 move visually traces a straight line, verified by eye or a distance-from-line check |
| Secondary tabs built before core simulation is solid | Roadmap sequencing (applies across phases) | Core Simulation tab reaches demo-ready state before secondary-tab phases are scheduled to begin |
| Deployment/CI left until the end | Project-skeleton/first phase | A deployed URL exists and is reachable from day one, kept live continuously through subsequent phases |

## Sources

- [Universal Robots — DH Parameters for calculations of kinematics and dynamics](https://www.universal-robots.com/articles/ur/application-installation/dh-parameters-for-calculations-of-kinematics-and-dynamics/)
- [Universal Robots — Denavit-Hartenberg parameters (developer docs)](https://www.universal-robots.com/developer/hardware-and-motion/robot-motion-dh-parameters/)
- [Universal Robot URe-Series Cobot Kinematics & Dynamics (Ohio University)](https://people.ohio.edu/williams/html/PDF/UniversalRobotKinematics.pdf)
- [Universal Robots — What is a singularity?](https://www.universal-robots.com/articles/ur/application-installation/what-is-a-singularity/)
- [RoboDK blog — Robot Singularities: What Are They and How to Beat Them](https://robodk.com/blog/robot-singularities/)
- [Robohub — 3 types of robot singularities and how to avoid them](https://robohub.org/3-types-of-robot-singularities-and-how-to-avoid-them/)
- [Mecademic — What are Singularities in a Six-Axis Robot Arm?](https://mecademic.com/insights/academic-tutorials/what-are-singularities-6-axis-robot-arm/)
- [GitHub — 7DOF-KUKA-Linear-Axis-Forward-and-Inverse-Kinematics (redundancy resolution methods)](https://github.com/Walid-khaled/7DOF-KUKA-Linear-Axis-Forward-and-Inverse-Kinematics)
- [RoboDK forum — Inverse kinematics for 7 and 8 axis systems](https://robodk.com/forum/Thread-Inverse-kinematics-for-7-and-8-axis-systems)
- [Kinematics and Singularity Analysis of a 7-DOF Redundant Manipulator (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8587006/)
- [LinuxCNC — The EMC2 G Code Language](http://linuxcnc.org/docs/2.4/html/gcode_main.html)
- [Marlin firmware — G2-G3: Arc or Circle Move](https://marlinfw.org/docs/gcode/G002-G003.html)
- [cnccode.com — G20 vs G21: Inch vs Metric Programming in CNC](https://cnccode.com/2025/07/13/g20-vs-g21-inch-vs-metric-programming-in-cnc-avoiding-costly-mistakes/)
- [CNCCookbook — G21 and G20: Metric and Imperial Unit Conversion G-Code Programming](https://www.cnccookbook.com/g21-gcode-g20-cnc-metric-imperial/)
- [ENCY CAD/CAM — Why CNC Programmers Find It Challenging to Master Robotic Machining Programming](https://encycam.com/articles/why-cnc-programmers-find-it-challenging-to-master-robotic-machining-programming/)
- [RobMach — G-Code-based off-line programming for robotic machining trajectory generation](https://www.researchgate.net/publication/354943807_RobMach_G-Code-based_off-line_programming_for_robotic_machining_trajectory_generation)
- [React Three Fiber — Performance pitfalls (official docs)](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- [Wawa Sensei — 3 React Three Fiber Mistakes I'll Never Make Again](https://wawasensei.dev/tuto/3-react-three-fiber-mistakes)
- [three.js docs — Line2 / LineSegments2](https://threejs.org/docs/pages/Line2.html)
- [three.js discourse — Improving the performance of high density lines](https://discourse.threejs.org/t/improving-the-performance-of-high-density-lines/67635)
- [dev.to — Why your React Three Fiber gallery drops to 5 FPS and how to fix it](https://dev.to/alanwest/why-your-react-three-fiber-gallery-drops-to-5-fps-and-how-to-fix-it-4661)
- [react-three-fiber GitHub discussion #489 — Disposing of a mesh](https://github.com/pmndrs/react-three-fiber/discussions/489)
- [react-three-fiber GitHub issue #514 — Leaking WebGLRenderer and more when unmounting](https://github.com/pmndrs/react-three-fiber/issues/514)
- [DEV Community — Avoid Those Mistakes When You Work On Your Next Take-Home Interview Assignment](https://dev.to/pallymore/avoid-those-mistakes-when-you-work-on-your-next-take-home-interview-assignment-2kak)
- [BigPanda Engineering — Secrets from the Interview Room: What Reviewers Look For in a Take-home Coding Assignment](https://medium.com/bigpanda-engineering/secrets-from-the-interview-room-what-reviewers-look-for-in-a-take-home-coding-assignment-1aaec70dabe0)

---
*Pitfalls research for: Browser-based UR3e robotic cell simulation interface*
*Researched: 2026-08-13*
