---
phase: 03-inverse-kinematics-trajectory-compile-scrub
plan: 04
subsystem: ui
tags: [three.js, react-three-fiber, design-tokens, css-custom-properties, vitest]

# Dependency graph
requires:
  - phase: 01-scene-shell-robot-model
    provides: RailRig.tsx, Workbench.tsx, CellScene.tsx, NavCube.tsx scene components this plan rewires
  - phase: 01-foundation
    provides: the --ui-* design-token layer in src/index.css this plan extends
provides:
  - "src/scene/scene-palette.ts — SCENE_PALETTE, relativeLuminance, contrastRatio, MIN_SURFACE_CONTRAST; the single source of every 3D scene surface color"
  - "three new --ui-scene-* tokens (floor/bench/rail) in src/index.css"
  - "an anti-drift Vitest gate proving token/value sync and pairwise structural-surface contrast separation, plus a no-local-color scan of every scene consumer"
affects: [03-05-marker-readability, any future scene component adding a new structural surface]

# Actuals (#2632)
actuals:
  tokens: 4769
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Design-token mirror module: a pure TS module pairs a --ui-* token name with the literal three.js needs, and a Vitest test parses the stylesheet to prove the two never diverge (src/scene/urdf-asset.test.ts's readFileSync+process.cwd() pattern reused for CSS instead of XML)."
    - "No-local-color scan: strip comments then regex-scan for #rrggbb literals across a fixed file list, asserting every consumer imports the shared palette instead of declaring its own color."

key-files:
  created:
    - src/scene/scene-palette.ts
    - src/scene/scene-palette.test.ts
  modified:
    - src/index.css
    - src/scene/RailRig.tsx
    - src/scene/Workbench.tsx
    - src/scene/CellScene.tsx
    - src/scene/NavCube.tsx

key-decisions:
  - "Kept the three structural tones (floor/bench/rail) and NavCube's four tones exactly as specified in the plan's interface table — no deviation from the given hex values."
  - "Left NavCube's arrowHelper axis colors (0xff0000/0x00ff00/0x0000ff numeric literals, standard X/Y/Z convention) untouched, per the plan's explicit exclusion — they are not #rrggbb strings so the no-local-color scan does not (and should not) flag them."

patterns-established:
  - "Scene surface colors are declared exactly once, as --ui-scene-* tokens in src/index.css, mirrored into SCENE_PALETTE, and enforced never to diverge or collide by an automated Vitest gate rather than code review."

requirements-completed: [SCENE-03, SCENE-04]

coverage:
  - id: D1
    description: "SCENE_PALETTE module with relativeLuminance/contrastRatio/MIN_SURFACE_CONTRAST, token-synced against src/index.css"
    requirement: "SCENE-04"
    verification:
      - kind: unit
        ref: "src/scene/scene-palette.test.ts#SCENE_PALETTE / src/index.css token sync"
        status: pass
      - kind: unit
        ref: "src/scene/scene-palette.test.ts#relativeLuminance / contrastRatio"
        status: pass
    human_judgment: false
  - id: D2
    description: "floor, workbench and rail are pairwise distinct and clear MIN_SURFACE_CONTRAST"
    requirement: "SCENE-03"
    verification:
      - kind: unit
        ref: "src/scene/scene-palette.test.ts#structural surface separation"
        status: pass
    human_judgment: false
  - id: D3
    description: "RailRig, Workbench, CellScene and NavCube all read colors from SCENE_PALETTE; no scene component declares a color literal in code"
    requirement: "SCENE-03"
    verification:
      - kind: unit
        ref: "src/scene/scene-palette.test.ts#scene components source colors from SCENE_PALETTE, not literals"
        status: pass
      - kind: unit
        ref: "npx tsc -b (full build)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rail rig, workbench and floor render as three visibly distinct tones in the running app"
    verification: []
    human_judgment: true
    rationale: "Requires visual confirmation in npm run dev — automated contrast-ratio assertions (D2) prove the mathematical separation but not the subjective 'looks like three different structures' UAT criterion."

# Metrics
duration: ~15min
completed: 2026-08-15
status: complete
---

# Phase 3 Plan 04: Scene Surface Color De-Collision Summary

**One token-backed `SCENE_PALETTE` module replaces three independently-declared, colliding tone constants across the rail rig, workbench, floor and nav cube — enforced by an automated anti-drift test.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Added three `--ui-scene-*` design tokens (`floor`/`bench`/`rail`) to `src/index.css`, sitting inside the existing `:root` color-role block
- Created `src/scene/scene-palette.ts` exporting `SCENE_PALETTE`, `relativeLuminance`, `contrastRatio` and `MIN_SURFACE_CONTRAST` — a pure, dependency-free module pairing each scene tone with the `--ui-*` token it mirrors
- Created `src/scene/scene-palette.test.ts` — an anti-drift gate proving every palette hex matches its named token's declared CSS value, that floor/workbench/rail clear a 1.5 WCAG contrast floor pairwise, and unit coverage of the two pure color-math functions
- Rewired `RailRig.tsx`, `Workbench.tsx`, `CellScene.tsx` and `NavCube.tsx` to read from `SCENE_PALETTE` instead of declaring local tone constants — deleted the stale, colliding `SECONDARY_TONE`/`DOMINANT_TONE` literals from all three files
- `NavCube.tsx`'s hover tone now picks up the current `--ui-accent` red instead of the pre-retheme `#2563EB` blue it was still silently painting
- Extended the test file with a no-local-color scan (comment-stripped regex over a fixed 4-file list) proving zero `#rrggbb` literals remain in any rewired scene component, and that each imports `SCENE_PALETTE`

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the scene's surface tones once, in tokens, with an anti-drift gate** - `1d42008` (feat)
2. **Task 2: Rewire every scene component onto the palette and prove none declares its own color** - `6a00232` (feat)

_Note: both tasks carried `tdd="true"`; each commit bundles the test additions and the implementation together rather than as separate RED/GREEN commits, since the plan's `<action>` specified writing the module/components and their covering tests as one atomic unit of work per task (the plan did not structure this as a strict TDD red-green split across separate commits)._

## Files Created/Modified
- `src/index.css` - adds `--ui-scene-floor`/`--ui-scene-bench`/`--ui-scene-rail` inside the existing `:root` block
- `src/scene/scene-palette.ts` - new: `SCENE_PALETTE`, `relativeLuminance`, `contrastRatio`, `MIN_SURFACE_CONTRAST`
- `src/scene/scene-palette.test.ts` - new: token-sync gate, contrast-separation gate, pure-function unit tests, no-local-color scan
- `src/scene/RailRig.tsx` - reads `SCENE_PALETTE.rail.hex` at all five material sites; local `SECONDARY_TONE` deleted
- `src/scene/Workbench.tsx` - reads `SCENE_PALETTE.workbench.hex` at tabletop and leg materials; local `SECONDARY_TONE` deleted
- `src/scene/CellScene.tsx` - reads `SCENE_PALETTE.background.hex` (canvas clear color) and `SCENE_PALETTE.floor.hex` (floor material); local `DOMINANT_TONE`/`SECONDARY_TONE` deleted
- `src/scene/NavCube.tsx` - reads `SCENE_PALETTE.navCubeFace/.navCubeStroke/.navCubeHover/.navCubeText` for all four `GizmoViewcube` color props; `arrowHelper` axis colors left untouched per plan

## Decisions Made
- Followed the plan's given hex/token table exactly for all eight palette entries — no independent color choices were made.
- Left the three `arrowHelper` axis colors as numeric literals (`0xff0000`/`0x00ff00`/`0x0000ff`), per the plan's explicit instruction that the standard X/Y/Z convention is not a UI-SPEC tone; the no-local-color scan targets `#rrggbb` string literals only, so these numeric literals correctly fall outside its scope.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered
`npm run lint` fails project-wide with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file" — no ESLint flat config exists anywhere in the repo, confirmed to predate this plan (not introduced by these changes). Logged to `.planning/phases/03-inverse-kinematics-trajectory-compile-scrub/deferred-items.md` per the scope-boundary rule (pre-existing, unrelated to this plan's files) rather than fixed here. `npx tsc -b` (the project's real build gate) and the full `npx vitest run` suite (149 tests, 15 files, zero regressions) both pass clean.

## Next Phase Readiness
- `SCENE_PALETTE` is exported and ready for plan 03-05 to import for its toolpath marker-readability contrast checks against the new workbench tone, per this plan's published `<interfaces>` contract.
- D4 (visual three-tone confirmation in `npm run dev`) remains a human-judgment UAT item — the mathematical contrast separation is proven, the subjective "looks distinct" check is not automatable and is deferred to UAT.
- The missing project-wide ESLint config (see Issues Encountered) is a candidate for a future `/gsd-quick` task; it blocks `npm run lint` from ever passing until scaffolded, independent of any plan's code changes.

---
*Phase: 03-inverse-kinematics-trajectory-compile-scrub*
*Plan: 04*
*Completed: 2026-08-15*
