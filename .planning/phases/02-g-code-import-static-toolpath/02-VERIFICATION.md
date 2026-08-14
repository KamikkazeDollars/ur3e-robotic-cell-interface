---
phase: 02-g-code-import-static-toolpath
verified: 2026-08-14T12:05:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/9
  gaps_closed:
    - "The toolpath sits on a visible workbench surface, well above floor level (G-02-01)"
    - "The toolpath sits clearly in front of the rail rig's carriage with a positive, visible clearance gap (G-02-02)"
    - "The rendered toolpath lines are visibly thicker, with overall start/end point markers (G-02-03)"
    - "The navigation cube's XYZ axis triad is visible through the cube's faces (G-02-04)"
    - "Selecting a sample re-frames the camera to fit that sample's bounds (D-05/CR-01) — now confirmed by live UAT sign-off, not only a static code trace"
  gaps_remaining: []
  regressions: []
---

# Phase 2: G-code Import + Static Toolpath Verification Report

**Phase Goal:** Users can upload a g-code file and see it parsed into a classified, color-coded toolpath rendered in the 3D scene, independent of any kinematics/animation risk (scope note: "upload" = select a bundled sample per locked decision D-01; no upload UI is built)
**Verified:** 2026-08-14T12:05:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 02-04, 02-05, plus a live-session fix on commit `8921e1d`)

## What changed since the initial verification

- **02-04** re-derived the D-06 world-space toolpath anchor (`src/gcode/toolpath-anchor.ts`): `TOOLPATH_ANCHOR_OFFSET.y` now sits on a new `Workbench.tsx` mesh's top surface (`WORKBENCH_TOP_Y`, half the ready-pose TCP's own world height) instead of the floor plane (Y=0); `TOOLPATH_ANCHOR_OFFSET.z` now clears the rail carriage's real forward face (`CARRIAGE_FRONT_FACE_Z`, exported from `RailRig.tsx`) by a named `TOOLPATH_CLEARANCE_MARGIN` (0.12m) instead of an arbitrary fraction of `ROBOT_REACH_ENVELOPE`.
- **02-05** doubled the toolpath's rapid/cutting line widths, added two `sphereGeometry` start/end markers in `CUTTING_COLOR`, and set `opacity={0.6}` on the nav cube's `GizmoViewcube` so its axis triad reads through the faces.
- **A live-session fix (commit `8921e1d`, not tied to a numbered plan)** corrected a marker-clipping regression the developer found while eyeballing the merged result: the start/end markers were centered exactly on the workbench surface (because the toolpath's minimum Y is translated onto the anchor's Y), so a sphere centered there rendered as a clipped half-dome. The fix lifts each marker's position by its own radius (`liftMarker` helper in `Toolpath.tsx`) so its bottom, not its center, rests on the point.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select a bundled g-code sample and the system parses it into classified move segments (move type, coordinates, feed rate per segment) — ROADMAP SC1 / SIM-01 | ✓ VERIFIED | `src/gcode/parseToolpath.ts` unchanged this cycle; `parseToolpath.test.ts` (15 tests) still passing; full suite 67/67 green, including all pre-existing SIM-01 assertions |
| 2 | Rapid (G0) and cutting (G1/G2/G3) moves render as visually distinct line styles — ROADMAP SC2 / SIM-02 | ✓ VERIFIED | `src/scene/Toolpath.tsx` renders 2 batched `<Line segments>` draws, dashed gray vs. solid orange, now with doubled widths (`RAPID_LINE_WIDTH=4`, `CUTTING_LINE_WIDTH=6`); visually confirmed distinguishable in 02-UAT.md Test 1 (pass) |
| 3 | Every classified segment carries move type, ordered scene-space points, and modal feed rate (null until first F word) | ✓ VERIFIED | Unchanged this cycle; `ClassifiedSegment.feedRate` typed `number \| null`, asserted by existing passing tests |
| 4 | G2/G3 arcs tessellate into curves with bit-identical endpoints | ✓ VERIFIED | Unchanged this cycle; `arcTessellation.test.ts` (8 tests) passing; visually confirmed smooth curved corners in 02-UAT.md Test 2 (pass) |
| 5 | Non-finite coordinates and runaway segment counts are refused, counted, never rendered/hung | ✓ VERIFIED | Unchanged this cycle; `isFiniteVector`/`MAX_TOOLPATH_SEGMENTS` guards and their tests still passing |
| 6 | The toolpath sits on a visible workbench surface, well above floor level, not floating over the bare floor (G-02-01) | ✓ VERIFIED | `WORKBENCH_TOP_Y` derived from real `forwardKinematics(UR3E_READY_POSE)` output (never a hand-typed literal); `Workbench.tsx` renders its tabletop's top surface at exactly `WORKBENCH_TOP_Y`, mounted in `CellScene.tsx`; visually confirmed in 02-UAT.md Test 1 (pass — "toolpath now rests on a visible workbench well clear of the carriage") |
| 7 | The toolpath sits clearly in front of the rail rig's carriage with a positive, visible clearance gap, never overlapping (G-02-02) | ✓ VERIFIED | `CARRIAGE_FRONT_FACE_Z` derived from the carriage's real rendered depth (`CARRIAGE_BASE_DEPTH`/`CARRIAGE_BLOCK_DEPTH`, newly exported from `RailRig.tsx`), not a reach-envelope fraction; mechanically proven by a new `describe` block in `toolpath-anchor.test.ts` asserting both samples' minimum anchored Z strictly exceeds `CARRIAGE_FRONT_FACE_Z` (passing); visually confirmed in 02-UAT.md Test 1 |
| 8 | Both bundled samples remain fully within `ROBOT_REACH_ENVELOPE` of `ROBOT_MOUNT_WORLD` after the anchor's Y and Z both changed | ✓ VERIFIED | Pre-existing reach-envelope `describe` block in `toolpath-anchor.test.ts` re-asserted against the new derivation (unchanged assertions, symbolic constants) — passing for both samples |
| 9 | Selecting a sample re-frames the camera to fit that sample's bounds, unaffected by the anchor change; Reset View still returns to the distinct Phase-1 default (D-05/CR-01) | ✓ VERIFIED | `ToolpathCameraFit.tsx` untouched by plans 02-04/02-05; independent static trace (carried from initial verification) confirms the effect correctly re-fires on the `toolpathLoadStatus → 'ready'` transition; now additionally confirmed by live UAT sign-off (02-UAT.md Test 3 — "selecting print then mill produced two visibly different camera framings, screenshots captured"). **Caveat:** no automated regression test exists for this component (`02-REVIEW.md` WR-02, still open) — see Anti-Patterns/Warnings below |
| 10 | Rendered toolpath lines are visibly thicker than the original render, and the overall start/end points are marked with clearly visible, thicker warm-orange markers (G-02-03) | ✓ VERIFIED | `Toolpath.tsx`: `RAPID_LINE_WIDTH`/`CUTTING_LINE_WIDTH` roughly doubled (2→4, 3→6); `endpoints` memo derives `toolpath.segments[0].points[0]` / last segment's last point; two `sphereGeometry` meshes rendered in `CUTTING_COLOR`, radius 0.012m, each lifted by its own radius via `liftMarker` (commit `8921e1d`) to avoid workbench-surface clipping; visually confirmed as full (non-clipped) spheres in 02-UAT.md Test 1 |
| 11 | The navigation cube's XYZ axis triad is visible through the cube's faces, not fully occluded (G-02-04) | ✓ VERIFIED | `NavCube.tsx`: `opacity={0.6}` added to `<GizmoViewcube>`; all three `arrowHelper` axis definitions and face colours unchanged; visually confirmed in 02-UAT.md Test 6 (pass — "all three axis arrows and all six face labels visible simultaneously") |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified — the one previously-flagged behavior-dependent truth, #9, now has both an independent static trace and a live human-verification record in 02-UAT.md; automated regression coverage for it remains a carried-forward warning, not a blocker)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/gcode/toolpath-anchor.ts` | Revised D-06 anchor: `WORKBENCH_TOP_Y`, `CARRIAGE_FRONT_FACE_Z`, `TOOLPATH_CLEARANCE_MARGIN`, updated `TOOLPATH_ANCHOR_OFFSET.y/.z` | ✓ VERIFIED | All four new/updated exports present, each derived from imports, none retyped as a second literal; `ROBOT_MOUNT_WORLD` unchanged |
| `src/scene/RailRig.tsx` | `CARRIAGE_BASE_DEPTH`/`CARRIAGE_BLOCK_DEPTH` widened to exports | ✓ VERIFIED | Both `export const` present with Pitfall-D doc comments naming the new consumer; used directly in the file's own `boxGeometry` args (no divergence between rendered geometry and exported constant) |
| `src/scene/Workbench.tsx` | A workbench/table mesh whose top surface sits at `WORKBENCH_TOP_Y` | ✓ VERIFIED | Default-exported `Workbench()`, 2 `boxGeometry` uses (tabletop + reused leg geometry across 4 legs), every dimension derived from `toolpath-anchor.ts` imports, no restated literal |
| `src/scene/CellScene.tsx` | `<Workbench />` mounted between the rail rig and `<Toolpath />` | ✓ VERIFIED | `<Workbench />` present exactly once, positioned after `rail-rig-mount`'s closing tag and before `<Toolpath />`; composition-order comment updated |
| `src/gcode/toolpath-anchor.test.ts` | New clearance assertion (G-02-02) alongside existing reach/TCP assertions | ✓ VERIFIED | New `describe('D-06 anchor: bundled samples clear the carriage front face (G-02-02)')` block present with 2 tests (print, mill), both passing; existing 2 describe blocks unchanged and still passing |
| `src/scene/Toolpath.tsx` | Thicker lines + overall start/end sphere markers, marker-clipping fix | ✓ VERIFIED | Exactly 2 `<Line>` elements (unchanged batch count), 2 `sphereGeometry` marker meshes, `liftMarker` helper present and correctly applied to both markers |
| `src/scene/NavCube.tsx` | `opacity` prop on `GizmoViewcube` | ✓ VERIFIED | `opacity={0.6}` present, tuned within the plan's documented 0.5-0.7 range; all 3 `arrowHelper` definitions unchanged |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `src/gcode/toolpath-anchor.ts` | `src/scene/RailRig.tsx` | imports `CARRIAGE_BASE_DEPTH`/`CARRIAGE_BLOCK_DEPTH`/`CARRIAGE_TOP_Y`/`RIG_Z_OFFSET` | ✓ WIRED |
| `src/gcode/toolpath-anchor.ts` | `src/kinematics` | imports `forwardKinematics`/`UR3E_READY_POSE` to derive `WORKBENCH_TOP_Y` from real FK output | ✓ WIRED |
| `src/scene/Workbench.tsx` | `src/gcode/toolpath-anchor.ts` | imports `CARRIAGE_FRONT_FACE_Z`, `TOOLPATH_ANCHOR_OFFSET`, `WORKBENCH_TOP_Y` — never restates them | ✓ WIRED |
| `src/scene/CellScene.tsx` | `src/scene/Workbench.tsx` | `<Workbench />` mounted inside Canvas, before `<Toolpath />` | ✓ WIRED |
| `src/scene/Toolpath.tsx` | `src/gcode/parseToolpath.ts` (via store) | reads `toolpath.segments` for both `toRenderBuckets` and the new endpoints memo | ✓ WIRED |
| `src/gcode/parseToolpath.ts` | `src/gcode/toolpath-anchor.ts` | still applies `TOOLPATH_ANCHOR_OFFSET` as the final translation (unchanged consuming logic, new upstream values) | ✓ WIRED |
| `src/scene/CellScene.tsx` | `src/scene/ToolpathCameraFit.tsx` | mounted as sibling of `CameraResetListener` (untouched by 02-04/02-05) | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `Workbench.tsx` | `TABLETOP_*`/`LEG_*` dimensions | Derived at module load from `toolpath-anchor.ts`'s exported constants, which themselves derive from `RailRig.tsx` geometry + real `forwardKinematics` output | Yes | ✓ FLOWING |
| `Toolpath.tsx` | `endpoints.start`/`endpoints.end` | `toolpath.segments[0].points[0]` / last segment's last point, off the real Zustand-stored parsed toolpath | Yes | ✓ FLOWING |
| `NavCube.tsx` | `opacity` | Fixed constant (0.6), not data-dependent — correctly a static cosmetic parameter, not a stub | N/A (static by design) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full Vitest suite passes (no regression across all 5 plans) | `npx vitest run` | 8 files, 67 tests, all green | ✓ PASS |
| Production build succeeds with the workbench/marker/opacity changes bundled | `npm run build` | `tsc -b && vite build` exits 0, 773 modules transformed | ✓ PASS |
| Carriage-clearance assertion mechanically proves G-02-02 for both samples | `npx vitest run src/gcode/toolpath-anchor.test.ts` (included in full run above) | Both `describe('...clear the carriage front face...')` tests pass | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in this cycle's touched files | `grep -nE` across `toolpath-anchor.ts`, `Workbench.tsx`, `Toolpath.tsx`, `NavCube.tsx`, `RailRig.tsx`, `CellScene.tsx`, `toolpath-anchor.test.ts` | No matches | ✓ PASS |
| Marker-clipping fix (commit `8921e1d`) actually lifts both markers, not just one | `git show 8921e1d` (diff inspected directly) | `liftMarker` applied to both `endpoints.start` and `endpoints.end` mesh positions | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SIM-01 | 02-01, 02-02, 02-03, 02-04, 02-05 | User can upload (select) a g-code file, parsed into classified toolpath | ✓ SATISFIED | Unchanged parser + newly-verified visible/clear rendering of that parsed data |
| SIM-02 | 02-01, 02-02, 02-03, 02-04, 02-05 | Parsed toolpath rendered as color-coded line, rapid vs. cutting visually distinct | ✓ SATISFIED | Two-batch dash/color render, now thicker with start/end markers, anchored on a visible workbench clear of the rig — visually confirmed via 02-UAT.md |
| SCENE-03 | 02-05 (incidental, owned by Phase 1) | Navigation cube gizmo | ✓ SATISFIED (not orphaned) | `REQUIREMENTS.md` maps SCENE-03 to Phase 1 (already Complete); 02-05's `opacity` tuning is a cosmetic fix to an already-satisfied Phase-1 requirement, explicitly scoped as such in the plan's objective — not a new Phase-2 requirement claim |

No orphaned requirements: `REQUIREMENTS.md` maps only SIM-01/SIM-02 to Phase 2, and both are claimed by all five plans' frontmatter.

### Anti-Patterns Found

None blocking. Scanned all files touched by plans 02-04/02-05 (`toolpath-anchor.ts`, `toolpath-anchor.test.ts`, `RailRig.tsx`, `Workbench.tsx`, `CellScene.tsx`, `Toolpath.tsx`, `NavCube.tsx`) for debt markers, empty implementations, and hardcoded stub values — none found.

Two known, previously-flagged, non-blocking warnings remain open and are carried forward (unchanged by this cycle's plans):

- **WR-01 (still open, untouched by 02-04/02-05):** `extractFeedRateQueue` in `parseToolpath.ts` desyncs against a line carrying bare coordinate words alongside a non-motion G command (`G92`/`G10`). Confirmed neither bundled sample uses these commands — latent, not currently reachable.
- **WR-02 (still open, untouched by 02-04/02-05):** No committed automated test exists for `ToolpathCameraFit.tsx`. The camera-fit behavior (truth #9 above) is now confirmed both by an independent static trace and by a live human sign-off recorded in `02-UAT.md` Test 3 — but a future refactor of this component could still reintroduce a regression undetected by `npm test`. Recommend adding this test before Phase 3 extends `ToolpathCameraFit.tsx` for scrub/playback framing.

### Cross-check of 02-UAT.md's "complete, 6/6 passed" claim

Per this task's instruction not to take the orchestrator's UAT claim purely on faith, each of the 6 UAT test results was cross-checked against the actual code rather than accepted as narrative:

1. **Test 1 (print sample visual render, incl. the live marker-clipping find/fix):** Corroborated directly — `git show 8921e1d` shows a real, correctly-scoped diff (`liftMarker` applied to both markers only, no other behavior changed), consistent with the UAT note's description of the bug and fix. This is strong evidence the live-browser session actually happened (a fabricated claim would not typically come with a matching, correctly-targeted code commit).
2. **Test 2 (mill sample arcs):** Consistent with unchanged, already-passing `arcTessellation.test.ts` numeric assertions; no code contradicts the visual claim.
3. **Test 3 (camera auto-fit/Reset View):** Consistent with the unmodified `ToolpathCameraFit.tsx` and the initial verification's independent static trace of `cellStore.ts`'s state machine (still valid — neither file changed this cycle).
4. **Test 4 (missing-sample error surface):** The UAT note's quoted overlay copy ("Couldn't load that sample. Check your connection and try again.") matches `src/ui/scene-status-copy.ts` verbatim (`toolpathError` key) — confirmed by direct file read, not assumed.
5. **Test 5 (unit disclosure):** Not independently re-checked visually this cycle (unchanged code path from initial verification, which already confirmed the `mm` label's presence in `SampleSelect.tsx` at the code level).
6. **Test 6 (nav cube axis triad):** Corroborated directly — `NavCube.tsx` has `opacity={0.6}` and all 3 `arrowHelper` elements intact, consistent with the claim.

No contradictions found between 02-UAT.md's claims and the actual codebase state.

## Human Verification Required

None. All items that required human/visual sign-off (print/mill sample rendering, camera auto-fit, missing-sample error surface, unit disclosure, nav cube axis triad) are recorded as passed in `02-UAT.md` with corroborating code evidence cross-checked above. No new visual-only truths were introduced by plans 02-04/02-05 that lack a corresponding UAT test.

## Gaps Summary

No gaps. All 11 must-have truths (5 carried from the initial verification, 4 newly closing G-02-01 through G-02-04, plus the anchor's continued reach-envelope compliance and the now human-confirmed camera-fit behavior) are verified against the current codebase, not merely claimed. The full test suite (67/67) and production build both pass. Two non-blocking warnings (WR-01, WR-02) remain open from the original code review and are carried forward as recommendations for Phase 3, not blockers to Phase 2's goal achievement.

---

*Verified: 2026-08-14T12:05:00Z*
*Verifier: Claude (gsd-verifier)*
