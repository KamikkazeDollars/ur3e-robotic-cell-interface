---
status: diagnosed
trigger: "operation-point-marker-count-and-sizing — For both bundled samples (print and mill), which each have 3 operations, only 2 operation start markers are shown on the toolpath instead of 3. Additionally, the vertical guide line under each marker is not very visible, and the markers themselves are too large relative to the overall trajectory."
created: 2026-08-15T00:00:00Z
updated: 2026-08-15T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Toolpath.tsx renders exactly 2 markers (whole-toolpath first point + whole-toolpath last point), not per-operation markers. Per-operation segmentation/marker/guide-line vocabulary is explicitly unbuilt Phase 6 scope (ROADMAP.md), not a regression in existing Phase 2/3 code. Marker oversizing is a separate, real root cause: a hardcoded absolute-metre radius constant never scaled to the toolpath's own bounding box.
test: read Toolpath.tsx, parseToolpath.ts, compile.ts, OperationsPanel.tsx, ROADMAP.md, 02-UAT.md gap G-02-03, git log for these files, and both bundled g-code samples
expecting: confirm whether per-operation grouping data exists anywhere in the pipeline (it does not) and whether a vertical guide-line component exists anywhere in the scene (it does not)
next_action: none — root cause confirmed, returning diagnosis (goal: find_root_cause_only)

## Symptoms

expected: Each operation in a sample has its own distinct, visible start marker on the toolpath, sized appropriately relative to the trajectory, sitting on a clearly visible vertical guide line.
actual: DATA_START
"For printing and milling I see that there are three operations that are made but only two points. It should be 3. Also the vertical line that the point is on isn't very visible. Also compared to the whole trajectory the points are too big, you can make them smaller."
DATA_END
errors: None reported
reproduction: Load either bundled sample (print or mill) in the app and inspect the toolpath's operation start markers — count them against the known 3 operations per sample, and visually assess marker size and guide-line visibility relative to the toolpath.
started: Reported during Phase 03 UAT (test 4, not one of the original 3 formal checkpoints)

## Eliminated

- hypothesis: "A regression in Phase 3 code broke previously-working per-operation marker logic."
  evidence: git log on src/scene/Toolpath.tsx shows the marker-adding commit is f1e8069 "feat(02-05): thicken toolpath lines and add start/end markers" (Phase 2), followed only by 8921e1d (Phase 2 lift-above-workbench fix) and 57019ed (unrelated UI shell scaffold). No Phase 3 commit ever touched this file. Per-operation marker logic never existed to regress from.
  timestamp: 2026-08-15T00:00:00Z

- hypothesis: "gcode-toolpath or the parser exposes per-operation boundaries that Toolpath.tsx simply fails to read."
  evidence: ClassifiedSegment (parseToolpath.ts) carries only {type, motion, source, points, feedRate} — no operation index/id field. ParsedToolpath carries {segments, unit, skippedMotionCount, appliedAnchorTranslation, bounds} — no operations array. CompiledTrajectory (compile.ts) carries {samples, railPos, status, requestedSampleCount} — samples have no operation grouping either. No stage of the pipeline computes or carries "which operation does this point belong to."
  timestamp: 2026-08-15T00:00:00Z

## Evidence

- timestamp: 2026-08-15T00:00:00Z
  checked: src/scene/Toolpath.tsx (full file)
  found: "endpoints" memo (lines 54-62) computes exactly ONE start point (toolpath.segments[0].points[0]) and ONE end point (last point of last segment) — the whole toolpath's overall first/last point, not per-operation. Two <mesh><sphereGeometry> markers are rendered (lines 99-110), both colored CUTTING_COLOR, both radius MARKER_RADIUS = 0.012 (a hardcoded absolute constant, line 24). The file's own doc comment (lines 49-52) states explicitly: "the overall toolpath's single start and single end point (not per-operation — this phase's toolpath is one continuous parsed path; per-operation markers are ROADMAP Phase 6's job)."
  implication: The "2 not 3" symptom is exactly what this code was built to do — render 2 markers for the whole path, never 3 for 3 operations. This is by design, not a bug in the executed logic.

- timestamp: 2026-08-15T00:00:00Z
  checked: src/gcode/parseToolpath.ts, src/trajectory/compile.ts (full files)
  found: No type or field anywhere in ClassifiedSegment, ParsedToolpath, TrajectorySample, or CompiledTrajectory represents "operation" grouping. gcode-toolpath's addLine/addArcCurve callbacks (consumed here) carry only motion/modal/point data, no operation/program-section boundaries.
  implication: Per-operation segmentation has no data source anywhere in the current pipeline — it would need to be newly computed (e.g. from rapid-to-cut transition boundaries), not merely "read" from something that already exists.

- timestamp: 2026-08-15T00:00:00Z
  checked: src/ui/tabs/OperationsPanel.tsx (full file)
  found: Purely static placeholder — SKELETON_OPERATIONS is a hardcoded array of 3 fake rows (not derived from any toolpath), and the component's own doc comment + <PhaseNote phase={6}> footer explicitly label "per-operation markers, computed durations and engagement coloring" as Phase 6, unbuilt work. Comment at line 25 says the skeleton rows exist "so the marker vocabulary Phase 6 introduces is visible even before real operations exist" — implying a distinct per-operation marker visual style (glyph "▶ ▪") is planned but not yet implemented anywhere, including in the 3D scene.
  implication: Confirms per-operation markers (in the panel AND by extension in the 3D scene) are known-future, not known-regressed, work.

- timestamp: 2026-08-15T00:00:00Z
  checked: .planning/ROADMAP.md
  found: Line 21 and lines 141-151 explicitly scope "Per-operation start/end markers" and "User sees a distinct start and end marker on the 3D trajectory for each operation" under "Phase 6: Operations Tree + Mill Engagement Coloring," listed as not started (line 196: "6. Operations Tree + Mill Engagement Coloring | 0/? | Not started").
  implication: Per-operation 3D markers are a formally scoped, not-yet-started future phase — corroborates the code-level finding independently.

- timestamp: 2026-08-15T00:00:00Z
  checked: .planning/phases/02-g-code-import-static-toolpath/02-UAT.md gap G-02-03 (lines 78-88)
  found: "truth: The rendered toolpath lines are visibly thicker, and the start and end of the toolpath are marked with clearly visible, thicker point markers in the same warm-orange family." This is the exact requirement Toolpath.tsx's current 2-marker code was built to satisfy (Phase 2 gap closure) — "the start and end of the toolpath" (singular, whole-path), never "of each operation."
  implication: Confirms the 2-marker behavior is a fully-implemented, correctly-closed PRIOR requirement (G-02-03), and the current UAT gap (G-03-4) is asking for a materially different, larger, not-yet-scoped-for-this-phase requirement (3 per-operation markers).

- timestamp: 2026-08-15T00:00:00Z
  checked: public/gcode/mill-sample.gcode, public/gcode/print-sample.gcode (full files)
  found: Mill sample = 3 depth passes (-1mm/-2mm/-3mm), each starting with a G0 retract+reposition then a G1 Z-plunge. Print sample = 3 inset-square layers, each starting with a G0 travel+lift then a G0 Z-plunge. Each of the 3 "operations" the user refers to is a real, distinct block in the g-code (marked only by hand-authored comments, e.g. "; --- pass 1: -1mm depth ---"), not by any G-code-parseable operation marker (no M-code, no tool change, no program-section word).
  implication: The g-code files genuinely do contain 3 operations by the user's (and the sample author's) intent, so "3 expected" is a correct, reasonable reading of the sample content — but nothing in gcode-parser/gcode-toolpath exposes that grouping automatically; a future Phase 6 implementation would need a heuristic (e.g. rapid-then-plunge transition detection) to derive it.

- timestamp: 2026-08-15T00:00:00Z
  checked: src/scene/CellScene.tsx (full file, full scene composition list) and a codebase-wide grep for "vertical|guide|dropLine|Cylinder|stem"
  found: The full 3D scene composition is: ambient/directional lights, floor plane, RailRig, Workbench, Toolpath (2 Line batches + 2 marker spheres), ScrubMarker (1 sphere), OrbitControls, NavCube, camera listeners. Grep across src/ for vertical-line / guide-line / drop-line / stem / pin / extra Cylinder geometry returns zero matches outside of unrelated comment text (e.g. "vertical clearance" in compile.ts doc comments, "-apple-system" CSS). No dedicated vertical guide-line (a "pin" style stem connecting a marker to the path/floor) exists anywhere in the codebase.
  implication: The "vertical line under the marker" the user describes is not a built, dedicated visual element with its own styling — it does not exist as code at all. What the user is most likely seeing is the g-code's own real near-vertical plunge segment (mill: G1 Z-1/-2/-3 cutting moves; print: G0 Z-plunge rapids) rendered with the SAME styling as every other segment of its class (CUTTING_COLOR/CUTTING_LINE_WIDTH for mill plunges, RAPID_COLOR/dashed/thin for print plunges) — no distinct "this is a guide/anchor line" visual treatment exists to make it stand out, which is exactly consistent with "isn't very visible."

- timestamp: 2026-08-15T00:00:00Z
  checked: src/scene/Toolpath.tsx MARKER_RADIUS constant and its doc comment (lines 20-24), compared against src/scene/ScrubMarker.tsx SCRUB_MARKER_RADIUS (0.02) and src/gcode/parseToolpath.ts's already-computed `bounds` field
  found: MARKER_RADIUS = 0.012 is a hardcoded absolute-metre constant, manually chosen ("so each marker reads as a clearly visible bullet point, not a speck") against an assumed sample scale ("bundled samples span roughly 0.13-0.15m per side") documented directly in the comment — never computed from or scaled against the toolpath's actual bounding box, even though `ParsedToolpath.bounds` (parseToolpath.ts) already exposes exactly that data and is unused by Toolpath.tsx for sizing.
  implication: A 0.024m-diameter sphere against a ~0.13-0.15m trajectory span is roughly 16-18% of the shortest trajectory dimension — visually large relative to line width (CUTTING_LINE_WIDTH=6, far thinner in effective on-screen terms) and to the whole path, exactly matching "compared to the whole trajectory the points are too big." Root cause is the fixed absolute size never being scaled/derived from the actual geometry it decorates.

## Resolution

root_cause: "Three independent, evidence-confirmed root causes for the three complaints in this single UAT gap (G-03-4), NOT one shared bug: (1) marker count — Toolpath.tsx's marker logic (category: code/scope) was built in Phase 2 (commit f1e8069, gap G-02-03) to render exactly 2 markers for the WHOLE toolpath's overall start/end point; per-operation segmentation (which would produce 3 markers matching the 3 real operations in each bundled g-code sample) has no data source anywhere in the pipeline (ClassifiedSegment/ParsedToolpath/CompiledTrajectory carry no operation grouping) and is explicitly scoped as unbuilt future work under ROADMAP.md Phase 6 ('Operations Tree + Mill Engagement Coloring', status: Not started) — confirmed independently by OperationsPanel.tsx's own placeholder skeleton and PhaseNote. This is a scope gap, not a code defect in what was actually built. (2) vertical guide-line visibility — no dedicated vertical guide-line component exists anywhere in the codebase (category: code, feature never built); what the user is seeing is most likely the sample g-code's own real near-vertical plunge segments (mill Z-depth plunges / print Z-layer plunges) rendered with the same undifferentiated line styling as every other segment of their class, with no distinct 'anchor/guide' visual treatment. (3) marker oversizing — a genuine, independently-fixable code issue (category: code): MARKER_RADIUS in Toolpath.tsx is a hardcoded absolute-metre constant (0.012) manually tuned against an assumed sample scale in a comment, never derived from the toolpath's own bounding box (already computed and exposed as ParsedToolpath.bounds but unused for sizing) — causing the marker to read as oversized relative to the ~0.13-0.15m trajectory span. AND-gate: these three causes do not need to co-occur to explain the symptom — each independently and fully explains its own third of the report; they are bundled only because the user reported them together in one UAT observation."
fix: ""
verification: ""
files_changed: []
