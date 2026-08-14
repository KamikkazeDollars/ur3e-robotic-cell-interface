---
phase: 03
slug: inverse-kinematics-trajectory-compile-scrub
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-14
updated: 2026-08-14
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 |
| **Config file** | none dedicated — Vite's own config / Vitest defaults (matches existing `forward-kinematics.test.ts`, `rail.test.ts`) |
| **Quick run command** | `npx vitest run src/kinematics/inverse-kinematics.test.ts src/kinematics/rail.test.ts src/trajectory/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1-2 seconds (matches existing suite's sub-second runtime) |

---

## Sampling Rate

- **After every task commit:** Run kinematics-scoped quick command
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual scrub UAT walkthrough
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | SIM-05 | T-03-04 | Single `sceneToDhFrame` conversion site; FK of every compiled sample reproduces its own toolpath point to 1e-6 m | unit/integration | `npx vitest run src/trajectory/compile.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-01-T1 | 03-01 | 1 | SIM-05 | T-03-02 | Compile bounded by `MAX_TRAJECTORY_SAMPLES` on top of Phase 2's `MAX_TOOLPATH_SEGMENTS` ceiling | unit | `npx vitest run src/trajectory/compile.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-01-T1 | 03-01 | 1 | SIM-05 | T-03-03 | Store records only a status enum on the compile path; no exception object retained | build | `npm run build && npm test` | ✅ existing | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | SIM-05 | T-03-01 | `acos`/`asin` args clamped to [-1,1]; NaN/Infinity branches filtered via `Number.isFinite` **before** `isWithinJointLimits` | unit | `npx vitest run src/kinematics/inverse-kinematics.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | SIM-05 | — | Branch continuity: nearest-to-previous selection, incl. a negative control proving the rule does work | unit | `npx vitest run src/kinematics/inverse-kinematics.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | SIM-05 | — | Round trip `FK(IK(FK(joints)))` incl. a near-singular pose; joint-limit filtering rejects out-of-range branches | unit | `npx vitest run src/kinematics/inverse-kinematics.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | SIM-05 | — | Rail resolves within `RAIL_TRAVEL`, near `RAIL_CENTER_X` for bundled samples, visibly elsewhere when off-centre (D-02 non-vestigial) | unit | `npx vitest run src/kinematics/rail.test.ts` | ❌ W0 (this task, extends existing file) | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | SIM-05 | — | Arc-length `totalLength` matches hand-summed reference; `pointAtFraction(0)/(1)` return exact first/last points | unit | `npx vitest run src/trajectory/arc-length.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-02-T1 | 03-02 | 2 | SIM-05 | — | Singularity flags stored per sample; classification never filters branch acceptance | unit | `npx vitest run src/kinematics/singularity.test.ts src/trajectory/compile.test.ts` | ❌ W0 (this task) | ⬜ pending |
| 03-02-T2 | 03-02 | 2 | SIM-05 | T-03-07 | Frozen-trajectory copy is a fixed constant with no interpolation syntax; counts read off the trajectory | unit | `npx vitest run src/ui/scene-status-copy.test.ts` | ✅ existing (extended) | ⬜ pending |
| 03-02-T3 | 03-02 | 2 | SIM-05 | T-03-08, T-03-09 | Carriage X derived from the clamped resolved rail position; joint-limit values structurally pinned (5 wide, 1 narrow) | build + structural | `npm run build && npm test` | ✅ existing | ⬜ pending |
| 03-03-T1 | 03-03 | 2 | SIM-05 | T-03-10 | Marker resolves its sample index identically to the pose driver; guarded on null/empty trajectory | build | `npm run build && npm test` | ✅ existing | ⬜ pending |
| 03-03-T2 | 03-03 | 2 | SIM-05 | T-03-11 | `setScrubFraction` clamps to the unit interval; disabled control when no trajectory | build + manual | `npm run build && npm test` + UAT walkthrough | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** no 3 consecutive tasks lack an `<automated>` verify — every one of the 7
tasks across the 3 plans carries a runnable command.

---

## Wave 0 Requirements

All Wave 0 gaps are closed inside Wave 1 (plan 03-01), so no task in Wave 2 depends on a test file that
does not yet exist.

- [ ] `src/trajectory/compile.test.ts` — end-to-end trajectory compile; the FK-reproduces-the-toolpath-point assertion is the tracer's own verify (03-01 Task 1)
- [ ] `src/kinematics/inverse-kinematics.test.ts` — IK round-trip against FK, continuity with a negative control, limit filtering, non-finite rejection (03-01 Task 2)
- [ ] `src/trajectory/arc-length.test.ts` — arc-length table and fraction-to-point mapping (03-01 Task 2)
- [ ] `src/kinematics/rail.test.ts` extension — `resolveRailPosition` cases incl. the off-centre non-vestigial case and the A2 cross-check (03-01 Task 2, existing file/framework)
- [ ] `src/kinematics/singularity.test.ts` — one case per singular family plus a non-singular control (03-02 Task 1)
- [ ] Framework install: none — Vitest already configured and running

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Dragging the scrub slider re-poses the visible robot with no visual snapping/flipping, at any point in the timeline, for both bundled samples | SIM-05 | No e2e/browser test tooling installed in this project (no Playwright/Cypress dependency) | Run `npm run dev`, select a sample, drag the scrub control across its full range, confirm the robot smoothly re-poses with no visible joint snapping or elbow/wrist flipping; repeat for both bundled samples |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all closed in Wave 1)
- [x] No watch-mode flags (`vitest run` / `npm test` are single-shot)
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned — task IDs bound to 03-01/03-02/03-03 on 2026-08-14
