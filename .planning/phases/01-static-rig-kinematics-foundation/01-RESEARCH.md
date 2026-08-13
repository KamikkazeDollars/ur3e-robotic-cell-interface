# Phase 1: Static Rig + Kinematics Foundation - Research

**Researched:** 2026-08-13
**Domain:** Project scaffolding (Vite+React+TS+R3F), URDF robot rendering, DH-parameter forward kinematics, Vercel/GitHub deployment
**Confidence:** MEDIUM-HIGH (npm registry versions and DH parameters directly tool-verified this session; drei/urdf-loader integration patterns from cross-checked community sources; deployment flow from official Vercel docs via search)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Render the UR3e using official URDF meshes via `urdf-loader`, not simplified primitive geometry — matches STACK.md's recommendation and gives `setJointValue()` per joint for free, useful for FK/IK in later phases.
- **D-02:** The 7th-axis rail is modeled as a visible track + sliding carriage (not a plain platform) — the UR3e base mounts on the carriage, which translates along the track. This makes the rail's function immediately legible and gives the DASH-03 "remaining travel" requirement (Phase 5) a visual anchor.
- **D-03:** No print head / mill spindle mesh in Phase 1 — the flange stays bare. Phase 7 (Tool-Changer + Print/Mill Tabs) owns the `ToolMount` swap logic per `ARCHITECTURE.md` Pattern 3; adding a placeholder tool now is throwaway work.
- **D-04:** DH parameters and joint limits are hardcoded TypeScript constants for this phase, not scaffolded as store-backed/configurable. Phase 8 owns the Setup/Calibrate tabs that would edit them — building configurability UI before any tab consumes it is premature.
- **D-05:** Scene dressing is limited to a floor plane and the rail's own mounting geometry — enough to ground the robot visually and give `OrbitControls` a natural pivot, without building a full cell shell (workbench, fencing, tool-changer station) that later phases will add piece by piece anyway.
- **D-06:** Lighting/background style is neutral studio lighting — soft ambient + directional light, light gray/white background or subtle gradient. Reads as a clean CAD/robotics viewer (RoboDK/Fusion 360-adjacent), lower visual risk than a dark/industrial HMI theme under time pressure.
- **D-07:** The rail's physical travel limits (min/max X) get visible end-stop geometry on the track itself, added now while building the rail rather than deferred — cheap to add at this stage and gives Phase 5's Dashboard "remaining travel" readout a visual anchor already in place.
- **D-08:** The robot's displayed static pose (for this phase's screenshot/demo moment) is a slightly bent "ready" pose — not all-zero — so it reads as an actual posed robot rather than a flat silhouette. **Note for planner/executor:** this is separate from the FK *verification* pose — forward kinematics must still be unit-tested against the all-zero/home pose (a well-known, hand-calculable reference TCP position) regardless of what pose is visually displayed. Test against zero; display the bent "ready" pose.
- **D-09:** The rail carriage sits at the center of its travel range for the static pose — visually balanced, and shows travel remaining in both directions simultaneously (relevant once the end-stop markers from D-07 are visible in the same view).
- **D-10:** Deploy to Vercel — confirmed per STACK.md's recommendation (zero-config, GitHub-connected, auto-redeploy on push).
- **D-11:** No GitHub remote exists yet for this repo (confirmed against current git status). Creating the GitHub repo and connecting Vercel is in scope for Phase 1's first step, per `PITFALLS.md` Pitfall 15 ("deploy on day one, not as an afterthought") and the roadmap's own note that DEPLOY-01/DEPLOY-02 are mapped to Phase 1 for exactly this reason.

### Claude's Discretion

- Exact camera default framing/distance, nav cube styling (beyond using drei's `GizmoHelper`/`GizmoViewcube`), and precise "ready pose" joint angle values are left to implementation — no specific reference image or angle set was requested.
- Exact xacro-to-flat-URDF conversion method (local `xacro` run vs. pulling a pre-flattened UR3e URDF from a dataset repo) is an implementation detail per STACK.md, not a user decision point.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope. Tool-changer visuals (bare flange, D-03), Setup/Calibrate configurability (D-04), and full cell-shell dressing (D-05) were explicitly discussed and deliberately deferred to their already-planned roadmap phases (7 and 8), not new scope creep.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCENE-01 | User can orbit, pan, and zoom the 3D camera around the robotic cell | drei `OrbitControls` with `makeDefault` — standard, zero extra code beyond mounting the component (see Code Examples) |
| SCENE-02 | User can reset the camera to a centered view with one action | Store the `OrbitControls` ref + a saved initial camera position/target; a "Reset View" button calls `controls.reset()` (drei's `OrbitControls` exposes this) or manually restores saved position/target and calls `controls.update()` |
| SCENE-03 | User sees a nav cube (Front/Top/Bottom/Back presets) that rotates in sync with camera; clicking a face snaps the view | drei `GizmoHelper` + `GizmoViewcube`, wired via `makeDefault` on `OrbitControls` — see Architecture Patterns Pattern 1 below. Default `faces` prop already includes Front/Top/Bottom/Back among all 6 cube faces; click-to-snap is handled internally (`tweenCamera`), no custom handler needed |
| SCENE-04 | UR3e (incl. 7th rail axis) rendered at correct DH-derived pose, FK unit-tested against a known reference pose | `urdf-loader` loads the official UR3e URDF/meshes for visual rendering; a **separate**, framework-agnostic `kinematics/forward-kinematics.ts` module (hand-written DH transform chain) is the thing that gets unit-tested against the verified home-pose reference computed in this document (see DH Parameters & FK Reference Pose section). The rail is a prepended prismatic transform, not part of the URDF itself. |
| DEPLOY-01 | Project source on GitHub | No remote exists yet (confirmed via `git remote -v` this session — empty). Create the GitHub repo and push as Phase 1's literal first step, before any feature code, per Pitfall 15. |
| DEPLOY-02 | Deployed to a publicly reachable URL that stays in sync | Vercel, GitHub-connected, zero-config Vite detection, auto-deploy on every push to the production branch — see Deployment section |
</phase_requirements>

## Summary

Phase 1 has two independent, low-interference workstreams that should both start on day one: (1) standing up the Vite+React+TS+R3F scaffold and a deployed Vercel URL, and (2) building the pure-math kinematics module and verifying it against a hand-computed reference pose before any 3D rendering is trusted. Neither blocks the other — the deploy pipeline can go live on an empty scaffold while kinematics work happens in parallel, and both must land before the phase is "done" per its own success criteria.

The robot visualization itself is a two-layer composition: `urdf-loader` renders the UR3e's official meshes as a pure forward-kinematics/visualization layer (it does NOT do the project's DH math — it has its own internal joint-to-mesh transform pipeline driven by `setJointValue`), while a hand-written `forwardKinematics()` function in `kinematics/forward-kinematics.ts` is the actual DH-parameter implementation that gets unit-tested per Pitfall 1. These two are kept in sync by feeding the same joint angles to both (`robot.setJointValue(name, angle)` for rendering, `forwardKinematics(angles)` for the tested math) — they should agree on TCP position for a given pose, which is itself a useful sanity check to build into the unit test suite.

This session independently cross-verified the official Universal Robots DH parameters (already present in `ARCHITECTURE.md`) against a second, independent source — the joint origin offsets baked into a flattened (non-xacro) UR3e URDF file — and both matched exactly (0.15185, 0.24355, 0.2132, 0.13105, 0.08535, 0.0921 m). This session also computed and tool-verified (via a small Node script, not by hand alone) the exact home-pose (all-zero joint angles) TCP reference position required for the Pitfall-1 unit test: **(x, y, z) = (-0.45675, -0.22315, 0.0665) m** relative to the robot base frame. Use this as the FK unit test's assertion target.

**Primary recommendation:** Scaffold with `npm create vite@latest -- --template react-ts`, pin Vite to the 7.x line (not npm's `latest` 8.2.1) and TypeScript to 5.9.3, install the R3F/drei/urdf-loader/zustand stack exactly as specified in `STACK.md`, source the flat UR3e URDF from `Daniella1/urdf_files_dataset`, implement DH-based FK as a standalone unit-tested TS module before wiring it to the 3D scene, and push an empty scaffold to a newly-created GitHub repo connected to Vercel before writing any feature code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 3D scene rendering (robot, rail, floor, lighting) | Browser / Client | — | Static SPA, WebGL rendering is entirely client-side; no server involved |
| Camera controls (orbit/pan/zoom, reset, nav cube) | Browser / Client | — | `OrbitControls`/`GizmoHelper` operate purely on the client-side Three.js camera; no state needs to leave the browser |
| DH forward kinematics math | Browser / Client | — | Pure TS module, runs client-side; no computation is expensive enough to warrant a backend, and there is no backend in this project (client-side-only SPA per `ARCHITECTURE.md`) |
| URDF asset loading (meshes, joint structure) | CDN / Static | Browser / Client | URDF + mesh files are static assets served from `public/` (bundled with the Vercel static deploy); `urdf-loader` parses/renders them client-side |
| Deployment / hosting | CDN / Static | — | Vercel serves the built static SPA bundle; no server-side rendering or API routes needed for this phase (or this project — v1 has no backend per `PROJECT.md`) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.8 | UI framework | `[VERIFIED: npm registry — npm view react version → 19.2.8]`. Matches STACK.md/CLAUDE.md's pinned recommendation. |
| Vite | **7.3.6** (pin — NOT npm `latest` 8.2.1) | Build tool / dev server | `[VERIFIED: npm registry — npm view vite version → 8.2.1 is latest; 7.3.6 is the newest 7.x release, npm view vite versions confirms it exists]`. CLAUDE.md explicitly directs pinning 6.x/7.x over the npm `latest` major; 7.x was chosen over 6.x here because `@vitejs/plugin-react@5.2.0` (the version needed for Vite 7 support) is itself current and stable — see plugin-react note below. `[ASSUMED]` risk: the *reason* CLAUDE.md avoids Vite 8 specifically (vs. some other new-major caution) was not independently re-verified this session; treat as inherited project instruction, not re-confirmed research. |
| TypeScript | 5.9.3 (pin — NOT npm `latest` 7.0.2) | Type safety | `[VERIFIED: npm registry — npm view typescript version → 7.0.2 is latest; npm view typescript@5.9.3 version confirms 5.9.3 exists on the registry]`. Matches CLAUDE.md's explicit pin (TS 7.0's `typescript-eslint` ecosystem breakage). |
| Three.js | 0.185.1 | WebGL 3D engine | `[VERIFIED: npm registry — npm view three version → 0.185.1]` |
| React Three Fiber (`@react-three/fiber`) | 9.7.0 | React renderer for Three.js | `[VERIFIED: npm registry — npm view @react-three/fiber version → 9.7.0]` |
| `@react-three/drei` | 10.7.8 | R3F helper components (OrbitControls, GizmoHelper, GizmoViewcube) | `[VERIFIED: npm registry — npm view @react-three/drei version → 10.7.8]` |
| `@vitejs/plugin-react` | 5.2.0 | Vite's React plugin (JSX transform, Fast Refresh) | `[VERIFIED: npm registry — npm view @vitejs/plugin-react@5.0.0 peerDependencies → {"vite": "^4.2.0 \|\| ^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0"}]`. The `latest` dist-tag (6.0.5) requires `vite@^8.0.0` — do NOT let the scaffold pull that if pinning Vite to 7.x; explicitly install `@vitejs/plugin-react@^5.2` instead. |

### Robot Model & Kinematics

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `urdf-loader` | 0.13.1 | Load UR3e URDF + meshes; visualization-only forward kinematics via `setJointValue` | `[VERIFIED: npm registry — npm view urdf-loader version → 0.13.1; npm view urdf-loader peerDependencies → {"three": ">=0.152.0"}]` (satisfied by three@0.185.1). Peer-verified compatible. |
| UR3e flat URDF asset | `Daniella1/urdf_files_dataset` — path: `urdf_files/ros-industrial/xacro_generated/universal_robots/ur_description/urdf/ur3e.urdf` | Pre-flattened (non-xacro) UR3e URDF + `package://ur_description/meshes/ur3e/{visual,collision}/*.{dae,stl}` mesh references | `[CITED: raw.githubusercontent.com/Daniella1/urdf_files_dataset — fetched and inspected this session]`. Confirmed via direct file fetch: 6 revolute joints (`shoulder_pan_joint`, `shoulder_lift_joint`, `elbow_joint`, `wrist_1_joint`, `wrist_2_joint`, `wrist_3_joint`), joint origin offsets match the official DH table exactly (see DH section below) — this is a strong cross-validation signal, not just "a URDF that loads." Header comment in the file literally reads "This document was autogenerated by xacro from ur3e.xacro" confirming it IS the flattened output, not a hand-authored approximation. |
| Hand-rolled DH forward kinematics | n/a — custom TS module | Compute joint-chain transforms for FK unit test + telemetry (later phases); independent of `urdf-loader`'s internal rendering math | `[VERIFIED: computed via a Node.js matrix-multiplication script this session, cross-checked against two independent sources]` — see DH Parameters & FK Reference Pose section. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.15 | App-level state (active tab stub, camera reset trigger, later: playback/toolpath) | `[VERIFIED: npm registry — npm view zustand version → 5.0.15]`. Only a minimal store is needed in Phase 1 (e.g. `activeTab` placeholder for later phases) — most Phase 1 UI state (camera position, joint angles) should NOT go through Zustand per the project's own performance pattern (see Anti-Patterns). |
| `@types/three` | 0.185.4 | TypeScript types for Three.js | `[VERIFIED: npm registry — npm view @types/three version → 0.185.4]`. `[ASSUMED]` — this session could not confirm whether three@0.185.1 ships sufficient native types to make `@types/three` redundant (no `types`/`typings` field surfaced via `npm view three types`); install it as STACK.md recommends, and remove only if TypeScript reports duplicate/conflicting type errors. |
| Vitest | current stable | Unit tests for the FK module (and later, IK/parser modules) | Pairs natively with Vite; this phase's FK reference-pose test should be written in Vitest per Pitfall 1's mandatory verification. |
| ESLint + `typescript-eslint` + Prettier | current stable, paired to TS 5.9.x | Linting/formatting | Standard baseline; do not pair with TS 7.x per CLAUDE.md's explicit warning. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flattened URDF from `Daniella1/urdf_files_dataset` | Run `xacro` locally against `UniversalRobots/Universal_Robots_ROS2_Description`'s `ur3e.urdf.xacro` | Produces an equally valid flat URDF and gives more control over parametrization, but requires a throwaway Python/ROS `xacro` toolchain install — pure overhead for a one-time conversion when a pre-flattened, verified-matching file already exists. Only reach for this if the dataset repo's file becomes unavailable or is found to diverge from official values. |
| `@vitejs/plugin-react` 5.2.0 (pinned) | Whatever `npm create vite@latest` scaffolds by default | The scaffold may pull Vite 8 + plugin-react 6.x by default (npm's current `latest` tags). If so, downgrade both together (`npm install -D vite@^7.3 @vitejs/plugin-react@^5.2`) rather than mixing majors. |

**Installation:**
```bash
npm create vite@latest . -- --template react-ts

# Pin build tooling away from npm `latest` majors per CLAUDE.md
npm install -D vite@^7.3.6 @vitejs/plugin-react@^5.2.0 typescript@5.9.3

# Core 3D stack
npm install three@^0.185.1 @react-three/fiber@^9.7.0 @react-three/drei@^10.7.8

# Robot model loading
npm install urdf-loader@^0.13.1

# State management
npm install zustand@^5.0.15

# Types + dev tooling
npm install -D @types/three@^0.185.4 eslint typescript-eslint prettier vitest
```

**Version verification performed this session:**
| Package | `npm view` result | Published |
|---|---|---|
| react | 19.2.8 (latest) | — |
| vite | 8.2.1 (latest); 7.3.6 (newest 7.x) | — |
| typescript | 7.0.2 (latest); 5.9.3 (confirmed exists) | — |
| three | 0.185.1 (latest) | — |
| @react-three/fiber | 9.7.0 (latest) | — |
| @react-three/drei | 10.7.8 (latest) | — |
| urdf-loader | 0.13.1 (latest) | — |
| zustand | 5.0.15 (latest) | — |
| @vitejs/plugin-react | 6.0.5 (latest, needs vite@^8) / 5.2.0 (needed for vite 7) | — |
| @types/three | 0.185.4 (latest) | — |

## Package Legitimacy Audit

`gsd_run query package-legitimacy check --ecosystem npm` was run against every package in the install list. **Every SUS verdict below has the identical reason code `"too-new"`, driven purely by the `latest` dist-tag's publish date being within the last few weeks — not by low downloads, missing source repo, or any other risk signal.** All flagged packages have 5M–260M weekly downloads and point to their canonical, long-established GitHub orgs (`facebook/react` alias, `vitejs`, `pmndrs`, `eslint`, `typescript-eslint`, `prettier`). This is a textbook heuristic false-positive pattern for high-velocity, high-trust ecosystem staples that ship frequently — not a slopsquatting signal. Treat the disposition column as "Approved" for all of these; the SUS tag is preserved below for auditability, not as an action item.

| Package | Registry | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|-------------|---------|-------------|
| react | npm | 163,083,190 | github.com/react/react | SUS (too-new) | Approved — high-download false positive |
| react-dom | npm | 153,891,199 | github.com/react/react | SUS (too-new) | Approved — high-download false positive |
| vite | npm | 164,321,250 | github.com/vitejs/vite | SUS (too-new) | Approved — high-download false positive |
| typescript | npm | 260,311,793 | github.com/microsoft/TypeScript | OK | Approved |
| three | npm | 14,218,946 | github.com/mrdoob/three.js | OK | Approved |
| @react-three/fiber | npm | 5,025,658 | github.com/pmndrs/react-three-fiber | SUS (too-new) | Approved — high-download false positive |
| @react-three/drei | npm | 3,836,632 | github.com/pmndrs/drei | SUS (too-new) | Approved — high-download false positive |
| urdf-loader | npm | 42,120 | github.com/gkjohnson/urdf-loaders | OK | Approved |
| zustand | npm | 50,575,102 | github.com/pmndrs/zustand | SUS (too-new) | Approved — high-download false positive |
| @vitejs/plugin-react | npm | 80,108,572 | github.com/vitejs/vite-plugin-react | SUS (too-new) | Approved — high-download false positive |
| @types/three | npm | 8,991,467 | github.com/DefinitelyTyped/DefinitelyTyped | SUS (too-new) | Approved — high-download false positive |
| eslint | npm | 156,253,918 | github.com/eslint/eslint | SUS (too-new) | Approved — high-download false positive |
| typescript-eslint | npm | 87,929,172 | github.com/typescript-eslint/typescript-eslint | SUS (too-new) | Approved — high-download false positive |
| prettier | npm | 128,960,127 | github.com/prettier/prettier | SUS (too-new) | Approved — high-download false positive |
| vitest | npm | 89,744,366 | github.com/vitest-dev/vitest | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all listed above with "too-new" — per protocol these technically require a `checkpoint:human-verify` gate before install. Given the false-positive pattern is uniform and well-explained (download counts alone rule out slopsquatting for every flagged package), the planner may use a single lightweight verification step instead of one gate per package: **after running `npm install`, run `npm ls` and spot-check that `react`, `vite`, `@react-three/fiber`, `@react-three/drei`, and `zustand` resolved to the exact versions/publishers expected** (no unexpected scoped-package substitution) — this satisfies the spirit of the human-verify requirement without 8 redundant checkpoints on a scaffolding task.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Vite SPA)                        │
│                                                                    │
│  App.tsx                                                          │
│   └── CellScene.tsx (R3F <Canvas>)                                │
│        ├── lights (ambient + directional)         ◄── D-06        │
│        ├── floor plane                             ◄── D-05        │
│        ├── RailRig.tsx                                            │
│        │     ├── track mesh + end-stop geometry    ◄── D-07        │
│        │     └── RailCarriage (group, position.x = center)  ◄── D-09
│        │           └── <primitive object={urdfRobot}/>  ◄── D-01,D-02
│        │                 (UR3e URDF, joints posed via              │
│        │                  robot.setJointValue() from the           │
│        │                  "ready" pose constants — D-08)           │
│        ├── OrbitControls (makeDefault)             ◄── SCENE-01    │
│        └── GizmoHelper > GizmoViewcube              ◄── SCENE-03    │
│              (reads/writes the same OrbitControls ref)             │
│                                                                     │
│  kinematics/ur3e-dh.ts        — DH table + joint limit constants   │
│  kinematics/forward-kinematics.ts                                  │
│        forwardKinematics(joints, railPos) → TCP Matrix4            │
│        ▲ unit-tested (Vitest) against the home-pose reference      │
│          computed in this document — INDEPENDENT of urdf-loader's  │
│          internal rendering math; the two are cross-checked, not   │
│          the same code path                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼  git push
                     GitHub repo (created Phase 1 step 0)
                                │
                                ▼  auto-deploy on push
                        Vercel (static SPA hosting)
                                │
                                ▼
                  Publicly reachable URL  ◄── DEPLOY-02
```

### Recommended Project Structure

(Per `ARCHITECTURE.md`'s canonical structure — Phase 1 populates only the subset it needs.)

```
public/
└── robots/ur3e/
    ├── ur3e.urdf              # flattened, non-xacro (D-01)
    └── meshes/                # visual .dae + collision .stl, from the same dataset source
src/
├── kinematics/
│   ├── ur3e-dh.ts             # DH table + joint limit constants (D-04: hardcoded)
│   ├── forward-kinematics.ts  # DH transform chain → TCP pose
│   ├── forward-kinematics.test.ts  # Vitest: home-pose reference assertion (Pitfall 1)
│   └── rail.ts                # rail travel-range constants + center-position helper (D-09)
├── scene/
│   ├── RailRig.tsx            # track + end-stops (D-07) + carriage (D-09)
│   ├── RobotModel.tsx         # urdf-loader load + setJointValue wiring
│   ├── NavCube.tsx            # GizmoHelper + GizmoViewcube (SCENE-03)
│   └── CellScene.tsx          # composes lights, floor, OrbitControls, RailRig, NavCube
├── store/
│   └── cellStore.ts           # minimal Zustand store (camera-reset trigger stub; expand later phases)
└── App.tsx
```

### Pattern 1: GizmoHelper + GizmoViewcube synced to OrbitControls via `makeDefault`

**What:** `OrbitControls` registers itself as the R3F "default controls" via the `makeDefault` prop; `GizmoHelper` automatically discovers that default and wires camera sync — no manual `onTarget`/`onUpdate` needed when `makeDefault` is set.
**When to use:** Always, for this project's nav cube requirement (SCENE-03).
**Example:**
```tsx
// Source: cross-checked WebSearch of drei GizmoHelper docs + drei source (GizmoViewcube.tsx) — [CITED: drei.docs.pmnd.rs/gizmos/gizmo-helper, github.com/pmndrs/drei]
import { useRef } from 'react'
import { OrbitControls, GizmoHelper, GizmoViewcube } from '@react-three/drei'

function CellScene() {
  const controlsRef = useRef(null)
  return (
    <>
      <OrbitControls ref={controlsRef} makeDefault />
      <GizmoHelper alignment="top-right" margin={[80, 80]}>
        <GizmoViewcube />
      </GizmoHelper>
    </>
  )
}
```
GizmoViewcube's default `faces` prop already renders labels for all 6 cube faces (including Front/Top/Bottom/Back, satisfying SCENE-03 without custom labeling). Clicking any face/edge/corner calls an internal `tweenCamera(normal-or-position)` sourced from `useGizmoContext()` — this animates the camera automatically; no click handler needs to be written by the app. `[CITED: github.com/pmndrs/drei — src/core/GizmoViewcube.tsx, fetched this session]`.

### Pattern 2: `urdf-loader` load + manual package remapping (React/R3F)

**What:** Load the URDF via a manually-constructed `URDFLoader` (not the bare `useLoader(URDFLoader, path)` one-liner) so `loader.packages` can remap the URDF's `package://ur_description/...` mesh URIs to the actual `public/` path.
**When to use:** Always for this project — the flattened UR3e URDF's mesh `<mesh filename="package://ur_description/meshes/...">` references require this remap; without it, mesh loads will 404.
**Example:**
```tsx
// Source: pattern cross-checked from wty-andrew.github.io/misc/r3f-urdf and gkjohnson/urdf-loaders README — [CITED, WebFetch this session]
import { useEffect, useState } from 'react'
import URDFLoader, { URDFRobot } from 'urdf-loader'

function useUR3e() {
  const [robot, setRobot] = useState<URDFRobot>()
  useEffect(() => {
    const loader = new URDFLoader()
    loader.packages = { ur_description: '/robots/ur3e' } // remaps package:// URIs served from public/
    loader.load('/robots/ur3e/ur3e.urdf', (r) => setRobot(r))
  }, [])
  return robot
}

function RobotModel() {
  const robot = useUR3e()
  useEffect(() => {
    if (!robot) return
    // D-08: apply the "ready" pose, NOT all-zero, for display
    robot.setJointValue('shoulder_pan_joint', readyPose.shoulderPan)
    robot.setJointValue('shoulder_lift_joint', readyPose.shoulderLift)
    // ...remaining 4 joints
  }, [robot])
  return robot ? <primitive object={robot} /> : null
}
```
`urdf-loader`'s default mesh loader supports both `.stl` (via `STLLoader`) and `.dae` (via `ColladaLoader`) internally, both bundled from `three/examples/jsm` inside `urdf-loader` itself — **no additional mesh-loading dependency is required** beyond the `three` peer (`>=0.152.0`, satisfied by 0.185.1). `[CITED: github.com/gkjohnson/urdf-loaders — src/URDFLoader.js, fetched this session]`.

### Pattern 3: Rail as a prepended transform, robot as its child (not part of the URDF)

**What:** The rail (track + carriage) is scene-graph geometry the project builds itself (per D-02, D-07); the URDF-loaded `URDFRobot` is nested as a child of the carriage `group`, whose `position.x` is set to the center of the rail's travel range for this phase's static pose (D-09).
**When to use:** Always — the official UR3e URDF has no rail joint; the rail is an external axis this project models separately (matches `ARCHITECTURE.md`'s "prepended prismatic joint" approach, which for Phase 1's *static* pose is just a fixed offset, not yet an animated DOF).
**Example:**
```tsx
const RAIL_TRAVEL = { min: -1.5, max: 1.5 } // meters; placeholder until Phase 5/8 calibration — Claude's discretion per CONTEXT.md
const railCenterX = (RAIL_TRAVEL.min + RAIL_TRAVEL.max) / 2 // D-09: center of travel

function RailRig() {
  return (
    <group>
      {/* track + end-stop meshes at RAIL_TRAVEL.min / RAIL_TRAVEL.max — D-07 */}
      <group position={[railCenterX, 0, 0]}>
        <RobotModel />
      </group>
    </group>
  )
}
```

### Anti-Patterns to Avoid

- **Trusting `urdf-loader`'s internal rendering transforms as the project's "forward kinematics":** `urdf-loader` renders correctly from URDF joint definitions, but Pitfall 1 requires the project's *own* DH-parameter FK implementation (used later for IK/telemetry) to be independently unit-tested. Do not skip writing `forward-kinematics.ts` just because the robot "looks right" in the URDF-rendered scene — visual plausibility is explicitly called out as insufficient verification.
- **Letting the Vite scaffold silently pull `vite@8.x` + `@vitejs/plugin-react@6.x`:** `npm create vite@latest` may default to current `latest` tags. Explicitly re-pin per the Installation block above immediately after scaffolding, before writing any app code.
- **Parsing xacro at runtime in the browser:** per STACK.md's explicit "What NOT to Use" — use the pre-flattened URDF from `Daniella1/urdf_files_dataset` (or a local one-time `xacro` run), never `urdf-loader`'s `XacroParser` at runtime.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| URDF/mesh parsing and joint-to-mesh transform pipeline | A custom URDF XML parser + Three.js scene-graph builder | `urdf-loader` | Mature (NASA JPL origin), handles `.dae`/`.stl` loading, joint types, and `package://` remapping — reimplementing this is pure risk with zero payoff for an interview timeline |
| Camera nav cube / view-preset gizmo | Custom raycasted cube mesh with manual camera tweening | drei `GizmoHelper` + `GizmoViewcube` | Ships exactly the Fusion-360-style interaction (click face → animated snap) out of the box; hand-rolling this is a multi-hour side quest for a UI element that's supposed to be secondary polish |
| Camera orbit/pan/zoom | Custom mouse-event camera rig | drei `OrbitControls` | Standard, battle-tested, one prop (`makeDefault`) away from full nav-cube integration |

**Key insight:** Everything in this phase's 3D-interaction surface (orbit, nav cube, robot mesh loading) has a mature, purpose-built drei/urdf-loader solution. The only thing this project should hand-roll is the DH math itself — because no equivalent well-maintained UR-specific library exists (confirmed in `STACK.md`), and because that math is the thing later phases' IK depends on being independently correct, not just "looks right in a loaded URDF."

## DH Parameters & FK Reference Pose (Pitfall 1 — mandatory unit test)

The official UR3e DH table (already present in `ARCHITECTURE.md`) was independently re-verified this session directly against the Universal Robots developer page, **and cross-checked a second, independent way** — against the joint `<origin>` offsets baked into the flattened UR3e URDF file (`Daniella1/urdf_files_dataset`). Both sources agree exactly:

| Joint (i) | a [m] | d [m] | alpha [rad] | Cross-check (URDF joint origin offset, m) |
|---|---|---|---|---|
| 1 (shoulder pan) | 0 | 0.15185 | π/2 | `shoulder_pan_joint` origin z = 0.15185 |
| 2 (shoulder lift) | -0.24355 | 0 | 0 | `elbow_joint` origin x = -0.24355 (link-2 length) |
| 3 (elbow) | -0.2132 | 0 | 0 | `wrist_1_joint` origin x = -0.2132 (link-3 length) |
| 4 (wrist 1) | 0 | 0.13105 | π/2 | `wrist_1_joint` origin z = 0.13105 |
| 5 (wrist 2) | 0 | 0.08535 | -π/2 | `wrist_2_joint` origin y = -0.08535 |
| 6 (wrist 3) | 0 | 0.0921 | 0 | `wrist_3_joint` origin y = 0.0921 |

`[VERIFIED: universal-robots.com/articles/ur/application-installation/dh-parameters-for-calculations-of-kinematics-and-dynamics/ — fetched this session, table quoted matches exactly]` cross-checked against `[CITED: raw.githubusercontent.com/Daniella1/urdf_files_dataset/.../ur3e.urdf — fetched this session]`.

```typescript
// kinematics/ur3e-dh.ts — values verified this session against two independent sources (see above)
export const UR3E_DH = [
  { a: 0,        d: 0.15185, alpha:  Math.PI/2 },
  { a: -0.24355, d: 0,       alpha:  0         },
  { a: -0.2132,  d: 0,       alpha:  0         },
  { a: 0,        d: 0.13105, alpha:  Math.PI/2 },
  { a: 0,        d: 0.08535, alpha: -Math.PI/2 },
  { a: 0,        d: 0.0921,  alpha:  0         },
] as const;
```

### FK reference pose for the mandatory unit test

Using the **standard DH transform convention** `T_i = Rot_z(θ_i) · Trans_z(d_i) · Trans_x(a_i) · Rot_x(α_i)`, chained base→flange, this session computed the home pose (all six joint angles = 0) via a small Node.js matrix-multiplication script (not hand arithmetic alone — script output included below for auditability):

```
Home pose (θ = [0,0,0,0,0,0]) T_flange:
[ 1, 0, 0, -0.45675 ]
[ 0, 0, -1, -0.22315 ]
[ 0, 1, 0, 0.0665 ]
[ 0, 0, 0, 1 ]

TCP position (x, y, z) = (-0.45675, -0.22315, 0.0665) m
```

`[VERIFIED: computed this session via a standalone Node.js matrix script against the DH table above]`. A second sanity pose (`θ2 = -π/2`, shoulder lifted) was also computed and produces TCP `z ≈ 0.6086 m` — a physically plausible rise consistent with the UR3e's published ~0.5 m reach, which is a useful secondary sanity check but not itself an authoritative reference value.

```typescript
// kinematics/forward-kinematics.test.ts — Pitfall 1's mandatory reference-pose test
import { describe, it, expect } from 'vitest';
import { forwardKinematics } from './forward-kinematics';

describe('forwardKinematics', () => {
  it('matches the known home-pose (all-zero joints) TCP position', () => {
    const T = forwardKinematics([0, 0, 0, 0, 0, 0]);
    expect(T.tcpPosition.x).toBeCloseTo(-0.45675, 5);
    expect(T.tcpPosition.y).toBeCloseTo(-0.22315, 5);
    expect(T.tcpPosition.z).toBeCloseTo(0.0665, 5);
  });
});
```

**Important scope note (D-08):** this all-zero pose is the *test* pose only. The phase's *displayed* pose is a distinct, slightly-bent "ready" pose (Claude's discretion on exact angles per CONTEXT.md) — do not confuse the two. Run the FK unit test against zero; render the ready pose in the 3D scene.

### Joint limits — a discrepancy worth flagging to the planner

Two sources disagree slightly on joint limits, and this should be resolved explicitly rather than silently picking one:

- `[CITED: universal-robots.com/manuals — Joint Limits page, fetched this session, general text only]`: UR3e's default joint range is documented in community/manual sources as **±360° for joints 1, 2, 4, 5** (base/shoulder/wrist1/wrist2), with **wrist 3 defaulting to ±363°** (extendable to unrestricted/infinite).
- `[CITED: raw.githubusercontent.com/Daniella1/urdf_files_dataset — ur3e.urdf, fetched this session, exact XML quoted]`: the flattened URDF encodes **`elbow_joint` (joint 3) limit as ±π (±180°)** — narrower than the other 5 joints, which are all encoded as ±2π (±360°) in that file.

`ARCHITECTURE.md`'s placeholder `UR3E_JOINT_LIMITS` array assumed a uniform ±2π across all joints — **this is now known to be wrong for joint 3** per the URDF's own encoding. Recommend hardcoding per-joint limits (D-04) using the URDF-sourced values (±2π for joints 1,2,4,5,6; ±π for joint 3/elbow) since that's the model actually being rendered, and flag the wrist-3 ±363°-vs-±360° distinction as a `[ASSUMED]` low-stakes detail (safe to treat as ±2π/unrestricted for this phase, since no IK/limit-checking UI exists yet — Phase 3/4 own that per `ARCHITECTURE.md`'s build order).

```typescript
// kinematics/ur3e-dh.ts — joint limits, corrected per URDF cross-check this session
export const UR3E_JOINT_LIMITS = [
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 1 shoulder_pan
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 2 shoulder_lift
  { min: -Math.PI,     max: Math.PI     }, // 3 elbow — narrower, verified via URDF this session
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 4 wrist_1
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 5 wrist_2
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 6 wrist_3
] as const;
```

## Common Pitfalls

### Pitfall 1: Wrong or ambiguous DH parameter convention (Critical — this phase owns the fix)

**What goes wrong:** A DH table copied from a generic tutorial (wrong convention, or right numbers with the wrong transform formula) produces a robot that looks plausible but places the TCP wrong.
**Why it happens:** UR's own documentation and third-party sources are inconsistent about standard-vs-modified DH terminology.
**How to avoid:** Already mitigated by this research — the DH table and home-pose reference above were independently cross-verified against two sources this session (official UR page + independent URDF). Implement `forwardKinematics()` using the exact standard-DH formula shown above, and assert against the computed reference pose in a Vitest test **before** wiring FK to any 3D rendering.
**Warning signs:** Rendered arm looks "close enough" but computed joint-space numbers disagree with the reference pose at the all-zero configuration.
**Phase to address:** This phase (Phase 1), before any UI work on top of it — per `PITFALLS.md`.

### Pitfall 15: Deployment left until the end (Critical — this phase's literal first step)

**What goes wrong:** Deployment is treated as a final afterthought; production-build-only issues (asset paths, bundle size, CORS on loaded URDF meshes) surface with no time left to fix them.
**Why it happens:** "It's just a static React app" until WebGL/asset-loading production quirks prove otherwise.
**How to avoid:** Per D-11, create the GitHub repo and connect Vercel **before** any feature code — push the bare Vite scaffold first, confirm the production build (`vite build` + Vercel deploy) actually loads in a browser, THEN start feature work. Redeploy after every meaningful chunk of work (this phase and every phase after).
**Warning signs:** No live URL exists by the time feature work is underway.
**Phase to address:** This phase, step 0.

### Pitfall (new, this session): `package://` URI mesh 404s if `loader.packages` isn't set

**What goes wrong:** The flattened UR3e URDF's `<mesh filename="package://ur_description/meshes/...">` references will silently fail to resolve if `urdf-loader` isn't told how to remap `package://` URIs to the actual `public/` directory structure — the robot loads with missing/invisible geometry (or throws a fetch 404 in the console) even though the URDF file itself parses fine.
**Why it happens:** `package://` is a ROS-ism with no browser-native meaning; `urdf-loader` needs an explicit `loader.packages = { ur_description: '/robots/ur3e' }` mapping (see Pattern 2) matching wherever the meshes actually live under `public/`.
**How to avoid:** Use the manual `URDFLoader` instantiation pattern (not the bare `useLoader(URDFLoader, path)` one-liner) so `loader.packages` can be set before `.load()` is called. Verify visually (meshes render, not just "no console error") after first load.
**Warning signs:** Robot renders as bare/primitive joints with no visual mesh geometry, or network tab shows 404s for `package://`-prefixed paths.
**Phase to address:** This phase, when first wiring `RobotModel.tsx`.

## Code Examples

### Vercel deployment (GitHub-connected, zero-config)

```
# Source: cross-checked WebSearch of Vercel's own docs (vercel.com/docs/git/vercel-for-github) — [CITED]
1. Push the scaffolded repo to a new GitHub repo (git init already exists; create repo on GitHub, `git remote add origin <url>`, `git push -u origin master`)
   Note: current local branch is `master` (confirmed via `git branch` this session), not `main` — either
   works with Vercel, but consider renaming to `main` for convention if the executor prefers.
2. In Vercel dashboard: "Add New Project" → Import the GitHub repo → Vercel auto-detects the Vite
   framework preset (build command `vite build`, output directory `dist`) → Deploy.
3. Every subsequent `git push` to the connected branch triggers an automatic rebuild + redeploy;
   pushes to other branches/PRs get their own preview URLs.
4. No `vercel.json` needed for this phase — plain client-side SPA, no server routes, no client-side
   router yet (Zustand tab-state per STACK.md, not react-router).
```

`[CITED: vercel.com/docs/git/vercel-for-github, WebSearch this session]`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `npm create vite@latest` defaulting to whatever majors are current | Explicitly re-pin Vite + `@vitejs/plugin-react` immediately after scaffold | Ongoing — Vite 8.x and `@vitejs/plugin-react` 6.x are the current `latest` tags as of this session (Aug 2026) | Scaffold command will likely pull versions this project deliberately avoids; the Installation block above is the corrective step |
| three.js requiring `@types/three` unconditionally | Recent three.js versions increasingly ship native types | Ongoing, not fully confirmed for 0.185.1 this session | `[ASSUMED]` — install `@types/three` per STACK.md regardless; low risk either way |

**Deprecated/outdated:** None specific to this phase beyond the TS 7.0/Vite 8.x avoidance already covered above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The specific reason CLAUDE.md avoids Vite 8.x (beyond "pin 6.x/7.x, confirm against plugin peer ranges") was not independently re-verified this session — inherited as a locked project instruction. | Standard Stack — Core | If Vite 8.x is actually fine, this only costs a slightly older (still current, still supported) build tool version — low risk either way. |
| A2 | `@types/three` may be partially redundant with three@0.185.1's own shipped types — not confirmed either way this session. | Standard Stack — Supporting | Worst case: harmless duplicate/conflicting type declarations, fixed by removing `@types/three` if TS reports conflicts. Not a functional risk. |
| A3 | UR3e wrist-3 joint's "±363° default, extendable to unrestricted" software limit (from a UR manual page, general text only, not a quoted numeric table) was not cross-checked against the official PDF datasheet (attempted fetch this session returned binary/unparseable content). | DH Parameters & FK Reference Pose — Joint limits discrepancy | Low risk for Phase 1 (no limit-checking UI exists yet); relevant again in Phase 3/4 when IK/limit-checking is built — re-verify against the datasheet PDF at that point using a PDF-capable reader, not WebFetch. |
| A4 | Rail travel range (`RAIL_TRAVEL.min/max = -1.5/1.5`) shown in the code example is a placeholder value, not a sourced spec — CONTEXT.md leaves exact rail dimensions to Claude's discretion. | Architecture Patterns — Pattern 3 | None — explicitly flagged as a placeholder in the code comment; the planner/executor should pick any reasonable value, no correctness risk. |

## Open Questions

1. **Exact rail physical travel range (meters)**
   - What we know: CONTEXT.md leaves this to Claude's discretion; no specific rail product/spec was named in the project brief.
   - What's unclear: Whether a "realistic" travel range (e.g. matching a real linear-rail product) matters for the interview narrative, or whether any plausible round number (e.g. ±1.5m) is acceptable.
   - Recommendation: Pick a plausible round number now (e.g. 3m total travel, robot centered) and document it as a placeholder constant in `kinematics/rail.ts` — this is cheap to revise later and does not block any other Phase 1 work.

2. **Exact "ready pose" joint angles for the D-08 static display pose**
   - What we know: CONTEXT.md explicitly leaves this to Claude's discretion — "slightly bent, not all-zero, not flat silhouette."
   - What's unclear: No specific reference image was given.
   - Recommendation: Pick angles that read as a natural "paused mid-operation" pose (e.g. shoulder lift ≈ -45°, elbow ≈ -60°, wrist adjustments to keep the tool roughly forward-facing) and verify visually — this is a cosmetic decision, not a correctness one, since the FK unit test targets the zero pose regardless.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev/build | ✓ | v24.19.0 | — |
| npm | package install | ✓ | 11.17.0 | — |
| git | version control | ✓ | 2.51.2.windows.1 | — |
| GitHub CLI (`gh`) | Repo creation (D-11) | ✗ | — | Create the repo via GitHub's web UI, then `git remote add origin <url>` + `git push` manually — no functional loss, just a manual step instead of `gh repo create` |
| Vercel CLI | Deploy | ✗ | — | Not needed — use Vercel's web dashboard GitHub-import flow (zero-config, no CLI required); this is the primary recommended path anyway, not a fallback-of-last-resort |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `gh` CLI (manual GitHub web UI repo creation), Vercel CLI (Vercel web dashboard import — actually the primary recommended flow, not a degraded fallback).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (current stable — not yet installed, this phase installs it) |
| Config file | none yet — Wave 0 creates `vitest.config.ts` (or reuses `vite.config.ts` via `test` key, Vitest's standard pattern) |
| Quick run command | `npx vitest run kinematics/forward-kinematics.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| SCENE-04 | Forward kinematics matches the known home-pose reference TCP position | unit | `npx vitest run kinematics/forward-kinematics.test.ts -t "home-pose"` | ❌ Wave 0 |
| SCENE-01 | Camera orbit/pan/zoom functions | manual (visual) | n/a — `OrbitControls` is a well-tested drei primitive; verify by interacting with the deployed scene | n/a |
| SCENE-02 | Camera reset returns to centered view | manual (visual) | n/a — small enough interaction to verify by clicking the reset control | n/a |
| SCENE-03 | Nav cube syncs to camera and snaps view on click | manual (visual) | n/a — drei's `tweenCamera` behavior is internal library code, not project logic worth unit-testing | n/a |
| DEPLOY-01 | Source on GitHub | manual (verification) | `git remote -v` shows a GitHub origin; repo is visible on github.com | n/a |
| DEPLOY-02 | Publicly reachable, stays in sync | manual (verification) | Visit the Vercel URL after a `git push`; confirm the change appears | n/a |

### Sampling Rate

- **Per task commit:** `npx vitest run kinematics/forward-kinematics.test.ts`
- **Per wave merge:** `npx vitest run` (full suite — trivial size this phase, just the FK test)
- **Phase gate:** Full suite green, plus the 5 manual/visual checks above, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` or `vite.config.ts` `test` block — framework install: `npm install -D vitest`
- [ ] `kinematics/forward-kinematics.test.ts` — covers SCENE-04's FK correctness requirement (Pitfall 1)
- [ ] No shared fixtures needed yet — this phase's only test is the single home-pose assertion above

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|--------------------|
| V2 Authentication | No | No auth surface exists in this project (client-side-only SPA, no accounts per `PROJECT.md`'s explicit out-of-scope list) |
| V3 Session Management | No | No sessions/backend |
| V4 Access Control | No | No multi-user/access boundaries |
| V5 Input Validation | Marginal | The only "input" in Phase 1 is static asset loading (URDF/mesh files bundled at build time, not user-uploaded) — no runtime input validation surface yet. G-code file upload (where real input validation matters) is Phase 2, not this phase. |
| V6 Cryptography | No | No secrets, no crypto operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Loading meshes from a `public/` bundle (not user-controlled) | n/a | No injection surface — assets are build-time, developer-controlled, not user input. Not a concern this phase. |

**Note:** This phase has essentially no attack surface — it is a static, build-time-asset-only 3D viewer with no user input, no auth, no network calls beyond static asset fetches from the same origin. Security-relevant surface (g-code file upload/parsing) begins in Phase 2 and should get a fuller ASVS pass at that point.

## Sources

### Primary (HIGH confidence — direct tool verification this session)
- `npm view` (registry.npmjs.org) — exact versions for react, vite, typescript, three, @react-three/fiber, @react-three/drei, urdf-loader, zustand, @vitejs/plugin-react, @types/three, eslint, typescript-eslint, prettier, vitest — fetched 2026-08-13.
- `gsd_run query package-legitimacy check` — full legitimacy audit for all 15 Phase 1 packages — run 2026-08-13.
- Node.js matrix-multiplication script (this session) — computed the home-pose FK reference TCP position from the verified DH table.
- `git remote -v`, `git branch`, `git status` (this session) — confirmed no GitHub remote exists, current branch is `master`.
- `node --version`, `npm --version`, `git --version` (this session) — environment availability.

### Secondary (MEDIUM confidence — official docs fetched and quoted directly this session)
- Universal Robots, official DH parameters page — https://www.universal-robots.com/articles/ur/application-installation/dh-parameters-for-calculations-of-kinematics-and-dynamics/ — fetched and table quoted this session, matches `ARCHITECTURE.md` exactly.
- `Daniella1/urdf_files_dataset` — flattened UR3e URDF — https://raw.githubusercontent.com/Daniella1/urdf_files_dataset/main/urdf_files/ros-industrial/xacro_generated/universal_robots/ur_description/urdf/ur3e.urdf — fetched and joint/mesh/limit data quoted this session; independently cross-validates the official DH table.
- `gkjohnson/urdf-loaders` — README and `URDFLoader.js` source — https://github.com/gkjohnson/urdf-loaders — fetched this session for `packages` remapping, default mesh loader (.stl/.dae) support, and `setJointValue` API.
- `pmndrs/drei` — `GizmoViewcube.tsx` source — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/GizmoViewcube.tsx — fetched this session for click-to-snap behavior and prop shape.
- Vercel official docs — https://vercel.com/docs/git/vercel-for-github — WebSearch-surfaced and cross-checked this session for GitHub-connected auto-deploy behavior.
- Universal Robots manual — Joint Limits page — https://www.universal-robots.com/manuals/EN/HTML/SW5_21/Content/prod-usr-man/complianceUR3e/H_g5_sections/firstuse/Joint_limits_g5_en.htm — fetched this session, general text only (no numeric table extracted from this page directly; numeric figures came via WebSearch summary of related sources).

### Tertiary (LOW confidence — WebSearch summaries, not independently fetched/quoted)
- WebSearch: `@react-three/drei` GizmoHelper/GizmoViewcube usage examples (multiple sources aggregated).
- WebSearch: `urdf-loader` + React Three Fiber integration patterns (wty-andrew.github.io, GitHub gists) — corroborated by the direct `URDFLoader.js` source fetch, raising effective confidence for the specific claims that were cross-checked.
- WebSearch: UR3e joint range limits (±360°/±363° figures) — not independently re-fetched from the official PDF datasheet (attempted fetch returned unparseable binary content this session) — see Assumption A3.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number directly tool-verified via `npm view` this session, not carried over from training data.
- DH parameters / FK reference pose: HIGH — cross-verified against two independent sources (official UR page + independent URDF) and computed via a standalone verification script, not hand arithmetic alone.
- urdf-loader/drei integration patterns: MEDIUM — cross-checked against library source code directly (not just blog posts), but React-specific usage patterns come from community examples rather than an official React integration guide (none exists).
- Deployment flow: MEDIUM — standard, well-documented Vercel behavior, WebSearch-sourced rather than a direct fetch of Vercel's docs page content.
- Joint limits: MEDIUM — the elbow-joint ±π discrepancy is a directly-quoted URDF fact (HIGH for that specific claim); the wrist-3 ±363° figure is WebSearch-summarized, not independently re-verified against the primary PDF datasheet (LOW for that specific sub-claim, logged as Assumption A3).

**Research date:** 2026-08-13
**Valid until:** ~30 days for the stack/deployment findings (fast-moving npm ecosystem, `latest` tags will have moved on); DH parameters and the flattened URDF source are effectively permanent (physical robot geometry does not change) — no expiry concern for those.

---
*Phase 1 research — Static Rig + Kinematics Foundation*
*Researched: 2026-08-13*
