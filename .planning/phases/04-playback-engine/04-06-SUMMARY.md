---
phase: 04-playback-engine
plan: 06
subsystem: kinematics
tags: [rail, toolpath-anchor, gcode, zustand, react-three-fiber, camera]

# Dependency graph
requires:
  - phase: 04-playback-engine (plan 04)
    provides: traversed-path highlight, scrub marker sizing, playback clock ordering
  - phase: 04-playback-engine (plan 05)
    provides: CellMode, mode-tagged bundled samples, mode-filtered picker, mode-change reselection hook
provides:
  - "railStartXForMode / MODE_RAIL_START_OFFSET_M — clamped, symmetric per-mode rail station"
  - "toolpathAnchorForMode — mode-aware world-space toolpath anchor built on the shared rail station"
  - "parseToolpath's optional explicit-anchor second parameter"
  - "cellStore.selectSample anchoring loaded jobs to the active mode's station"
  - "Workbench.tsx tracking the active mode's station"
  - "shouldTightFrameOnReady / camera-fit-origin — manual-pick vs mode-sync camera behavior on toolpath ready"
affects: [phase-07-tool-changer, phase-05-telemetry]

actuals:
  tokens: 10228
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Mode-to-world-space resolution happens at the anchor layer (toolpathAnchorForMode), not inside the rail resolver or compile.ts, so resolveRailPosition's tested algorithm stays untouched and the whole scene shifts by one rigid X translation."
    - "cellStore reads UI-chrome state (cellMode) via useUiShellStore.getState() at dispatch time, never via subscription, keeping the store's own reactivity model pull-based and request-id-guarded."
    - "Origin-tagged store actions (SelectSampleOrigin: 'manual' | 'mode-sync') let a single action serve two callers with different downstream side effects (camera behavior) without branching UI code on the caller's identity."

key-files:
  created:
    - src/gcode/toolpath-anchor.test.ts (extended, not created, see modified)
    - src/trajectory/mode-rail.test.ts
    - src/scene/camera-fit-origin.ts
    - src/scene/camera-fit-origin.test.ts
  modified:
    - src/kinematics/rail.ts
    - src/kinematics/rail.test.ts
    - src/kinematics/index.ts
    - src/gcode/toolpath-anchor.ts
    - src/gcode/toolpath-anchor.test.ts
    - src/gcode/parseToolpath.ts
    - src/store/cellStore.ts
    - src/store/cellStore.test.ts
    - src/store/uiShellStore.ts
    - src/scene/Workbench.tsx
    - src/scene/ToolpathCameraFit.tsx
    - src/ui/useCellModeSampleSync.ts

key-decisions:
  - "Threaded cellMode into the toolpath anchor layer (toolpathAnchorForMode), not into compile.ts/resolveRailPosition as the gap record's `missing` item suggested — deliberate deviation, see below."
  - "cellStore.selectSample resolves cellMode via getState() before the fetch await, not via a subscription, preserving the store's non-reactive orchestration model and the existing request-id staleness guard."
  - "uiShellStore's isolation-boundary comment was rewritten, not just amended, to state cellMode is now a real cell-configuration input consumed by src/gcode and src/scene — a conscious, recorded reversal of the prior rule, scoped to station selection only (Phase 7 still owns the tool-changer swap)."
  - "Camera-fit deviation (checkpoint round 1 feedback): added SelectSampleOrigin ('manual' | 'mode-sync') to selectSample and a pure shouldTightFrameOnReady() decision function, so mode-driven reselection triggers the existing requestCameraReset() wide framing instead of the D-05 tight auto-zoom, with zero code change required at the manual dropdown call site."

patterns-established:
  - "A pure decision helper (camera-fit-origin.ts) isolates untestable DOM/canvas-coupled camera logic (ToolpathCameraFit.tsx) into a unit-testable boolean function, matching this repo's convention of keeping Vitest coverage on logic that doesn't require a DOM/canvas harness."

requirements-completed: [SIM-04]

coverage:
  - id: D1
    description: "Printing and milling jobs anchor to opposite, clamped, symmetric rail stations 0.6m either side of RAIL_CENTER_X, with the resolver proven translation-covariant."
    requirement: SIM-04
    verification:
      - kind: unit
        ref: "src/kinematics/rail.test.ts — per-mode station describe block"
        status: pass
      - kind: unit
        ref: "src/gcode/toolpath-anchor.test.ts — mode-aware anchor describe block"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both bundled samples compile to a ready trajectory under both mode anchors with joint tuples identical to the centred compile within 1e-6 rad, and railPos genuinely differs by mode."
    requirement: SIM-04
    verification:
      - kind: integration
        ref: "src/trajectory/mode-rail.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selecting a sample anchors the job to the active mode's station and the workbench renders at the same station, both derived from toolpathAnchorForMode."
    requirement: SIM-04
    verification:
      - kind: unit
        ref: "src/store/cellStore.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live verification in the browser: mode-filtered picker, rail station sweep on mode switch, trajectory highlight, marker legibility, and no drag/scrub regressions — all four G-04-1 items together."
    verification:
      - kind: manual_procedural
        ref: "Task 3 blocking checkpoint — human ran npm run dev and walked all five how-to-verify items"
        status: pass
    human_judgment: true
    rationale: "Visual framing, camera behavior on mode switch, and highlight/marker legibility are judgment calls about what reads correctly on screen — not mechanically checkable by a unit or integration test."
  - id: D5
    description: "Mode-switch reselection no longer forces the tight D-05 camera zoom; it produces the same wide Reset View framing a manual Reset View click gives, while a manual sample pick from the dropdown keeps the original tight auto-frame."
    verification:
      - kind: unit
        ref: "src/scene/camera-fit-origin.test.ts"
        status: pass
      - kind: unit
        ref: "src/store/cellStore.test.ts — lastSelectSampleOrigin coverage"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint, round 2 — human re-verified mode switching after the fix and replied \"approved\""
        status: pass
    human_judgment: true
    rationale: "The correct camera framing on a mode switch is a visual/UX judgment the human checkpoint exists to confirm; the unit tests prove the decision function and store wiring are correct, not that the resulting on-screen framing feels right."

duration: ~75min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 06: Per-Mode Rail Station Summary

**Printing and milling jobs now anchor to opposite rail stations 0.6m either side of centre — the carriage, workbench, toolpath and camera all sweep together on a mode switch, closing the last G-04-1 gap item.**

## Performance

- **Duration:** ~75 min (three commits across two checkpoint rounds)
- **Started:** 2026-08-15T18:50:57+03:00
- **Completed:** 2026-08-15T19:37:17+03:00
- **Tasks:** 3 (2 auto + 1 blocking checkpoint, resolved over 2 rounds)
- **Files modified:** 15

## Accomplishments
- A per-mode rail station (`railStartXForMode`, `MODE_RAIL_START_OFFSET_M = 0.6`) clamped inside `RAIL_TRAVEL` and symmetric about `RAIL_CENTER_X`, proven translation-covariant with `resolveRailPosition` to within one 15mm candidate grid step
- A mode-aware toolpath anchor (`toolpathAnchorForMode`) that takes its X solely from the rail station and its Y/Z from the existing centred anchor, with `parseToolpath`'s new anchor parameter defaulting to the original centred anchor so every pre-existing call site and test stayed green unedited
- `cellStore.selectSample` and `Workbench.tsx` both derive their X from the same `toolpathAnchorForMode` call, so the loaded job, its highlight/markers, and the physical bench travel together on a mode switch — proven end to end in `mode-rail.test.ts` (both bundled samples compile `'ready'` under both mode anchors with joint tuples identical to the centred compile within 1e-6 rad)
- `uiShellStore`'s isolation-boundary comment rewritten to record `cellMode` as a real cell-configuration input now consumed by the toolpath anchor and workbench, a deliberate, documented reversal of the earlier "cellMode never leaves UI chrome" rule
- Checkpoint-driven fix: mode-switch reselection no longer fights the wide Reset View framing with a tight D-05 auto-zoom — a new `SelectSampleOrigin` on `selectSample` plus a pure `shouldTightFrameOnReady()` helper route mode-triggered reselection to `requestCameraReset()` instead

## Task Commits

Each task was committed atomically:

1. **Task 1: A per-mode rail station, a mode-aware anchor, and a parser that accepts one** - `60337b8` (feat, TDD)
2. **Task 2: Anchor the loaded job and the workbench to the active mode's station** - `5b05914` (feat)
3. **Task 3: Live verification of all four G-04-1 items together** - blocking checkpoint, two rounds (see Deviations)
   - Checkpoint-driven fix - `8cf0c43` (fix)

**Plan metadata:** (this commit)

_Note: Task 1 was TDD (tests extended before implementation, per its `tdd="true"` marker); Task 3's checkpoint round 1 produced the deviation committed as `8cf0c43`._

## Files Created/Modified
- `src/kinematics/rail.ts` - `MODE_RAIL_START_OFFSET_M`, `railStartXForMode`, clamped and symmetric about `RAIL_CENTER_X`
- `src/kinematics/rail.test.ts` - per-mode station describe block, translation-covariance proof
- `src/kinematics/index.ts` - barrel re-export of the new rail-station symbols
- `src/gcode/toolpath-anchor.ts` - `toolpathAnchorForMode`, X from `railStartXForMode`, Y/Z from the existing centred anchor
- `src/gcode/toolpath-anchor.test.ts` - mode-aware anchor coverage plus the default-argument regression guard
- `src/gcode/parseToolpath.ts` - optional explicit `anchor` parameter, defaulting to `TOOLPATH_ANCHOR_OFFSET`
- `src/store/cellStore.ts` - `selectSample` resolves `toolpathAnchorForMode(cellMode)` via `getState()` before the fetch await; gained `SelectSampleOrigin` param and `lastSelectSampleOrigin` field
- `src/store/cellStore.test.ts` - coverage for mode-anchored selection and the new origin field
- `src/store/uiShellStore.ts` - header comment rewritten to record `cellMode` as a real cell-configuration input (boundary reversal, recorded as a decision)
- `src/scene/Workbench.tsx` - tabletop and legs derive X from `toolpathAnchorForMode(cellMode)`, computed once and reused
- `src/scene/ToolpathCameraFit.tsx` - reads `lastSelectSampleOrigin` via `shouldTightFrameOnReady()` to choose tight auto-frame vs `requestCameraReset()`
- `src/scene/camera-fit-origin.ts` - new pure `shouldTightFrameOnReady()` decision function
- `src/scene/camera-fit-origin.test.ts` - unit coverage for the decision function
- `src/ui/useCellModeSampleSync.ts` - passes `'mode-sync'` origin explicitly when reselecting on a mode change
- `src/trajectory/mode-rail.test.ts` - end-to-end proof: both samples compile `'ready'` under both mode anchors, `railPos` differs by mode by at least 0.5m, joint tuples identical to the centred compile within 1e-6 rad

## Decisions Made
- **Anchored the mode into the toolpath anchor layer, not into `compile.ts`/`resolveRailPosition`.** The gap record's `missing` item proposed threading `cellMode` into `compileTrajectory`/`resolveRailPosition` directly. This plan instead threads it one layer earlier, into the anchor the toolpath is placed at, leaving `compile.ts` and the rail resolver's already-tested algorithm completely untouched. The rail then moves because the work is off-centre — the physically honest reason a rail axis moves — and because the whole scene shifts by one rigid X translation, every reach, singularity and table-clearance property Phase 3 established is preserved by construction, which `mode-rail.test.ts` asserts directly rather than assumes.
- **`cellStore` reads `cellMode` via `useUiShellStore.getState()`, never a subscription.** The store is not a React component and must not acquire one; reading before the `await` means the anchor reflects the mode as it stood when the selection was dispatched, with the pre-existing request-id guard discarding any response superseded by a mode-driven reselection.
- **`uiShellStore`'s isolation comment was rewritten as a recorded decision, not silently loosened.** `cellMode` is now stated to be a real cell-configuration input consumed by the toolpath anchor and the workbench station; Phase 7 still owns the actual tool-changer swap. This reversal exists specifically because of gap G-04-1 and is documented in the file so a future reader sees intent, not erosion.
- **0.6m per-mode offset** (`MODE_RAIL_START_OFFSET_M`) is a chosen figure (CONTEXT.md leaves rail dimensions to implementation discretion; the UAT report explicitly left the distance to the implementer's judgement), sized at 40% of the rail's half-travel to keep both stations well inside the end-stops, and chosen as an exact multiple of the resolver's own 15mm candidate spacing so the resolved station for an offset toolpath is exactly the centred result plus the offset rather than drifting by up to half a grid step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Checkpoint round 1 feedback, treated as Rule 1/2-class fix] Mode-switch reselection forced an unwanted tight camera zoom**
- **Found during:** Task 3 (blocking human-verify checkpoint), round 1
- **Issue:** The plan's Task 3 checkpoint text explicitly called out that "selecting a sample auto-frames the camera close in on the toolpath" (pre-existing D-05 behavior) as deliberately unchanged. In practice, `useCellModeSampleSync`'s mode-triggered reselection called the same `selectSample()` action a manual dropdown pick uses, which flipped `toolpathLoadStatus` to `'ready'` and re-triggered `ToolpathCameraFit`'s tight D-05 auto-frame on *every* mode switch — fighting the wide "see the rail sweep" framing that is the entire point of this plan's rail-station feature. The human's first checkpoint round flagged this as the one failing item, requiring a manual Reset View click after every mode switch to see the sweep this plan just implemented.
- **Fix:** Added an optional `SelectSampleOrigin` (`'manual' | 'mode-sync'`) parameter to `cellStore.selectSample`, defaulting to `'manual'` so `SampleSelect.tsx`'s manual dropdown pick required zero code changes, recorded in a new `lastSelectSampleOrigin` store field. `useCellModeSampleSync.ts` now passes `'mode-sync'` explicitly. A new pure `src/scene/camera-fit-origin.ts` (`shouldTightFrameOnReady`) decides whether `ToolpathCameraFit.tsx`'s `'ready'`-transition effect performs the tight D-05 zoom (manual pick, unchanged behavior) or instead calls the store's existing `requestCameraReset()` (mode-sync — the same wide framing Reset View already produces; no second camera-reset code path was invented).
- **Files modified:** `src/store/cellStore.ts`, `src/store/cellStore.test.ts`, `src/ui/useCellModeSampleSync.ts`, `src/scene/ToolpathCameraFit.tsx`, `src/scene/camera-fit-origin.ts` (new), `src/scene/camera-fit-origin.test.ts` (new)
- **Verification:** New unit coverage in `camera-fit-origin.test.ts` and extended `cellStore.test.ts`; human re-ran the full Task 3 `how-to-verify` procedure in round 2 and replied "approved" with no further issues.
- **Committed in:** `8cf0c43`

---

**Total deviations:** 1 auto-fixed, driven by human checkpoint feedback (not a Rule 1-3 bug/gap/blocker found during autonomous execution, but the standard fix-and-reverify loop applied to a blocking checkpoint's partial rejection).
**Impact on plan:** Necessary to make the feature this plan built actually visible without an extra manual step; no scope creep — the fix is scoped entirely to camera-framing behavior on the reselection path this plan introduced, reusing the existing `requestCameraReset()` rather than adding a new camera mechanism.

## Issues Encountered
- Task 3's blocking checkpoint required two rounds. Round 1: human confirmed the mode-filtered picker, rail station sweep, trajectory highlight, and marker legibility items but reported the camera-zoom regression described above as "Mostly approved" with one issue. Round 2, after the `8cf0c43` fix: human replied "approved," closing gap G-04-1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Gap G-04-1 (all four items: highlight, mode-filtered picker, per-mode rail station, camera framing) is fully closed and human-verified.
- `uiShellStore`'s `cellMode` boundary is now explicitly documented as consumed by `src/gcode` and `src/scene` for station selection; Phase 7 (tool-changer) should read that revised header comment before adding its own `cellMode` consumers so the two documented uses don't drift apart.
- No blockers for subsequent phases.

---
*Phase: 04-playback-engine*
*Completed: 2026-08-15*
