# Walking Skeleton — UR3e Robotic Cell Interface

**Phase:** 1
**Generated:** 2026-08-13
**Plans:** `01-01` (scaffold + scene + deploy) · `01-02` (kinematics core) · `01-03` (design system + camera reset) · `01-04` (robot + rail rendering)

> The Walking Skeleton is the Phase-1 special case of the tracer: a whole-application slice that exercises every layer this project will ever have, end to end, in production quality. Every decision recorded here is inherited unchanged by Phases 2-8. Treat it as a contract, not a scratchpad — a later phase that wants to change one of these rows is proposing an architectural change, not an implementation detail.

---

## Capability Proven End-to-End

A user opens a publicly reachable URL and sees the real UR3e — rendered from its official URDF meshes, standing on its 7th-axis linear rail — posed by joint values that come from this project's own DH-parameter forward-kinematics module, and can orbit, pan, zoom, snap to a nav-cube face, and reset the camera to the opening view.

**Why this is the right skeleton slice:** it is the thinnest capability that touches every layer the remaining seven phases build on — build/deploy, the R3F scene graph, the framework-free kinematics module, the Zustand store, the design-token layer, and the static asset pipeline. It contains no g-code, no inverse kinematics, and no animation, so none of the project's genuinely risky work is entangled in proving the substrate works.

**This project's analogue of "one real read and one real write":** there is no database and no backend (v1 is a client-side-only SPA — `REQUIREMENTS.md` Out of Scope: "Persistent backend/database/accounts"). The equivalent round trip is a **real computation driving a real render**: `forwardKinematics()` computes from the officially-sourced DH table and is asserted against an externally-computed reference TCP position (plan `01-02`), and the same exported joint constants pose the rendered robot in the scene (plan `01-04`). The "real UI interaction" is the working `OrbitControls` + nav-cube camera (plan `01-01`) plus the one-action camera reset (plan `01-03`).

---

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| UI framework | React 19 | Component-heavy, tab-driven dashboard (6+ tabs across Phases 5-8) sharing one playback/robot state; largest ecosystem for fast building under a few-day deadline. |
| Build tool | Vite, pinned to the 7.x line (**not** the npm `latest` 8.x) | Instant HMR and a zero-config TS+React template. Pinned to 7.x because `@vitejs/plugin-react` 5.2.x is the version whose peer range accepts Vite 7; the plugin's `latest` 6.x requires Vite 8. Mixing those majors is toolchain debugging time this timeline cannot absorb. |
| Language | TypeScript, pinned to exactly 5.9.3 (**not** the npm `latest` 7.x) | TS 7.0 (the Go-native compiler) is GA but `typescript-eslint` integration is broken as of this build; 5.9.3 is the fully-tooled line. Re-verify only once TS 7.1 lands full ecosystem support. |
| 3D engine | Three.js 0.185.x | The WebGL substrate underneath both the scene and the robot loader. |
| 3D React layer | `@react-three/fiber` 9.7.x + `@react-three/drei` 10.7.x | Declarative scene graph with automatic resize/dispose, and — decisively — trivial state-sync between React tab UI and the scene. drei ships `OrbitControls`, `GizmoHelper`/`GizmoViewcube`, and `Line2` (Phase 2's toolpath), so the camera rig, the nav cube, and the fat-line toolpath are all off-the-shelf. |
| Camera control convention | `OrbitControls` with `makeDefault`; the nav cube auto-discovers it | One prop replaces all manual camera-sync wiring between the controls and the gizmo. Any later component needing the controls reads the R3F default rather than having them prop-drilled. |
| Robot model | `urdf-loader` 0.13.x against a **flattened, non-xacro** UR3e URDF + official meshes committed under `public/robots/ur3e/` | Purpose-built (NASA JPL origin), handles Collada/STL and per-joint `setJointValue` with no extra mesh-loading dependency. The URDF is flattened **once, offline** and committed — xacro is never parsed at runtime in the browser. |
| Asset serving convention | `loader.packages = { ur_description: '/robots/ur3e' }`; on-disk layout mirrors the path after the package name | The URDF's `package://` URIs are a ROS-ism with no browser meaning. The remap must be assigned on a manually-constructed loader **before** `load()` is called, or meshes 404 silently while the XML still parses and the robot renders as bare joints. Phase 7's tool meshes inherit this asset root. |
| Kinematics | Hand-written **standard-DH** forward kinematics in `src/kinematics/`, framework-free, unit-tested against an externally-computed reference pose | No maintained JS/TS library provides UR-specific kinematics. The module imports no renderer, no robot loader, and no UI framework, so it is directly unit-testable and survives a rendering-layer change. It is deliberately **independent of** the robot loader's internal transforms — that independence is what makes the cross-check meaningful and is what stops "the robot looks right" from being accepted as evidence. |
| Kinematics source of truth | `UR3E_DH` transcribed only from the officially-sourced table, cross-verified against the flattened URDF's joint origins; elbow limit is ±π, not the uniform ±2π | A DH transcription error produces a plausible-looking robot with the TCP in the wrong place — the single highest-risk correctness item in the project. The reference-pose assertion fails on any single-digit error because the home TCP is a function of every `a` and `d`. |
| 7th axis (rail) | Project-owned scene geometry (track + end-stops + carriage) with the rail entering the kinematic chain as a **prepended translation**, not as a joint in the URDF | The official UR3e URDF has no rail joint. Keeping the rail as a prepended 1-DOF transform lets Phase 3 resolve it as a separate positioning problem and solve the remaining 6-DOF analytically, which is both how real UR rail cells are programmed and far cheaper than a 7-DOF redundant numerical solve. |
| Rail constants | `RAIL_TRAVEL` / `RAIL_CENTER_X` exported from `src/kinematics/rail.ts`; the rendered end-stops and Phase 5's remaining-travel readout both read them | One definition of "travel", so the visible limits and the reported limits cannot drift apart. The travel value itself is a deliberately-chosen plausible number with no hardware source — recorded in that file's header so no later phase mistakes it for a spec. |
| State management | Zustand 5.0.x (`src/store/cellStore.ts`), **coarse UI-cadence state only** | Works cleanly both inside and outside the R3F render tree, unlike React Context. Hard constraint: per-frame values (joint angles, TCP position, camera position, speed) never go through the store — from Phase 4 onward those are driven imperatively via `useFrame` and refs, with the store written only at UI cadence (throttled telemetry, pause/scrub). This is the single most important performance decision in the project. |
| Design system | shadcn/ui, neutral preset, CSS variables enabled; official registry only | The UI-SPEC design contract. Radix primitives underneath, `lucide-react` icons, system-UI font stack, no webfont. Phase 1 installs exactly one block (`Button`). Third-party registries are not configured. |
| Design tokens | UI-SPEC spacing / typography / colour declared once as CSS custom properties in `src/index.css` | Seven 4px-multiple spacing steps, a four-role type scale with a hard **two-weight** cap (400 / 600), and four colour roles: Dominant `#FAFAFA`, Secondary `#E4E7EB`, Accent `#2563EB`, Destructive `#DC2626`. Accent is reserved for the nav cube and the primary CTA and is never applied to robot or rail geometry. |
| Testing | Vitest, configured through the `test` key in `vite.config.ts`, `node` environment | Same config and transform pipeline as the build. The `node` environment is sufficient because everything worth testing in this project is framework-free by design — kinematics math, rail geometry, store transitions, copy contracts, and asset integrity. No DOM test environment or rendering-test library is installed; if a later phase needs one, that is a deliberate addition, not an assumption. |
| Deployment | GitHub → Vercel, zero-config Vite preset, push-triggered auto-redeploy of the production branch; production URL recorded in `README.md` | Deployed on day one before any feature code, so production-only quirks (asset paths, bundle size, mesh fetching) surface while there is time to fix them. The recorded URL is the machine-checkable anchor every plan's verify gate curls. No `vercel.json` — plain client-side SPA, no server routes. |
| Directory layout | `src/kinematics/` · `src/scene/` · `src/store/` · `src/ui/` · `src/components/ui/` · `public/robots/<model>/` | Separation by concern, not by feature: `kinematics/` is framework-agnostic pure math, `scene/` is R3F components, `store/` is coarse app state, `ui/` is hand-authored DOM chrome, `components/ui/` is registry-generated blocks (kept separate so generated code is never confused with authored code), `public/robots/` is the static asset root. |
| Navigation between tabs (Phases 7-8) | A Zustand `activeTab` string, **not** a router | The tab structure is panel-switching within one page, not distinct routes. Adding a router would also mean an SPA-rewrite config on the host for zero benefit. Revisit only if bookmarkable per-tab URLs become a requirement. |

---

## Stack Touched in Phase 1

The template's checklist is written for a database-backed web app; the rows below are its honest equivalents for a client-side-only 3D simulation with no backend.

- [ ] **Project scaffold** — framework, build tool, TypeScript, lint, formatter, and the Vitest runner, all at pinned versions *(plan `01-01`)*
- [ ] **Composition root** — one real R3F `Canvas` scene with lighting, floor, camera rig, and named insertion points *(plan `01-01`; this project's analogue of "at least one real route")*
- [ ] **Real computation, real render** — `forwardKinematics()` computes from the official DH table and is asserted against an externally-computed reference TCP position; the same exported joint constants pose the rendered robot *(plans `01-02` + `01-04`; this project's analogue of "one real read AND one real write")*
- [ ] **Real static-asset pipeline** — the official URDF and every mesh it references committed, served, and machine-proven to resolve in the production build *(plan `01-04`)*
- [ ] **Real UI interaction** — orbit / pan / zoom, nav-cube click-to-snap, and a one-action camera reset routed through the store *(plans `01-01` + `01-03`)*
- [ ] **Design-system layer** — shadcn/ui initialised and the UI-SPEC token contract declared once *(plan `01-03`)*
- [ ] **State layer** — the minimal Zustand store, holding intent rather than per-frame values *(plans `01-03` + `01-04`)*
- [ ] **Deployment** — GitHub remote plus a publicly reachable production URL that redeploys on every push, verified by fetching the shell, the bundle, and the robot asset *(plans `01-01`, re-verified by `01-03` and `01-04`)*

---

## Out of Scope (Deferred to Later Slices)

Explicit, so no later phase re-litigates Phase 1's minimalism:

- **G-code** — no parsing, no upload, no toolpath geometry (Phase 2)
- **Inverse kinematics** — Phase 1 is forward-only; no closed-form solver, no branch selection, no rail redundancy resolution (Phase 3)
- **Animation and playback** — the pose is static; no `useFrame` loop, no timeline, no scrub (Phases 3-4)
- **Telemetry** — no live joint-angle, TCP, speed, or remaining-travel readouts (Phase 5); `railRemainingTravel()` exists as a tested helper but nothing displays it yet
- **Tooling on the flange** — no print head, no mill spindle, no tool-changer station; the flange stays bare (Phase 7)
- **Cell dressing** — floor plane and rail geometry only; no workbench, fencing, or enclosure (later phases add these piece by piece)
- **Tabs** — no tab bar, no Dashboard / Vision / Calibrate / Setup / I-O / Optimization panels, no operations tree (Phases 5-8)
- **Configurability** — DH parameters, joint limits, and rail travel are hardcoded constants with no store backing and no editing UI (Phase 8 owns Setup/Calibrate)
- **Rail motion** — the carriage is parked at travel centre; the rail is a visible static axis, not yet a degree of freedom (Phase 3)
- **Backend, database, accounts, auth, persistence** — out of scope for the entire v1, not just Phase 1
- **Hardware connection** — no RTDE/URScript; simulation only, for the entire v1

---

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton **without altering the decisions above**:

- **Phase 2 — G-code Import + Static Toolpath:** upload a g-code file, parse it into classified move segments, render it as a color-coded line in the scene built here. Adds a parsing module beside `kinematics/`; introduces the first real user-input surface (and with it the first genuine input-validation security scope).
- **Phase 3 — Inverse Kinematics + Trajectory Compile + Scrub:** closed-form IK built on `kinematics/`, rail redundancy resolved by fixing a carriage position per operation, scrubbing the timeline to re-pose the rig. Extends the kinematics module; the rail becomes a resolved DOF.
- **Phase 4 — Playback Engine:** press play and animate the full toolpath in real time, driven imperatively through `useFrame` and refs — the first phase where the store's no-per-frame-state rule does real load-bearing work.
- **Phase 5 — Telemetry / Dashboard:** live joint angles, TCP position and speed, and rail position plus remaining travel, all computed from the same trajectory data the scene reads. First consumer of `railRemainingTravel()` and of the token layer for panel chrome.
- **Phase 6 — Operations Tree + Mill Engagement Coloring:** per-operation start/end markers, a sequenced tree with computed durations, depth-of-engagement colouring — all reusing Phase 2's segmentation and Phase 4's playback.
- **Phase 7 — Tool-Changer + Print/Mill Tabs:** the first tabs, and the first tool geometry mounted onto the flange left bare here, served from the same `public/robots/` asset root and remap convention.
- **Phase 8 — Remaining Tabs:** Setup, Vision, Calibrate, I/O, and Optimization as thin consumers of the now-stabilised store; the first UI that edits the constants Phase 1 hardcoded.

---

## Artifacts this phase produces

Phase-wide inventory across all four plans. Individual plans reference this table.

| Kind | Symbol / Path | Plan |
|---|---|---|
| Scaffold | `package.json`, `package-lock.json`, `index.html`, `vite.config.ts` (incl. the Vitest `test` block), `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.gitignore`, `README.md` | 01-01 |
| App root | `src/main.tsx`, `src/App.tsx`, `src/index.css` | 01-01 |
| Scene | `src/scene/CellScene.tsx`, `src/scene/NavCube.tsx` | 01-01 |
| Kinematics | `src/kinematics/ur3e-dh.ts`, `forward-kinematics.ts`, `forward-kinematics.test.ts`, `rail.ts`, `rail.test.ts`, `index.ts` | 01-02 |
| Kinematics constants | `UR3E_DH`, `UR3E_JOINT_LIMITS`, `UR3E_JOINT_NAMES`, `UR3E_HOME_POSE`, `UR3E_READY_POSE`, `RAIL_TRAVEL`, `RAIL_CENTER_X` | 01-02 |
| Kinematics functions | `forwardKinematics(joints, railPos?)`, `isWithinJointLimits(joints)`, `railRemainingTravel(x)`, `clampRailPosition(x)` | 01-02 |
| Kinematics types | `JointAngles`; return shapes `{ frames, matrix, tcpPosition }`, `{ negative, positive }`, `{ min, max }` | 01-02 |
| Design system | `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`; the `--space-*` / `--text-*` / `--leading-*` / `--weight-*` / `--color-*` token set in `src/index.css` | 01-03 |
| Camera | `src/scene/camera-defaults.ts` (`DEFAULT_CAMERA_POSITION`, `DEFAULT_CAMERA_TARGET`), `src/scene/CameraResetListener.tsx` | 01-03 |
| Store | `src/store/cellStore.ts` (`useCellStore`: `resetToken`, `requestCameraReset()`, `robotLoadStatus`, `setRobotLoadStatus()`), `src/store/cellStore.test.ts` | 01-03, 01-04 |
| DOM chrome | `src/ui/ResetViewButton.tsx`, `src/ui/SceneStatusOverlay.tsx`, `src/ui/scene-status-copy.ts` (`SCENE_STATUS_COPY`), `src/ui/scene-status-copy.test.ts` | 01-03, 01-04 |
| Robot + rail | `src/scene/RobotModel.tsx`, `src/scene/RailRig.tsx`, `src/scene/urdf-asset.test.ts` | 01-04 |
| Static assets | `public/robots/ur3e/ur3e.urdf` and every mesh it references under `public/robots/ur3e/meshes/` | 01-04 |
| External | GitHub repository (`origin`), Vercel production deployment + URL (recorded in `README.md`) | 01-01 |

---

*Walking Skeleton for Phase 1 — Static Rig + Kinematics Foundation*
*Generated: 2026-08-13*
