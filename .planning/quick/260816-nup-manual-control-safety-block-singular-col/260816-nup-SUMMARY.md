---
phase: quick
plan: 260816-nup
subsystem: manual-control-safety
tags: [collision, singularity, rail-geometry, ui-layout-revert]
status: halted
dependency-graph:
  requires:
    - quick 260816-m6d (manualJog, setManualJointAngle/setManualRailPos, DashboardPanel manual control)
    - src/kinematics/singularity.ts classifySingularity (Phase 3, previously advisory-only)
    - src/trajectory/compile.ts sceneToDhFrame / dhFrameToScene (existing IK world-space composition)
  provides:
    - src/collision/pose-collision.ts (pure floor/workbench/rig collision check)
    - src/collision/manual-pose-safety.ts (combined singularity+collision verdict for manual-jog only)
    - Grown RailRig.tsx visual track length matching +-1500mm travel with real margin
    - DashboardPanel error row + blur/Enter commit (observable revert-to-last-valid)
    - Restored ModeBar.tsx compact top toggle; single toggleable Dashboard tab; JobPanel.tsx deleted
  affects:
    - src/store/cellStore.ts (setManualJointAngle/setManualRailPos now gated)
    - src/scene/RailRig.tsx / src/scene/Workbench.tsx
    - src/gcode/toolpath-anchor.ts (workbench footprint constants relocated here)
    - src/ui/tabs/DashboardPanel.tsx
    - src/ui/shell/TabRail.tsx / TabPanel.tsx / PlaceholderPanel.tsx / uiShellStore.ts
    - src/App.tsx
tech-stack:
  added: []
  patterns:
    - "New src/collision/ module family mirrors singularity.ts's own discipline: pure, framework-free, unit-tested, no rendering/store import"
    - "Collision world-space composition reuses trajectory/compile.ts's existing sceneToDhFrame/dhFrameToScene pair rather than re-deriving the rail+mount+z-up/y-up transform"
    - "manual-pose-safety.ts composes singularity + collision into ONE verdict, gating only cellStore's manual-jog setters — trajectory/playback path is explicitly left unguarded (playback-path-unguarded.test.ts asserts this structurally)"
    - "NumberField commit moved from per-keystroke onChange to onBlur/Enter, so a rejected multi-digit entry reverts to the true last-committed value instead of an intermediate typed digit"
key-files:
  created:
    - src/collision/pose-collision.ts
    - src/collision/pose-collision.test.ts
    - src/collision/manual-pose-safety.ts
    - src/collision/manual-pose-safety.test.ts
    - src/collision/playback-path-unguarded.test.ts
    - src/collision/index.ts
    - src/scene/rail-rig-geometry.test.ts
    - src/ui/shell/ModeBar.tsx
    - src/ui/shell/shell-geometry.ts
    - src/ui/shell/shell-geometry.test.ts
  modified:
    - src/scene/RailRig.tsx
    - src/scene/Workbench.tsx
    - src/gcode/toolpath-anchor.ts
    - src/store/cellStore.ts
    - src/store/cellStore.test.ts
    - src/store/uiShellStore.ts
    - src/ui/tabs/DashboardPanel.tsx
    - src/ui/shell/TabPanel.tsx
    - src/ui/shell/TabRail.tsx
    - src/ui/shell/PlaceholderPanel.tsx
    - src/ui/tabs/tab-registry.ts
    - src/ui/tabs/tab-registry.test.ts
    - src/App.tsx
  deleted:
    - src/ui/tabs/JobPanel.tsx
decisions:
  - "Elbow's travel limit (+/-180deg) coincides exactly with the elbow singularity threshold — driving the elbow to its clamped maximum is now correctly refused by the new safety gate, not silently allowed as before."
  - "UR3E_PARKED_POSE independently re-verified safe (non-singular, collision-free) at RAIL_CENTER_X, both mode stations, and RAIL_TRAVEL.max before gating — it is the seed both manual setters fall back to, so an unsafe seed would have made the whole feature unusable."
  - "Two pre-existing manual-jog tests were rewritten because they asserted behavior that is now correctly refused: setManualJointAngle(2, 4) clamped the elbow to exactly pi (the elbow singularity, now rejected); setManualJointAngle(1, 0.2) drove the arm into the floor/carriage (now rejected). Swapped for geometrically-inert equivalents; the other four manual-jog test cases were confirmed unaffected."
  - "Rail track visual length increased with real margin beyond the bare minimum needed to cover the carriage box, per the user's reported symptom (carriage/robot visually overhanging the rail model at +-1500mm)."
  - "Printing/Milling reverted from left-rail tabs with a docked JobPanel back to a compact ModeBar-style toggle near the top of the 3D scene; the tab rail now carries a single toggleable Dashboard entry (activeTab: TabId | null, defaulting to null) so the app opens on a full-width scene. Upload button relocated into ModeBar. Underlying upload/auto-load/playbackStarted functionality from 260816-m6d preserved unchanged."
metrics:
  duration: ~35min (across two executor sessions due to a mid-run API session-limit interruption; resumed from saved progress)
  completed: 2026-08-16
actuals:
  tokens: 539373
  tasks: 6
  commits: 6
---

# Quick Task 260816-nup: Manual-control safety (singularity + collision), rail model growth, Printing/Milling layout revert Summary

Extended the manual joint/rail control added in 260816-m6d with real safety limits: a new pure collision module and the existing (previously advisory-only) singularity classifier now jointly gate every manual-jog commit, rejecting unsafe poses with a visible error and an observable revert to the last valid value — while leaving g-code/toolpath playback completely untouched. Also grew the rail's visual 3D model so the carriage/robot no longer overhangs it at the travel extremes, and reverted Printing/Milling from full docked-panel tabs back to a compact top toggle, restoring the full-width 3D scene.

## What Was Built

**Task 1 — Rail track visual length (U-4).** `src/scene/RailRig.tsx`'s track overhang grown well beyond the bare minimum needed to cover the carriage box, so the full carriage + robot footprint sits clearly on top of the visible rail model at both `RAIL_TRAVEL` extremes, with real margin. `RAIL_TRAVEL`'s logical ±1.5m range is unchanged — only the cosmetic geometry grew. New `rail-rig-geometry.test.ts` asserts the margin. Committed as `faf8b75`.

**Task 2 — Pure collision module (U-2).** New `src/collision/pose-collision.ts`: given a joint tuple + rail position, composes world-space link-origin points via `forwardKinematics(joints).frames` and the trajectory compiler's own existing `sceneToDhFrame`/`dhFrameToScene` transform (NOT `toUrdfJointAngles`, which is render-only), then checks those points against the floor plane, the workbench's footprint/top surface (constants relocated to `toolpath-anchor.ts`), and the rig's own rail/carriage geometry (`RailRig.tsx` exports). Framework-free and unit-tested, mirroring `singularity.ts`'s own discipline. Committed as `668473e`.

**Task 3 — Combined manual-pose verdict (U-1, U-2, U-3).** New `src/collision/manual-pose-safety.ts` composes `classifySingularity` (Phase 3, previously unused for gating) and the new collision check into one verdict for a candidate `{joints, railPos}` pose. `playback-path-unguarded.test.ts` structurally asserts the trajectory/playback path never imports or calls this new gate, so Phase 3/4's already-verified toolpath behavior can't regress. Committed as `b60d506`.

**Task 4 — Gate cellStore manual-jog commits (U-1, U-2, U-3).** `setManualJointAngle`/`setManualRailPos` in `cellStore.ts` now: clamp to individual joint/rail range limits exactly as before (unchanged), then validate the full resulting pose via the new verdict; on a safe pose, commit as before; on an unsafe pose, leave `manualJog` untouched and set a new `manualJogError: string | null` field instead, cleared on the next valid commit. Two pre-existing tests were rewritten (see Decisions) because they asserted now-correctly-refused behavior; four others confirmed unaffected. Committed as `dadf6ad`.

**Task 5 — Dashboard error surfacing + observable revert (U-3).** `DashboardPanel.tsx` renders `manualJogError` as a status row. `NumberField`'s commit point moved from per-keystroke `onChange` to `onBlur`/Enter — needed because per-keystroke commits meant a rejected multi-digit entry (e.g. typing `-270` digit by digit) would previously revert to whatever intermediate digit was last committed (e.g. `-27`), not the true last-valid value the user actually had before editing (e.g. `-269`). No new revert mechanism was built; this reuses the exact same "draft resyncs to the store's unchanged `value` prop on blur" snap-back `NumberField` already had for clamping. Committed as `5eb56ac`.

**Task 6 — Printing/Milling layout revert (U-5).** Recreated `src/ui/shell/ModeBar.tsx` as a compact top toggle carrying the mounted-tool label and the "Upload .gcode" button (relocated from the deleted `JobPanel.tsx`). `uiShellStore.ts`'s `activeTab` is now `TabId | null`, defaulting to `null`, so the app opens with no docked panel and a full-width 3D scene; the tab rail carries a single toggleable Dashboard entry that opens/closes the panel. `tab-registry.ts`/`tab-registry.test.ts` updated to the single-entry registry with a regression case asserting no cell-mode ids can be reintroduced as tabs. All per-mode upload/auto-load (`uploadedJobs`, `loadUploadedGcode`, `useModeJobSync`) and `playbackStarted` scrub-gating functionality from 260816-m6d preserved unchanged — this was a presentation-layer-only reversion. Committed as `1761558`.

## Deviations from Plan

**Mid-run interruption, not a deviation:** the executor agent hit a session/API limit partway through Task 5 (before the `NumberField` blur/Enter change and the Dashboard error row were written) and was resumed from saved progress in a second session, continuing Task 5 through Task 6 without re-doing or losing any completed work. No task content changed as a result.

Otherwise no deviations from the plan — all 6 automated tasks executed as written, with the two pre-existing test rewrites documented above as expected, correct consequences of the new gate rather than plan deviations.

## Task 7 — BLOCKED: Live human browser verification (not yet resolved)

The plan's Task 7 is a blocking human-verify checkpoint (`gate="blocking"`, plan frontmatter `autonomous: false`) requiring a live `npm run dev` pass. No browser automation tooling exists in this environment (confirmed in the prior related quick task 260816-m6d's own SUMMARY.md), so this checkpoint could not be resolved by the executor or the orchestrating session — it requires the actual human user.

**How to verify** — run `npm run dev`, open the printed URL, then check:

1. **U-4 rail model.** Dashboard tab → type `-1500` into the rail Position field, press Enter, then `1500`. At BOTH extremes the carriage and robot must sit clearly on top of the visible rail track with track still visibly showing beyond them.
2. **U-1/U-2/U-3 manual safety.** Drive the Shoulder field progressively more negative (e.g. −60, −120, −200, −250, −270). At some point an entry must be REFUSED: a red-toned error message appears at the top of the Dashboard panel, the field snaps back to the previous value, and the robot does not move. Type a valid value afterward — the error must disappear. Separately, type `600` into the Base field: it must clamp silently to 360 with NO error. Drive the Elbow to its maximum (`180`): expected to be refused (the elbow's travel limit coincides with the elbow singularity).
3. **U-3 playback untouched.** Press Play on the loaded sample, let it run, then scrub the timeline. Playback must behave exactly as before — no new errors, refusals, or stalls.
4. **U-5 layout.** On first load there must be NO wide docked side panel — the 3D scene spans full width right of the narrow icon rail. Printing/Milling must be a compact toggle near the top of the scene with the mounted-tool label AND the "Upload .gcode" button. Switching modes must still auto-load each mode's job; upload a .gcode on Printing, switch to Milling, switch back — Printing must still show the uploaded file and Milling its own job. Clicking the Dashboard icon opens the panel; clicking again closes it and the scene returns to full width.

## Verification Status

- `npx vitest run` — PASSED, 1127/1127 tests (full merged-tree suite; re-confirmed by the orchestrating session after merge).
- `npx tsc -b` — PASSED, clean (re-confirmed after merge).
- `npm run build` — PASSED, clean production build (re-confirmed after merge).
- `test ! -f src/ui/tabs/JobPanel.tsx && test -f src/ui/shell/ModeBar.tsx` — PASSED.
- `grep -rn "Arrives in Phase" src/` — CLEAN, no matches.
- **`npm run dev` live browser pass — NOT YET DONE.** This is Task 7, above — the one remaining item before this quick task can be marked complete.

## Threat Flags

None beyond the plan's own STRIDE register. The new collision/singularity gate is a pure, local, client-side computation (no new network calls, no new external dependencies) that strictly narrows what manual input can command — it cannot introduce a new attack surface, only reduce previously-uncontrolled state space.

## Note on this document

Like `260816-m6d-SUMMARY.md` before it, this document was reconstructed by the orchestrating session from the executor agent's final completion report rather than read back from the executor's own file: the executor wrote its original SUMMARY.md inside its isolated worktree (per contract, left uncommitted), but the orchestrating session force-removed the worktree (`git worktree remove --force`) immediately after a manual merge review, without first copying the uncommitted SUMMARY.md out — the same mistake as the prior quick task, not yet corrected in the orchestration process. The code changes themselves were unaffected (all 6 commits landed via the merge, and the full test suite/build were independently re-verified afterward on the merged tree).
