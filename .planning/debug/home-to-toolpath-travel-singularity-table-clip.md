---
status: diagnosed
trigger: "The robot's home-to-toolpath travel move (the segment before the arm reaches the toolpath's first point) passes through joint singularities and clips through the table/workbench geometry, for both bundled g-code samples (print and mill)."
created: 2026-08-15T00:05:34Z
updated: 2026-08-15T00:06:30Z
---

## Current Focus

hypothesis: "This is a duplicate report of an already-resolved bug. `.planning/debug/resolved/table-clipping-singularities.md` (closed 2026-08-15, human-verified) already root-caused and fixed exactly this symptom pair (table clip + apparent wrist singularity during the home->toolpath travel move, both bundled samples) via commit e9dceb1. This worktree's HEAD already contains that commit and no relevant file has changed since."
test: "(1) Confirm e9dceb1 is an ancestor of HEAD. (2) Confirm no commits touched inverse-kinematics.ts / ur3e-dh.ts / compile.ts since e9dceb1. (3) Re-run the regression suite added by that fix (compile.test.ts + inverse-kinematics.test.ts) to confirm it is still green in this exact worktree, not just green in the original fix's environment."
expecting: "All three checks confirm the fix is present, unmodified, and passing -- meaning the objective's trigger describes stale/pre-fix state (traced to 03-UAT.md tests 1/3 and STATE.md's now-outdated 'KNOWN OPEN ISSUE' note, both of which predate the e9dceb1 fix commit)."
next_action: "NONE -- investigation complete. See Resolution."

## Symptoms

expected: "The UR3e's flange sweeps continuously along the drawn toolpath with no joint visibly whipping, snapping, or reversing mid-drag (a single large repositioning as the sample first loads is expected and correct). The arm's home-to-toolpath travel move stays clear of the table at all times."
actual: "\"The robot goes into singularities when going over the workbench from home position. While doing that it also goes through the table.\" (Test 1) / \"The robot goes into singularities when going over the workbench from home position. While doing that it also goes through the table\" and \"it is very probable that the tools on the robot will go through the table\" (Test 3)"
errors: "None reported by user (visual/kinematic behavior only)"
reproduction: "In the app, with no sample loaded, select the print sample (or mill sample) and slowly drag the scrub control from 0%, watching the first few percent (the home-to-toolpath travel-move portion). Repeat for both bundled samples."
started: "Discovered during Phase 03 UAT (03-UAT.md tests 1 and 3). Previously logged narrower as 03-REVIEW.md IN-02."

## Eliminated

(none needed -- Phase 0 knowledge-base match was directly confirmed as the exact, already-fixed cause; no alternative hypotheses were required.)

## Evidence

- timestamp: 2026-08-15T00:05:34Z
  checked: "`.planning/debug/resolved/` directory and its README.md (this project's resolved-session knowledge base, functionally equivalent to `.planning/debug/knowledge-base.md` which does not yet exist as a separate file)."
  found: "An entry `table-clipping-singularities` matches this exact symptom pair (table clip + apparent wrist singularity, both bundled samples, home->toolpath travel move), sourced from the same `03-UAT.md` tests 1/3 (gaps G-03-1/G-03-3) this task's trigger quotes verbatim. Status: resolved, human-verified 2026-08-15."
  implication: "Strong knowledge-base match -- treated as the primary hypothesis to confirm, per protocol."

- timestamp: 2026-08-15T00:05:34Z
  checked: "`git log --oneline -20` and `git log --all --oneline --grep=singular -i` in this worktree."
  found: "Commit `e9dceb1 fix(kinematics): wrap-aware IK branch continuity + tool-down parked pose` is present in this worktree's own history, immediately before the later quick-task commits, and is an ancestor of current HEAD `cfb7afd`."
  implication: "The fix commit for the matched knowledge-base entry is already merged into this worktree -- not just present on some other branch."

- timestamp: 2026-08-15T00:05:34Z
  checked: "`git log --oneline e9dceb1..HEAD -- src/kinematics/inverse-kinematics.ts src/kinematics/ur3e-dh.ts src/trajectory/compile.ts`"
  found: "Empty output -- zero commits touched any of the three fixed files since e9dceb1."
  implication: "No regression, revert, or conflicting edit has reintroduced the bug after the fix landed."

- timestamp: 2026-08-15T00:05:34Z
  checked: "Source content directly: `unwrapTowards` in `src/kinematics/inverse-kinematics.ts` (limit-checked per-joint 2*pi unwrap before branch scoring) and `UR3E_PARKED_POSE` in `src/kinematics/ur3e-dh.ts` (tool-down branch with wrist_1 derived from the closure condition, not the old sideways-flange pose)."
  found: "Both fixes are present verbatim in the current worktree source, matching the resolved session's documented `files_changed`."
  implication: "Both of the two independently-confirmed root causes from the prior session are fixed in the code currently checked out here."

- timestamp: 2026-08-15T00:05:34Z
  checked: "`npx vitest run src/kinematics/inverse-kinematics.test.ts src/trajectory/compile.test.ts` in this worktree."
  found: "2 files, 27/27 tests passed, including the 6 regression tests the prior fix added specifically for this bug (whole-arm table clearance during travel, adjacent-sample continuity through the wrap boundary, parked-pose tool-down orientation)."
  implication: "The fix is not just present in source but independently re-verified as passing in this exact worktree/environment, not merely trusted from the prior session's report."

- timestamp: 2026-08-15T00:05:34Z
  checked: "`.planning/STATE.md` Blockers/Concerns section (line 108) and `.planning/phases/03-inverse-kinematics-trajectory-compile-scrub/03-UAT.md`."
  found: "STATE.md still lists this as a 'KNOWN OPEN ISSUE' and was last updated 2026-08-14T23:43:57Z -- before the fix commit (2026-08-15T02:12:28+03:00 per its author date, i.e. after STATE.md's last edit). 03-UAT.md's gaps G-03-1/G-03-3 are still marked `status: failed` and were never re-run against the fixed code."
  implication: "The objective's trigger text was generated from stale planning documents (03-UAT.md, STATE.md) that predate the fix. This is the source of the duplicate report: no process step re-ran UAT tests 1/3 or updated STATE.md/03-UAT.md's gap status after commit e9dceb1 closed and archived the debug session."

## Resolution

root_cause: "Not a live bug in the current codebase. This is a duplicate/stale report of an issue that was already fully root-caused and fixed in debug session `table-clipping-singularities` (archived at `.planning/debug/resolved/table-clipping-singularities.md`), commit `e9dceb1`, which is already an ancestor of this worktree's HEAD (`cfb7afd`) with zero subsequent changes to the fixed files. The original two root causes were: (1) `pickClosestBranch`/`jointSpaceDistance` scored IK branches by raw component subtraction while `solveUR6IK` normalises every branch into (-pi, pi], so a joint crossing the wrap boundary mid-travel made the geometrically-continuous branch look ~2*pi away and lose to a physically distant whole-arm reconfiguration that rode 0.008m from the tabletop instead of 0.080m (this produced both the apparent 'singularity' whip and the table clip -- `classifySingularity` actually reported zero true singularities across all samples). (2) `UR3E_PARKED_POSE` was used verbatim as sample 0 while every other sample is IK-solved against a fixed tool-down orientation the authored pose did not satisfy (rotation error 1.00), causing a 1.57 rad wrist snap on the very first scrub step. The trigger for *this* task was generated from `03-UAT.md`/`STATE.md`, both of which predate the fix commit and were never refreshed afterward."
fix: "No new fix needed -- already applied in commit e9dceb1 (`src/kinematics/inverse-kinematics.ts`: limit-checked `unwrapTowards` before branch scoring; `src/kinematics/ur3e-dh.ts`: `UR3E_PARKED_POSE` re-authored as the tool-down branch with wrist_1 derived from the closure condition; `src/trajectory/compile.ts`: doc-only cross-reference). Human-verified in-app on both bundled samples per the archived session."
verification: "Re-ran the fix's own regression suite in this worktree: 27/27 pass across `src/kinematics/inverse-kinematics.test.ts` and `src/trajectory/compile.test.ts`, including the 6 tests written specifically for this bug. Confirmed e9dceb1 is an ancestor of HEAD and no relevant file changed since. This is independent re-confirmation, not a re-statement of the prior session's own claims."
files_changed: []
