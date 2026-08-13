# Phase 1: Static Rig + Kinematics Foundation - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 12 (new)
**Analogs found (in-codebase):** 0 / 12 — **no existing codebase to map**

## Codebase Status

This is a brand-new repository. `git status` / `ls` confirm the working tree contains only `.planning/` and `.claude/` — there is no `src/`, no `package.json`, no prior implementation of any kind. There are **zero in-codebase analogs** for any file in this phase.

Per the task instructions, this PATTERNS.md does not fabricate analogs. Instead, every file below is mapped to the concrete external reference pattern already sourced and verified in `01-RESEARCH.md` (library docs/source fetched and quoted this session — drei, urdf-loader, Vercel), which the planner should treat as the "analog" for pattern-copying purposes. All excerpts below are reproduced directly from RESEARCH.md's Architecture Patterns / Code Examples sections (not re-derived) for the planner's direct use.

## File Classification

| New File | Role | Data Flow | Reference Pattern Source | Match Quality |
|----------|------|-----------|---------------------------|----------------|
| `src/kinematics/ur3e-dh.ts` | config/model (constants) | transform | RESEARCH.md "DH Parameters" section (verified table) | exact — values are the deliverable itself |
| `src/kinematics/forward-kinematics.ts` | utility (pure function) | transform | RESEARCH.md "DH Parameters" — standard DH transform chain formula | exact — algorithm fully specified |
| `src/kinematics/forward-kinematics.test.ts` | test | transform (assertion) | RESEARCH.md Code Examples — Vitest reference-pose test | exact — full test body provided |
| `src/kinematics/rail.ts` | utility (constants + helper) | transform | RESEARCH.md Pattern 3 — `RAIL_TRAVEL` + `railCenterX` | exact — pattern provided, values are placeholders (Claude's discretion) |
| `src/scene/RobotModel.tsx` | component (3D) | request-response (async load) + event-driven (joint pose apply) | RESEARCH.md Pattern 2 — `URDFLoader` + `useUR3e` hook | exact — full hook + component code provided |
| `src/scene/RailRig.tsx` | component (3D) | transform (static geometry composition) | RESEARCH.md Pattern 3 — `RailRig` composing carriage + `RobotModel` | exact — component skeleton provided |
| `src/scene/NavCube.tsx` | component (3D) | event-driven (click → camera tween) | RESEARCH.md Pattern 1 — `GizmoHelper` + `GizmoViewcube` | exact — full JSX provided |
| `src/scene/CellScene.tsx` | component (3D, composition root) | event-driven (camera controls) + transform (scene composition) | RESEARCH.md Pattern 1 + System Architecture Diagram | exact — composition order fully specified in the diagram |
| `src/store/cellStore.ts` | store (Zustand) | event-driven | RESEARCH.md Standard Stack — Zustand row; CLAUDE.md anti-pattern note (no per-frame state) | role-match — no code excerpt given, but constraints are explicit |
| `src/App.tsx` | component (app root) | request-response (mount) | RESEARCH.md Recommended Project Structure | role-match — structure only, standard Vite/R3F app-root shape |
| `vite.config.ts` / `vitest.config.ts` | config | n/a | RESEARCH.md Wave 0 Gaps + Installation block | role-match — standard Vite/Vitest scaffold config, no project-specific excerpt needed |
| Vercel/GitHub deploy steps (no file — process) | config/deploy | n/a | RESEARCH.md "Code Examples — Vercel deployment" | exact — step-by-step process provided |

## Pattern Assignments

### `src/kinematics/ur3e-dh.ts` (config, transform)

**Reference:** RESEARCH.md "DH Parameters & FK Reference Pose" section — values independently cross-verified against two sources this session (official UR page + flattened URDF).

```typescript
// kinematics/ur3e-dh.ts — values verified this session against two independent sources
export const UR3E_DH = [
  { a: 0,        d: 0.15185, alpha:  Math.PI/2 },
  { a: -0.24355, d: 0,       alpha:  0         },
  { a: -0.2132,  d: 0,       alpha:  0         },
  { a: 0,        d: 0.13105, alpha:  Math.PI/2 },
  { a: 0,        d: 0.08535, alpha: -Math.PI/2 },
  { a: 0,        d: 0.0921,  alpha:  0         },
] as const;

export const UR3E_JOINT_LIMITS = [
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 1 shoulder_pan
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 2 shoulder_lift
  { min: -Math.PI,     max: Math.PI     }, // 3 elbow — narrower, verified via URDF
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 4 wrist_1
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 5 wrist_2
  { min: -2 * Math.PI, max: 2 * Math.PI }, // 6 wrist_3
] as const;
```

**Do not** use a uniform ±2π across all joints — joint 3 (elbow) is ±π per the URDF's own encoding (RESEARCH.md flags this discrepancy explicitly).

---

### `src/kinematics/forward-kinematics.ts` (utility, transform)

**Reference:** RESEARCH.md — standard DH transform convention.

**Core pattern:** Chain `T_i = Rot_z(θ_i) · Trans_z(d_i) · Trans_x(a_i) · Rot_x(α_i)` for each of the 6 joints, base→flange, using `UR3E_DH` params combined with runtime joint angles. Function signature implied by the test file: `forwardKinematics(joints: number[]) => { tcpPosition: {x,y,z}, ... }` (likely also returns the full `Matrix4`/transform per RESEARCH's `T_flange` shape).

**Verification target (must match exactly, home pose θ=[0,0,0,0,0,0]):**
```
TCP position (x, y, z) = (-0.45675, -0.22315, 0.0665) m
```

**Anti-pattern warning (from RESEARCH.md):** Do not treat `urdf-loader`'s internal rendering transforms as this project's FK. This module must be an independent, hand-written implementation, unit-tested in isolation — even though the rendered robot may "look right," that's explicitly called out as insufficient verification (Pitfall 1).

---

### `src/kinematics/forward-kinematics.test.ts` (test, transform)

**Reference:** RESEARCH.md Code Examples — full test body provided verbatim, use as-is:

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

Test against the **all-zero** pose only — the "ready" display pose (D-08) is a separate, un-tested cosmetic value used only in `RobotModel.tsx`. Do not conflate the two.

---

### `src/kinematics/rail.ts` (utility, transform)

**Reference:** RESEARCH.md Pattern 3.

```typescript
export const RAIL_TRAVEL = { min: -1.5, max: 1.5 }; // meters; placeholder — Claude's discretion per CONTEXT.md
export const railCenterX = (RAIL_TRAVEL.min + RAIL_TRAVEL.max) / 2; // D-09: center of travel
```

Values are explicitly flagged as placeholders in RESEARCH.md (Assumption A4) — any plausible round number is acceptable; no sourced spec exists. D-09 requires the carriage sits at `railCenterX` for the static pose. D-07 requires end-stop geometry visible at `RAIL_TRAVEL.min`/`.max` in `RailRig.tsx`.

---

### `src/scene/RobotModel.tsx` (component, request-response load + event-driven pose apply)

**Reference:** RESEARCH.md Pattern 2 — full hook + component provided verbatim:

```tsx
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

**Critical pitfall (RESEARCH.md, "Pitfall — package:// URI mesh 404s"):** Must use manual `URDFLoader` instantiation (not bare `useLoader(URDFLoader, path)`) so `loader.packages` can be set **before** `.load()` is called — otherwise mesh geometry silently 404s while the URDF XML itself still parses fine. Verify visually (meshes actually render) after first load, not just "no console error."

**Suggested ready-pose values** (RESEARCH.md Open Questions #2, cosmetic only): shoulder lift ≈ -45°, elbow ≈ -60°, wrist adjustments to keep tool roughly forward-facing.

---

### `src/scene/RailRig.tsx` (component, transform/static composition)

**Reference:** RESEARCH.md Pattern 3 — full skeleton provided:

```tsx
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

The URDF-loaded robot is nested as a child of the carriage group (not part of the URDF itself — the official UR3e URDF has no rail joint). The carriage `position.x` is a fixed offset for this phase (static pose only; becomes an animated DOF in a later phase).

---

### `src/scene/NavCube.tsx` + camera wiring in `CellScene.tsx` (component, event-driven)

**Reference:** RESEARCH.md Pattern 1 — full JSX provided:

```tsx
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

`makeDefault` on `OrbitControls` is what lets `GizmoHelper` auto-discover and sync camera state — no manual `onTarget`/`onUpdate` wiring needed. `GizmoViewcube`'s default `faces` prop already covers Front/Top/Bottom/Back (SCENE-03); click-to-snap is handled internally via `tweenCamera` — no custom click handler required.

**Camera reset (SCENE-02):** Not directly code-provided in RESEARCH.md; pattern implied — store the `OrbitControls` ref + saved initial camera position/target, and have a "Reset View" action call `controls.reset()` (native to drei's `OrbitControls`) or restore the saved position/target + `controls.update()`. Wire the reset trigger through the minimal `cellStore.ts` per the architecture diagram.

---

### `src/scene/CellScene.tsx` (component, composition root)

**Reference:** RESEARCH.md System Architecture Diagram — this is the definitive composition order:

```
CellScene.tsx (R3F <Canvas>)
 ├── lights (ambient + directional)         ← D-06
 ├── floor plane                             ← D-05
 ├── RailRig.tsx
 │     ├── track mesh + end-stop geometry    ← D-07
 │     └── RailCarriage (group, position.x = center)  ← D-09
 │           └── <primitive object={urdfRobot}/>  ← D-01, D-02
 ├── OrbitControls (makeDefault)             ← SCENE-01
 └── GizmoHelper > GizmoViewcube              ← SCENE-03
```

---

### `src/store/cellStore.ts` (store, event-driven)

**Reference:** RESEARCH.md Standard Stack (Zustand row) + CLAUDE.md anti-pattern.

No direct code excerpt exists in RESEARCH.md for this phase — it's described only as "minimal Zustand store (camera-reset trigger stub; expand later phases)" holding e.g. `activeTab` placeholder. **Hard constraint from CLAUDE.md/RESEARCH.md Anti-Patterns:** do NOT push per-frame values (joint angles, TCP position) through this store — that forces a React re-render every animation tick. Only coarse, UI-relevant state (camera reset trigger, active tab stub) belongs here in Phase 1; continuous animation state (none yet this phase, since it's static) would go through `useFrame`/refs in later phases.

---

### `src/App.tsx`, `vite.config.ts`, `vitest.config.ts` (scaffold files)

No project-specific excerpt exists — these are standard `npm create vite@latest -- --template react-ts` scaffold outputs. RESEARCH.md's explicit warning: the scaffold may default to `vite@8.x` + `@vitejs/plugin-react@6.x` (current `latest` npm tags) — must be **immediately re-pinned** post-scaffold per the Installation block:

```bash
npm install -D vite@^7.3.6 @vitejs/plugin-react@^5.2.0 typescript@5.9.3
```

`vitest.config.ts` may reuse `vite.config.ts`'s `test` key (Vitest's standard pattern) rather than a separate file — RESEARCH.md leaves this as an implementation detail, not yet decided.

---

### Deployment process (no file — GitHub + Vercel steps)

**Reference:** RESEARCH.md "Code Examples — Vercel deployment," reproduced verbatim:

```
1. Push the scaffolded repo to a new GitHub repo (git init already exists; create repo on GitHub,
   `git remote add origin <url>`, `git push -u origin master`)
   Note: current local branch is `master`, not `main` — either works with Vercel; consider renaming
   to `main` for convention if the executor prefers.
2. In Vercel dashboard: "Add New Project" → Import the GitHub repo → Vercel auto-detects the Vite
   framework preset (build command `vite build`, output directory `dist`) → Deploy.
3. Every subsequent `git push` to the connected branch triggers an automatic rebuild + redeploy;
   pushes to other branches/PRs get their own preview URLs.
4. No `vercel.json` needed for this phase.
```

Per D-11/Pitfall 15, this must happen as the phase's literal **first step** — before any feature code — pushing a bare scaffold first to confirm the production build actually loads in a browser.

## Shared Patterns

### Manual URDFLoader instantiation (not bare `useLoader`)
**Source:** RESEARCH.md Pattern 2
**Apply to:** `RobotModel.tsx` only (single consumer this phase, but establishes the project convention for any future URDF/tool-mesh loading, e.g. Phase 7's `ToolMount`)
**Why:** `loader.packages` must be set before `.load()` to remap `package://` URIs — the one-liner `useLoader(URDFLoader, path)` form does not allow this.

### `makeDefault` for shared camera-control state
**Source:** RESEARCH.md Pattern 1
**Apply to:** `CellScene.tsx` (OrbitControls) and `NavCube.tsx` (GizmoHelper) — both must reference the same default-registered controls instance; no manual prop-drilling of camera state between them.

### No per-frame state through Zustand
**Source:** CLAUDE.md Supporting Libraries table + RESEARCH.md Anti-Patterns
**Apply to:** `cellStore.ts` and any future scene component — joint angles/TCP/camera position must stay in refs/imperative Three.js updates (`useFrame` in later phases), never in the Zustand store on every tick.

### DH FK independence from urdf-loader rendering
**Source:** RESEARCH.md Anti-Patterns / Pitfall 1
**Apply to:** `forward-kinematics.ts` — must be written and unit-tested as a fully independent implementation from `RobotModel.tsx`'s `urdf-loader`-driven rendering, even though both are fed the same joint angles for a later cross-check.

## No Analog Found

All 12 files have **no in-codebase analog** (repository has zero prior application code). Every file is instead mapped above to concrete external reference code/patterns directly quoted from `01-RESEARCH.md` (itself sourced from official docs / library source fetched this session), which the planner should treat as this phase's canonical "copy from" source in lieu of prior project code.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| all files listed in File Classification above | various | various | Greenfield repository — no `src/`, no `package.json`, no prior implementation exists to analogize from |

## Metadata

**Analog search scope:** Full repository root (`.`) — confirmed via `ls -la` that only `.claude/`, `.git/`, `.planning/`, and two loose `.md` files exist; no `src/` or `package.json`.
**Files scanned:** 0 source files (none exist)
**External reference patterns used instead:** 3 (drei GizmoHelper/GizmoViewcube source, urdf-loader source, Vercel docs) — all pre-verified and quoted in `01-RESEARCH.md`
**Pattern extraction date:** 2026-08-13
</content>
