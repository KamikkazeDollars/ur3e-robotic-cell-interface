---
status: resolved
trigger: "Phase 03 UAT (03-UAT.md, tests 1 and 3): during scrub-drag from home into the toolpath, the robot arm passes through the table and hits joint singularities on the home-to-toolpath travel move, for both bundled samples (print and mill)."
created: 2026-08-15
updated: 2026-08-15
---

## Symptoms

- expected: "The robot's home->toolpath travel move (parked pose -> lift -> approach -> descend) stays clear of the table and moves smoothly with no joint whipping/snapping."
- actual: "During scrub-drag from home into the toolpath, the arm passes through the table and hits joint singularities partway through the travel move, for both bundled samples (print + mill)."
- errors: "None reported in-app; failure mode is visual (arm clips through table geometry) and kinematic (visible joint whipping/snapping/reversal consistent with a wrist singularity, theta5 near 0/pi) during the travel segment."
- timeline: "Present since phase 03 was implemented. Flagged as a known open issue in the phase's own code review (03-REVIEW.md IN-02) before implementation review closed; UAT (03-UAT.md, 2026-08-14) confirmed it's worse than first diagnosed -- not just visual table-clipping, but actual singularities in the IK solve during the same segment."
- reproduction: "Load either bundled sample (print or mill). Slowly drag the scrub control from 0% through the first few percent -- the home-to-first-toolpath-point travel segment. Watch the arm pass through the table and/or whip/snap at a joint."

## Related context

- .planning/phases/03-inverse-kinematics-trajectory-compile-scrub/03-UAT.md (tests 1, 3; gaps G-03-1, G-03-3)
- .planning/phases/03-inverse-kinematics-trajectory-compile-scrub/03-REVIEW.md (IN-02: travel-move table-clipping note)
- src/trajectory/compile.ts (travel waypoint construction: homeTcpPoint -> liftPoint -> aboveFirstPoint -> points[0], around lines 249-268; buildToolDownTarget import line 13)
- src/trajectory/compile.test.ts (lines ~162-192: existing "travel move clears the table" regression check only tests sample.point / TCP position against an axis-aligned table footprint -- does not check other arm links or account for the tool-down orientation's link sweep)
- IN-02's hypothesis: the diagonal homeTcpPoint -> liftPoint segment can sweep intermediate links (forearm/elbow/wrist) sideways through the table even while the TCP itself stays clear, because only the TCP point is collision-checked.
- UAT adds: the travel waypoints (parked -> lift -> approach -> descend) may be poorly chosen relative to the robot's reachable/well-conditioned workspace, producing IK singularities, not just geometric table collision.

## Current Focus

hypothesis: "TWO independent defects in the travel move, both confirmed numerically. (1) `pickClosestBranch`'s continuity metric (`jointSpaceDistance`) subtracts raw joint values, while `solveUR6IK` normalises every branch into (-pi, pi]. When a joint crosses the wrap boundary mid-travel, the geometrically-continuous branch is scored ~2pi away and a completely different arm configuration wins — a full reconfiguration over 2mm of TCP motion, which is BOTH the visible whipping AND the table clip (the wrong configuration rides 8mm from the tabletop vs 80mm for the correct one). (2) `UR3E_PARKED_POSE` is used verbatim as sample 0 but its flange is rotated ~90deg about the tool axis relative to `buildToolDownTarget`'s fixed orientation, so sample 0 -> sample 1 snaps 1.57 rad."
test: "Apply wrap-aware unwrapping inside `pickClosestBranch`, and re-author `UR3E_PARKED_POSE` as the tool-down IK branch at its own existing TCP point. Re-run the instrumented compile for both bundled samples."
expecting: "Max per-joint step between consecutive samples drops from 4.28 rad to the sub-0.05 rad range; travel-phase minimum centre-line clearance to the tabletop rises from 0.008 m to ~0.08 m (the designed TRAVEL_CLEARANCE_ABOVE_TABLE_M)."
next_action: "NONE — session closed. Human verification PASSED on 2026-08-15: the user scrub-dragged both bundled samples (print and mill) through the home-to-toolpath travel move in the running app and confirmed no table clipping and no whipping/snapping. The cosmetic parked-pose orientation change from root cause 2's fix (tool now points down instead of sideways at home) was reviewed and accepted as intended. Session archived to .planning/debug/resolved/ with a knowledge-base entry."
bug_class: "Bohrbug — fully deterministic, reproduces identically on every compile of both bundled samples in a headless Node run with no renderer involved"
reasoning_checkpoint:
  hypothesis: "The travel-move whipping and table clipping share one dominant root cause: `pickClosestBranch` measures branch-to-branch distance with raw component subtraction over angles that `solveUR6IK` has normalised into (-pi, pi], so at a wrap boundary the true continuous branch is penalised by ~2pi and loses to a physically distant arm reconfiguration. A second, independent defect makes the very first scrub step snap: the authored parked pose's flange orientation is not the fixed tool-down orientation every IK-solved sample uses."
  confirming_evidence:
    - "Direct observation at print sample idx 281: previous joints [1.5709,-1.9755,1.8839,-1.4791,-1.5708,-3.1415]; the branch list contains [1.5638,-1.9736,1.8828,-1.4800,-1.5708,3.1346] whose wrap-aware distance is 0.0103 rad but whose raw `jointSpaceDistance` is 6.2761 — so the metric rejects it in favour of [-0.4277,-2.9960,1.2049,0.2203,-1.5708,1.1431] at raw 5.1713. theta6 is the wrapped joint (-3.1415 -> +3.1346)."
    - "Geometric consequence measured per interval (print): samples 1..280 (correct configuration) min centre-line clearance to the tabletop AABB 0.0804 m; samples 281..371 (post-flip configuration) 0.0080 m. Mill is identical in shape: 0.0830 m -> 0.0159 m. UR3e link meshes have ~0.04-0.06 m radius, so 0.008 m centre-line clearance is a visible pass-through."
    - "`forwardKinematics(UR3E_PARKED_POSE).matrix` rotation rows are [0,-0.9394,-0.3429],[-1,0,0],[0,0.3429,-0.9394]; `buildToolDownTarget` demands [1,0,0],[0,-1,0],[0,0,-1]. Max element error 1.00. Sample 0 -> sample 1 therefore steps wrist_3 by 1.5732 rad and wrist_1 by 0.616 rad over 1.2 mm of TCP travel."
    - "`RobotPose.tsx:40` selects the nearest sample (`Math.round(scrubFraction * (samples.length - 1))`) with no interpolation, so each of these steps is applied to the URDF in a single frame — the reported snap/whip."
    - "Both bundled samples fail at structurally identical points (print idx 1/281/372, mill idx 1/286/368), and all three lie inside the travel phase (print travel spans idx 0..456, mill 0..439), matching the UAT reproduction ('first few percent of the scrub')."
  falsification_test: "If the wrap hypothesis were wrong, re-scoring the same branch list at idx 281 with a shortest-angular-path metric would still select the reconfiguration. It does not: it selects the 0.0103-rad-away branch. If the parked-pose hypothesis were wrong, the pose's FK rotation would already match the tool-down target; the measured element error is 1.00, not ~0."
  fix_rationale: "Fix 1 changes the continuity DECISION, not the geometry: `pickClosestBranch` re-expresses each candidate in the 2pi-equivalent revolution nearest `previous` (per joint, only when the unwrapped value stays inside that joint's declared limit) before scoring. This removes the artificial 2pi penalty at the wrap boundary AND makes the stored joint values continuous in value, not merely in physical pose — which also protects the Phase 5 joint-velocity readout from a spurious 2pi spike. Fix 2 re-authors `UR3E_PARKED_POSE` as the tool-down IK branch at its own EXISTING TCP point, so sample 0 and sample 1 agree on orientation while `homeTcpPoint` is bit-for-bit unchanged — every empirically-verified claim in `compileTrajectory`'s doc comment about lift reachability and table-crossing stays valid without re-derivation. Neither fix touches TRAVEL_CLEARANCE_ABOVE_TABLE_M, which measurement shows is already correct."
  blind_spots: "Clearance is measured against the kinematic skeleton (frame origins joined by straight segments), not the real URDF mesh hulls, so the absolute clearance numbers are approximate — the 10x before/after ratio is the load-bearing result, not the absolute value. The fix is verified headlessly; the final visual confirmation that no link grazes the table during a real scrub drag needs a human."
  candidate_causes:
    - "code: continuity metric ignores 2pi angular wrap (CONFIRMED — dominant cause of both symptoms)"
    - "code: authored parked pose orientation does not match the fixed tool-down IK target (CONFIRMED — independent, causes the first-step snap)"
    - "config: TRAVEL_CLEARANCE_ABOVE_TABLE_M (0.08) too small (ELIMINATED — measured 0.0804 m actual clearance in the correct configuration, i.e. exactly the designed value)"
    - "environment: renderer/browser/urdf-loader issue (ELIMINATED — reproduces headless in Node with no renderer)"
    - "data: sample-specific g-code geometry (ELIMINATED — both bundled samples fail identically at structurally equivalent travel indices)"
  and_gate: "no — the wrap-metric defect alone is sufficient to produce both reported symptoms (it causes the whip AND drives the arm into the low-clearance configuration that clips). The parked-pose orientation defect is a genuinely separate second root cause for the first-step snap, not a co-condition of the same failure, so `root_cause` is a two-item list rather than an AND-gated single cause."
tdd_checkpoint: null

## Evidence

- timestamp: 2026-08-15
  checked: "Instrumented `compileTrajectory` over both bundled g-code files in a headless vitest run; measured the max per-joint step between consecutive samples."
  found: "print: max step 4.2846 rad at idx 281 (scrubFraction 0.2114); steps > 0.2 rad at idx 1 (1.5732), 281 (4.2846), 372 (2.5224). mill: max step 4.2458 rad at idx 286; steps > 0.2 rad at idx 1 (1.5732), 286 (4.2458), 368 (2.4812). Every one of these lies in the TRAVEL phase (print travel = idx 0..456, mill = 0..439). The toolpath phase itself is already smooth."
  implication: "The defect is confined to the prepended travel move, exactly as UAT reported, and is deterministic and identical in shape across both samples."

- timestamp: 2026-08-15
  checked: "At print idx 281, re-enumerated the valid IK branch list for the same target point and scored every branch against the previous sample with BOTH the current raw `jointSpaceDistance` and a shortest-angular-path metric."
  found: "The geometrically-continuous branch [1.5638,-1.9736,1.8828,-1.4800,-1.5708,3.1346] scores wrap-aware 0.0103 rad but raw 6.2761. The branch the compiler actually chose, [-0.4277,-2.9960,1.2049,0.2203,-1.5708,1.1431], scores raw 5.1713. theta6 crossed the -pi normalisation boundary (-3.1415 -> +3.1346)."
  implication: "ROOT CAUSE 1 confirmed by direct measurement: `solveUR6IK`'s `normalizeAngle` into (-pi, pi] plus `jointSpaceDistance`'s raw subtraction makes a 2pi representation change look like a 2pi physical move, so continuity selection deliberately prefers a full arm reconfiguration."

- timestamp: 2026-08-15
  checked: "Built the kinematic skeleton (rail base + the six FK frame origins, converted to scene space via `dhFrameToScene`) for every travel sample and measured its minimum distance to the tabletop AABB reproduced from `Workbench.tsx`'s own derivation (X [-0.25, 0.25], Z [0.71, 0.96], Y [0.3731, 0.4131])."
  found: "print: samples 1..280 min clearance 0.0804 m; samples 281..371 min clearance 0.0080 m (at idx 349); samples 372..456 descend onto the workpiece as designed. mill: 0.0830 m -> 0.0159 m -> 0.0030 m. 99 (print) / 90 (mill) travel samples sit within 0.06 m of the tabletop."
  implication: "The table clipping is a CONSEQUENCE of root cause 1, not a separate geometry bug: the post-flip configuration rides ~10x closer to the table than the correct one. `TRAVEL_CLEARANCE_ABOVE_TABLE_M` (0.08) is doing exactly its job whenever the correct branch is held."

- timestamp: 2026-08-15
  checked: "`forwardKinematics(UR3E_PARKED_POSE).matrix` rotation block vs `buildToolDownTarget`'s fixed orientation."
  found: "Parked rotation rows [0,-0.9394,-0.3429],[-1,0,0],[0,0.3429,-0.9394]; tool-down target [1,0,0],[0,-1,0],[0,0,-1]; max element error 1.00. The flange is rotated ~90deg about the tool axis. Consequently sample 0 (the literal authored pose) -> sample 1 (the first IK-solved, tool-down pose, 1.2 mm away) steps wrist_3 by 1.5732 rad and wrist_1 by 0.616 rad."
  implication: "ROOT CAUSE 2 confirmed, independent of root cause 1: `compileTrajectory` special-cases sample 0 as the authored pose while every other sample is solved against a fixed tool-down orientation the authored pose does not satisfy."

- timestamp: 2026-08-15
  checked: "`src/scene/RobotPose.tsx` — how a compiled sample reaches the rendered URDF."
  found: "Line 40 picks the nearest sample (`Math.round(scrubFraction * (samples.length - 1))`); no interpolation between samples."
  implication: "Each joint-space step is applied to the robot in a single frame, so a 4.28 rad step is an instantaneous whole-arm teleport — the 'whipping/snapping' the user sees, and why the swept volume reads as passing through the table."

- timestamp: 2026-08-15
  checked: "Existing regression coverage — `src/trajectory/compile.test.ts` 'travel move clears the table' and `src/kinematics/inverse-kinematics.test.ts` 'pickClosestBranch — continuity along a line of tool-down targets'."
  found: "The table test filters on `sample.point` only — the TCP target, which never enters the table footprint below its top surface — so it passes while the elbow rides 8 mm from the tabletop. The continuity test walks a 100 mm straight line at the toolpath anchor's own height, a region where no joint crosses the (-pi, pi] wrap boundary, and it asserts max step < 0.2 rad using the same wrap-blind metric under test."
  implication: "Both existing gates are structurally incapable of catching this class. The regression tests must (a) measure ARM LINK clearance, not just the TCP point, and (b) assert adjacent-step continuity over the REAL compiled travel move, which is where the wrap boundary is actually crossed."

- timestamp: 2026-08-15
  checked: "Candidate replacement parked poses: the tool-down IK branches at the current parked TCP, and a variant keeping the authored shoulder/elbow bend while re-articulating the wrist."
  found: "IK branch 0 = [pi, -0.4645740511122175, 1.0760678431724195, -2.1822901188550987, -pi/2, -pi/2] reproduces the parked TCP to 6.2e-17 m with rotation error 1.22e-16 from tool-down, keeps shoulder_pan at pi (stowed away from the table), is non-singular, and its whole skeleton stays at z <= 0.50 (tabletop near edge is z = 0.71). Its theta2+theta3+theta4 sums to exactly -pi/2 — the tool-down closure condition for this wrist configuration. The keep-the-bend variant also achieves exact tool-down but moves the parked TCP 3.7 cm further out, which would invalidate `compileTrajectory`'s empirically-verified lift-reachability findings."
  implication: "Branch 0 is the correct replacement: it fixes the orientation while leaving `homeTcpPoint` bit-for-bit unchanged, so no travel-waypoint reasoning has to be re-derived."

- timestamp: 2026-08-15
  checked: "HUMAN VERIFICATION (checkpoint response: confirmed_fixed). The user ran the app and scrub-dragged BOTH bundled samples (print and mill) from 0% through the home-to-toolpath travel move — the exact reproduction from the UAT report."
  found: "No table clipping and no whipping/snapping in either sample. The user additionally reviewed the one cosmetic behavioural change introduced by root cause 2's fix — the tool now points DOWN at the parked/home pose instead of sideways — and explicitly accepted it as an intended and acceptable consequence of re-authoring `UR3E_PARKED_POSE` to hold the same tool-down orientation every IK-solved sample uses."
  implication: "Closes the residual risk recorded under `Resolution.verification.residual_risk`: the headless clearance measurement used the kinematic skeleton rather than the real URDF mesh hulls, so visual confirmation that no link grazes the table during a live scrub drag could only come from a human. It now has. Both original symptoms (D-03 continuity / travel-move table clearance) are resolved end to end, and the parked-pose orientation change is accepted rather than outstanding. Session resolved."

## Eliminated

- hypothesis: "`TRAVEL_CLEARANCE_ABOVE_TABLE_M` (0.08 m) is too small, so the travel move is routed too close to the table."
  evidence: "Measured minimum centre-line clearance during the correctly-branched portion of the travel move is 0.0804 m — the designed value, achieved exactly. The 0.0080 m minimum occurs only after the wrap-induced branch flip. Raising the constant would mask the real defect and push the lift target back toward the unreachable region compile.ts already documents."
  timestamp: 2026-08-15

- hypothesis: "IN-02's original theory — the diagonal homeTcpPoint -> liftPoint segment sweeps intermediate links sideways through the table while the TCP stays clear."
  evidence: "Measured directly: over samples 1..280 (which covers the lift and most of the clearance-plane traverse, in the correct configuration) the minimum skeleton-to-tabletop distance is 0.0804 m for print and 0.0830 m for mill. The lift segment never brings any link near the table. The intrusion begins at idx 281, at the branch flip, well after the lift is complete."
  timestamp: 2026-08-15

- hypothesis: "UAT's theory — the travel waypoints sit in a poorly-conditioned region of the workspace, so the IK solve is genuinely near-singular there."
  evidence: "`classifySingularity` reports ZERO singular samples across all 1330 print / 1137 mill compiled samples (wrist=0, shoulder=0, elbow=0). No waypoint is near a singularity. The 'singularity-like' whipping is a branch-selection artefact, not a kinematic degeneracy — the arm is snapping between two well-conditioned configurations."
  timestamp: 2026-08-15

- hypothesis: "A renderer/urdf-loader frame or interpolation problem (e.g. `toUrdfJointAngles` mis-mapping) causes the visual artefact."
  evidence: "The whole failure reproduces in a headless Node vitest run against `compileTrajectory` alone, with no Three.js, no urdf-loader and no rendering. The compiled joint data itself contains the 4.28 rad discontinuity."
  timestamp: 2026-08-15

- hypothesis: "The defect is specific to one bundled sample's g-code geometry."
  evidence: "Both samples fail identically in structure: print at travel idx 1/281/372, mill at 1/286/368, with the same three-interval clearance collapse (0.0804 -> 0.0080 print, 0.0830 -> 0.0159 mill)."
  timestamp: 2026-08-15

## Resolution

root_cause: "(1) `pickClosestBranch`/`jointSpaceDistance` (src/kinematics/inverse-kinematics.ts) score IK branches by raw component subtraction while `solveUR6IK` normalises every branch into (-pi, pi]; when a joint crosses that wrap boundary mid-travel the geometrically-continuous branch is penalised by ~2pi and loses to a physically distant arm reconfiguration, producing a 4.28 rad whole-arm snap over 2 mm of TCP motion and leaving the arm in a configuration that rides 0.008 m from the tabletop instead of 0.080 m. (2) `compileTrajectory` uses the authored `UR3E_PARKED_POSE` verbatim as sample 0 while every other sample is IK-solved against `buildToolDownTarget`'s fixed tool-down orientation, which that pose does not satisfy (rotation error 1.00), producing a 1.57 rad wrist snap between sample 0 and sample 1."
fix: "(1) `src/kinematics/inverse-kinematics.ts` — added a module-private `unwrapTowards(candidate, previous)` that re-expresses each IK branch in the 2*pi-equivalent revolution nearest the previous sample, per joint, and ONLY when the unwrapped value stays inside that joint's own `UR3E_JOINT_LIMITS` entry (load-bearing: the elbow is +/- pi where the other five are +/- 2*pi, so its continuation past pi is genuinely unreachable and must not be manufactured). `pickClosestBranch` now unwraps each candidate BEFORE scoring it and returns the unwrapped form, so the stored joint values are continuous in value, not merely equivalent in pose — which also protects the Phase 5 joint-velocity readout from a spurious 2*pi spike. `jointSpaceDistance` is unchanged and now documents that it is deliberately raw. (2) `src/kinematics/ur3e-dh.ts` — re-authored `UR3E_PARKED_POSE` as the tool-down IK branch at its own previous TCP point: shoulder_pan pi, the stowed shoulder/elbow bend as two named constants, wrist_2/wrist_3 at -pi/2, and wrist_1 DERIVED as `-pi/2 - shoulder_lift - elbow` (the tool-down closure for this wrist configuration) so re-posing the stowed bend keeps the pose tool-down automatically instead of silently reintroducing the snap. The parked TCP is bit-for-bit unchanged, so `compileTrajectory`'s `homeTcpPoint` and every empirically-verified claim in its doc comment about lift reachability and table-height crossing still stand unmodified. (3) `src/trajectory/compile.ts` — doc-only: cross-references that constraint at the one site that special-cases sample 0."
verification:
  signal_regression_test: "PASS — 6 new regression tests added and confirmed RED before the fix with exactly the predicted numbers (print 4.2846 rad step at idx 281; mill 4.2458 at 286; print traverse clearance 0.0080 m; mill 0.0159 m), GREEN after. Tests: `compile.test.ts` 'the whole ARM (not just the TCP) clears the table while traversing' (print + mill) and 'adjacent samples never snap (D-03 continuity, end to end)' (print + mill); `inverse-kinematics.test.ts` 'pickClosestBranch — 2*pi wrap must not be mistaken for real motion' (3 cases incl. the elbow joint-limit boundary neighbour) and 'UR3E_PARKED_POSE — must hold the same tool-down orientation every solved sample uses'."
  signal_full_suite: "PASS — 480 tests across 52 files, zero failures. No pre-existing test was modified or weakened; the only edits to existing test files are additions."
  signal_typecheck: "PASS — `tsc -b` clean."
  signal_build: "PASS — `vite build` succeeds (781 modules, 9.4s)."
  signal_lint: "NOT APPLICABLE — the repo has no `eslint.config.js`, so `npm run lint` cannot run. Pre-existing project gap, unrelated to this fix and not introduced by it."
  signal_mutation: "PASS — neutering `unwrapTowards` to return its input unchanged was killed by 5 of the 6 new tests (the parked-pose test correctly survived, since it pins the independent second root cause). Confirms the fix site is load-bearing and the tests bite rather than passing vacuously."
  signal_revert: "PASS — equivalent to the RED phase above: the exact reported symptoms reappear with the pre-fix code."
  measured_outcome: "Max per-joint step between adjacent samples: print 4.2846 -> 0.0132 rad, mill 4.2458 -> 0.0128 rad. Steps above 0.2 rad: 3 -> 0 for both samples. Minimum arm-link centre-line clearance to the tabletop through the clearance-plane traverse: print 0.0080 -> 0.0800 m, mill 0.0159 -> 0.0830 m — i.e. exactly the designed `TRAVEL_CLEARANCE_ABOVE_TABLE_M` of 0.08, now actually delivered. Lift-phase clearance 0.1135 m (print) / 0.1228 m (mill). Singularity flags remain 0 across all 1330 print / 1137 mill samples. Trajectory status stays 'ready' with unchanged sample counts and rail positions."
  oracle_type: "derived (contract/model) — the assertions encode two design contracts (adjacent samples must be continuous in joint space; no arm link may approach the tabletop during the clearance-plane traverse) checked against the real bundled g-code, not against the solver's own output."
  guardrail_verdict: accepted
  residual_risk: "Clearance is measured against the arm's kinematic skeleton (frame origins joined by straight segments), not the real URDF mesh hulls, so absolute clearance figures are approximate — the 10x/5x before-after ratio is the load-bearing result. Final confirmation that nothing grazes the table during a real scrub drag requires human visual verification."
files_changed:
  - "src/kinematics/inverse-kinematics.ts — wrap-aware continuity selection (root cause 1)"
  - "src/kinematics/ur3e-dh.ts — tool-down parked pose (root cause 2)"
  - "src/trajectory/compile.ts — doc-only cross-reference at the sample-0 special case"
  - "src/kinematics/inverse-kinematics.test.ts — 4 new regression tests"
  - "src/trajectory/compile.test.ts — 4 new regression tests (arm-link clearance + end-to-end continuity)"
