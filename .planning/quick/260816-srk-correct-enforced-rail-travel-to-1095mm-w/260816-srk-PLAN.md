---
phase: quick
plan: 260816-srk
type: execute
wave: 1
depends_on: []
files_modified:
  - src/kinematics/rail.ts
  - src/kinematics/rail.test.ts
  - src/scene/rail-rig-geometry.test.ts
  - src/ui/manual-jog.test.ts
  - src/scene/RailRig.tsx
autonomous: true
requirements: [QUICK-260816-SRK]
estimate:
  tokens: 26000
  raw_tokens: 13000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Typing or dragging a rail value past 1095mm (either sign) clamps to exactly 1095mm, and the robot renders normally at both travel extremes."
    - "The visible rail track still spans exactly the same 2.8m / half-span 1.4m it does today — the user-confirmed geometry is byte-identical after this change."
    - "Each mode station still sits at exactly 46% of the (new, shorter) half-travel, and still lands EXACTLY on a resolveRailPosition candidate — no half-grid-step drift."
    - "No file anywhere in src/ still states the superseded travel bound, span, spacing, or mode offset as a literal — every consumer derives from RAIL_TRAVEL."
    - "Full Vitest suite, tsc -b, and production build all pass with no new failures."
  artifacts:
    - src/kinematics/rail.ts
    - src/kinematics/rail.test.ts
    - src/scene/rail-rig-geometry.test.ts
    - src/ui/manual-jog.test.ts
  key_links:
    - "RAIL_TRAVEL -> RAIL_CANDIDATE_SPACING_M -> MODE_RAIL_START_OFFSET_M (the structural chain introduced by quick 260816-s4e; the whole point of this plan is that only the FIRST link changes)"
    - "RAIL_TRAVEL -> RailRig.tsx TRACK_OVERHANG (derived consequence; TRACK_HALF_SPAN_M itself is an untouchable fixed input)"
    - "RAIL_TRAVEL -> manual-jog.ts railLimitsMillimetres/clampRailMillimetres (Dashboard input + slider clamp)"
---

<objective>
Correct the enforced rail travel limit from its current value to ±1.095 m — the figure the user determined empirically by live-testing the already-trimmed ±1.4 m visual track — and let the existing `RAIL_CANDIDATE_SPACING_M` derivation chain from quick 260816-s4e re-scale everything downstream, rather than hand-picking any new literal.

Purpose: with the shortened visual track, the previously-specified enforced limit still lets the robot overhang the track visually at both extremes (the same defect class as `Robot Problem.png`, milder). The user has already re-tested live and supplied the corrected number — this plan just lands it correctly, including the ripple.

Output: `RAIL_TRAVEL` narrowed to ±1.095 m, all derived constants re-scaled by construction, all stale literal restatements swept out of tests and comments, full suite/typecheck/build green.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260816-s4e-cap-rail-travel-at-1300mm-trim-rail-visu/260816-s4e-SUMMARY.md

@src/kinematics/rail.ts
@src/kinematics/rail.test.ts
@src/scene/RailRig.tsx
@src/scene/rail-rig-geometry.test.ts
@src/ui/manual-jog.ts
@src/ui/manual-jog.test.ts
@src/trajectory/mode-rail.test.ts
</context>

<worked_arithmetic>
Do not re-derive these from scratch and do not substitute your own judgement figures. This is the complete arithmetic for the change; every number below follows mechanically from `RAIL_TRAVEL` alone.

| Quantity | Definition in code | New value |
|---|---|---|
| `RAIL_TRAVEL` | literal (THE ONLY INPUT THAT CHANGES) | `{ min: -1.095, max: 1.095 }` |
| total travel span | `RAIL_TRAVEL.max - RAIL_TRAVEL.min` | `2.19` m |
| `RAIL_RESOLUTION_CANDIDATES` | literal, **unchanged** | `201` |
| `RAIL_CANDIDATE_SPACING_M` | `span / (201 - 1)` | `0.01095` m |
| `MODE_RAIL_START_OFFSET_STEPS` | literal, **stays 46 — see below** | `46` |
| `MODE_RAIL_START_OFFSET_M` | `46 * RAIL_CANDIDATE_SPACING_M` | `0.5037` m |
| station as fraction of half-travel | `0.5037 / 1.095` | `0.46` (46%) |
| remaining travel beyond a station, tight side | `1.095 - 0.5037` | `0.5913` m |
| `TRACK_HALF_SPAN_M` | literal in RailRig.tsx, **UNTOUCHABLE** | `1.4` (unchanged) |
| `TRACK_LENGTH` | `TRACK_HALF_SPAN_M * 2`, **UNTOUCHABLE** | `2.8` (unchanged) |
| `TRACK_OVERHANG` | `TRACK_HALF_SPAN_M - span/2` (already derived) | `0.305` m (was smaller) |

**Why `MODE_RAIL_START_OFFSET_STEPS` stays at 46 and must NOT be re-picked:**
The step count is expressed in grid steps, and the grid has a fixed 100 steps per half-travel regardless of span (`(201-1)/2`). So 46 steps is *by definition* 46% of half-travel at every possible span. The station's proportional placement — the property the original figure was chosen for — is preserved automatically. This is precisely the outcome `RAIL_CANDIDATE_SPACING_M` was introduced to guarantee in quick 260816-s4e: a travel-span change re-scales the offset structurally with zero re-guessing. If you find yourself picking a new step count or a new metres literal, you have misread this plan.
</worked_arithmetic>

<!-- planner-discipline-allow: 1.3 -->
<!-- planner-discipline-allow: 1300 -->
<!-- planner-discipline-allow: 2.6 -->
<!-- planner-discipline-allow: 0.598 -->
<!-- planner-discipline-allow: 0.702 -->
<!-- The four literals above are the SUPERSEDED values this plan removes. They appear in
     task actions only so the executor knows what to delete. They must NOT be written back
     into any source file — not as code, not as a "was previously X" provenance comment.
     Task 2's negative grep gate enforces exactly that. -->

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Narrow RAIL_TRAVEL to ±1.095 m and let the derivation chain re-scale</name>
  <files>src/kinematics/rail.ts, src/kinematics/rail.test.ts</files>
  <read_first>
    Read `src/kinematics/rail.ts` in full before editing. Note that `RAIL_CANDIDATE_SPACING_M`
    and `MODE_RAIL_START_OFFSET_M` are already *derived* — the executable change in this file
    is a single object literal. Everything else in this task is removing now-false numbers
    from prose.
  </read_first>
  <behavior>
    - `RAIL_TRAVEL.min === -1.095` and `RAIL_TRAVEL.max === 1.095`.
    - `RAIL_TRAVEL.max - RAIL_TRAVEL.min` is `2.19` to 5 dp.
    - `RAIL_CANDIDATE_SPACING_M` still equals `span / (RAIL_RESOLUTION_CANDIDATES - 1)` to 12 dp (existing test, unchanged).
    - `MODE_RAIL_START_OFFSET_M / RAIL_CANDIDATE_SPACING_M` is still a whole number to within 1e-9 (existing test, assertion text and tolerance unchanged).
    - `resolveRailPosition` is still EXACTLY translation-covariant under `±MODE_RAIL_START_OFFSET_M` to within 1e-9 (existing test — tolerance must NOT be widened; if this fails, the offset derivation is wrong, not the tolerance).
    - Both mode stations still lie strictly inside `RAIL_TRAVEL` with positive remaining travel in both directions (existing tests, unchanged).
  </behavior>
  <action>
    1. In `src/kinematics/rail.ts`, change `RAIL_TRAVEL` to `{ min: -1.095, max: 1.095 } as const`. This is the only executable-code edit in this file.

    2. Do NOT change `RAIL_RESOLUTION_CANDIDATES` (stays 201), `RAIL_CANDIDATE_SPACING_M` (stays derived), or `MODE_RAIL_START_OFFSET_STEPS` (stays 46). See `<worked_arithmetic>` for why 46 is still correct — it is 46% of half-travel at any span by construction.

    3. Sweep this file's prose for numbers that are now false and rewrite them:
       - The `RAIL_TRAVEL` doc comment's parenthetical total-travel figure (currently states 2.6 m) → `2.19 m`.
       - The `MODE_RAIL_START_OFFSET_STEPS` doc-comment paragraph (b), which currently states the half-travel as 1.3 m and the remaining travel beyond a station as 0.702 m → half-travel `1.095 m`, remaining travel `0.5913 m`. Keep the "roughly 46%" claim: it is still exactly right, and paragraph (c)'s structural-alignment rationale is unchanged and must be preserved verbatim in substance.
       - Extend the file-header provenance note to record that the enforced bound was corrected again in quick 260816-srk after the user re-tested against the trimmed track, and that the visible track span was confirmed correct and deliberately left alone. Cite the quick-task IDs only.
       - **Hard constraint on all prose you write here:** do not restate any superseded numeral (1.3 / 2.6 / 0.598 / 0.702 / 1300) anywhere in this file, including inside a "previously was" style provenance sentence. Refer to prior attempts by quick-task ID, never by their numbers. A negative grep in Task 2 fails the build if you do.
       - Prefer naming a constant over restating its value wherever the sentence still reads clearly — same anti-restatement principle 260816-s4e applied to `railStartXForMode`'s comment.

    4. In `src/kinematics/rail.test.ts`, update only the total-span assertion and its title: the `it(...)` currently naming 2.6 metres and its `toBeCloseTo(2.6, 5)` become `2.19`. Nothing else in this file changes — in particular:
       - The `grid-alignment invariant` describe block keeps its exact assertions and tolerances (1e-12 / 1e-9). Do not widen, do not relax, do not add a tolerance argument.
       - The `railStartXForMode` describe block's translation-covariance test keeps its 1e-9 bound and its inline warning comment about not widening it.
       - Every other assertion is already expressed relative to `RAIL_TRAVEL` / `TOTAL_TRAVEL` and must stay that way.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx vitest run src/kinematics/rail.test.ts src/trajectory/mode-rail.test.ts</automated>
  </verify>
  <done>
    `RAIL_TRAVEL` is ±1.095, `MODE_RAIL_START_OFFSET_M` evaluates to 0.5037 m via 46 unchanged grid steps, both named test files pass in full, and no superseded numeral survives anywhere in `rail.ts` or `rail.test.ts`.
  </done>
  <reversibility rating="reversible">Single constant plus test/comment text; revert is a one-line git revert with no data or schema consequences.</reversibility>
</task>

<task type="auto">
  <name>Task 2: Sweep the downstream literal restatements and gate the whole repo</name>
  <files>src/scene/rail-rig-geometry.test.ts, src/ui/manual-jog.test.ts, src/scene/RailRig.tsx</files>
  <read_first>
    Read `src/scene/RailRig.tsx`'s constant block before editing. Confirm for yourself that
    `TRACK_HALF_SPAN_M` and `TRACK_LENGTH` are plain fixed inputs and that `TRACK_OVERHANG`
    is already computed from `RAIL_TRAVEL` — so this file needs NO executable-code edit.
  </read_first>
  <action>
    1. `src/scene/rail-rig-geometry.test.ts` — update the two assertions that restate the enforced bound as literals:
       - The `RAIL_TRAVEL is capped at ...` test: expected values become `-1.095` / `1.095`, and its title's numeral updates to match.
       - The `TRACK_OVERHANG` test: its numeric expectation becomes `0.305` (and the title's numeral with it). Keep the second, structural assertion in that same test (`TRACK_OVERHANG` equals `TRACK_HALF_SPAN_M` minus half the travel span) exactly as written — that is the assertion proving the overhang is a consequence, not an input.
       - Leave the `TRACK_LENGTH is exactly 2.8` test and the `RAIL_CENTER_X ± TRACK_HALF_SPAN_M` / `± 1.4` test **completely untouched, including their numerals**. Those encode the user-confirmed visual track and are explicitly out of scope. Note that the overhang expectation changing while the track expectations do not is the correct, intended shape of this diff: the track did not move, the end-stops moved inward.
       - Leave the two floor-containment tests untouched; they are already derived and should still pass (a shorter travel can only make them safer).

    2. `src/ui/manual-jog.test.ts` — update the millimetre-facing literals: `railLimitsMillimetres` expected `{ min: -1095, max: 1095 }`; `clampRailMillimetres` out-of-range expectations become `1095` / `-1095`; the in-range `250` case is unchanged. Update the round-trip test (its title and both assertions) to the new figure: `millimetresToMetres(1095)` is `1.095` and `metresToMillimetres(1.095)` is `1095`. These use strict `toBe` — if either fails on IEEE-754 rounding, report the exact received value in the summary and switch that single assertion to `toBeCloseTo(..., 9)` rather than silently rounding or changing the conversion functions. Do not touch `src/ui/manual-jog.ts` itself — it is already fully derived from `RAIL_TRAVEL`.

    3. `src/scene/RailRig.tsx` — **comment text only, zero constant or JSX changes.** The block of comment lines just below `TRACK_LENGTH` currently claims that at a travel extreme the carriage's base plate overhangs the visible track end, because the plate is wider than the remaining track margin. With the enforced travel now shorter and `TRACK_OVERHANG` re-deriving to 0.305 m, that claim needs rechecking: read `CARRIAGE_BASE_WIDTH` in this file and compare `CARRIAGE_BASE_WIDTH / 2` against 0.305. If the half-width is now smaller, replace that comment block with a short note that the carriage plate now sits fully within the visible track at both extremes, attributing the change to the corrected enforced travel (quick 260816-srk) and restating that `TRACK_HALF_SPAN_M` is a fixed user-specified figure that was deliberately not re-derived. If the half-width is still the larger of the two, keep the caveat but correct its figures. Either way: cite quick-task IDs, not superseded numerals, and change no executable line in this file.

    4. Repo-wide stale-literal sweep. Search all of `src/` for the superseded rail numerals (`1.3`, `1300`, `2.6`, `0.598`, `0.702`) and for any newly-orphaned reference. Only act on hits that genuinely concern rail travel — the earlier survey found unrelated legitimate hits (e.g. `FIT_PADDING` in `src/scene/ToolpathCameraFit.tsx`, joint-angle radians, CSS/padding numerals) which must be left alone. If a genuine rail-travel hit appears in a file this plan does not list, fix it by deriving from `RAIL_TRAVEL` and record the file in the summary as a deviation.

    5. Run the full gate: whole Vitest suite, `npx tsc -b`, and `npm run build`. Any failure in a file this plan does not list is a real ripple — fix it by deriving from `RAIL_TRAVEL`, never by loosening the assertion, and record it in the summary.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx vitest run &amp;&amp; npx tsc -b &amp;&amp; npm run build &amp;&amp; ! grep -REn "1\.3|1300|2\.6|0\.598|0\.702" src/kinematics/rail.ts src/kinematics/rail.test.ts src/scene/rail-rig-geometry.test.ts src/ui/manual-jog.test.ts src/scene/RailRig.tsx src/trajectory/mode-rail.test.ts</automated>
  </verify>
  <done>
    Full suite green with no new failures, `tsc -b` clean, production build succeeds (the pre-existing >500kB chunk-size warning is not a regression), and the scoped negative grep finds zero hits across all six rail-related files.
  </done>
  <reversibility rating="reversible">Test expectations and comment prose only; no runtime constant in this task.</reversibility>
</task>

</tasks>

<verify_gate_notes>
The negative grep in Task 2 is a **presence** gate (`! grep -q`-style), and comment lines are deliberately IN scope rather than filtered out — a superseded value surviving in a doc comment is exactly the defect this gate exists to catch, since `rail.ts`'s comments are the file's primary documentation of the travel range. It is scoped to six named rail files, not the whole repo, because unrelated legitimate hits (camera fit padding, joint radians, CSS) exist elsewhere and must not fail the build. None of the new values (1.095, 2.19, 0.01095, 0.5037, 0.5913, 0.305) contain any of the gated patterns as a substring, so a correct implementation passes cleanly.
</verify_gate_notes>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input -> rail position (Dashboard numeric field / slider) | Human-typed millimetre values cross into metres-native kinematics; the only boundary this plan's values sit on |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-srk-01 | Tampering | `clampRailMillimetres` / `clampRailPosition` — an out-of-range typed rail value | low | mitigate | Clamp path is untouched and still routes millimetre input through the metres-native clamp; Task 2's `manual-jog.test.ts` assertions re-prove clamping at the new bound in both directions |
| T-srk-02 | Denial of Service | `resolveRailPosition` brute-force scan | low | accept | Candidate count is unchanged at 201; scan cost is identical to today's, no new unbounded input |
| T-srk-03 | Tampering | npm/pip/cargo installs | n/a | accept | No packages are added, removed, or upgraded by this plan — no package-legitimacy gate applies |
</threat_model>

<verification>
- `npx vitest run` — full suite passes with no new failures (baseline was 406/406 after quick 260816-s4e; expect the same count).
- `npx tsc -b` — clean.
- `npm run build` — succeeds.
- Scoped negative grep across the six rail files — zero hits.
- Structural spot-check: `MODE_RAIL_START_OFFSET_M` evaluates to 0.5037 m and `MODE_RAIL_START_OFFSET_STEPS` is still the literal 46 — proving the offset re-scaled by derivation and was not re-guessed.
- `git diff --stat src/scene/RailRig.tsx` shows comment-line changes only, and `git diff src/scene/RailRig.tsx` contains no change to `TRACK_HALF_SPAN_M`, `TRACK_LENGTH`, or any JSX.
- Human check (informational, non-blocking — the user already determined ±1095mm empirically from live testing, so this is confirmation, not a gate): after `npm run dev`, type a value past 1095mm and drag the slider to both extremes; the robot should render normally at each end with the carriage sitting inside the visible track, and the track itself should look exactly as it does today.
</verification>

<success_criteria>
- `RAIL_TRAVEL` is `{ min: -1.095, max: 1.095 }` and is the sole literal input changed.
- `MODE_RAIL_START_OFFSET_STEPS` is still 46 and `MODE_RAIL_START_OFFSET_M` re-scaled to 0.5037 m purely by derivation from `RAIL_CANDIDATE_SPACING_M`.
- `rail.test.ts`'s grid-alignment and translation-covariance assertions pass unchanged and un-widened.
- `TRACK_HALF_SPAN_M` and `TRACK_LENGTH` in `RailRig.tsx` are byte-identical to their pre-change values, and the two track-span tests in `rail-rig-geometry.test.ts` are untouched.
- No superseded rail numeral survives in any of the six swept files.
- Full suite, typecheck, and build all green.
- Nothing outside the five listed files is modified except a genuine, documented ripple.
</success_criteria>

<output>
Create `.planning/quick/260816-srk-correct-enforced-rail-travel-to-1095mm-w/260816-srk-SUMMARY.md` when done.

Report as first-class findings:
- The final evaluated value of `MODE_RAIL_START_OFFSET_M`, and confirmation that `MODE_RAIL_START_OFFSET_STEPS` was left at 46.
- The evaluated `TRACK_OVERHANG`, and the `CARRIAGE_BASE_WIDTH / 2` comparison that decided how the `RailRig.tsx` carriage-overhang comment was rewritten.
- Whether the two `toBe` round-trip assertions in `manual-jog.test.ts` held exactly under IEEE-754, and the received values if not.
- Any file touched by step 4's sweep beyond the five this plan names, or an explicit "none".
- Any ripple failure in the full suite outside this plan's files, or an explicit "none".
</output>
