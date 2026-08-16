---
phase: quick
plan: 260816-s4e
subsystem: kinematics, scene
tags: [rail, travel-range, rail-rig, checkpoint]
dependency-graph:
  requires: []
  provides:
    - "RAIL_TRAVEL capped at ±1.3m (enforced clamp)"
    - "RAIL_CANDIDATE_SPACING_M (single derivation of resolver grid spacing)"
    - "TRACK_HALF_SPAN_M / fixed ±1.4m visible rail track"
  affects:
    - src/kinematics/rail.ts
    - src/kinematics/rail.test.ts
    - src/kinematics/index.ts
    - src/trajectory/mode-rail.test.ts
    - src/scene/RailRig.tsx
    - src/scene/rail-rig-geometry.test.ts
    - src/ui/manual-jog.test.ts
    - src/scene/camera-defaults.ts
tech-stack:
  added: []
  patterns:
    - "Derive dependent constants (MODE_RAIL_START_OFFSET_M, TRACK_LENGTH, TRACK_OVERHANG) from a single named constant, expressed in whole grid steps where an alignment invariant depends on it, rather than restating independently-chosen literals"
key-files:
  created: []
  modified:
    - src/kinematics/rail.ts
    - src/kinematics/rail.test.ts
    - src/kinematics/index.ts
    - src/trajectory/mode-rail.test.ts
    - src/scene/RailRig.tsx
    - src/scene/rail-rig-geometry.test.ts
    - src/ui/manual-jog.test.ts
    - src/scene/camera-defaults.ts
  deleted:
    - src/scene/robot-footprint.ts
    - src/scene/robot-footprint.test.ts
decisions:
  - "RAIL_TRAVEL narrowed to {min:-1.3, max:1.3} (2.6m total) per the user's own empirically-determined figures — third report of the same rail visual defect, after two prior fix attempts (cosmetic margin, then measured-footprint derivation) were both confirmed NOT to have fixed it"
  - "MODE_RAIL_START_OFFSET_M re-expressed as 46 whole RAIL_CANDIDATE_SPACING_M steps (0.598m) instead of an independent literal, so the grid-alignment invariant holds by construction rather than by coincidence of two independently-chosen numbers"
  - "TRACK_HALF_SPAN_M=1.4 is a fixed, user-specified figure — NOT derived from the robot's rendered extent, and the footprint-measurement module that the previous attempt used for this purpose was deleted rather than kept as dead code"
metrics:
  duration: ~35min
  completed: 2026-08-16
status: incomplete
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase quick Plan 260816-s4e: Cap Rail Travel at ±1300mm, Trim Rail Visual Summary

Capped the rail's enforced travel range at ±1.3m and the rendered rail track's visible span at a fixed ±1.4m — both figures supplied directly by the user after live testing — re-derived the mode-station grid-alignment invariant to hold by construction, and deleted the now-orphaned footprint-measurement module from the previous (rejected) fix attempt. **Execution halted at Task 4's mandatory human-verify checkpoint** — this environment has no browser automation tooling, so live in-app verification could not be performed by the executor. All 3 automated tasks are complete, committed, and verified by their own automated gates (full Vitest suite 406/406, `tsc -b` clean, production build succeeds, scoped literal sweep clean).

## Status: INCOMPLETE — awaiting human checkpoint (Task 4)

Tasks 1–3 (all `type="auto"`) are done and committed. Task 4 (`type="checkpoint:human-verify"`, `gate="blocking"`) requires a human to run `npm run dev`, open the app, and visually verify the clamp/track behavior in a real browser — this cannot be automated in this environment. Do not mark this plan complete until Task 4 is resolved by the user.

## First-Class Findings (per plan's `<output>` spec)

- **`MODE_RAIL_START_OFFSET_M` final value:** `0.598` m, derived as `46 * RAIL_CANDIDATE_SPACING_M` where `RAIL_CANDIDATE_SPACING_M = (1.3 - -1.3) / 200 = 0.013` m. 46 is `MODE_RAIL_START_OFFSET_STEPS`, a module-private constant in `src/kinematics/rail.ts`. This is a change from the plan's own worked table only in that the offset is now a *product* of two named constants rather than a single literal — the resulting value (0.598m) matches the plan's arithmetic exactly.
- **`src/scene/robot-footprint.ts`:** **Deleted**, along with `src/scene/robot-footprint.test.ts`. A repo-wide search (both before and after Task 2's edits) confirmed the only importers were `src/scene/RailRig.tsx`, `src/scene/rail-rig-geometry.test.ts`, and the module's own test — all three of which Task 2 rewrote or Task 3 deleted. No remaining consumer was found.
- **Files touched by Task 3's stale-literal sweep (step 4):** none beyond what the plan already named. The repo-wide grep for `1.5|1500|0.015` (and separately for `robot-footprint`/`ROBOT_FOOTPRINT_HALF_WIDTH_X`) found hits only in files this plan already modifies (`rail.ts`, `rail.test.ts`, `RailRig.tsx`, `rail-rig-geometry.test.ts`, `manual-jog.test.ts`, `camera-defaults.ts`) or in files where the numeral is genuinely unrelated to rail travel (CSS line-height, button padding classes, joint-angle radians in `inverse-kinematics.test.ts`/`ur3e-dh.ts`/`compile.test.ts`/`pose-collision.test.ts`, `MIN_SURFACE_CONTRAST` in `scene-palette.ts`, dashed-line `gapSize` in `Toolpath.tsx`, scrub-fraction/segment-count test fixtures). None of those unrelated hits were touched, per the plan's scoping instruction.
- **Ripple-effect failures outside this plan's files:** none. `npx vitest run` (full suite): 406/406 passed. `npx tsc -b`: clean. `npm run build`: succeeded (pre-existing >500kB chunk-size warning only, not a regression).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - consistency] Updated a second stale-literal location in `rail.ts` not explicitly listed in Task 1's action steps**
- **Found during:** Task 1
- **Issue:** `railStartXForMode`'s own doc comment (a location distinct from the `MODE_RAIL_START_OFFSET_M` comment block Task 1 explicitly rewrites) restated "Printing parks 0.6m right of centre, milling 0.6m left" as a literal — now stale since the offset is 0.598m, not 0.6m.
- **Fix:** Reworded to reference `MODE_RAIL_START_OFFSET_M` by name instead of restating the value as a literal, consistent with the plan's broader anti-restatement principle for this file.
- **Files modified:** `src/kinematics/rail.ts`
- **Commit:** `1fe24fc`

None of Rules 2–4 were triggered. No architectural changes were needed; the plan's own worked arithmetic and file-by-file action list were followed directly.

## Automated Task Verification

| Task | Verify command | Result |
|---|---|---|
| 1 | `npx vitest run src/kinematics/rail.test.ts src/trajectory/mode-rail.test.ts` | 40/40 passed |
| 2 | `npx vitest run src/scene/rail-rig-geometry.test.ts src/collision` | 29/29 passed (4 files) |
| 3 | `npx vitest run && npx tsc -b && npm run build && ! grep -REq "1\.5\|1500\|0\.015" src/kinematics/rail.ts src/kinematics/rail.test.ts src/scene/RailRig.tsx src/scene/rail-rig-geometry.test.ts src/ui/manual-jog.test.ts` | Full suite 406/406, tsc clean, build succeeded, sweep grep exit 1 (no hits) — gate green |

## Known Stubs

None.

## Threat Flags

None — this plan touches no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. See the plan's own `<threat_model>` STRIDE register (T-s4e-01/02/03), all already dispositioned `mitigate`/`accept` at plan time and unaffected by the actual implementation.

## Self-Check

Verifying claims made above:

- `src/kinematics/rail.ts` exports `RAIL_CANDIDATE_SPACING_M` and `MODE_RAIL_START_OFFSET_M` derives from it — confirmed by reading the file post-edit and by the passing grid-alignment describe block in `rail.test.ts`.
- `src/scene/robot-footprint.ts` and `src/scene/robot-footprint.test.ts` no longer exist on disk — confirmed via `git status --short` showing both as `D` (deleted) and staged in commit `1f1f2e4`.
- Commits `1fe24fc`, `9d518af`, `1f1f2e4` exist in `git log` on the current branch.

## Self-Check: PASSED

## Next Step (for the human / orchestrator)

Run `npm run dev`, open the app, and complete Task 4's live browser verification exactly as specified in the plan (`.planning/quick/260816-s4e-cap-rail-travel-at-1300mm-trim-rail-visu/260816-s4e-PLAN.md`, Task 4):

1. Type a rail value past ±1300mm into the Dashboard field and via the slider at both extremes — confirm it clamps and the robot renders normally (not like `Robot Problem.png`) at both ends.
2. Confirm the rail track visually ends a short, deliberate distance beyond each end-stop, not a long stretch.
3. **Judge, not a bug:** at each travel extreme the carriage's mounting plate now slightly overhangs the visible track end — the plate's own footprint is wider than the 100mm of track remaining past the end-stop (170mm carriage half-width vs 100mm of margin, per the plan's pre-flagged arithmetic). Say whether this is acceptable as specified, or whether the visible track should be nudged out further to fully carry the plate.
4. Confirm no regressions in g-code import/playback/scrub, joint field input, Home/Reset, and mode switching.

Reply "approved" or describe what still looks wrong (screenshot welcome) to resolve the checkpoint.
