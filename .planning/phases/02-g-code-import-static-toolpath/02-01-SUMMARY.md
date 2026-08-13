---
phase: 02-g-code-import-static-toolpath
plan: 01
subsystem: 3d-toolpath
tags: [gcode-toolpath, gcode-parser, vite-plugin-node-polyfills, react-three-fiber, drei, zustand, three.js]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: RailRig.tsx scene-composition constants (RIG_Z_OFFSET, ROBOT_REACH_ENVELOPE, RAIL_CENTER_X), CellScene.tsx Canvas composition, cellStore.ts store conventions, forwardKinematics/UR3E_READY_POSE kinematics barrel
provides:
  - "public/gcode/print-sample.gcode — hand-authored 3-layer inset-square printing sample (exactly 7 G0 / 12 G1)"
  - "src/gcode/samples.ts — GCODE_SAMPLES bundled-sample registry"
  - "src/gcode/parseToolpath.ts — SIM-01 parse+classify pipeline (parseToolpath, toRenderBuckets, ClassifiedSegment, ParsedToolpath)"
  - "src/gcode/toolpath-anchor.ts — D-06 ROBOT_MOUNT_WORLD / TOOLPATH_ANCHOR_OFFSET, the stable world-space contract Phase 3 consumes"
  - "src/scene/Toolpath.tsx — two-batch dashed/solid color-coded toolpath rendering (SIM-02, D-03, D-04)"
  - "src/ui/SampleSelect.tsx — D-02 sample-selection dropdown"
  - "src/scene/RailRig.tsx CARRIAGE_TOP_Y — newly exported (Pitfall D)"
  - "src/store/cellStore.ts — selectedSampleId/toolpathLoadStatus/toolpath fields + selectSample async action"
affects: [02-02-arc-tessellation-mill-sample, 02-03-camera-fit-status-copy, phase-3-ik-trajectory]

# Actuals (#2632)
actuals:
  tokens: 8225
  tasks: 2
  commits: 1

tech-stack:
  added: [gcode-toolpath@3.0.0, gcode-parser@2.2.0, vite-plugin-node-polyfills@0.28.0]
  patterns:
    - "Independent feed-rate pre-scan (parseStringSync) zipped onto gcode-toolpath's addLine/addArcCurve callbacks by call order, since gcode-toolpath never reads params.F"
    - "Single mm->m unit-conversion + axis-remap boundary (toScenePoint) inside parseToolpath.ts — no rounding, no second conversion site"
    - "D-06 anchor: bbox X/Z-center + min-Y translated onto TOOLPATH_ANCHOR_OFFSET, reported via appliedAnchorTranslation for inspectability"
    - "Two batched drei <Line segments> draws (dashed gray rapid, solid warm cutting) instead of one vertexColors batch, since dash state is material-level"
    - "Ambient .d.ts for untyped npm packages (gcode-parser/gcode-toolpath ship no types) — only the actually-called surface is declared"

key-files:
  created:
    - src/gcode/parseToolpath.ts
    - src/gcode/toolpath-anchor.ts
    - src/gcode/samples.ts
    - src/gcode/gcode-libs.d.ts
    - src/scene/Toolpath.tsx
    - src/ui/SampleSelect.tsx
    - public/gcode/print-sample.gcode
  modified:
    - src/store/cellStore.ts
    - src/scene/CellScene.tsx
    - src/scene/RailRig.tsx
    - src/App.tsx
    - vite.config.ts
    - package.json

key-decisions:
  - "Human explicitly approved installing gcode-toolpath/gcode-parser (SUS-verdict, low-download-only) after reviewing the npm/GitHub legitimacy evidence in Task 1's blocking checkpoint."
  - "Disabled vite-plugin-node-polyfills's default globals (process/Buffer/global) — only the stream/events/timers module polyfills are needed for the Pitfall B Rollup fix; the global process shim silently broke Vitest's process.cwd() resolution project-wide."
  - "print-sample.gcode hand-authored as three inset square perimeters (150mm/140mm/130mm) at 0.2/0.4/0.6mm layer heights, exactly 7 G0 + 12 G1, F1200 opening feed rate with F900 on layer 3's first cut — matches the plan's committed test-count contract for 02-02."
  - "skippedMotionCount is scoped narrowly to arc (G2/G3) motions this plan, since arc tessellation is explicitly deferred to plan 02-02; zero-length line segments are dropped silently per the plan's own truth, not counted there."

patterns-established:
  - "Pattern: parseToolpath.ts is the single load-bearing SIM-01 contract module — Phase 3 and plan 02-02 both extend it rather than re-deriving classification logic."
  - "Pattern: toolpath-anchor.ts composes world-space constants purely from imports (RailRig.tsx, kinematics barrel), never restating a literal — same discipline RailRig.tsx already established for RAIL_TRAVEL/RIG_Z_OFFSET."

requirements-completed: [SIM-01, SIM-02]

coverage:
  - id: D1
    description: "SIM-01: bundled print sample parses into classified segments with correct move type, scene-space points, and per-segment feed rate (null until first F word, 1200 then 900)"
    requirement: SIM-01
    verification:
      - kind: manual_procedural
        ref: "node REPL scratch check (src/gcode/__scratch__.test.ts, run via `npx vitest run`, not committed): 7 rapid + 12 cut segments, first cut feedRate=1200, last cut feedRate=900"
        status: pass
    human_judgment: true
    rationale: "Plan 02-01's own acceptance criteria explicitly defer the committed parseToolpath.test.ts to plan 02-02 ('Plan 02-02 turns this into a committed test'); this plan only requires a scratch/REPL-level check, which is not machine-verifiable from CI going forward."
  - id: D2
    description: "SIM-02: selecting the print sample renders its toolpath as two visually distinct line styles (dashed gray rapid, solid warm cutting) anchored in front of the robot on the floor"
    requirement: SIM-02
    verification: []
    human_judgment: true
    rationale: "Color/dash visual distinctness and on-screen anchor placement are only confirmable by a human viewing the rendered scene (02-RESEARCH.md: 'not automatable in this project's current node-environment Vitest setup'); per this project's human_verify_mode=end-of-phase config, this is deferred to phase-end UAT rather than gated per-plan."
  - id: D3
    description: "Production build succeeds with gcode-toolpath/gcode-parser reachable from the module graph (Pitfall B Rollup gate)"
    verification:
      - kind: other
        ref: "npm run build (tsc -b && vite build)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No regression in the existing Phase 1 Vitest suite"
    verification:
      - kind: unit
        ref: "npm test (32 tests, 5 files)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 1: Bundled Sample Toolpath — Parse, Anchor, Render Summary

**End-to-end g-code tracer slice: gcode-toolpath/gcode-parser wired through a feed-rate pre-scan, D-06 world-space anchor, and a two-batch dashed/solid drei Line render, proven by a passing production build against the Rollup-breaking parser dependency.**

## Performance

- **Duration:** ~30 min (Task 2, post-checkpoint-approval)
- **Tasks:** 2 (Task 1: blocking package-legitimacy checkpoint — approved by human; Task 2: tracer implementation)
- **Files modified:** 13 (excluding package-lock.json)

## Accomplishments
- `parseToolpath.ts` classifies bundled g-code into rapid/cut segments with an independently pre-scanned per-segment feed rate (gcode-toolpath itself never reads the F word — verified via source read, 02-RESEARCH.md Pitfall A)
- `toolpath-anchor.ts` derives D-06's `ROBOT_MOUNT_WORLD`/`TOOLPATH_ANCHOR_OFFSET` purely from imported RailRig/kinematics constants — the stable contract Phase 3's IK targets will consume
- `Toolpath.tsx` renders exactly two batched drei `<Line segments>` draws (dashed muted gray for rapids, solid warm orange for cuts) — satisfies D-03/D-04 without per-segment draw calls
- `public/gcode/print-sample.gcode` hand-authored to the plan's exact test-count contract: 7 G0, 12 G1, F1200→F900
- Production build (`npm run build`) proven green against the Rollup class-extends failure `gcode-parser`'s Node-builtin imports otherwise trigger

## Task Commits

1. **Task 1: Package-legitimacy gate for the g-code parser stack** — checkpoint, no commit (human typed "approved")
2. **Task 2: End-to-end "select a bundled sample, see its colour-coded toolpath"** — `c9570a3` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/gcode/parseToolpath.ts` - SIM-01 classification pipeline: feed-rate pre-scan, mm->m conversion, zero-length drop, D-06 anchor translation
- `src/gcode/toolpath-anchor.ts` - D-06 world-space anchor constants
- `src/gcode/samples.ts` - bundled sample registry (`GCODE_SAMPLES`)
- `src/gcode/gcode-libs.d.ts` - ambient types for the untyped `gcode-parser`/`gcode-toolpath` packages
- `src/scene/Toolpath.tsx` - two-batch dashed/solid toolpath render
- `src/ui/SampleSelect.tsx` - D-02 sample dropdown
- `public/gcode/print-sample.gcode` - hand-authored printing sample
- `src/store/cellStore.ts` - added `selectedSampleId`/`toolpathLoadStatus`/`toolpath`/`selectSample`
- `src/scene/CellScene.tsx` - mounted `<Toolpath />`
- `src/scene/RailRig.tsx` - exported `CARRIAGE_TOP_Y`
- `src/App.tsx` - mounted `<SampleSelect />`
- `vite.config.ts` - added `vite-plugin-node-polyfills` (module polyfills only, globals disabled)
- `package.json` - added `gcode-toolpath`, `gcode-parser`, `vite-plugin-node-polyfills`

## Decisions Made
- Human approved installing `gcode-toolpath`/`gcode-parser` after Task 1's blocking checkpoint (SUS-verdict low-download packages, otherwise clean provenance per 02-RESEARCH.md's Package Legitimacy Audit).
- `vite-plugin-node-polyfills` configured with `globals: { process: false, Buffer: false, global: false }` — see Deviations below.
- `skippedMotionCount` scoped to arc (G2/G3) motions only this plan; zero-length line segments are dropped without incrementing any counter, matching the plan's literal Step 6 wording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `vite-plugin-node-polyfills`'s default global shims broke the existing Vitest suite's `process.cwd()`**
- **Found during:** Task 2, Step 11 verification (`npm test`)
- **Issue:** Adding `nodePolyfills({ include: ['stream', 'events', 'timers'] })` per the plan's exact instruction fixed the Rollup build (Pitfall B) but also caused `urdf-asset.test.ts` to fail with `ENOENT: no such file or directory, open 'C:\public\robots\ur3e\ur3e.urdf'`. Root cause: the plugin's default `globals: { process: true, Buffer: true, global: true }` rewrites every `process`/`Buffer`/`global` reference project-wide during Vite's `serve` command — which Vitest also runs under — replacing real Node's `process` object with a browser-style polyfill whose `process.cwd()` returns `/`, breaking `urdf-asset.test.ts`'s `join(process.cwd(), 'public/robots/...')` path resolution (confirmed via a scratch `console.log(process.cwd())` check under Vitest, which printed `/`).
- **Fix:** Added `globals: { process: false, Buffer: false, global: false }` to the `nodePolyfills` config. This only disables the global-identifier shim injection; the `include: ['stream', 'events', 'timers']` module-level polyfills (the actual Pitfall B fix) are untouched and still fully effective.
- **Files modified:** `vite.config.ts`
- **Verification:** `npm test` returns to 32/32 passing (confirmed both before this fix broke it and after the fix restored it); `npm run build` re-verified green after the change.
- **Committed in:** `c9570a3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to avoid a real regression in the pre-existing test suite; no scope creep — the fix is a single config flag on the exact plugin the plan already specified.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `parseToolpath.ts`'s `ClassifiedSegment`/`ParsedToolpath` contract and `toolpath-anchor.ts`'s `TOOLPATH_ANCHOR_OFFSET`/`ROBOT_MOUNT_WORLD` are ready for plan 02-02 (arc tessellation, mill sample, committed test suite) to extend without touching this plan's already-verified line/rapid classification path.
- SIM-02's visual sign-off (dashed gray vs. solid warm cutting line, anchored in front of the robot) is deferred to phase-end UAT per this project's `human_verify_mode: end-of-phase` config — not yet manually confirmed in a browser this session, though the dev server was smoke-tested (boots clean, serves `/gcode/print-sample.gcode` correctly, no console errors observed at startup).
- Pre-existing gap (not introduced this plan, already logged in STATE.md Blockers/Concerns): no functional `eslint.config.js` exists yet (`npm run lint` fails immediately with "ESLint couldn't find an eslint.config.js"). Out of scope for this plan's files_modified list; still worth fixing before Phase 2 accumulates more scene code, per the existing STATE.md note.

---
*Phase: 02-g-code-import-static-toolpath*
*Completed: 2026-08-14*

## Self-Check: PASSED

All created files confirmed present on disk (`public/gcode/print-sample.gcode`, `src/gcode/{parseToolpath.ts,toolpath-anchor.ts,samples.ts,gcode-libs.d.ts}`, `src/scene/Toolpath.tsx`, `src/ui/SampleSelect.tsx`); commit `c9570a3` confirmed present in `git log`.
