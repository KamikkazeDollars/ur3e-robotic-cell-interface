---
phase: 1
slug: static-rig-kinematics-foundation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (current stable — not yet installed, this phase installs it) |
| **Config file** | none yet — Wave 0 creates `vitest.config.ts` (or reuses `vite.config.ts` via its `test` key, Vitest's standard pattern) |
| **Quick run command** | `npx vitest run kinematics/forward-kinematics.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds (single FK unit test this phase) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run kinematics/forward-kinematics.test.ts`
- **After every plan wave:** Run `npx vitest run` (full suite — trivial size this phase)
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual/visual checks below
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-*-* | TBD | TBD | SCENE-04 | — | N/A (no auth/input surface this phase) | unit | `npx vitest run kinematics/forward-kinematics.test.ts -t "home-pose"` | ❌ W0 | ⬜ pending |
| 01-*-* | TBD | TBD | SCENE-01 | — | N/A | manual | Orbit/pan/zoom the deployed scene | n/a | ⬜ pending |
| 01-*-* | TBD | TBD | SCENE-02 | — | N/A | manual | Click camera-reset control, confirm centered view | n/a | ⬜ pending |
| 01-*-* | TBD | TBD | SCENE-03 | — | N/A | manual | Rotate camera, confirm nav cube syncs; click a face, confirm snap | n/a | ⬜ pending |
| 01-*-* | TBD | TBD | DEPLOY-01 | — | N/A | manual | `git remote -v` shows GitHub origin; repo visible on github.com | n/a | ⬜ pending |
| 01-*-* | TBD | TBD | DEPLOY-02 | — | N/A | manual | Visit Vercel URL after `git push`; confirm change appears | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are TBD — the planner fills these in once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest` — framework install (none detected yet)
- [ ] `vitest.config.ts` or `vite.config.ts` `test` block
- [ ] `kinematics/forward-kinematics.test.ts` — covers SCENE-04's FK correctness requirement (PITFALLS.md Pitfall 1); assert against the tool-verified home-pose reference TCP position `(-0.45675, -0.22315, 0.0665)` m computed in `01-RESEARCH.md`
- [ ] No shared fixtures needed yet — this phase's only automated test is the single home-pose assertion above

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera orbit/pan/zoom | SCENE-01 | `OrbitControls` is a well-tested drei primitive; the project logic here is wiring, not math worth unit-testing | Load the deployed scene, drag to orbit, scroll to zoom, confirm smooth response |
| Camera reset to centered view | SCENE-02 | Small, purely visual interaction | Click the reset control, confirm camera returns to the default centered framing |
| Nav cube sync + click-to-snap | SCENE-03 | drei's `GizmoHelper`/`tweenCamera` behavior is internal library code, not project logic worth unit-testing | Rotate the camera, confirm the nav cube rotates in sync; click a face (e.g. Front), confirm the camera snaps to that view |
| Source on GitHub | DEPLOY-01 | Repo state, not application behavior | `git remote -v` shows a GitHub origin; repo is visible on github.com |
| Publicly reachable, stays in sync | DEPLOY-02 | Deployment state, not application behavior | Visit the Vercel URL after a `git push`; confirm the latest change appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
