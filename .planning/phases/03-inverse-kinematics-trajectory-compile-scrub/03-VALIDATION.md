---
phase: 03
slug: inverse-kinematics-trajectory-compile-scrub
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
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
| 03-01-* | TBD | TBD | SIM-05 | V5 (ASVS) | `acos`/`asin` args clamped to [-1,1]; NaN/Infinity branches filtered via `Number.isFinite` before `isWithinJointLimits` | unit | `npx vitest run src/kinematics/inverse-kinematics.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-* | TBD | TBD | SIM-05 | — | Branch continuity: nearest-to-previous-solution selection | unit | `npx vitest run src/kinematics/inverse-kinematics.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-* | TBD | TBD | SIM-05 | — | Rail position resolves within RAIL_TRAVEL, near RAIL_CENTER_X for bundled samples | unit | `npx vitest run src/kinematics/rail.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-* | TBD | TBD | SIM-05 | — | Arc-length table totalLength matches hand-summed reference | unit | `npx vitest run src/trajectory/arc-length.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-* | TBD | TBD | SIM-05 | — | pointAtFraction(0)/(1) return exact first/last points | unit | `npx vitest run src/trajectory/arc-length.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-* | TBD | TBD | SIM-05 | T-03-DoS (client-side) | Trajectory compile end-to-end produces monotonic sample array; bounded by Phase 2's MAX_TOOLPATH_SEGMENTS ceiling | unit/integration | `npx vitest run src/trajectory/compile.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Exact task IDs filled in once gsd-planner produces PLAN.md files.*

---

## Wave 0 Requirements

- [ ] `src/kinematics/inverse-kinematics.test.ts` — IK correctness/round-trip (`FK(IK(FK(joints))) ≈ joints`), continuity, limit-filtering
- [ ] `src/trajectory/arc-length.test.ts` — arc-length table and fraction-to-point mapping
- [ ] `src/trajectory/compile.test.ts` — end-to-end trajectory compile
- [ ] `src/kinematics/rail.test.ts` extension — `resolveRailPosition` cases (existing file/framework, no new setup)
- [ ] Framework install: none — Vitest already configured and running

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Dragging the scrub slider re-poses the visible robot with no visual snapping/flipping, at any point in the timeline, for both bundled samples | SIM-05 | No e2e/browser test tooling installed in this project (no Playwright/Cypress dependency) | Run `npm run dev`, select a sample, drag the scrub control across its full range, confirm the robot smoothly re-poses with no visible joint snapping or elbow/wrist flipping; repeat for both bundled samples |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
