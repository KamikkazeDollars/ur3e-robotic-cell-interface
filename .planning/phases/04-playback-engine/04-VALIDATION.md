---
phase: 04
slug: playback-engine
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vite.config.ts` (`test: { environment: 'node' }` — no jsdom/DOM environment; existing tests target pure logic modules / Zustand store via `getState()`/`setState()`, never `@testing-library/react`) |
| **Quick run command** | `npx vitest run src/playback` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/playback src/store/cellStore.test.ts src/trajectory`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green; manual playback UAT (see Manual-Only Verifications) is the only way to verify animation smoothness/timing itself
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 04-01 | 1 | SIM-04 | T-04-01, T-04-02, T-04-03 | D-01 fixed 10s duration constant; delta clamped to `MAX_FRAME_DELTA_S` with non-finite/negative coerced to 0; D-06 terminal frame returns fraction exactly 1 and pauses; D-05/D-07 resume-vs-restart via epsilon, never exact equality; throttled sync fires far less often than the frame rate | unit | `npx vitest run src/playback/clock-step.test.ts` | ❌ created by 04-01-01 | ⬜ pending |
| 04-01-01 | 04-01 | 1 | SIM-04 | T-04-01, T-04-03 | Headless end-to-end run: real `compileTrajectory` output seeded into the real store, stepped at 1/60s, reaches fraction exactly 1, monotonically non-decreasing, terminates with `isPlaying` false | unit (integration) | `npx vitest run src/playback/clock-step.test.ts` | ❌ created by 04-01-01 | ⬜ pending |
| 04-01-02 | 04-01 | 1 | SIM-04 | T-04-03 | `play()`/`pause()` toggle `isPlaying`; `livePlayback` is referentially stable and stays in lockstep with `setScrubFraction`; NaN/Infinity/out-of-range clamp to [0,1]; `setScrubFraction` never changes `isPlaying` (Pitfall 4 guard) | unit | `npx vitest run src/store/cellStore.test.ts` | ⚠️ extend existing | ⬜ pending |
| 04-02-01 | 04-02 | 2 | SIM-04 | T-04-06 | `travelLength` + `toolpathLength` published on `CompiledTrajectory` and consistent with the compiler's own `scrubFraction` arithmetic at the travel/toolpath boundary; degenerate branch returns 0 for both | unit | `npx vitest run src/trajectory/compile.test.ts` | ⚠️ extend existing | ⬜ pending |
| 04-02-02 | 04-02 | 2 | SIM-04 | T-04-05 | D-02 weighting direction (a rapid segment consumes strictly less time than an equal-length cut); monotonic, exactly anchored at 0 and 1, invertible within 1e-9; every divisor epsilon-guarded so degenerate/non-finite inputs stay finite | unit | `npx vitest run src/playback/duration-mapping.test.ts` | ❌ created by 04-02-02 | ⬜ pending |
| 04-03-01 | 04-03 | 2 | SIM-04 | T-04-08, T-04-09 | `sampleAtFraction` returns exact endpoints at 0/1, span-weighted interior blends, the last solved sample for a truncated trajectory (ratio clamped, never extrapolated), null on empty, finite output for non-finite input; adjacent joint deltas below 0.5 rad on the real fixture | unit | `npx vitest run src/trajectory/sample-lookup.test.ts` | ❌ created by 04-03-01 | ⬜ pending |
| 04-03-02 | 04-03 | 2 | SIM-04 | T-04-09 | Both per-frame scene consumers derive position from the one shared lookup on `livePlayback.fraction`; neither retains a private index derivation; URDF frame correction and bounds-derived marker sizing survive the refactor | source assertion | `grep -q 'sampleAtFraction' src/scene/RobotPose.tsx && grep -q 'sampleAtFraction' src/scene/ScrubMarker.tsx && ! grep -q 'rawIndex' src/scene/RobotPose.tsx && ! grep -q 'rawIndex' src/scene/ScrubMarker.tsx && npx tsc -b && npm test` | n/a | ⬜ pending |
| 04-01-01, 04-01-02, 04-02-02, 04-03-02 | all | 1-2 | SIM-04 | — | Robot animates continuously/smoothly on Play; slider tracks progress; drag-while-playing pauses+seeks (D-04); Play after completion restarts (D-07); rapids visibly outpace cuts; no per-sample ticking | manual | N/A — no jsdom/RTL; carried as `<verify><human-check>` on each task and settled at the end-of-phase human verification (`workflow.human_verify_mode: end-of-phase`) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs finalized 2026-08-15 against `04-01-PLAN.md`, `04-02-PLAN.md`, and `04-03-PLAN.md`. Every task in the phase carries an `<automated>` verify; no three consecutive tasks lack one.*

---

## Wave 0 Requirements

No separate Wave 0 pass is needed: every MISSING test file is created by the task
that depends on it, inside the same plan, and each of those tasks is marked
`tdd="true"` with an explicit `<behavior>` block so the test is written before the
implementation.

- [ ] `src/playback/clock-step.test.ts` — created by task 04-01-01 (tracer, `tdd="true"`); covers D-01/D-05/D-06/D-07 and the headless end-to-end run
- [ ] `src/playback/duration-mapping.test.ts` — created by task 04-02-02 (`tdd="true"`); covers SIM-04's D-02 weighted-mapping math
- [ ] `src/trajectory/sample-lookup.test.ts` — created by task 04-03-01 (`tdd="true"`); covers the interpolated lookup (the shared-refactor recommendation is adopted)
- [ ] `src/store/cellStore.test.ts` and `src/trajectory/compile.test.ts` — extended in place by tasks 04-01-02 and 04-02-01
- [ ] No framework install needed — Vitest is already configured and used identically by every other pure-TS module in this codebase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Continuous smooth robot animation on Play, synced trajectory highlight + TCP marker, drag-while-playing pause+seek, restart-after-completion | SIM-04 | No jsdom/DOM environment or `@testing-library/react` in this project; 3D rendering (R3F/Three.js) behavior requires visual confirmation, consistent with Phase 1-3's live-URL visual sign-off pattern | 1. Load a g-code file. 2. Press Play and watch the robot animate continuously along the full toolpath, synced to the trajectory line. 3. Confirm TCP marker and trajectory highlight track position smoothly without stutter. 4. Drag the scrub slider while playing — confirm it pauses and seeks. 5. Let playback run to completion, then press Play again — confirm it restarts from 0. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 6 tasks across the 3 plans carry an `<automated>` block
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — zero tasks lack one
- [x] Wave 0 covers all MISSING references — each missing test file is created by its own `tdd="true"` task in the same plan
- [x] No watch-mode flags — every command is `vitest run` / `npx vitest run <path>`
- [x] Feedback latency < 10s — targeted per-task runs are single-file `npx vitest run`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner (2026-08-15) — set to `validated` by `/gsd-validate-phase` after execution.
