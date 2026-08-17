---
phase: quick
plan: 260817-jfy
subsystem: ui
tags: [react, zustand, run-tab, free-movement, playback, telemetry]

requires:
  - phase: quick-260817-gdv
    provides: Run/Free Movement tab split, showsPlaybackControls predicate, JogControl shared widget
  - phase: quick-260817-iyv
    provides: SampleSelect gated to Run tab via showsPlaybackControls

provides:
  - "livePoseJoints/livePoseJointDegrees (src/ui/live-pose-readout.ts) — live joint-angle derivation mirroring RobotPose.tsx's manualJog-then-sample-then-parked precedence"
  - "RunPanel.tsx rewritten as a read-only telemetry readout — zero inputs, zero manual-pose store dispatches"
  - "Mode bar (ModeBar.tsx) gated to the Run tab, reusing showsPlaybackControls — no second predicate"

affects: [dashboard-telemetry, run-tab, free-movement-tab]

actuals:
  tokens: 6881
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Live telemetry readouts derive from the reactive, throttle-synced scrubFraction (never the 60fps livePlayback.fraction), mirroring the scene's own render precedence so on-screen numbers and the rendered arm can never disagree."

key-files:
  created:
    - src/ui/live-pose-readout.ts
    - src/ui/live-pose-readout.test.ts
  modified:
    - src/ui/tabs/RunPanel.tsx
    - src/ui/manual-jog-input-hardening.test.ts
    - src/App.tsx
    - src/ui/shell/playback-chrome-visibility.ts
    - src/ui/shell/playback-chrome-visibility.test.ts

key-decisions:
  - "Judgement call (F-7): Run's 'Return to toolpath' button was removed along with the rest of the write surface — releasing a manual override now requires switching to Free Movement, or loading/reselecting a job (which clears manualJog automatically). Flagged for explicit human confirmation; see 'Known Judgement Call' below."
  - "No second rail derivation added: manualRailMillimetres (existing) is already live-correct because railPos is constant across every sample of a compiled trajectory (F-2)."

patterns-established:
  - "LivePoseReadoutState extends ManualPoseReadbackState rather than redeclaring it, so a panel can build one state object and feed both the live-pose and manual-pose-readback derivations from the same snapshot."

requirements-completed: [QUICK-260817-JFY, DASH-01, DASH-03]

coverage:
  - id: D1
    description: "Run tab is a live, read-only telemetry readout: six joint-angle rows + rail position row as plain text, zero inputs, zero buttons, zero manual-pose store dispatches"
    requirement: "DASH-01"
    verification:
      - kind: unit
        ref: "src/ui/manual-jog-input-hardening.test.ts#RunPanel.tsx — read-only readout guards (quick 260817-jfy)"
        status: pass
      - kind: automated_ui
        ref: "scratch Playwright script against npm run dev (temp devDependency, fully reverted) — checks 1-2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Run's readouts track playback live (via scrubFraction) and never freeze at the parked pose while the robot moves"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "src/ui/live-pose-readout.test.ts (8 tests: manual override, endpoint/mid-fraction blend, parked-pose fallback, all six joint indices)"
        status: pass
      - kind: automated_ui
        ref: "scratch Playwright script — check 3, joint value changed from 180.0deg to 76.2deg mid-playback"
        status: pass
    human_judgment: false
  - id: D3
    description: "Free Movement keeps full manual control (sliders, typed fields, Home/Reset) and the shared JogControl widget, byte-for-byte unchanged"
    verification:
      - kind: unit
        ref: "src/ui/manual-jog-input-hardening.test.ts#FreeMovementPanel.tsx — still the only editable manual-jog surface (quick 260817-jfy)"
        status: pass
      - kind: other
        ref: "git diff --name-only -- src/ui/tabs/FreeMovementPanel.tsx src/ui/JogControl.tsx (empty output, confirmed after Task 2 and again after final revert)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mode bar (Printing/Milling toggle, mounted-tool chip, job label, upload) mounts only on Run and is genuinely absent from the DOM (not CSS-hidden) elsewhere, gated by the single existing showsPlaybackControls predicate"
    verification:
      - kind: unit
        ref: "src/ui/shell/playback-chrome-visibility.test.ts#App.tsx — playback transport + sample picker structural guards — mounts ModeBar exactly once, guarded by the visibility flag"
        status: pass
      - kind: automated_ui
        ref: "scratch Playwright script — checks 4 and 8 (mode bar absent on Free Movement, present again on Run with same job)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Judgement call F-7 (Run loses its 'Return to toolpath' button) — requires explicit user confirmation, not an automatable check"
    verification: []
    human_judgment: true
    rationale: "This is a UX/product judgement call the plan itself flags for human sign-off (finding F-7), not a correctness property automation can verify."

duration: 35min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-jfy: Run Tab Read-Only Readouts + Mode Bar Run-Only Gating Summary

**Run tab converted from a manual-control surface to a live read-only telemetry readout (new `livePoseJointDegrees` derivation tracking `scrubFraction`), and the top-of-scene mode bar gated to mount only on Run via the existing `showsPlaybackControls` predicate.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-17T14:07:00Z (approx, first tool call)
- **Completed:** 2026-08-17T14:42:00Z (approx)
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- New pure module `src/ui/live-pose-readout.ts` derives the live joint-angle tuple with the exact same precedence `RobotPose.tsx` uses at render time (manual override wins, else the blended trajectory sample at `scrubFraction`, else `UR3E_PARKED_POSE`) — so Run's on-screen numbers can never disagree with the rendered arm. 8-test unit suite covers all four precedence branches plus all six joint indices.
- `RunPanel.tsx` rewritten as a read-only readout: six joint-angle rows and a rail position row as plain label/value text, zero `<input>`, zero `<Button>`, zero manual-pose store dispatches. The Recovery section and the `Return to toolpath` button were deliberately removed (finding F-7 — flagged below for explicit human confirmation), along with the now-unreachable `manualJogError` alert row (finding F-8).
- `manual-jog-input-hardening.test.ts` re-aimed per finding F-6: the editable-panel loop now covers only `FreeMovementPanel.tsx` (Run would have been vacuous coverage), with a new explicit `RunPanel.tsx — read-only readout guards` describe block asserting an EMPTY manual-pose dispatch set (not an allowlist-membership check) plus a `FreeMovementPanel.tsx — still the only editable manual-jog surface` guard so a future edit stripping manual control from both panels can't silently pass.
- `App.tsx`'s mode bar mount gated behind the existing `showPlayback` flag (`{showPlayback && <ModeBar />}`) — no second predicate, no inline tab comparison. `playback-chrome-visibility.ts`'s header comment and its test suite were extended to document/assert the mode bar joins the Run-only chrome family.
- Full verification gate green: `npx vitest run` (449/449 tests, whole repo), `npx tsc -b` (clean), `npx vite build` (succeeds). `npx eslint .` fails with the pre-existing missing `eslint.config.js` — a known standing concern documented in STATE.md, not a regression from this task.
- Human-check walkthrough performed via a temporary local Playwright install against `npm run dev` (fully reverted afterward, per the task's own instructions and the precedent set in quick tasks 260817-gdv/260817-iyv): all 8 numbered verification steps from the plan's `<human-check>` block passed, including confirming joint numbers update live during playback (Base joint went from 180.0° to 76.2° mid-play while the rail stayed correctly constant at 572.0mm) and that a Free-Movement jog is correctly reflected back on Run with the override note visible.

## Task Commits

Each task was committed atomically:

1. **Task 1: Live joint-angle readout derivation (pure module + unit tests)** - `019c618` (feat, tracer)
2. **Task 2: Make RunPanel read-only; re-aim the input-hardening guards** - `d4d11ac` (feat)
3. **Task 3: Gate the mode bar to the Run tab, verify in browser** - `1235693` (feat)

**Plan metadata:** pending (docs commit follows per orchestrator's Step 8)

## Files Created/Modified
- `src/ui/live-pose-readout.ts` - Pure joint-angle derivation module (`livePoseJoints`, `livePoseJointDegrees`, `LivePoseReadoutState`), mirroring `RobotPose.tsx`'s precedence
- `src/ui/live-pose-readout.test.ts` - 8-test unit suite for the above
- `src/ui/tabs/RunPanel.tsx` - Rewritten from a manual-control surface into a read-only live readout; Recovery/override-release buttons and the manual-jog import surface removed
- `src/ui/manual-jog-input-hardening.test.ts` - `PANEL_SOURCE_PATHS` narrowed to `EDITABLE_PANEL_SOURCE_PATHS` (Free Movement only); added non-vacuous Run read-only guard and Free-Movement-still-editable guard
- `src/App.tsx` - Mode bar mount gated behind `showPlayback`, with a comment explaining the reuse of the existing predicate
- `src/ui/shell/playback-chrome-visibility.ts` - Header comment extended to enumerate the mode bar among the Run-only chrome this predicate governs (no behavior change)
- `src/ui/shell/playback-chrome-visibility.test.ts` - Added a mode-bar mount-count + guarded-mount structural assertion

## Decisions Made
- Reused `showsPlaybackControls` for the mode bar rather than introducing a second predicate (finding F-4): the mode bar's contents (job/mode chrome) belong to the same Run-only family `SampleSelect`/`PlaybackControl`/`ScrubControl` already occupy.
- No second rail derivation added to `live-pose-readout.ts`: `railPos` is constant across every sample of a compiled trajectory ("nothing to blend" per `sample-lookup.ts`'s own doc comment), so the existing `manualRailMillimetres` was already live-correct (finding F-2).
- `LivePoseReadoutState` extends `ManualPoseReadbackState` rather than redeclaring its fields, so `RunPanel.tsx` builds exactly one state snapshot and feeds both `livePoseJointDegrees` and `manualRailMillimetres` from it — the joint and rail readouts can never be fed different snapshots.

## Deviations from Plan

None — plan executed exactly as written, including all discovery findings (F-1 through F-8) applied verbatim.

## Known Judgement Call (finding F-7) — requires user confirmation

Per the plan's own instruction, this judgement call was made per the plan's default and is being surfaced here rather than decided silently:

**Run no longer has a "Return to toolpath" button.** Releasing a manual override now requires switching to the Free Movement tab (or loading/reselecting a job, which clears `manualJog` automatically on every branch of `loadJobSource`). This was confirmed working in the human-check walkthrough — jogging a joint on Free Movement and switching back to Run correctly showed the jogged pose plus an informational note: "Manual command is currently overriding playback. Switch to Free Movement to release it."

**If you want that button kept on Run, say so — it is a one-line restore** (re-add the `clearManualJog` selector and the conditional button block that was removed from `RunPanel.tsx`).

## Issues Encountered

None. The temporary Playwright install (used to drive the browser walkthrough since no interactive browser session was available) required discovering the app's actual DOM structure via a debug pass (the left-rail "Run"/"Free Movement" buttons are plain `<button>` elements, not ARIA `role="tab"`, and the panel starts closed even though `activeTab` defaults to `'run'`) — this was exploratory tooling only, fully reverted, and did not touch any shipped code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Run and Free Movement now have a clean, permanent split: Run is pure playback/telemetry chrome, Free Movement is the sole manual-control surface.
- The mode bar, sample picker, and playback transport are now consistently Run-only, all governed by the single `showsPlaybackControls` predicate — no forked predicates to maintain going forward.
- Awaiting user confirmation on the F-7 judgement call (Return to toolpath button removal from Run) before this is considered fully settled UX.

---
*Phase: quick*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 7 created/modified files verified present on disk (`src/ui/live-pose-readout.ts`, `src/ui/live-pose-readout.test.ts`, `src/ui/tabs/RunPanel.tsx`, `src/ui/manual-jog-input-hardening.test.ts`, `src/App.tsx`, `src/ui/shell/playback-chrome-visibility.ts`, `src/ui/shell/playback-chrome-visibility.test.ts`). All 3 task commit hashes (`019c618`, `d4d11ac`, `1235693`) verified present in `git log`.
