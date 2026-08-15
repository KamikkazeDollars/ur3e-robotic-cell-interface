---
phase: 03-inverse-kinematics-trajectory-compile-scrub
plan: 05
subsystem: ui
tags: [three.js, react-three-fiber, vitest, gcode, toolpath]

# Dependency graph
requires:
  - phase: 03-inverse-kinematics-trajectory-compile-scrub
    provides: "plan 03-04's SCENE_PALETTE / contrastRatio, consumed for the marker/guide-vs-workbench readability gate"
provides:
  - "src/scene/marker-scale.ts — pure bounds-derived sizing for endpoint markers, the scrub marker, and the guide stem/footprint"
  - "proportional (not hardcoded) marker radii in Toolpath.tsx and ScrubMarker.tsx"
  - "a vertical guide stem + tabletop footprint pad under each start/end marker"
affects: [any future scene component rendering a marker or anchor on the toolpath, ROADMAP Phase 6 per-operation markers]

# Actuals (#2632)
actuals:
  tokens: 5689
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure sizing module split (marker-scale.ts): follows parseToolpath.ts's toRenderBuckets precedent — no React/three.js imports, every dimension a pure function of ParsedToolpath.bounds, fully covered by its own unit test independent of any 3D render."
    - "Derived-not-independent size hierarchy: scrubMarkerRadiusFromBounds multiplies markerRadiusFromBounds rather than clamping separately, so the scrub-vs-endpoint size relationship holds by construction at every toolpath scale."
    - "Bundled anchor component: AnchoredMarker in Toolpath.tsx renders a marker sphere, guide stem, and footprint pad as one unit so the three pieces of a single anchor can never render inconsistently or drift apart."

key-files:
  created:
    - src/scene/marker-scale.ts
    - src/scene/marker-scale.test.ts
  modified:
    - src/scene/Toolpath.tsx
    - src/scene/ScrubMarker.tsx

key-decisions:
  - "Followed the plan's given constant table exactly (MARKER_RADIUS_FRACTION 0.02, MIN/MAX_MARKER_RADIUS, SCRUB_MARKER_SCALE 1.75, guide ratios) — no independent tuning of the sizing fractions."
  - "AnchoredMarker hardcodes CUTTING_COLOR for its sphere/stem/footprint (not a color prop) since the plan's behavior spec says the marker sphere is 'unchanged in tone from today' and both existing endpoint markers already use CUTTING_COLOR."
  - "ScrubMarker.tsx reads its radius via a reactive Zustand selector (scrubMarkerRadiusFromBounds(state.toolpath?.bounds)) while trajectory/scrubFraction stay on getState() inside useFrame — documented in-line why this asymmetry is legitimate (bounds change once per sample selection, the coarse cadence the store's header sanctions; trajectory/scrubFraction change per frame and must not trigger reactive re-renders)."

patterns-established:
  - "Marker/anchor geometry sizing is always derived from ParsedToolpath.bounds via marker-scale.ts, never a hardcoded literal — any future marker-like scene element should follow the same pure-function-plus-unit-test split."

requirements-completed: [SIM-02, SIM-05]

coverage:
  - id: D1
    description: "markerRadiusFromBounds/scrubMarkerRadiusFromBounds/guideStemRadius/guideFootprintRadius are pure, bounds-derived, and clamp null/degenerate/oversized inputs safely"
    requirement: "SIM-02"
    verification:
      - kind: unit
        ref: "src/scene/marker-scale.test.ts (17 tests: proportional sizing, diameter ceiling regression gate, null/degenerate/oversized clamps, axis selection, scrub/endpoint hierarchy, guide stem/footprint ratios, workbench-contrast gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Toolpath.tsx renders each endpoint as a marker sphere, vertical guide stem, and tabletop footprint pad, all sized from the parsed bounds; no marker-radius literal remains in either file"
    requirement: "SIM-02"
    verification:
      - kind: unit
        ref: "npx tsc -b (full build)"
        status: pass
      - kind: unit
        ref: "npx vitest run (full suite, 916 tests / 97 files, zero regressions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Markers read as small bullet points proportional to the toolpath, guide stems/footprints are clearly visible, and the scrub marker stays the largest indicator, confirmed live in the running app"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint — user approved all 5 checks (scene colors, nav cube accent, marker size, guide visibility, scrub/endpoint hierarchy) live at http://localhost:5173/"
        status: pass
    human_judgment: true
    rationale: "Proportional sizing and contrast are proven by unit test (D1/D2), but 'reads as a small bullet point' and 'clearly visible guide' are subjective visual judgments only a live look can confirm."

# Metrics
duration: ~18min (execution) + checkpoint wait
completed: 2026-08-15
status: complete
---

# Phase 3 Plan 05: Marker Sizing and Guide Visibility Summary

**Toolpath start/end markers now scale from `ParsedToolpath.bounds` instead of a hardcoded 0.012m radius (a 5x reduction on the bundled samples), each sitting on a visible vertical guide stem down to the workbench with a tabletop footprint pad, while the scrub marker scales from the same bounds and stays the larger, primary indicator.**

## Performance

- **Duration:** ~18 min execution (Tasks 1-2) + human checkpoint wait (Task 3)
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Created `src/scene/marker-scale.ts` — a pure, dependency-free sizing module (no React/three.js imports) exporting `markerRadiusFromBounds`, `scrubMarkerRadiusFromBounds`, `guideStemRadius`, `guideFootprintRadius`, and eight rationale-commented sizing constants, following the `toRenderBuckets` "pure testable half" precedent this repo already established
- Created `src/scene/marker-scale.test.ts` — 17 tests covering the numeric print/mill-sample cases, the diameter-vs-span ceiling (including an explicit regression assertion that the OLD hardcoded 0.012m radius would fail that same ceiling), null/degenerate/non-finite/oversized clamp behavior, largest-axis selection, the scrub/endpoint size hierarchy, guide stem/footprint ratios, and workbench-contrast readability
- Rewired `Toolpath.tsx`: deleted the hardcoded `MARKER_RADIUS` constant, added an `AnchoredMarker` local component bundling a marker sphere + guide-stem cylinder (guarded against non-positive height) + tabletop footprint circle (unlit, double-sided) as one unit, and derived the radius via `useMemo` before the early return to keep hook order stable
- Rewired `ScrubMarker.tsx`: deleted the hardcoded `SCRUB_MARKER_RADIUS`, added a reactive `scrubMarkerRadiusFromBounds` selector (documented as legitimate given coarse toolpath-change cadence) while keeping `trajectory`/`scrubFraction` on `getState()` inside `useFrame`
- Rewrote both files' stale pre-retheme palette comments to reference `SCENE_PALETTE` and the new `MIN_MARKER_CONTRAST` test gate instead of restating obsolete literal hex values in prose
- Human checkpoint (Task 3) confirmed live: all 5 verification checks passed — scene colors (G-03-6), nav cube accent, marker size, guide visibility, and scrub/endpoint hierarchy

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive every marker dimension from the toolpath's own bounds, as a pure tested function** - `60e2339` (feat)
2. **Task 2: Render proportional markers on visible guide stems, and rescale the scrub marker to match** - `a173d6f` (feat)
3. **Task 3: Visual sign-off on both closed gaps** - checkpoint, no code changes; approved by user live at `http://localhost:5173/`

**Plan metadata:** committed alongside this SUMMARY

_Note: both Task 1 and Task 2 carried `tdd="true"`; each commit bundles the module/component and its covering test together rather than a strict separate RED/GREEN commit pair, matching the plan's `<action>` wording (write the module/components and their tests as one atomic unit) and plan 03-04's prior precedent for this repo._

## Files Created/Modified
- `src/scene/marker-scale.ts` - new: `markerRadiusFromBounds`, `scrubMarkerRadiusFromBounds`, `guideStemRadius`, `guideFootprintRadius`, `largestSpan`, and the 8 sizing constants
- `src/scene/marker-scale.test.ts` - new: 17-test Nyquist gate covering sizing, clamping, hierarchy, and readability
- `src/scene/Toolpath.tsx` - `AnchoredMarker` local component (sphere + guide stem + footprint pad); marker radius now derived from `markerRadiusFromBounds(toolpath?.bounds ?? null)`; stale header comment rewritten
- `src/scene/ScrubMarker.tsx` - radius now derived from `scrubMarkerRadiusFromBounds` via a reactive selector; stale header comment rewritten

## Decisions Made
- Followed the plan's given constant table exactly — no independent tuning of any sizing fraction.
- `AnchoredMarker` hardcodes `CUTTING_COLOR` (matching the plan's "unchanged in tone from today" spec) rather than taking a color prop.
- Kept the scrub marker's tone (`#0F766E`, D-07) completely untouched, per the plan's explicit instruction — only its radius derivation changed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
`npm run lint` still fails project-wide with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file" — confirmed pre-existing (documented in plan 03-04's SUMMARY, predates this plan, not touched by these files). `npx tsc -b` (the project's real build gate) and the full `npx vitest run` suite (916 tests, 97 files, zero regressions) both pass clean.

## Known Stubs

None.

## Next Phase Readiness
- Both G-03-4 (this plan) and G-03-6 (plan 03-04) gaps are closed and human-confirmed at this plan's Task 3 checkpoint.
- `marker-scale.ts` is available for reuse by any future scene element needing bounds-derived sizing — in particular, ROADMAP Phase 6's per-operation markers (SIM-03/SIM-06, explicitly out of scope here) can reuse `markerRadiusFromBounds` rather than reinventing sizing logic.
- The missing project-wide ESLint config remains a candidate for a future `/gsd-quick` task; unrelated to this plan.

## Self-Check: PASSED

All created/modified files confirmed on disk (`src/scene/marker-scale.ts`, `src/scene/marker-scale.test.ts`, `src/scene/Toolpath.tsx`, `src/scene/ScrubMarker.tsx`) and both task commits (`60e2339`, `a173d6f`) confirmed present in `git log`.

---
*Phase: 03-inverse-kinematics-trajectory-compile-scrub*
*Plan: 05*
*Completed: 2026-08-15*
