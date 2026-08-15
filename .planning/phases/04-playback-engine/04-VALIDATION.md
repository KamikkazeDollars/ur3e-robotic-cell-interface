---
phase: 04
slug: playback-engine
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 04-XX-XX | TBD | TBD | SIM-04 | — | Weighted elapsed-time-to-scrubFraction mapping is monotonic, respects D-01's fixed duration, and weights rapid vs. cut segments correctly | unit | `npx vitest run src/playback/duration-mapping.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-XX | TBD | TBD | SIM-04 | — | D-07: `fractionToElapsed`/clock resume logic treats `scrubFraction` ≈ 1 as a restart-from-0, not a zero-duration resume | unit | `npx vitest run src/playback/duration-mapping.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-XX | TBD | TBD | SIM-04 | — | `cellStore.play()`/`pause()` toggle `isPlaying` correctly; `livePlayback.fraction` stays in sync with `setScrubFraction` calls | unit | `npx vitest run src/store/cellStore.test.ts` (extend existing file) | ⚠️ extend existing | ⬜ pending |
| 04-XX-XX | TBD | TBD | SIM-04 | — | `sampleAtFraction` bracketing-pair interpolation returns exact endpoints at fraction 0/1 and a correct midpoint lerp | unit | `npx vitest run src/trajectory/sample-lookup.test.ts` | ❌ W0 (only if shared-lookup refactor adopted) | ⬜ pending |
| 04-XX-XX | TBD | TBD | SIM-04 | — | Robot animates continuously/smoothly on Play; slider tracks progress; drag-while-playing pauses+seeks (D-04); Play after completion restarts (D-07) | manual | N/A — no jsdom/RTL; requires visual confirmation in running app | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs will be finalized once PLAN.md files exist — this table seeds the requirement→test mapping for the planner and executor.*

---

## Wave 0 Requirements

- [ ] `src/playback/duration-mapping.test.ts` — stubs/covers SIM-04's weighted-mapping math (new file, new module)
- [ ] `src/trajectory/sample-lookup.test.ts` — covers interpolated lookup, if the shared-refactor recommendation is adopted (new file, new module)
- [ ] No framework install needed — Vitest is already configured and used identically by every other pure-TS module in this codebase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Continuous smooth robot animation on Play, synced trajectory highlight + TCP marker, drag-while-playing pause+seek, restart-after-completion | SIM-04 | No jsdom/DOM environment or `@testing-library/react` in this project; 3D rendering (R3F/Three.js) behavior requires visual confirmation, consistent with Phase 1-3's live-URL visual sign-off pattern | 1. Load a g-code file. 2. Press Play and watch the robot animate continuously along the full toolpath, synced to the trajectory line. 3. Confirm TCP marker and trajectory highlight track position smoothly without stutter. 4. Drag the scrub slider while playing — confirm it pauses and seeks. 5. Let playback run to completion, then press Play again — confirm it restarts from 0. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
