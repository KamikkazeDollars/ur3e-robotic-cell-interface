# Debug Knowledge Base — Resolved Sessions

Index of resolved `/gsd-debug` sessions. Each full session file lives beside this README
and carries the complete evidence trail; the entries below carry the **transferable lesson**
so a future investigation can recognise the pattern without reading the whole session.

Read this before starting a new debug session — a symptom match here is a
**hypothesis candidate to test first**, not a confirmed diagnosis.

**Entry convention:** symptom as observed → root cause(s) stated as a general class →
why the existing gates did not catch it → the recurrence guard that now exists → pointers.

---

## table-clipping-singularities — arm clips the table and whips during the home→toolpath travel scrub

- **Date:** 2026-08-15
- **Session:** [`table-clipping-singularities.md`](./table-clipping-singularities.md)
- **Origin:** Phase 03 UAT tests 1 and 3 (gaps G-03-1, G-03-3); previously logged as 03-REVIEW.md IN-02
- **Bug class:** Bohrbug — fully deterministic, reproduced headlessly in Node against `compileTrajectory` with no renderer involved
- **Error patterns:** arm passes through table, joint whipping/snapping, apparent wrist singularity, travel move, scrub drag, IK branch flip, 2*pi wrap, parked pose

### Symptom as observed

Scrub-dragging from 0% through the first few percent — the prepended home→toolpath travel
move — made the arm pass through the tabletop and whip/snap at a joint, in **both** bundled
samples (print and mill). It read like a wrist singularity. It was not one:
`classifySingularity` reported **zero** singular samples across all 1330 print / 1137 mill
samples. The arm was snapping between two perfectly well-conditioned configurations.

### Root cause 1 (general class): a continuity metric that is blind to the representation its own solver produces

**The class:** *when a selector scores candidates on a quantity that a normalisation step
upstream has already folded into a restricted range, a pure REPRESENTATION change reads as a
large PHYSICAL change — and the selector will deliberately choose the wrong candidate at the
fold boundary.*

Here: `solveUR6IK` normalises every IK branch into `(-pi, pi]`, while `jointSpaceDistance`
scored branches by **raw component subtraction**. When a joint crossed the wrap boundary
mid-travel, the geometrically-continuous branch (`theta6: -3.1415 → +3.1346`, a true move of
0.0103 rad) was scored ~2*pi away and lost to a physically distant whole-arm reconfiguration.
Result: a 4.28 rad whole-arm snap over 2 mm of TCP motion — which was *both* reported
symptoms at once. The whip was the snap; the clipping was because the losing configuration
rides 0.008 m from the tabletop where the correct one rides 0.080 m.

**The subtlety worth carrying forward:** unwrapping is not unconditionally safe. On the UR3e
the **elbow is ±pi while the other five joints are ±2*pi**, so a naive "add 2*pi to get
nearer" manufactures a pose the robot physically cannot reach. Unwrapping must be
**limit-checked per joint** against that joint's own declared range. A generic
`unwrap(a, b)` helper with no limit awareness would have traded a visible bug for a silent one.

**Second-order benefit:** unwrapping at selection time makes the stored joint values
continuous *in value*, not merely equivalent *in pose*. Anything downstream that differentiates
those values — the Phase 5 joint-velocity readout — would otherwise have seen a spurious
2*pi spike.

### Root cause 2 (general class): an authored constant used verbatim alongside values derived under a different contract

**The class:** *a hand-authored constant spliced into a sequence whose every other element is
computed against a fixed invariant will silently violate that invariant, and nothing checks it
because the constant "looks right".*

Here: `compileTrajectory` used `UR3E_PARKED_POSE` verbatim as sample 0, while every other
sample is IK-solved against `buildToolDownTarget`'s fixed tool-down orientation. The authored
pose's flange was rotated ~90° about the tool axis (FK rotation vs target: **max element error
1.00**), so sample 0 → sample 1 snapped wrist_3 by 1.57 rad over 1.2 mm of TCP travel.

**Why the fix derives rather than hardcodes:** the replacement pose sets shoulder_pan, the
stowed shoulder/elbow bend, and wrist_2/wrist_3 explicitly, but **derives wrist_1 as
`-pi/2 - shoulder_lift - elbow`** — the tool-down closure condition for this wrist
configuration. Re-posing the stowed bend now stays tool-down automatically instead of silently
reintroducing the snap. Replacing one wrong magic number with a different right magic number
would have left the trap armed for the next person who nudges the home pose.

The replacement was chosen as the tool-down IK branch at the parked pose's **own existing TCP
point**, leaving `homeTcpPoint` bit-for-bit unchanged — so every empirically-verified claim in
`compileTrajectory`'s doc comment about lift reachability and table-height crossing stayed
valid without re-derivation.

**Accepted cosmetic consequence:** the tool now points down at the home/parked pose instead of
sideways. Confirmed with the user and accepted as intended.

### PREVENTION — the most valuable part: both pre-existing regression gates passed while the bug was live

Two tests already existed that were nominally aimed at exactly these two failure modes. Both
were **green throughout**. Neither was a weak assertion or a missing case — both were
*structurally incapable* of failing:

1. **`compile.test.ts` "travel move clears the table"** asserted only on `sample.point` — the
   **TCP**, the one point that by construction never enters the table footprint below its top
   surface. The elbow was riding 8 mm off the tabletop the whole time, unobserved.
   → **Generalise: a gate that checks the CONTROLLED POINT instead of the WHOLE SWEPT BODY
   cannot see a collision involving any other part of the body.** If the thing that can collide
   is the arm, measure the arm.

2. **`inverse-kinematics.test.ts` "pickClosestBranch — continuity along a line of tool-down
   targets"** had two independent flaws that compounded: it walked a 100 mm line at the
   toolpath anchor's own height — **a region where no joint crosses the wrap boundary**, so the
   triggering condition was never exercised — *and* it asserted `max step < 0.2 rad` using
   **the very wrap-blind metric that was under test**.
   → **Generalise: a test that validates a metric USING that same metric is a tautology — it
   can only confirm the metric agrees with itself.** Assert with an independent oracle (here:
   shortest-angular-path, or FK-derived Cartesian motion). And a continuity test must be walked
   through the boundary it is meant to protect, not near it.

**Recurrence guards now in place** (6 tests, all confirmed RED before the fix with the exact
predicted numbers — print 4.2846 rad at idx 281, mill 4.2458 at idx 286, print traverse
clearance 0.0080 m, mill 0.0159 m — and GREEN after):

| Guard | File | What it now measures |
|---|---|---|
| `compileTrajectory — the whole ARM (not just the TCP) clears the table while traversing` (print + mill) | `src/trajectory/compile.test.ts:253` | Full kinematic skeleton vs the tabletop AABB — closes gate flaw 1 |
| `compileTrajectory — adjacent samples never snap (D-03 continuity, end to end)` (print + mill) | `src/trajectory/compile.test.ts:295` | Adjacent-step continuity over the REAL compiled travel move, where the wrap boundary is actually crossed — closes gate flaw 2 |
| `pickClosestBranch — 2*pi wrap must not be mistaken for real motion` (3 cases) | `src/kinematics/inverse-kinematics.test.ts:167` | Includes `never unwraps a joint out of its own travel limit` (line 207) — the elbow ±pi boundary neighbour |
| `UR3E_PARKED_POSE — must hold the same tool-down orientation every solved sample uses` | `src/kinematics/inverse-kinematics.test.ts:221` | Pins root cause 2 independently of root cause 1 |

**Mutation check:** neutering `unwrapTowards` to return its input unchanged was killed by 5 of
the 6 new tests. The parked-pose test correctly **survived** — it pins the independent second
root cause, which is the intended result, not a gap.

### Files changed

- `src/kinematics/inverse-kinematics.ts` — added module-private limit-checked `unwrapTowards(candidate, previous)` (line 314); `pickClosestBranch` (line 358) now unwraps each candidate *before* scoring and returns the unwrapped form. `jointSpaceDistance` is unchanged and now documents that it is deliberately raw.
- `src/kinematics/ur3e-dh.ts` — re-authored `UR3E_PARKED_POSE` as the tool-down branch with wrist_1 derived from the closure condition.
- `src/trajectory/compile.ts` — doc-only cross-reference at the sample-0 special case.
- `src/kinematics/inverse-kinematics.test.ts`, `src/trajectory/compile.test.ts` — the guards above.

### Measured outcome

Max per-joint step between adjacent samples: print **4.2846 → 0.0132 rad**, mill
**4.2458 → 0.0128 rad**; steps above 0.2 rad **3 → 0** for both. Minimum arm-link centre-line
clearance through the clearance-plane traverse: print **0.0080 → 0.0800 m**, mill
**0.0159 → 0.0830 m** — i.e. the designed `TRAVEL_CLEARANCE_ABOVE_TABLE_M` of 0.08, now
actually delivered. `TRAVEL_CLEARANCE_ABOVE_TABLE_M` was **not** changed; measurement showed it
was already correct and only ever violated after the branch flip. Full suite 480 tests / 52
files green; `tsc -b` and `vite build` clean. Human-verified in-app on both bundled samples.

---
