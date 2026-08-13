# Stack Research

**Domain:** Browser-based 3D robotic cell control/simulation interface (UR3e on a 7th linear-rail axis, print/mill toolpath playback)
**Researched:** 2026-08-13
**Confidence:** MEDIUM-HIGH (framework/library choices HIGH — verified against npm registry directly; robot-kinematics specifics MEDIUM — cross-checked web sources, no single authoritative package)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.8 | UI framework | De facto standard for component-heavy dashboards with many tabs (Dashboard/Vision/Calibrate/Setup/Optimization/I-O); largest ecosystem, most Stack-Overflow/AI-assistant coverage for fast building under time pressure. |
| Vite | 6.x (pin, NOT the npm `latest` 8.2.1 — see note below) | Build tool / dev server | Instant HMR, zero-config TS+React template (`npm create vite@latest -- --template react-ts`), fastest path from zero to running app for a multi-day build. Confirm the exact 6.x/7.x point release against `@react-three/fiber` and plugin peer ranges at project init (`npm create vite@latest` will pick a sane current default) rather than blindly taking the newest major. |
| TypeScript | **5.9.3** (NOT the npm `latest` 7.0.2) | Type safety | TS 7.0 (the new Go-native "Project Corsa" compiler) went GA July 2026 but `typescript-eslint`/ESLint tooling compatibility is still broken as of Aug 2026 (see What NOT to Use). TS 5.9.3 is the stable, fully-tooled LTS-equivalent line — the safe choice for a tight-deadline project where debugging toolchain breakage is time you don't have. |
| Three.js | 0.185.x | WebGL 3D engine | Underlies both the rendering and the URDF robot loading; pin whatever `@react-three/fiber`'s peer range resolves to (fiber 9.x tracks recent three releases closely). |
| React Three Fiber (`@react-three/fiber`) | 9.7.0 | React renderer for Three.js | Wraps Three.js as React components with no meaningful perf penalty vs vanilla Three — but gives declarative scene graph, automatic resize/dispose handling, and trivial state-sync between React (tabs, telemetry panels) and the 3D scene. For a UI this component-heavy (6+ tabs reacting to shared robot/playback state), hand-rolling the imperative Three.js render loop and manually bridging it to React state would burn days you don't have. Confidence: MEDIUM (cross-checked across multiple 2026 comparison articles, consistent conclusion). |
| `@react-three/drei` | 10.7.8 | R3F helper components | Ships `OrbitControls`, `GizmoHelper` + `GizmoViewcube` (a ready-made Fusion-360-style navigation cube that syncs to the camera via `makeDefault` on `OrbitControls` — directly satisfies the "navigation cube that rotates in sync with the camera" requirement out of the box), `PerspectiveCamera`, `Line`/`Line2` (for toolpath polylines with per-segment color), `Html`, and `Stats`. Avoids reimplementing camera rigs and gizmos from scratch. |

### Robot Model & Kinematics

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `urdf-loader` | 0.13.1 | Load UR3e URDF + meshes into the Three.js/R3F scene | Purpose-built, mature (originated at NASA JPL, Apache-2.0, actively published on npm), returns a `URDFRobot` (extends `THREE.Object3D`) with `setJointValue(name, angle)` per joint. Confirmed integration pattern with R3F via `useLoader`/`primitive` in multiple community references. This is **forward-kinematics/visualization only** — it does not solve IK. Confidence: MEDIUM. |
| UR3e URDF asset | from `UniversalRobots/Universal_Robots_ROS2_Description` (official) | Robot geometry, joint limits, DH-consistent joint chain, and visual meshes | This is the canonical, Universal-Robots-maintained source (`ur_type:=ur3e`). It's xacro (parametrized), so **generate the flat URDF + copy meshes into `public/` once during setup** (either run `xacro` locally with a throwaway Python/ROS environment, or use a pre-generated flat `ur3e.urdf` from `Daniella1/urdf_files_dataset` or `automaticaddison/ur_robotiq` to skip the xacro toolchain entirely). Do NOT parse xacro at runtime in the browser — `urdf-loader`'s `XacroParser` can do it, but it adds fragility and load time you don't need when a one-time offline conversion is trivial. |
| Hand-rolled analytical IK (custom TS module) | n/a — you write this | Convert G-code Cartesian TCP targets into the 6 joint angles the robot must hold at each toolpath point | **No mature, well-maintained JS/TS library provides UR-specific 6-DOF inverse kinematics.** The one candidate found (`glumb/kinematics`, a generic 6-DOF JS IK lib) has an unusual, unverified kinematic-chain constraint, sparse recent activity, and no UR-specific validation — too risky to trust blind for an interview deliverable. The standard, well-documented approach for UR-series arms is the **closed-form analytical IK solution** (originally published by Hawkins, 2013, "Analytic Inverse Kinematics for the Universal Robots UR-5/UR-10 Arms") derived directly from the UR DH parameters — it's a known, ported-many-times algorithm (many open Python/C++/MATLAB reference implementations exist to port from) and is fast/deterministic (no iterative solver, no convergence risk), which matters for smooth playback scrubbing. Given the UR3e shares the same DH structure (non-spherical wrist, offset d4) as UR5/UR10, the same closed-form derivation applies with UR3e's own DH constants. Confidence: MEDIUM (well-established in the CNC/robotics community; verify DH constants against the official UR3e datasheet before implementing). |
| UR3e DH parameters | from Universal Robots' official specs / ROS `ur_description` `default_kinematics.yaml` | Link lengths/offsets/angles feeding both FK (sanity-check against urdf-loader) and the hand-rolled IK | Pull the authoritative numbers from the official UR3e support page or the `Universal_Robots_ROS2_Description` `config/ur3e/default_kinematics.yaml` — don't trust numbers copied from third-party blog posts without cross-referencing the official source, since transcription errors in DH tables are a common, hard-to-detect source of kinematic bugs (flag for phase-specific deeper research). |

### G-code Parsing / Toolpath Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `gcode-toolpath` | 3.0.0 | Turn parsed G-code into a toolpath (sequence of moves with type + start/end coordinates) | Purpose-built for exactly this job: exposes `addLine`/`addArcCurve` callbacks carrying the **modal state** (motion type: G0 rapid, G1 linear/cut, G2/G3 arc) plus start (`v1`) and end (`v2`) vectors for each segment — directly maps to the "color-code by move type" and "distinct start/end points per operation" requirements without you having to write a G-code state machine from scratch. Built on top of `gcode-parser`. Part of the mature, widely-used `cncjs` project ecosystem (real-world CNC sender), so its move-classification logic has been battle-tested against real G-code dialects, not just toy examples. |
| `gcode-parser` | 2.2.0 | Low-level G-code tokenizing (used internally by `gcode-toolpath`, usable standalone if you need raw line-by-line access) | Underlying parser; only add as a direct dependency if you need custom line-level processing beyond what `gcode-toolpath`'s callbacks expose (e.g. custom milling-depth-of-engagement logic per the "toolpath color changes with depth of cut" requirement, which is domain logic you'll layer on top regardless of parser choice). |

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zustand | 5.0.15 | App-level state: active tab, playback state (play/pause/scrub position), loaded toolpath/operations tree, setup/calibration config, simulated telemetry snapshot | Zustand has overtaken Redux in raw npm downloads through 2025-2026 and needs a fraction of the boilerplate for a project this size — one or a few small stores (e.g. `usePlaybackStore`, `useCellStore`) instead of actions/reducers/selectors ceremony. Crucially: it works cleanly both inside and outside the R3F render tree (unlike React Context, which can't easily be read from imperative code), so the same store can drive tab UI, the operations tree, and Three.js scene updates. Confidence: MEDIUM. |
| React Three Fiber's `useFrame` (no extra library) | — | Per-frame playback advance (robot pose, TCP position along toolpath) and telemetry values derived every animation tick | **Do not** push per-frame values (joint angles, TCP position, speed) through Zustand/React state — that forces a React re-render every frame and will tank performance once the scene, operations tree, and dashboard are all mounted. Drive continuous animation via `useFrame` mutating Three.js objects/refs directly (imperative), and only write to Zustand at a coarser cadence (e.g. throttled telemetry snapshot for the Dashboard tab, or on scrub/pause). This is the standard R3F performance pattern and is the single most important architectural decision for keeping playback smooth. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-three/drei` `Line`/`Line2` (from `three/examples/jsm/lines`) | bundled with drei | Thick, per-segment-colorable toolpath polylines | Standard Three.js `Line` (via `THREE.LineBasicMaterial`) can't vary width reliably across browsers/GPUs; `Line2`/`LineSegments2` (fat lines) is the accepted way to get visible, colorable toolpath strokes. Use drei's `<Line>` wrapper to avoid the raw geometry boilerplate. |
| `leva` | latest (optional) | Quick debug/tweak panels during development (e.g. tuning IK, camera, colors) | Nice-to-have dev-time tool, not shipped to users; only add if you find yourself hand-editing constants repeatedly. Skip if time is tighter than expected — it's a convenience, not a requirement. |
| `react-router` (or a simple tab-state switch in Zustand) | 7.x if used | Routing between Printing/Milling modes and the left-side tabs | Given the tab structure described in PROJECT.md is more "panel switching within one page" than "distinct routes," a simple Zustand `activeTab` string is likely sufficient and faster to build than wiring a router. Only reach for `react-router` if you want shareable/bookmarkable URLs per tab — a nice-to-have, not core value. |
| ESLint + `typescript-eslint` (flat config) + Prettier | current stable, paired to TS 5.9.x | Linting/formatting | Standard 2026 baseline; explicitly avoid pairing with TS 7.0 (see What NOT to Use). |
| Vitest | current stable | Unit tests (if time allows for kinematics/parser logic) | Pairs natively with Vite (same config, same transform pipeline) — no separate Jest config needed. Prioritize testing the hand-rolled IK math and G-code-to-toolpath mapping over UI, since those are the highest-risk-of-silent-bug areas. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server + `npm create vite@latest -- --template react-ts` | Local dev/build | Scaffolds React 19 + TS + Vite in one command; confirm the generated `package.json` pins a TS 5.9.x line, not 7.0, if the template has moved to TS 7 by the time you scaffold (check before installing). |
| GitHub | Source control (required by the assignment) | — |
| Vercel (recommended deploy target) | Static hosting + CI deploy | See Deployment section below. |

## Installation

```bash
# Scaffold (React 19 + TypeScript + Vite)
npm create vite@latest ur3e-cell-interface -- --template react-ts
cd ur3e-cell-interface

# Pin TypeScript to the stable 5.9.x line if the scaffold pulled TS 7.x
npm install -D typescript@5.9.3

# Core 3D stack
npm install three@^0.185 @react-three/fiber@^9.7 @react-three/drei@^10.7

# Robot model + kinematics scaffolding
npm install urdf-loader@^0.13

# G-code parsing / toolpath generation
npm install gcode-toolpath@^3.0 gcode-parser@^2.2

# State management
npm install zustand@^5.0

# Types
npm install -D @types/three@^0.185

# Dev tooling
npm install -D eslint typescript-eslint prettier vitest
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| React Three Fiber + drei | Raw Three.js | If the project were a single, isolated 3D canvas with no surrounding React UI state (e.g. a pure viewer with no tabs/dashboard), raw Three.js gives slightly more direct render-loop control. Not the case here — this app is tab-heavy and state-synced, which is R3F's exact sweet spot. |
| `urdf-loader` + hand-rolled analytical IK | A generic numerical IK solver (CCD/FABRIK/Jacobian-based, e.g. hand-rolled or via a general robotics IK lib) | Numerical IK is more robust to arbitrary/unknown kinematic chains and needed if you ever generalize beyond the UR3e (explicitly out of scope per PROJECT.md) or add the 7th rail axis + UR3e as one combined 7-DOF redundant chain requiring iterative resolution. For a fixed, well-documented 6-DOF UR3e (rail axis can be resolved separately as a 1-DOF positioning problem — see Architecture notes), the closed-form analytical solution is faster, deterministic, and easier to validate/debug under time pressure. |
| Zustand | Redux Toolkit | If the team/interviewer specifically expects Redux idioms, or the app were expected to grow far beyond this scope with many contributors — Redux's stricter structure pays off at larger team scale. Overkill here. |
| Zustand | React Context + `useReducer` | Fine for a much smaller app, but Context re-renders the whole subtree on any change and can't easily be read from code outside React (e.g. imperative R3F loop code), which this app needs. |
| Vercel | Netlify | Functionally near-identical for this use case (both zero-config GitHub-connected static deploys with preview URLs). Choose Netlify instead if you specifically want its form-handling or you're already in the Netlify ecosystem — no material advantage for this project either way. |
| Vercel/Netlify | GitHub Pages | Free and adequate, but requires manual `base` path configuration in `vite.config.ts` and a `404.html` SPA-redirect workaround for client-side routing; more setup friction for zero benefit when Vercel/Netlify give the same result with less configuration. Use GitHub Pages only if avoiding any third-party hosting account is a hard constraint (it isn't here). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| TypeScript 7.0.x (npm `latest` as of Aug 2026) | The new Go-native compiler (Project Corsa) went GA July 2026, but `typescript-eslint`/ESLint integration is confirmed broken as of early Aug 2026 (crashes inside `typescript-estree`, `npm ci` failures from incompatible peer ranges) — full ecosystem support isn't expected until TS 7.1 (~Oct 2026). Debugging toolchain breakage is exactly what you can't afford on a few-day timeline. | TypeScript 5.9.3 — stable, fully supported by all current tooling. |
| Hand-rolling xacro parsing at runtime in the browser for the UR3e URDF | Adds a fragile runtime dependency chain and load-time cost for a transformation that only needs to happen once. | Generate a flat `.urdf` once (locally, or use an already-flattened UR3e URDF from a dataset repo) and ship the static file + meshes in `public/`. |
| Redux (plain, without Toolkit) | High boilerplate-to-value ratio for a project this size and timeline; even the broader ecosystem is trending away from it in 2025-2026. | Zustand. |
| Driving per-frame robot/camera animation through React state/Zustand | Causes a full React re-render every animation frame once the dashboard, operations tree, and 3D scene are all subscribed — will visibly stutter as more tabs/panels are added. | Imperative updates via R3F's `useFrame` + refs; only sync to React state at UI-relevant cadence (throttled telemetry, pause/scrub events). |
| Trusting an unverified/community-sourced UR3e DH parameter table pulled from a random blog post | DH transcription errors are a well-known, hard-to-detect source of kinematic bugs (wrong joint offsets silently produce a plausible-looking but incorrect arm pose). | Pull DH/kinematics constants from the official `Universal_Robots_ROS2_Description` `default_kinematics.yaml` or Universal Robots' own published specs. |
| `glumb/kinematics` (or similar unmaintained generic JS IK libs) as a blind drop-in for UR3e IK | Unclear/unverified kinematic-chain constraints, sparse maintenance activity, no UR-specific validation — risk of silently wrong results that are expensive to debug during an interview timeline. | Hand-rolled closed-form analytical IK using UR3e's own DH parameters (well-documented algorithm family), validated against `urdf-loader`'s FK for known test poses. |

## Stack Patterns by Variant

**If time runs critically short (per PROJECT.md's explicit fallback: 3D toolpath simulation must not fail, other tabs can thin out):**
- Keep the full 3D/R3F/urdf-loader/IK/gcode-toolpath stack as-is — this is the non-negotiable core.
- Drop `leva`, skip Vitest coverage beyond the kinematics/parser math, and implement remaining tabs (Vision, Optimization, I/O) as simpler static/read-only panels backed by the same Zustand store rather than fully interactive controls.

**If the 7th linear-rail axis needs to be resolved jointly with the UR3e's 6 joints (redundant 7-DOF chain) rather than as a separate 1-DOF pre-positioning step:**
- The closed-form analytical 6-DOF IK no longer directly applies to the combined chain; you'd need to either (a) fix a rail position per operation and solve the remaining 6-DOF analytically (recommended — matches how UR cells with rails are typically programmed: the rail is positioned, then the arm executes), or (b) fall back to a numerical/iterative solver for the full 7-DOF redundant system. Recommend (a) for this timeline — it's simpler and matches real-world UR rail-cell programming practice.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@react-three/fiber@9.7.0` | `react@19.x`, `three@^0.180+` | Fiber 9.x targets React 19; confirm peer-dependency ranges at install time since both `three` and `@react-three/fiber` ship frequently. |
| `urdf-loader@0.13.1` | `three@^0.15x+` (wide range) | Loader returns a plain `THREE.Object3D` subclass, so it's not tightly version-locked to a specific Three.js release; still worth smoke-testing after any Three.js bump. |
| TypeScript `5.9.3` | ESLint 9.x flat config, `typescript-eslint` current | This is the "known-good" pairing as of Aug 2026; re-verify before upgrading to TS 7.x once TS 7.1 (~Oct 2026) lands full ecosystem support. |
| Vite | React 19 + `@vitejs/plugin-react` current | Standard, no known friction; use whatever version `npm create vite@latest` scaffolds rather than force-pinning to the very latest major unless a specific plugin requires it. |

## Sources

- npm registry (direct `registry.npmjs.org` lookups for `three`, `@react-three/fiber`, `@react-three/drei`, `urdf-loader`, `vite`, `react`, `typescript`, `zustand`, `gcode-parser`, `gcode-toolpath`) — HIGH confidence, primary source for exact version numbers, fetched 2026-08-13.
- WebSearch: "React Three Fiber vs raw Three.js" comparison articles (multiple, cross-checked) — MEDIUM confidence.
- WebSearch: `urdf-loader` / `gkjohnson/urdf-loaders` (GitHub, npm) — MEDIUM confidence; WebFetch of the repo README corroborated npm findings.
- WebSearch: UR3e URDF sources (`UniversalRobots/Universal_Robots_ROS2_Description`, `Daniella1/urdf_files_dataset`, `automaticaddison/ur_robotiq`) — MEDIUM confidence.
- WebSearch: `glumb/kinematics` + WebFetch of its README — MEDIUM confidence; insufficient to recommend as primary IK solution, informed the "hand-roll from DH parameters" recommendation.
- WebSearch: `gcode-toolpath`/`gcode-parser` (npm, GitHub `cncjs/gcode-toolpath`) — MEDIUM confidence.
- WebSearch: TypeScript 7.0 GA + ecosystem compatibility (multiple independent Aug 2026 articles, consistent finding of `typescript-eslint` breakage) — MEDIUM confidence, cross-checked across 3+ independent sources.
- WebSearch: Zustand vs Redux 2025-2026 adoption trends — MEDIUM confidence.
- WebSearch: Vercel vs Netlify vs GitHub Pages for static React/Three.js deployment — MEDIUM confidence.
- WebSearch: `@react-three/drei` `GizmoHelper`/`GizmoViewcube` docs and usage — MEDIUM confidence.

---
*Stack research for: Browser-based 3D robotic cell control/simulation interface*
*Researched: 2026-08-13*
