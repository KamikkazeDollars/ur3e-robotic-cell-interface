# Phase 1: Static Rig + Kinematics Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 1-Static Rig + Kinematics Foundation
**Areas discussed:** Robot model fidelity, Cell staging & environment, Static demo pose, Deployment target & repo

---

## Robot Model Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Official URDF meshes | Matches STACK.md's recommendation; visually convincing, gives `setJointValue()` for free | ✓ |
| Simplified primitives | Boxes/cylinders sized to DH link lengths; faster, zero asset-pipeline risk, weaker visual | |

**User's choice:** Official URDF meshes (via urdf-loader)

| Option | Description | Selected |
|--------|-------------|----------|
| Track + sliding carriage | Visible rail/track mesh, UR3e base mounted on translating carriage | ✓ |
| Simple sliding platform | Plain rectangular platform, no visible track geometry | |

**User's choice:** Track + sliding carriage

| Option | Description | Selected |
|--------|-------------|----------|
| Bare flange for now | Phase 7 owns ToolMount/tool-swap logic; adding a placeholder now is throwaway | ✓ |
| Placeholder tool attached | Simple placeholder mesh at flange so robot doesn't look unfinished | |

**User's choice:** Bare flange for now

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constants | Phase 8 owns Setup/Calibrate config UI; premature to build configurability now | ✓ |
| Scaffold as configurable now | Store-backed config from day one to avoid later refactor | |

**User's choice:** Hardcoded constants

**Notes:** All four questions in this area resolved to the recommended option.

---

## Cell Staging & Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Floor + rail mount only | Grounds the robot visually without building a full cell set later phases will add anyway | ✓ |
| Full cell shell | Floor, walls/fence, workbench/stock, placeholder tool-changer station all now | |
| Robot only, no floor | Fastest, but reads as a CAD viewer rather than a robotic cell | |

**User's choice:** Floor + rail mount only

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral studio lighting | Soft ambient + directional light, light gray/white background — CAD/robotics-viewer feel | ✓ |
| Dark/industrial theme | Dark background, accent-colored highlights — more HMI feel, riskier under time pressure | |

**User's choice:** Neutral studio lighting

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, visible end-stops | Cheap to add now; anchors Phase 5's Dashboard travel-remaining readout visually | ✓ |
| No, purely numeric for now | Travel limits exist only as data, no visual markers | |

**User's choice:** Yes, visible end-stops

**Notes:** All three questions resolved to the recommended option.

---

## Static Demo Pose

| Option | Description | Selected |
|--------|-------------|----------|
| Slightly bent 'ready' pose | Reads as a real posed robot rather than a flat silhouette | ✓ |
| All-zero home pose | Also the FK unit-test reference pose (well-known, hand-calculable TCP) | |

**User's choice:** Slightly bent "ready" pose

**Notes:** Captured explicitly in CONTEXT.md that this is independent of the FK verification pose — FK correctness must still be unit-tested against the all-zero pose per PITFALLS.md Pitfall 1, even though the displayed pose is bent.

| Option | Description | Selected |
|--------|-------------|----------|
| Center of travel | Visually balanced, shows travel remaining in both directions | ✓ |
| One end of travel | Matches a "parked" convention, only shows travel in one direction | |

**User's choice:** Center of travel

---

## Deployment Target & Repo

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel | Matches STACK.md's recommendation; zero-config, GitHub-connected, auto-redeploy | ✓ |
| Netlify | Near-identical alternative per STACK.md; only if existing preference | |
| GitHub Pages | Free but needs manual base-path config and 404.html SPA workaround | |

**User's choice:** Vercel

| Option | Description | Selected |
|--------|-------------|----------|
| Create new repo | No remote exists yet based on current git status | ✓ |
| Repo already exists | Just push and wire up deploy | |

**User's choice:** Create new repo as part of Phase 1

---

## Claude's Discretion

- Exact camera default framing/distance and nav cube styling details (beyond using drei's `GizmoHelper`/`GizmoViewcube`)
- Precise "ready pose" joint angle values
- Exact xacro-to-flat-URDF conversion method (local `xacro` run vs. pre-flattened dataset URDF)

## Deferred Ideas

None — all four discussed areas stayed within Phase 1's scope. Tool-changer visuals, Setup/Calibrate configurability, and full cell-shell dressing were explicitly deferred to their already-planned roadmap phases (7 and 8) rather than introduced as new scope.
