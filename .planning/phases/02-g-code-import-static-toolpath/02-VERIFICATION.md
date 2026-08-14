---
phase: 02-g-code-import-static-toolpath
verified: 2026-08-14T07:18:33Z
status: human_needed
score: 8/9 must-haves verified
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "Run `npm run dev`, pick the print sample from the dropdown, and observe the 3D cell."
    expected: "The toolpath appears in front of the robot, resting on the floor, with rapid moves drawn as a dashed muted-gray line and cutting moves drawn as a solid, slightly thicker warm-orange line — the two classes stay visually distinguishable in a greyscale still."
    why_human: "Visual color/dash distinctness and on-screen placement can only be confirmed by looking at the rendered WebGL output, not by grep/AST inspection."
  - test: "Pick the mill sample from the dropdown and observe its rounded corners and depth passes."
    expected: "The four G2/G3 arc corners render as smooth curves (not straight chords), and the three depth passes are visible at three distinct heights, with no visible seam at any arc-to-line junction."
    why_human: "Curve smoothness and depth-pass height separation are visual properties with no automatable assertion beyond the numeric tests already run on `tessellateArc` in isolation."
  - test: "Pick the print sample, then pick the mill sample, and watch the camera behavior. Then click Reset View."
    expected: "Each sample selection re-frames the camera to fit that sample's own bounding box (a visible pull-in/zoom-out as scale differs between the two samples). Reset View afterwards returns to the wide Phase-1 default framing, not to either toolpath fit."
    why_human: "CR-01 (found by code review) was a real bug where this exact effect never fired against a loaded toolpath. The fix (commit 52e7c9e, keying the effect on `toolpathLoadStatus` instead of `selectedSampleId`) is confirmed sound by this verification's own static trace of `cellStore.ts`'s `selectSample` state transitions (see Behavioral Trace section below), but no automated test exists for `ToolpathCameraFit.tsx` (review's own WR-02, still open) — so the runtime behavior itself is unverified by any test suite and needs an eyeball check."
  - test: "Temporarily rename `public/gcode/print-sample.gcode` on disk, reload the app, and select the print sample. Restore the filename afterwards."
    expected: "An error message appears over the canvas (not a blank scene, not a console-only failure)."
    why_human: "Requires manually breaking a file on disk and observing the DOM overlay; not exercisable from a static check."
  - test: "Look at the dropdown area in the running app."
    expected: "A label stating samples are interpreted in millimetres is visible beside the dropdown."
    why_human: "Visual presence/legibility of UI copy is a rendering check, not a code-structure check (the code-level grep for the `mm` string already passed in this report's Anti-Patterns/Artifacts sections)."
---

# Phase 2: G-code Import + Static Toolpath Verification Report

**Phase Goal:** Users can upload a g-code file and see it parsed into a classified, color-coded toolpath rendered in the 3D scene, independent of any kinematics/animation risk (scope note: "upload" = select a bundled sample per locked decision D-01; no upload UI is built)
**Verified:** 2026-08-14T07:18:33Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select a bundled g-code sample and the system parses it into classified move segments (move type, coordinates, feed rate per segment) — ROADMAP SC1 / SIM-01 | ✓ VERIFIED | `src/gcode/parseToolpath.ts` exports `parseToolpath`; `src/gcode/parseToolpath.test.ts` (15 tests) reads both shipped `.gcode` fixtures from disk and asserts exact segment counts (print: 7 rapid/12 cut; mill: 3 rapid/27 cut incl. 12 arc) and real feed rates (1200→900; 300/600), all passing (`npm test`: 65/65 green) |
| 2 | Rapid (G0) and cutting (G1/G2/G3) moves render as visually distinct line styles in the 3D scene — ROADMAP SC2 / SIM-02 (code presence + wiring half) | ✓ VERIFIED (code) / needs human sign-off (visual) | `src/scene/Toolpath.tsx` renders exactly 2 batched drei `<Line segments>` draws — dashed `RAPID_COLOR` (#9CA3AF) and solid, thicker `CUTTING_COLOR` (#EA580C); `toRenderBuckets` bucket-split logic is unit-tested (print: 14 rapid/24 cutting entries; mill: 6 rapid + arc-summed cutting, all passing). Actual on-screen color/dash distinctness is a rendering property — see Human Verification |
| 3 | Every classified segment carries move type, ordered scene-space points, and modal feed rate (null until first F word, never a substituted default) | ✓ VERIFIED | `ClassifiedSegment.feedRate` typed `number \| null`; pre-scan (`extractFeedRateQueue`) never defaults to 0; asserted by test (first cut = 1200, plunge = 300, no fabricated zero) |
| 4 | G2/G3 arcs tessellate into curves with bit-identical endpoints (no seam at arc-to-line junctions) | ✓ VERIFIED | `src/gcode/arcTessellation.ts` + `arcTessellation.test.ts` (8 tests): `toEqual` (strict) equality on start/end points, CW/CCW sweep, full circle, degenerate arc, all passing |
| 5 | Non-finite coordinates and runaway segment counts are refused, counted, never rendered/hung | ✓ VERIFIED | `isFiniteVector` guard + `MAX_TOOLPATH_SEGMENTS` (5000) ceiling in `parseToolpath.ts`, both incrementing `skippedMotionCount`; ceiling behavior covered by a committed test that generates `MAX_TOOLPATH_SEGMENTS + 5` commands and asserts exact truncation |
| 6 | The toolpath renders anchored in front of the robot, inside its reach envelope, not at the file's raw coordinates (D-06) | ✓ VERIFIED | `src/gcode/toolpath-anchor.ts` derives `TOOLPATH_ANCHOR_OFFSET`/`ROBOT_MOUNT_WORLD` purely from imported `RailRig`/kinematics constants; `toolpath-anchor.test.ts` (3 tests) proves every anchored point of both samples is within `ROBOT_REACH_ENVELOPE` of `ROBOT_MOUNT_WORLD`, and the FK-derived ready-pose TCP sits within reach too |
| 7 | Selecting a second sample before the first finishes loading never lets a stale response overwrite the newer selection | ✓ VERIFIED | `cellStore.ts`'s `selectSample` carries a monotonic `selectSampleRequestId`; 2 committed tests drive out-of-order-resolving fetches for both the success and failure branches, both passing |
| 8 | Loading/error/unit/refused-command states are visible to the user, never a blank scene or leaked exception text | ✓ VERIFIED | `SceneStatusOverlay.tsx` renders `toolpathStatusCopy()`-resolved fixed copy on parsing/error, never `err.message`/`.stack` (grep-confirmed 0 matches); `SampleSelect.tsx` renders the mm unit label and, when `skippedMotionCount > 0`, a refused-command count, both read off the parsed toolpath, not a second literal |
| 9 | Selecting a sample re-frames the camera to fit that sample's bounds, without disturbing the distinct Reset View default framing | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | See "Behavioral Trace: CR-01 Fix" below — code confirmed sound by independent trace, but no automated test exists for this component (review's WR-02, still open); routed to human verification |

**Score:** 8/9 truths verified (1 present + wired, behavior confirmed only by static trace, not by an automated test)

### Behavioral Trace: CR-01 Fix (independent confirmation, not taken on faith)

The code review (`02-REVIEW.md` CR-01) found `ToolpathCameraFit.tsx`'s effect keyed on `selectedSampleId`, which flips synchronously in the *same* `set()` call that resets `toolpath` to `null` — so the effect always read `bounds = null` and never re-fired once the async parse actually populated bounds. Net effect: D-05 camera framing was dead code against any real selection.

Commit `52e7c9e` changes the effect's dependency to `toolpathLoadStatus`. Independent trace of the actual state machine in `src/store/cellStore.ts`:

```
selectSample(sampleId):
  requestId += 1
  if (invalid sampleId) -> set({ ..., toolpathLoadStatus: 'error', toolpath: null }); return
  set({ selectedSampleId, toolpathLoadStatus: 'parsing', toolpath: null })   // (A)
  await fetch + parseToolpath
  if (stale) return
  set({ toolpath, toolpathLoadStatus: 'ready' })                             // (B)
  // on catch, if not stale: set({ toolpathLoadStatus: 'error', toolpath: null })
```

`ToolpathCameraFit.tsx`'s effect is now `useEffect(() => { ...; }, [toolpathLoadStatus])`, guarded by `if (toolpathLoadStatus !== 'ready') return`. At transition (A) the effect fires but no-ops (status is `'parsing'`, guard returns early). At transition (B) — the exact moment `toolpath.bounds` becomes non-null — `toolpathLoadStatus` flips from `'parsing'` to `'ready'`, which is a *different* value than before, so React re-runs the subscribed selector, the component re-renders, the dependency array changes, and the effect body runs with `useCellStore.getState().toolpath?.bounds` now populated. This closes the exact gap CR-01 identified: the effect now reacts to the transition when bounds actually exist, not to the transition when they were just cleared.

**Verdict: the fix is sound** — traced independently against the real store code, not asserted from the commit message or SUMMARY.md. It is not marked ✓ VERIFIED outright because no committed test exercises this state transition (confirmed: no `ToolpathCameraFit.test.tsx`/`.test.ts` file exists on disk), so a future regression on this exact effect-timing bug would not be caught by `npm test`. This is `02-REVIEW.md`'s own WR-02 ("no test coverage despite driving a documented core-value behavior"), still open post-fix.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `public/gcode/print-sample.gcode` | 7×G0, 12×G1, F1200→F900 | ✓ VERIFIED | Counts confirmed by grep and by the committed asset-integrity test |
| `public/gcode/mill-sample.gcode` | 3×G0, 15×G1 (incl. 3 plunges), 8×G3, 4×G2 | ✓ VERIFIED | Counts confirmed by grep and by the committed asset-integrity test |
| `src/gcode/samples.ts` | `GCODE_SAMPLES` with print + mill entries | ✓ VERIFIED | Both entries present, print first (default) |
| `src/gcode/parseToolpath.ts` | SIM-01 parse+classify pipeline | ✓ VERIFIED | All exports present (`parseToolpath`, `toRenderBuckets`, `ClassifiedSegment`, `ParsedToolpath`, `MoveClass`), 90+ lines, substantive logic |
| `src/gcode/arcTessellation.ts` | Pure G2/G3 tessellation | ✓ VERIFIED | Zero imports (dependency-free math module, confirmed), exact endpoint copy verified |
| `src/gcode/toolpath-anchor.ts` | D-06 anchor constants | ✓ VERIFIED | Both constants derived purely from imports, no literal retyping |
| `src/scene/Toolpath.tsx` | Two-batch color/dash render | ✓ VERIFIED | Exactly 2 `<Line>` elements, `segments` mode, `dashed` on rapid only, `useMemo` keyed on toolpath |
| `src/scene/ToolpathCameraFit.tsx` | D-05 camera auto-fit | ✓ VERIFIED (code) / ⚠️ behavior unproven by test | Present, wired into `CellScene.tsx`; see Behavioral Trace above |
| `src/ui/SampleSelect.tsx` | D-02 dropdown + unit/refused-command disclosure | ✓ VERIFIED | Native `<select>`, mm label, conditional refused-command notice, no Accent-blue reuse |
| `src/store/cellStore.ts` | toolpath fields/actions + stale-response guard | ✓ VERIFIED | `selectSample`, `selectSampleRequestId`, all fields present and covered by tests |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `src/gcode/toolpath-anchor.ts` | `src/scene/RailRig.tsx` | imports `CARRIAGE_TOP_Y`/`ROBOT_REACH_ENVELOPE`/`RIG_Z_OFFSET` | ✓ WIRED |
| `src/gcode/parseToolpath.ts` | `src/gcode/toolpath-anchor.ts` | applies `TOOLPATH_ANCHOR_OFFSET` as final translation | ✓ WIRED |
| `src/store/cellStore.ts` | `src/gcode/parseToolpath.ts` | `selectSample` fetches + calls `parseToolpath` | ✓ WIRED |
| `src/ui/SampleSelect.tsx` | `src/store/cellStore.ts` | `onChange` dispatches `selectSample` | ✓ WIRED |
| `src/scene/CellScene.tsx` | `src/scene/Toolpath.tsx` | mounted after `rail-rig-mount`, before `OrbitControls` | ✓ WIRED |
| `src/gcode/parseToolpath.ts` | `src/gcode/arcTessellation.ts` | `addArcCurve` calls `tessellateArc` | ✓ WIRED |
| `src/scene/CellScene.tsx` | `src/scene/ToolpathCameraFit.tsx` | mounted as sibling of `CameraResetListener` | ✓ WIRED |
| `src/scene/ToolpathCameraFit.tsx` | `src/store/cellStore.ts` | reads `toolpathLoadStatus` + `toolpath.bounds` | ✓ WIRED (re-fires correctly post-fix, see trace) |
| `src/ui/SceneStatusOverlay.tsx` | `src/ui/scene-status-copy.ts` | renders via `toolpathStatusCopy()`, never inlined literal | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `Toolpath.tsx` | `rapidPoints`/`cuttingPoints` | `toRenderBuckets(toolpath.segments)`, `toolpath` from Zustand store, set by `selectSample`'s real `parseToolpath` call over `fetch`ed `.gcode` text | Yes | ✓ FLOWING |
| `ToolpathCameraFit.tsx` | `bounds` | `useCellStore.getState().toolpath?.bounds`, computed by `parseToolpath` from real parsed points | Yes | ✓ FLOWING |
| `SampleSelect.tsx` | `unitLabel`/`skippedMotionCount` | `toolpath?.unit` / `toolpath?.skippedMotionCount` off the real parsed result | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Production build succeeds with the parser stack bundled | `npm run build` | `tsc -b && vite build` exits 0, 772 modules transformed | ✓ PASS |
| Full Vitest suite passes (no regression, all phase-2 assertions included) | `npm test` | 8 files, 65 tests, all green | ✓ PASS |
| Both bundled samples' committed command counts match the plan's authoring contract | `grep -c '^G0'/'^G1 '` on `print-sample.gcode`; `grep -c '^G0'/'^G1\b'/'^G3\b'/'^G2\b'` on `mill-sample.gcode` | 7/12 (print); 3/15/8/4 (mill) | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified source files | `grep -nE` across all 10 phase-2 source files | No matches in any file | ✓ PASS |
| `ToolpathCameraFit.tsx`'s effect re-fires on the transition that actually populates bounds | Static trace against `cellStore.ts`'s real `set()` sequence (no runnable single-named test exists — none was committed for this component) | Effect keyed on `toolpathLoadStatus`; transition to `'ready'` is the same transition that populates `toolpath.bounds` | ? SKIP (no committed test to run; traced statically instead — see Behavioral Trace) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SIM-01 | 02-01, 02-02, 02-03 | User can upload (select) a g-code file, parsed into classified toolpath (move type, coordinates, feed rate) | ✓ SATISFIED | `parseToolpath.ts` + 15-test asset-integrity suite, both bundled samples |
| SIM-02 | 02-01, 02-02, 02-03 | Parsed toolpath rendered as color-coded line, rapid vs. cutting visually distinct | ✓ SATISFIED (code) / pending visual sign-off | `Toolpath.tsx` two-batch dash/color render, bucket-split tested; on-screen distinctness needs human check |

No orphaned requirements: REQUIREMENTS.md maps only SIM-01/SIM-02 to Phase 2, and both are claimed by all three plans' frontmatter.

### Anti-Patterns Found

None. Scanned all 10 phase-2-touched source files (`parseToolpath.ts`, `toolpath-anchor.ts`, `arcTessellation.ts`, `Toolpath.tsx`, `ToolpathCameraFit.tsx`, `SampleSelect.tsx`, `SceneStatusOverlay.tsx`, `scene-status-copy.ts`, `cellStore.ts`, `samples.ts`, plus `gcode-libs.d.ts`, `vite.config.ts`, `RailRig.tsx`) for debt markers, empty implementations, and hardcoded stub values — none found.

Two known, previously-flagged, non-blocking defects remain open from `02-REVIEW.md` and are worth carrying forward rather than treating as resolved:

- **WR-01 (still open):** `extractFeedRateQueue` in `parseToolpath.ts` desyncs the feed-rate pre-scan queue against the real `addLine`/`addArcCurve` callback sequence for a line carrying bare X/Y/Z/I/J/K words alongside a non-motion G command (e.g. `G92 X0 Y0`, `G10 L20 P1 X0`) — confirmed neither bundled sample uses `G92`/`G10` (`grep` returns 0 matches in both `.gcode` files), so this is latent, not currently reachable, and does not block this phase's goal for the two bundled samples. Will become reachable the moment an upload feature or a new sample uses work-offset commands.
- **WR-02 (still open):** No committed test exists for `ToolpathCameraFit.tsx` despite it driving D-05. This is exactly the gap that let CR-01 ship — and although CR-01 itself is now fixed and independently confirmed sound (see Behavioral Trace), the absence of a regression test means a future refactor could reintroduce the same class of bug undetected by `npm test`.

## Human Verification Required

5 items need human testing (including 1 present-but-behavior-unverified truth — the camera-fit effect fix is code-confirmed sound but has no automated regression test):

1. **Print sample visual render** — Run `npm run dev`, select the print sample. Expected: toolpath in front of the robot on the floor, dashed gray rapids, solid thicker warm cutting line, clearly distinguishable in greyscale. Why human: rendering/color/dash-legibility is not automatable.
2. **Mill sample visual render** — select the mill sample. Expected: 3 depth passes at visibly distinct heights, smooth curved corners (not chorded), no seam at arc-to-line junctions. Why human: curve smoothness and depth separation are visual properties.
3. **Camera auto-fit + Reset View independence** — select print, then mill, then click Reset View. Expected: camera re-frames to each sample's bounds (visible zoom change), Reset View returns to the Phase 1 wide default, not either toolpath fit. Why human: CR-01 was exactly this behavior silently failing; the fix is code-confirmed sound by this report's own trace, but zero automated tests exist for `ToolpathCameraFit.tsx` (WR-02 open) — an eyeball check is currently the only executable proof.
4. **Missing-sample error surface** — temporarily rename `public/gcode/print-sample.gcode`, reload, select it, restore the filename afterward. Expected: visible error message over the canvas, not a blank scene or console-only failure.
5. **Unit disclosure visibility** — look at the running app. Expected: "Samples are interpreted in mm." label visible beside the dropdown.

## Gaps Summary

No blocking gaps. All must-have artifacts, key links, and requirement IDs (SIM-01, SIM-02) are present, substantive, and wired; the full test suite (65/65) and production build both pass; the one critical bug found by code review (CR-01, dead camera-fit effect) has a landed fix that this verification independently traced against the real store state machine and confirms is sound. The phase does not reach `passed` status only because (a) several truths are inherently visual and were explicitly deferred by all three plans to end-of-phase human sign-off (`human_verify_mode: end-of-phase`, per this project's own config), and (b) the CR-01 fix, while code-sound, still lacks the automated test (WR-02) that would let it clear this report's own bar for an unattended ✓ VERIFIED behavior-dependent truth. Recommend: run the 5 human-verification items above before declaring Phase 2 fully signed off, and consider adding a regression test for `ToolpathCameraFit.tsx`'s effect-timing (WR-02) before Phase 3 extends this exact component for scrub/playback framing.

---

*Verified: 2026-08-14T07:18:33Z*
*Verifier: Claude (gsd-verifier)*
