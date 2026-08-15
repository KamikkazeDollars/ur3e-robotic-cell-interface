---
status: diagnosed
trigger: "The colors of the rail rig and workbench are the same and I don't like that, please make them into different colors, also make the layout a different color"
created: 2026-08-15T00:00:00Z
updated: 2026-08-15T00:07:00Z
---

## Current Focus

hypothesis: CONFIRMED — RailRig.tsx and Workbench.tsx each independently declare a local `SECONDARY_TONE` constant hardcoded to the identical literal `'#E4E7EB'`, applied to every mesh in both components, so they render as visually identical materials. CellScene.tsx's floor already uses a different local literal (`'#3C4149'`), so the floor is technically already distinct — but it too is an independently-declared local copy, not drawn from a shared source.
test: n/a — confirmed via direct source read, not runtime behavior
expecting: n/a
next_action: n/a — root cause confirmed, goal is find_root_cause_only, returning diagnosis

## Symptoms

expected: Scene elements (rail rig, workbench, layout/floor) are visually distinguishable from each other by color.
actual: DATA_START
"The colors of the rail rig and workbench are the same and I don't like that, please make them into different colors, also make the layout a different color"
DATA_END
errors: None reported (cosmetic/material-assignment issue)
reproduction: Load the app and view the 3D scene — observe that the rail rig and workbench share one material/color, and the layout/floor's color choice relative to them.
started: Discovered during Phase 03 UAT (test 6), not one of the original 3 formal checkpoints — user preference/cosmetic report.

## Eliminated

## Evidence

- timestamp: 2026-08-15T00:05:00Z
  checked: src/scene/RailRig.tsx (full file)
  found: "Line 7: `const SECONDARY_TONE = '#E4E7EB'`. Applied via `<meshStandardMaterial color={SECONDARY_TONE} />` to both rail profiles (line 145), both end-stop blocks (153, 157), and both carriage meshes (168, 172). Comment at line 4-6 claims this is 'UI-SPEC Secondary tone (#E4E7EB)... No new colors are introduced anywhere in this file.'"
  implication: Every rail-rig mesh (track, end-stops, carriage) is painted with the exact same hex literal.

- timestamp: 2026-08-15T00:05:30Z
  checked: src/scene/Workbench.tsx (full file)
  found: "Line 9: `const SECONDARY_TONE = '#E4E7EB'` — an independently-declared local constant, same identifier and same literal value as RailRig.tsx's. Applied to the tabletop mesh (line 69) and all four legs (line 80). Comment at line 7-8 explicitly states: 'the same tone RailRig.tsx and CellScene.tsx's floor plane already use. No new color is introduced here.'"
  implication: Workbench.tsx deliberately, explicitly copies RailRig.tsx's exact color value — confirms the rail rig and workbench share an identical material color by design intent (not a coincidence or accidental collision), which is precisely the reported symptom. The comment's claim that CellScene's floor also uses this value is false (see next finding).

- timestamp: 2026-08-15T00:06:00Z
  checked: src/scene/CellScene.tsx (full file)
  found: "Line 18: `const SECONDARY_TONE = '#3C4149'` — a third, independently-declared local constant with the SAME NAME (`SECONDARY_TONE`) as RailRig.tsx/Workbench.tsx but a DIFFERENT hex literal. Applied only to the floor plane's material (line 77). This value equals the current `--ui-border` design token in src/index.css (line 53: `--ui-border: #3c4149`)."
  implication: The floor is already visually distinct from the rig/workbench (different hex) — Workbench.tsx's comment claiming otherwise is stale/incorrect. However, all three files hardcode their own local color literal under the identical name `SECONDARY_TONE` instead of importing a single shared source, so the files disagree with each other about what "the Secondary tone" even is.

- timestamp: 2026-08-15T00:06:30Z
  checked: src/index.css lines 48-58 (the `--ui-*` design-token palette, introduced by the Quick 260815-3cn retheme per STATE.md decision log: "Renamed UI-SPEC role tokens from Tailwind-reserved --color-* to --ui-* — fixed a real bug where @theme inline silently overrode --color-secondary/-accent/-destructive with shadcn's own variables")
  found: "Current palette: --ui-dominant #1c1e21, --ui-surface #26292e, --ui-surface-raised #30343a, --ui-border #3c4149, --ui-fg #f2f3f5, --ui-fg-muted #a2a8b2, --ui-accent #e11d2e (red), --ui-destructive #f97066. No `#E4E7EB` value exists anywhere in this token set."
  implication: `#E4E7EB` (used by RailRig.tsx and Workbench.tsx) is an orphaned/stale value that predates or was never migrated into the current `--ui-*` retheme. CellScene.tsx's floor (`#3C4149`) happens to match the current `--ui-border` token, meaning it was likely written or touched after the retheme while RailRig.tsx/Workbench.tsx's `SECONDARY_TONE` constants were not updated.

## Resolution

root_cause: "RailRig.tsx and Workbench.tsx each independently declare a local `SECONDARY_TONE` constant hardcoded to the identical, stale hex literal `#E4E7EB` (not present anywhere in the current `--ui-*` design-token palette in src/index.css) and apply it to every mesh in each component — Workbench.tsx's own code comment confirms this was a deliberate copy ('the same tone RailRig.tsx... already use'). This is why the rail rig and workbench render as visually identical. The layout/floor (CellScene.tsx) already uses a different, independently-declared local literal (`#3C4149`, matching the current `--ui-border` token) so it is already technically distinct from both — but it too is a third disconnected local copy rather than drawn from one shared source, meaning any future edit to one of the three `SECONDARY_TONE` constants can silently re-collide two of these elements again with no compile-time or lint-time signal."
fix: ""
verification: ""
files_changed: []
