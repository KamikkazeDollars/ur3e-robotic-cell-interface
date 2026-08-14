---
phase: 02-g-code-import-static-toolpath
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - package.json
  - vite.config.ts
  - public/gcode/mill-sample.gcode
  - public/gcode/print-sample.gcode
  - src/App.tsx
  - src/gcode/arcTessellation.test.ts
  - src/gcode/arcTessellation.ts
  - src/gcode/gcode-libs.d.ts
  - src/gcode/parseToolpath.test.ts
  - src/gcode/parseToolpath.ts
  - src/gcode/samples.ts
  - src/gcode/toolpath-anchor.test.ts
  - src/gcode/toolpath-anchor.ts
  - src/scene/CellScene.tsx
  - src/scene/RailRig.tsx
  - src/scene/Toolpath.tsx
  - src/scene/ToolpathCameraFit.tsx
  - src/store/cellStore.test.ts
  - src/store/cellStore.ts
  - src/ui/SampleSelect.tsx
  - src/ui/SceneStatusOverlay.tsx
  - src/ui/scene-status-copy.test.ts
  - src/ui/scene-status-copy.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The parsing/classification pipeline (`parseToolpath.ts`, `arcTessellation.ts`, `toolpath-anchor.ts`) is well-tested and its documented invariants (finite-coordinate rejection, segment ceiling, zero-length drop, D-06 anchor translation) hold up under trace-through and are backed by targeted unit tests against the real bundled fixtures.

However, the camera-framing feature (`ToolpathCameraFit.tsx`) — the component whose entire job is to frame the camera on a newly loaded toolpath (D-05) — has a stale-closure/dependency bug that means it never actually fires against a successfully parsed toolpath in real usage: it reads `toolpath.bounds` at the moment the sample selection *begins* (when the store has already been reset to `toolpath: null` for the pending fetch), and its effect dependency array never changes again once the async parse resolves, so it can't re-fire. This is a functional regression against the component's own stated purpose and has no test coverage to catch it (there is no test file for `ToolpathCameraFit.tsx` in this phase).

A second, lower-severity but real defect lives in `parseToolpath.ts`'s independent feed-rate pre-scan: it desyncs from the actual `addLine`/`addArcCurve` callback sequence whenever a line carries bare X/Y/Z/I/J/K words alongside a non-motion G command (e.g. `G92 X0 Y0`, `G10 L20 P1 X0`), because `gcode-toolpath`'s interpreter does not invoke either callback for those commands. Verified against the installed package's actual dist source. Neither bundled sample currently triggers this path, so it is latent rather than currently user-visible, but it silently misattributes feed rates rather than erroring, which is exactly the failure mode this module's own docstring says it must avoid ("never a substituted default").

## Critical Issues

### CR-01: ToolpathCameraFit never frames the camera on an actually-loaded toolpath

**File:** `src/scene/ToolpathCameraFit.tsx:30-73`
**Issue:**
The effect's only dependency is `selectedSampleId`:
```ts
useEffect(() => {
  if (!controls) return
  const bounds = useCellStore.getState().toolpath?.bounds
  if (!bounds) return
  // ...frame camera...
}, [selectedSampleId])
```
`cellStore.ts`'s `selectSample` sets `selectedSampleId` and `toolpath: null` in the *same* synchronous `set()` call before the async `fetch`/`parseToolpath` work even starts:
```ts
set({ selectedSampleId: sampleId, toolpathLoadStatus: 'parsing', toolpath: null })
// ...await fetch...
set({ toolpath, toolpathLoadStatus: 'ready' })   // selectedSampleId unchanged here
```
Sequence of events on every real selection:
1. `selectedSampleId` changes → `ToolpathCameraFit` re-renders → effect fires (dependency changed) → reads `useCellStore.getState().toolpath?.bounds`, which is `null` because `toolpath` was reset to `null` in the very same `set()` call that changed `selectedSampleId` → `if (!bounds) return` → camera is not touched.
2. The fetch/parse resolves later and `set({ toolpath, toolpathLoadStatus: 'ready' })` populates real bounds — but this call does **not** change `selectedSampleId`, and `ToolpathCameraFit` does not subscribe to `toolpath` via the `useCellStore` hook (only `selectedSampleId`, via a plain `useCellStore((state) => state.selectedSampleId)` selector), so the component does not re-render for this update, and even if it did, the effect's dependency array (`[selectedSampleId]`) would not have changed, so React would not re-run the effect body.

Net effect: the camera is never framed to a loaded toolpath's bounds for any sample selection, ever — the feature is dead code in practice. Nothing throws, so this fails silently and would only be caught by a human visually checking whether the camera actually reframes after picking a sample (there is no automated test for this component).

The in-file comment block that justifies the narrow dependency array explicitly reasons about avoiding "re-parses that don't change the selected sample id" — it does not address the case actually occurring on every selection: the *first* parse of a newly selected sample, which is asynchronous and therefore always postdates the effect's own firing.

**Fix:** Subscribe to the toolpath (or its bounds) reactively so the effect re-fires when the async parse actually completes, e.g.:
```tsx
export default function ToolpathCameraFit() {
  const camera = useThree((state) => state.camera) as ThreePerspectiveCamera
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null
  const bounds = useCellStore((state) => state.toolpath?.bounds ?? null)

  useEffect(() => {
    if (!controls || !bounds) return
    // ...frame camera using `bounds` directly instead of getState()...
  }, [bounds, controls])

  return null
}
```
(Keep `controls` in the dependency array too, or guard/re-derive as needed — the current effect can also silently no-op forever if `controls` is `null` on the one run it gets, since nothing re-triggers it once `controls` becomes available either.)

## Warnings

### WR-01: Feed-rate pre-scan desyncs on non-motion G commands carrying bare coordinate words

**File:** `src/gcode/parseToolpath.ts:95-118` (`extractFeedRateQueue`)
**Issue:**
`extractFeedRateQueue` pushes one queue entry for every line where `hasMotionWord || hasBareCoordinateWord` is true:
```ts
const hasBareCoordinateWord = words.some(([letter]) =>
  ['X', 'Y', 'Z', 'I', 'J', 'K'].includes(letter),
)
if (hasMotionWord || hasBareCoordinateWord) {
  queue.push(currentFeedRate)
}
```
This queue is consumed strictly by call order against `gcode-toolpath`'s real `addLine`/`addArcCurve` callbacks in `parseToolpath`. Verified directly against the installed `gcode-toolpath@3.0.0` dist source (`node_modules/gcode-toolpath/dist/cjs/Toolpath.js`): commands such as `G92` (set position) and `G10` (coordinate system data) accept `X`/`Y`/`Z` parameters but never call `fn.addLine`/`fn.addArcCurve` — they only mutate internal position/offset state. A line like `G92 X0 Y0` satisfies `hasBareCoordinateWord` (X and Y letters present) and pushes a queue entry that no callback will ever consume, permanently shifting `feedRateIndex` one entry ahead of the true callback sequence for the remainder of the file. Every `ClassifiedSegment.feedRate` reported after that point is silently the *previous* line's feed rate, not the correct one — with no error, warning, or `skippedMotionCount` increment, i.e. exactly the "substituted"/misattributed value this module's own docstring says must never happen ("this field must never be used to time a rapid" / "never a substituted default").

Neither bundled sample (`public/gcode/mill-sample.gcode`, `public/gcode/print-sample.gcode`) uses `G92` or `G10`, so this is not currently reachable through the shipped UI (no upload feature exists yet), but it is a real, provable defect in the pre-scan's line-classification heuristic that will silently corrupt data the moment a future upload feature accepts arbitrary g-code, or if a bundled sample is ever extended to use work-offset commands.

**Fix:** Base the queue-push decision on the same criteria `gcode-toolpath`'s interpreter actually uses to decide whether a line fires `addLine`/`addArcCurve` — i.e., only push when the line has an explicit G0–G3 motion word, or has bare coordinate words *and no other G word is present on the line* (so a bare-coordinate continuation of the active motion mode is distinguished from a bare-coordinate parameter to G92/G10/etc.):
```ts
const gWords = words.filter(([letter]) => letter === 'G').map(([, value]) => Number(value))
const hasMotionWord = gWords.some((v) => [0, 1, 2, 3].includes(v))
const hasOtherGWord = gWords.some((v) => ![0, 1, 2, 3].includes(v))
const hasBareCoordinateWord = words.some(([letter]) =>
  ['X', 'Y', 'Z', 'I', 'J', 'K'].includes(letter),
)
if (hasMotionWord || (hasBareCoordinateWord && !hasOtherGWord)) {
  queue.push(currentFeedRate)
}
```
Add a regression test with a `G92 X0 Y0` line followed by further motion lines, asserting the reported `feedRate` values are still correctly aligned.

### WR-02: `ToolpathCameraFit` has no test coverage despite driving a documented core-value behavior (D-05)

**File:** `src/scene/ToolpathCameraFit.tsx`
**Issue:** Every other stateful module in this phase (`parseToolpath.ts`, `arcTessellation.ts`, `toolpath-anchor.ts`, `cellStore.ts`, `scene-status-copy.ts`) has a corresponding `*.test.ts`. `ToolpathCameraFit.tsx` — which implements the camera-fit-to-toolpath requirement called out in its own doc comment as "D-05" — has none, which is very likely why CR-01 above shipped undetected.
**Fix:** Extract the pure math (center/size/distance/direction computation) into a testable helper function, and add a unit test asserting it produces a finite, sane camera position/target for representative bounds (including the degenerate zero-size guard already present). If full effect-timing coverage is wanted, add a React Testing Library-based test that exercises the async `selectSample` → bounds-available → camera-moved path directly, which would have caught CR-01.

## Info

### IN-01: `ClassifiedSegment.feedRate` silently assumes G21 (mm) units for the raw F word

**File:** `src/gcode/parseToolpath.ts:30-35`, `95-118`
**Issue:** Coordinate values passed into `addLine`/`addArcCurve` are already unit-corrected by `gcode-toolpath` internally (it multiplies by 25.4 when the file is in `G20`/inches mode, confirmed via `translateX`/`in2mm` in the installed package source), so `toScenePoint`'s fixed `MM_TO_M` conversion is safe. However, `extractFeedRateQueue` reads the raw `F` word straight off `gcode-parser`'s tokenized line with no equivalent unit correction. The field's own doc comment states the value is "in the file's own units (mm/min)", which silently assumes the file's own units *are* mm — untrue for a `G20` file, where the F word is inches/min but would be reported/labelled as if it were mm/min. Not currently reachable (both bundled samples are `G21`-only, and there is no upload path), but worth flagging alongside the module's otherwise careful "never fabricate/mislabel a value" discipline used everywhere else in this file (e.g. `skippedMotionCount`, the finite-coordinate guard).
**Fix:** Either explicitly reject/flag `G20` input for now (mirroring the documented G18/G19 arc-plane limitation in `arcTessellation.ts`), or convert the pre-scanned F word through the same modal-units tracking used for the interpreter itself before this module needs to support arbitrary uploaded files.

### IN-02: Inline `<style>` keyframes block re-created on every render while the overlay is visible

**File:** `src/ui/SceneStatusOverlay.tsx:78-80`
**Issue:** The `@keyframes` rule is declared via a `<style>` JSX element inside the component body, so it is re-evaluated (though ultimately reconciled to the same DOM node/text by React) on every render while the overlay is mounted. This isn't a functional bug — React diffs it to a no-op DOM update — but it's an easy-to-avoid smell; keyframes belong in a static stylesheet/CSS module, not inlined per-render JSX, especially since this project already has an `index.css` for shared UI-SPEC tokens.
**Fix:** Move `@keyframes gsd-scene-status-spin` into the project's global stylesheet (e.g. `index.css`) and drop the inline `<style>` tag entirely.

---

_Reviewed: 2026-08-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
