# Phase 1: Static Rig + Kinematics Foundation - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view an accurately-modeled UR3e — including its 7th external linear-rail axis — in an interactive 3D scene at a correct static pose. The pose is derived from real forward kinematics (DH parameters), not eyeballed geometry. The scene supports orbit/pan/zoom, a one-action camera reset, and a Fusion-360-style navigation cube that stays in sync with the camera and snaps to Front/Top/Bottom/Back views on click. The project is version-controlled on GitHub and deployed to a publicly reachable URL from this phase onward — deployment is set up now, not deferred.

No g-code, no toolpath, no animation, and no inverse kinematics exist yet — this phase is deliberately static. It proves the kinematic foundation (DH-correct forward kinematics, rig structure, rail composition) that every later phase depends on, in isolation from parsing/IK/playback risk.

</domain>

<decisions>
## Implementation Decisions

### Robot Model Fidelity
- **D-01:** Render the UR3e using official URDF meshes via `urdf-loader`, not simplified primitive geometry — matches STACK.md's recommendation and gives `setJointValue()` per joint for free, useful for FK/IK in later phases.
- **D-02:** The 7th-axis rail is modeled as a visible track + sliding carriage (not a plain platform) — the UR3e base mounts on the carriage, which translates along the track. This makes the rail's function immediately legible and gives the DASH-03 "remaining travel" requirement (Phase 5) a visual anchor.
- **D-03:** No print head / mill spindle mesh in Phase 1 — the flange stays bare. Phase 7 (Tool-Changer + Print/Mill Tabs) owns the `ToolMount` swap logic per `ARCHITECTURE.md` Pattern 3; adding a placeholder tool now is throwaway work.
- **D-04:** DH parameters and joint limits are hardcoded TypeScript constants for this phase, not scaffolded as store-backed/configurable. Phase 8 owns the Setup/Calibrate tabs that would edit them — building configurability UI before any tab consumes it is premature.

### Cell Staging & Environment
- **D-05:** Scene dressing is limited to a floor plane and the rail's own mounting geometry — enough to ground the robot visually and give `OrbitControls` a natural pivot, without building a full cell shell (workbench, fencing, tool-changer station) that later phases will add piece by piece anyway.
- **D-06:** Lighting/background style is neutral studio lighting — soft ambient + directional light, light gray/white background or subtle gradient. Reads as a clean CAD/robotics viewer (RoboDK/Fusion 360-adjacent), lower visual risk than a dark/industrial HMI theme under time pressure.
- **D-07:** The rail's physical travel limits (min/max X) get visible end-stop geometry on the track itself, added now while building the rail rather than deferred — cheap to add at this stage and gives Phase 5's Dashboard "remaining travel" readout a visual anchor already in place.

### Static Demo Pose
- **D-08:** The robot's displayed static pose (for this phase's screenshot/demo moment) is a slightly bent "ready" pose — not all-zero — so it reads as an actual posed robot rather than a flat silhouette. **Note for planner/executor:** this is separate from the FK *verification* pose — per `PITFALLS.md` Pitfall 1, forward kinematics must still be unit-tested against the all-zero/home pose (a well-known, hand-calculable reference TCP position) regardless of what pose is visually displayed. Test against zero; display the bent "ready" pose.
- **D-09:** The rail carriage sits at the center of its travel range for the static pose — visually balanced, and shows travel remaining in both directions simultaneously (relevant once the end-stop markers from D-07 are visible in the same view).

### Deployment Target & Repo
- **D-10:** Deploy to Vercel — confirmed per STACK.md's recommendation (zero-config, GitHub-connected, auto-redeploy on push).
- **D-11:** No GitHub remote exists yet for this repo (confirmed against current git status). Creating the GitHub repo and connecting Vercel is in scope for Phase 1's first step, per `PITFALLS.md` Pitfall 15 ("deploy on day one, not as an afterthought") and the roadmap's own note that DEPLOY-01/DEPLOY-02 are mapped to Phase 1 for exactly this reason.

### Claude's Discretion
- Exact camera default framing/distance, nav cube styling (beyond using drei's `GizmoHelper`/`GizmoViewcube`), and precise "ready pose" joint angle values are left to implementation — no specific reference image or angle set was requested.
- Exact xacro-to-flat-URDF conversion method (local `xacro` run vs. pulling a pre-flattened UR3e URDF from a dataset repo) is an implementation detail per STACK.md, not a user decision point.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Patterns
- `.planning/research/ARCHITECTURE.md` — system architecture, recommended project structure, DH table, FK/IK approach, rail composition (7-DOF redundancy resolution strategy), tool-changer scene graph pattern (Pattern 3, relevant to D-03's bare-flange decision), anti-patterns to avoid
- `.planning/research/PITFALLS.md` — Pitfall 1 (DH convention correctness, mandatory reference-pose unit test — governs D-08's test-vs-display pose split), Pitfall 15 (deploy on day one — governs D-10/D-11), Pitfall 5 (7th-axis rail redundancy handling)
- `.planning/research/STACK.md` — full recommended technology stack including exact package versions, urdf-loader integration pattern (D-01), Vercel deployment recommendation (D-10), UR3e URDF asset sourcing guidance

### Project & Requirements
- `.planning/PROJECT.md` — project brief, core value statement, constraints, key decisions log
- `.planning/REQUIREMENTS.md` — SCENE-01 through SCENE-04, DEPLOY-01, DEPLOY-02 (this phase's mapped requirements); full v1 requirement set for context on what later phases will need this rig to support
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and dependency position (first phase, nothing upstream)

</canonical_refs>

<code_context>
## Existing Code Insights

No source code exists yet — this is the project's first implementation phase. No `src/`, no `package.json`, no prior CONTEXT.md files, no codebase maps.

### Reusable Assets
- None yet — Phase 1 establishes the foundational project scaffold (Vite + React + TS + R3F) and `kinematics/` module that all later phases build on.

### Established Patterns
- None yet — this phase sets the first patterns (see `ARCHITECTURE.md`'s recommended project structure: `kinematics/`, `scene/`, `store/` as separate concerns).

### Integration Points
- N/A — nothing to integrate with yet.

</code_context>

<specifics>
## Specific Ideas

No specific visual references (images, competitor screenshots) were provided. The "neutral studio lighting" and "RoboDK/Fusion 360-adjacent" framing (D-06) is the closest thing to a stated aesthetic target — a clean, professional CAD/robotics-viewer look rather than a dark dashboard/HMI theme.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope. Tool-changer visuals (bare flange, D-03), Setup/Calibrate configurability (D-04), and full cell-shell dressing (D-05) were explicitly discussed and deliberately deferred to their already-planned roadmap phases (7 and 8), not new scope creep.

</deferred>

---

*Phase: 1-Static Rig + Kinematics Foundation*
*Context gathered: 2026-08-13*
