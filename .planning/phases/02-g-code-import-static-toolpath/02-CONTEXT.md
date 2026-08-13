# Phase 2: G-code Import + Static Toolpath - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can load a g-code file and see it parsed into a classified, color-coded toolpath rendered as a **static** line in the 3D scene — independent of any kinematics/animation risk. No robot posing, no IK, no playback: the UR3e stays parked at its Phase 1 ready pose. This phase covers SIM-01 (parse g-code into classified move segments: move type, coordinates, feed rate) and SIM-02 (render as a color-coded line, rapid/joint moves visually distinct from linear/cutting moves).

</domain>

<decisions>
## Implementation Decisions

### G-code Source
- **D-01:** No file-upload UI. The app ships with curated, bundled sample g-code files only — REQUIREMENTS.md already scopes out general-purpose g-code authoring/upload, and bundled samples eliminate the risk of an unvetted file hitting a parser edge case live during the interview demo. — **Reversibility:** reversible — a file-upload input can be added later without touching the parsing/rendering pipeline.
- **D-02:** Sample selection is a simple dropdown/select (not a card list) — fast to build, unambiguous, fits the existing minimal chrome from Phase 1 (Reset View button, nav cube) without adding a new UI surface.

### Move-Type Color Coding
- **D-03:** Rapid/joint (G0) moves render in a muted gray; linear/cutting (G1/G2/G3) moves render in a warm, high-contrast color (e.g. orange/red). This mirrors the common CAM-viewer convention (rapid = non-material travel, recedes; cutting = tool doing work, draws the eye) and stays clear of the Accent blue (`#2563EB`) reserved for the nav-cube/Reset View button per `01-UI-SPEC.md`. Exact hex values are Claude's discretion within this gray/warm pairing — pick values that read clearly against the Dominant (`#FAFAFA`)/Secondary (`#E4E7EB`) palette and are colorblind-distinguishable from the Accent blue.
- **D-04:** Rapid moves are dashed; cutting moves are solid. Line style carries the move-type distinction in addition to color (matches CAM-viewer convention, and keeps the distinction legible even in a still screenshot or for a colorblind viewer). — **Reversibility:** reversible — a rendering-layer choice, no data-model impact.

### Toolpath Scale/Fit in the Cell
- **D-05:** The camera auto-fits/zooms to the loaded toolpath's bounding box when a sample is selected, rather than assuming every sample already fits the Phase 1 default framing. Works regardless of a sample's real-world scale (mm-scale print vs. larger mill job). — **Reversibility:** costly — later phases (3+) may read/extend camera-framing logic for scrub/playback; changing this after Phase 3 builds on it means touching whatever consumes the fit logic, not just this phase's code.
- **D-06:** The toolpath is anchored near the robot's reachable workspace (positioned in front of the robot within its reach envelope), not plotted at the g-code file's own raw coordinates. Reads as "the thing the robot is working on" regardless of the sample file's coordinate-origin convention. — **Reversibility:** costly — Phase 3's IK will target these same world-space toolpath points; changing the anchoring transform after Phase 3 is built means re-deriving every IK target, not just moving a rendered line. Document the exact anchor-offset transform clearly so Phase 3 can consume it as a known, stable input.

### Printing vs. Milling Sample Coverage
- **D-07:** Ship two bundled samples: one printing-style (extrusion-style G1 moves) and one milling-style (arcs — G2/G3 — with depth passes), not just one. Directly exercises the "single-dialect assumption" pitfall RESEARCH.md flagged, and both samples are needed eventually anyway once Phase 7 (Tool-Changer) demonstrates the Printing/Milling tab switch — building them now avoids retrofitting later.
- **D-08:** Both sample files are hand-authored (not sourced from a real slicer/CAM export) — small, clean, standard G0/G1/G2/G3 syntax, sized/scaled to sit well within the Phase 1 cell's footprint. Full control over scale and complexity; avoids real-world exports being oversized (thousands of moves) or hitting obscure dialect quirks.

### Claude's Discretion
- Exact hex values for the rapid/cutting color pair (within the gray/warm-color pairing locked by D-03).
- Exact dash pattern/gap ratio for rapid-move lines (D-04).
- The precise anchor-offset transform's numeric values (D-06) — document whatever is chosen so Phase 3 can treat it as a stable, referenced constant, not a re-derived guess.
- Move classification scheme for feed rate: SIM-01 requires feed rate to be parsed per segment even though Phase 2 doesn't yet visualize it (that's OPT-01/DASH-02 territory) — store it on the classified segment now so later phases don't need to re-parse.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack (this phase's parser/rendering libraries)
- `.planning/research/STACK.md` §"G-code Parsing / Toolpath Generation" — `gcode-toolpath@3.0.0` (built on `gcode-parser@2.2.0`) is the recommended parser; exposes `addLine`/`addArcCurve` callbacks carrying modal state (G0/G1/G2/G3) plus start/end vectors — maps directly to SIM-01's classified-segment requirement.
- `.planning/research/STACK.md` §"Supporting Libraries" — drei's `Line`/`Line2` (fat lines) for per-segment-colorable toolpath polylines; do not use plain `THREE.Line`/`LineBasicMaterial` (can't vary width reliably, and per Pitfall 11 below, must be one batched geometry, not one object per segment).

### Known pitfalls for this phase
- `.planning/research/PITFALLS.md` §"Pitfall 11" — one `Line`/mesh object per toolpath segment causes a draw-call bottleneck past ~1000 segments; use a single `Line2`/`BufferGeometry` with a per-vertex color attribute for the entire toolpath instead.
- `.planning/research/PITFALLS.md` §"Pitfall 12" (geometry-recreation memory leak) — update the `BufferAttribute` in place when a new sample is selected; don't recreate the geometry object.
- `.planning/research/PITFALLS.md` — G-code single-dialect assumption: verify both bundled samples (printing-style, milling-style) parse correctly, per D-07/D-08 above.
- `.planning/research/PITFALLS.md` — Unit ambiguity (mm/inch, G20/G21): since both sample files are hand-authored (D-08), author them in mm and omit inch-mode testing this phase — but surface the assumed unit in the UI per the pitfall's stated fix, rather than silently hardcoding it invisibly.

### Design system (color/UI constraints)
- `.planning/phases/01-static-rig-kinematics-foundation/01-UI-SPEC.md` — Dominant (`#FAFAFA`) / Secondary (`#E4E7EB`) / Accent (`#2563EB`, reserved for nav-cube + Reset View only) palette. Toolpath colors (D-03) must be new tones distinct from all three.

### Existing kinematics/scene surface this phase builds on
- `src/kinematics/index.ts` — barrel exporting `RAIL_TRAVEL`, `RAIL_CENTER_X`, `UR3E_READY_POSE`, `forwardKinematics` — use `forwardKinematics(UR3E_READY_POSE)` to derive the robot's current TCP/flange world position for the D-06 anchor-offset calculation, rather than hand-guessing a workspace-front coordinate.
- `src/scene/RailRig.tsx` — exports `RIG_Z_OFFSET`, `ROBOT_REACH_ENVELOPE`, `RIG_FOOTPRINT_WIDTH/DEPTH` — reuse these constants for the D-06 anchor placement; do not restate the robot's reach or the rig's Z-offset as a new literal.
- `src/scene/camera-defaults.ts` — `DEFAULT_CAMERA_POSITION`/`DEFAULT_CAMERA_TARGET` — the D-05 auto-fit behavior is a *new* camera framing computed from the toolpath's bounds, distinct from these defaults; the existing Reset View button should still restore the Phase 1 default framing, not the toolpath fit.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/scene/CellScene.tsx` — R3F Canvas composition root; new toolpath rendering mounts here alongside the existing `RailRig`/`NavCube`/`CameraResetListener` per the established composition order (lights → floor → rail-rig-mount → OrbitControls → NavCube).
- `src/store/cellStore.ts` (Zustand) — existing pattern for scene state (`robotLoadStatus`, `resetToken`) to extend with the selected sample / parsed toolpath state. Per Phase 1's established rule: do NOT push per-frame values through this store — but a *static* toolpath (this phase has no playback) is a one-time-per-selection write, not a per-frame one, so it's a legitimate fit.
- `src/ui/SceneStatusOverlay.tsx` + `src/ui/scene-status-copy.ts` — established loading/error-overlay pattern; reuse for "parsing…" / "failed to parse sample" states rather than inventing a new overlay mechanism.

### Established Patterns
- Scene-composition constants (reach envelope, footprint, Z-offset) live in `RailRig.tsx` and are imported, never restated as literals elsewhere (Phase 1's "rail agreement" rule) — the same discipline applies to any new toolpath-placement constants this phase introduces.
- Asset-integrity testing pattern (`src/scene/urdf-asset.test.ts`) — cross-checks a fetched/bundled asset against independently-verified constants rather than trusting it blindly. Apply the same discipline to the two bundled sample g-code files: a test should assert each sample parses into the expected move-type counts, not just "doesn't throw."

### Integration Points
- New toolpath-rendering component mounts inside `CellScene.tsx`'s existing composition order, positioned via the D-06 anchor offset (built from `RailRig.tsx` constants + `forwardKinematics`), not as an unrelated new scene root.
- Sample-selection UI (dropdown, per D-02) is DOM/React chrome, following the same pattern as `ResetViewButton.tsx` — a small controlled component reading/writing `cellStore.ts`.

</code_context>

<specifics>
## Specific Ideas

No specific visual references beyond what's captured in Decisions above (CAM-viewer-convention color/line-style pairing, camera-auto-fit, robot-anchored placement).

</specifics>

<deferred>
## Deferred Ideas

- **Depth-of-engagement coloring during milling cuts (SIM-06)** — explicitly Phase 6's scope (Operations Tree + Mill Engagement Coloring), not this phase. Phase 2's milling sample only needs standard move-type (rapid/cutting) coloring, not engagement-depth coloring.
- **Start/end markers per operation (SIM-03)** — explicitly Phase 6's scope. Not built in Phase 2.
- **Playback/animation of the toolpath (SIM-04, SIM-05)** — explicitly Phases 3/4's scope. Phase 2's toolpath is fully static — the whole path renders at once, robot does not move.
- **File-upload UI** — user explicitly chose curated samples only for this phase (D-01); could become a future-phase or v2 idea if ever wanted, but not requested — noted here only so it isn't silently reconsidered later without the original reasoning (demo reliability).

None — discussion otherwise stayed within phase scope.

</deferred>

---

*Phase: 2-g-code-import-static-toolpath*
*Context gathered: 2026-08-13*
