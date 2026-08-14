---
phase: 02-g-code-import-static-toolpath
plan: 02
subsystem: 3d-toolpath
tags: [gcode-toolpath, gcode-parser, arc-tessellation, vitest]

# Dependency graph
requires:
  - phase: 02-01
    provides: "parseToolpath.ts's classification pipeline (addLine/feed-rate pre-scan/D-06 anchor), samples.ts registry, toolpath-anchor.ts world-space constants, the print-sample.gcode authoring pattern"
provides:
  - "src/gcode/arcTessellation.ts — tessellateArc, ARC_SEGMENTS_PER_TURN — pure XY-plane G2/G3 arc-to-polyline tessellation with exact verbatim endpoints"
  - "public/gcode/mill-sample.gcode — hand-authored rounded-rectangle contour, 3 depth passes, direction-alternating (G3/G2/G3) arcs, exact command-count contract"
  - "parseToolpath.ts's real addArcCurve branch (source: 'arc' segments) plus non-finite-coordinate and MAX_TOOLPATH_SEGMENTS defensive guards (T-02-02)"
  - "Committed asset-integrity test suite (parseToolpath.test.ts, toolpath-anchor.test.ts) gating both bundled samples' move-type counts, feed rates, bucket assignment, and the D-06 reach-envelope claim against forwardKinematics"
affects: [02-03-camera-fit-status-copy, phase-3-ik-trajectory]

# Actuals (#2632)
actuals:
  tokens: 7888
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "tessellateArc mirrors forward-kinematics.ts's shape: zero-import, pure typed-input/typed-output math module, directly unit-testable in isolation from React/Zustand/Three.js"
    - "Arc endpoints copied verbatim from the caller's own start/end tuples (never recomputed from the swept angle), so an arc's last point is bit-identical to the next segment's first point — no seam at line-to-arc junctions"
    - "toScenePoint's mm->m/axis-remap boundary generalized to accept a raw tuple (not just a GCodeVector), so both the line and arc branches route through the exact same single conversion site"
    - "Defensive guards (non-finite rejection, MAX_TOOLPATH_SEGMENTS ceiling) sit upstream of the bounds pass inside addLine/addArcCurve, incrementing skippedMotionCount rather than throwing — same discipline as 02-01's zero-length-segment drop"

key-files:
  created:
    - src/gcode/arcTessellation.ts
    - src/gcode/arcTessellation.test.ts
    - public/gcode/mill-sample.gcode
    - src/gcode/parseToolpath.test.ts
    - src/gcode/toolpath-anchor.test.ts
  modified:
    - src/gcode/parseToolpath.ts
    - src/gcode/samples.ts

key-decisions:
  - "mill-sample.gcode's CW pass (pass 2) traverses the identical rounded-rectangle contour in reverse order rather than a differently-shaped path, so every pass returns to the exact same plunge XY (20,0) — verified by hand that every arc's I/J-derived centre is equidistant from that arc's own start and end points before committing."
  - "Put an inline F600 on the very first cutting move of every pass (a G1 side for passes 1/3, the leading G2 arc for pass 2) rather than only on the file's opening line, since the immediately preceding line is always a F300 plunge — feed rate is modal, so failing to reassert it would leave the first cutting move of passes 2/3 silently inheriting the plunge's 300 feed."
  - "Left the non-finite-coordinate guard functionally untested (documented in a test-file code comment, not silently skipped): scratch-verified this session that gcode-parser's own tokenizer rejects a non-numeric word (XABC) and mis-tokenizes an out-of-range exponential literal (X1e999 -> X=1/E=999) before either could reach addLine/addArcCurve as NaN/Infinity, so the guard has no reachable trigger through the real text front door with the two hand-authored samples. Verified present via Task 2's isFinite/Number.isFinite grep criterion instead."
  - "Added a MAX_TOOLPATH_SEGMENTS truncation test beyond the plan's literal Task 3 behaviour list, since that must_haves truth (\"a file exceeding the defensive segment ceiling is truncated ... and reports the number of dropped commands\") was otherwise uncovered by any committed test (Rule 2 — missing critical test coverage for an already-implemented security control)."

patterns-established:
  - "Pattern: arc tessellation is the interpreter's XY-plane-only concern — a future G18/G19 upload feature adds a remap branch in arcTessellation.ts or the caller, documented explicitly in the module header rather than left implicit."
  - "Pattern: asset-integrity tests (parseToolpath.test.ts, toolpath-anchor.test.ts) read shipped fixtures from disk and assert independently-authored expected values (never re-derived from the implementation's own output), mirroring urdf-asset.test.ts's discipline — the same pattern Phase 1 established, now proven to generalize across subsystems."

requirements-completed: [SIM-01, SIM-02]

coverage:
  - id: D1
    description: "tessellateArc converts a G2/G3 arc into a polyline with exact verbatim start/end endpoints and every intermediate point on the true circle, for both CW and CCW direction, a full circle, and a degenerate zero-radius arc"
    requirement: SIM-01
    verification:
      - kind: unit
        ref: "src/gcode/arcTessellation.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both bundled samples parse into the exact committed move-type counts, feed rates, and render-bucket sizes (print: 7 rapid/12 cut; mill: 3 rapid/27 cut incl. 12 arc-sourced), gated against the actual shipped fixtures on disk"
    requirement: SIM-01
    verification:
      - kind: unit
        ref: "src/gcode/parseToolpath.test.ts (15 tests, includes 3 synthetic edge cases and the MAX_TOOLPATH_SEGMENTS truncation test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-06 reachability: every anchored point of both samples is within ROBOT_REACH_ENVELOPE of ROBOT_MOUNT_WORLD, and forwardKinematics(UR3E_READY_POSE) composed through the real scene-frame rotation places the ready-pose TCP above the anchor and within reach horizontally"
    verification:
      - kind: unit
        ref: "src/gcode/toolpath-anchor.test.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Selecting the mill sample visually renders three depth passes at distinct heights with genuinely curved (not chorded) rounded corners, and no seam appears at any arc-to-line junction"
    verification: []
    human_judgment: true
    rationale: "Visual curve rendering and depth-pass height distinctness are only confirmable by a human viewing the rendered scene; per this project's human_verify_mode=end-of-phase config, deferred to phase-end UAT, same precedent as plan 02-01's SIM-02 visual sign-off."
  - id: D5
    description: "npm run build succeeds with the arc branch wired in (production Rollup bundle, not just dev server)"
    verification:
      - kind: other
        ref: "npm run build (tsc -b && vite build)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No regression in the Phase 1 + plan 02-01 Vitest suite"
    verification:
      - kind: unit
        ref: "npm test (8 files, 58 tests)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 2: Arc Tessellation, Mill Sample & Defensive Parser Guards Summary

**Real G2/G3 arc-to-polyline tessellation wired into parseToolpath.ts, a hand-authored 3-depth-pass milling sample with direction-alternating (G3/G2/G3) rounded-rectangle contour, non-finite-coordinate and segment-ceiling defensive guards, and a committed asset-integrity/reachability test suite (26 new tests) gating both bundled samples against independently-specified expected values.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints — Tasks 1 and 3 were `tdd="true"`)
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- `arcTessellation.ts` tessellates a G2/G3 arc into a polyline whose first/last points are strictly equal (`toEqual`) to the caller's own start/end tuples — proven by 8 committed numeric tests covering CW, CCW, full-circle, degenerate-arc, point-count-scaling, and Z-interpolation cases
- `mill-sample.gcode`: a hand-authored 120mm rounded-rectangle contour (20mm corner radius) machined in three depth passes (-1/-2/-3mm), direction alternating G3/G2/G3 per pass (real CAM zigzag) — exactly 3 G0, 15 G1, 8 G3, 4 G2, verified by hand that every arc's I/J-derived centre is equidistant from its own start and end
- `parseToolpath.ts`'s `addArcCurve` now calls `tessellateArc` with the interpreter's centre/start/end and modal-read direction, pushing one `source: 'arc'` segment per arc command routed through the same `toScenePoint` mm->m/axis-remap boundary the line branch uses
- Defensive guards (T-02-02): non-finite coordinates and segments past a new `MAX_TOOLPATH_SEGMENTS` (5000) ceiling are rejected upstream of the bounds pass, counted into `skippedMotionCount` instead of thrown/hung on
- 26 new committed tests (`arcTessellation.test.ts` 8, `parseToolpath.test.ts` 15, `toolpath-anchor.test.ts` 3) gate both bundled samples' exact move-type counts, feed rates, and render-bucket sizes against the actual shipped fixtures on disk, plus mechanically prove D-06's reachability claim by calling the real `forwardKinematics` module
- Confirmed the assertions have teeth: deliberately corrupted one expected count, watched the suite fail, reverted before committing

## Task Commits

1. **Task 1: Tessellate G2/G3 arcs into polylines with exact endpoints** — `699c840` (test, RED) + `b20dc07` (feat, GREEN)
2. **Task 2: Ship the milling sample with arcs and depth passes, wire the arc branch and input guards into the parser** — `09d6578` (feat)
3. **Task 3: Cross-check both bundled samples and the D-06 anchor against independently-specified expected values** — `54d1e6c` (test) + `6b809c6` (test, added MAX_TOOLPATH_SEGMENTS coverage)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/gcode/arcTessellation.ts` - pure G2/G3 arc-to-polyline tessellation (`tessellateArc`, `ARC_SEGMENTS_PER_TURN`)
- `src/gcode/arcTessellation.test.ts` - 8 numeric tests against hand-computed arc geometry
- `public/gcode/mill-sample.gcode` - hand-authored milling sample (3 depth passes, alternating-direction arcs)
- `src/gcode/parseToolpath.ts` - real arc branch, non-finite guard, MAX_TOOLPATH_SEGMENTS ceiling
- `src/gcode/samples.ts` - registered the mill sample as `GCODE_SAMPLES[1]`
- `src/gcode/parseToolpath.test.ts` - 15 tests: asset-integrity gate for both samples, 3 synthetic edge cases, segment-ceiling test
- `src/gcode/toolpath-anchor.test.ts` - 3 tests: D-06 reach-envelope proof against `forwardKinematics`

## Decisions Made
- mill-sample.gcode's CW pass reverses the identical contour rather than authoring a second shape, keeping every pass's plunge XY identical (20,0)
- Inline F600 reasserted on the first cutting move of every pass (line or arc), since the preceding plunge always set F300 — feed rate is modal, so omitting this would leave passes 2/3's opening cut silently reporting 300
- Left the non-finite-coordinate guard functionally untested but documented why: `gcode-parser`'s tokenizer rejects/mis-tokenizes malformed numeric input before it can ever reach the guard as NaN/Infinity through the real text front door — verified via scratch inspection this session, not assumed
- Added a `MAX_TOOLPATH_SEGMENTS` truncation test beyond the plan's literal Task 3 list, closing a gap between an already-implemented security control and its test coverage (Rule 2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a MAX_TOOLPATH_SEGMENTS truncation test**
- **Found during:** Task 3, while cross-checking the plan's `must_haves.truths` against the committed test files
- **Issue:** The plan's must-have truth "a file exceeding the defensive segment ceiling is truncated at the ceiling and reports the number of dropped commands" was implemented in Task 2 but had no committed test proving it — Task 3's own behaviour block didn't include this case either.
- **Fix:** Added a test generating `MAX_TOOLPATH_SEGMENTS + 5` line commands and asserting the parser truncates at exactly the ceiling while `skippedMotionCount` reports the 5 dropped commands.
- **Files modified:** `src/gcode/parseToolpath.test.ts`
- **Verification:** `npx vitest run src/gcode/parseToolpath.test.ts` — test passes; confirmed it would fail against a parser without the ceiling by inspection of the guard logic added in Task 2.
- **Committed in:** `6b809c6`

**2. [Investigated, not a code fix] Non-finite-coordinate guard has no reachable trigger through the real parser front door**
- **Found during:** Task 3, attempting to add a functional test for the non-finite guard alongside the ceiling test
- **Issue:** Tried two approaches to make `gcode-parser` emit a NaN/Infinity coordinate from valid-looking g-code text (`X1e999` expecting IEEE-754 overflow to `Infinity`; `XABC` expecting a string fallback that `Number.isFinite` would reject). Scratch inspection showed `gcode-parser`'s regex tokenizer mis-tokenizes `X1e999` into separate `X=1`/`E=999` words (no scientific-notation support) and silently drops `XABC` as an unrecognized word entirely (X keeps its prior value) — neither path ever reaches `addLine`/`addArcCurve` as a non-finite value.
- **Resolution:** Did not force a synthetic test through internal APIs not exposed by `parseToolpath.ts`'s public contract. Documented the finding as a code comment in `parseToolpath.test.ts` so the gap is visible, not silent. The guard remains verified present via Task 2's `isFinite`/`Number.isFinite` grep acceptance criterion — a future upload feature that drives `gcode-toolpath`'s callbacks directly (bypassing the text tokenizer) is exactly the scenario this guard defends.
- **Files modified:** `src/gcode/parseToolpath.test.ts` (comment only, no source change)
- **Committed in:** `6b809c6`

---

**Total deviations:** 2 (1 auto-fixed test-coverage gap, 1 investigated-and-documented untestable path)
**Impact on plan:** Both improve test-suite honesty and completeness without expanding scope beyond this plan's own `must_haves.truths`. No source-code behavior changed as a result.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `parseToolpath.ts`'s arc branch and `arcTessellation.ts` are ready for plan 02-03 (camera fit + status copy) to consume — arc segments carry the same `ClassifiedSegment` shape as line segments, so no downstream rendering code needs a source-type branch.
- The mill sample's visual sign-off (curved corners, three distinct depth-pass heights, no seam at arc-to-line junctions) is deferred to phase-end UAT per this project's `human_verify_mode: end-of-phase` config — not yet manually confirmed in a browser this session.
- `MAX_TOOLPATH_SEGMENTS` (5000, exported from `parseToolpath.ts`) is available for plan 02-03's status-copy work to reference if a non-zero `skippedMotionCount` needs a user-facing message.
- Pre-existing gap (not introduced this plan, already logged in STATE.md Blockers/Concerns): no functional `eslint.config.js` exists yet. Still out of scope for this plan's `files_modified` list.

---
*Phase: 02-g-code-import-static-toolpath*
*Completed: 2026-08-14*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`src/gcode/arcTessellation.ts`, `src/gcode/arcTessellation.test.ts`, `public/gcode/mill-sample.gcode`, `src/gcode/parseToolpath.ts`, `src/gcode/samples.ts`, `src/gcode/parseToolpath.test.ts`, `src/gcode/toolpath-anchor.test.ts`); commits `699c840`, `b20dc07`, `09d6578`, `54d1e6c`, `6b809c6` confirmed present in `git log`. `npm test` (8 files, 58 tests) and `npm run build` both green as of the final commit.
