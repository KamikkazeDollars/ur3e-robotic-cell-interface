# Phase 2: G-code Import + Static Toolpath - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 2-g-code-import-static-toolpath
**Areas discussed:** G-code source, Move-type color coding, Toolpath scale/fit in the cell, Printing vs. milling sample coverage

---

## G-code Source

**Q1: How should a g-code file get into the app?**

| Option | Description | Selected |
|--------|-------------|----------|
| Curated sample files | Bundle 1-2 known-good sample files; user picks from a dropdown/list. Zero demo-breaking parse risk; REQUIREMENTS.md already excludes general-purpose g-code authoring. | ✓ |
| File upload only | A file picker/drag-drop loads any .gcode/.nc file from disk. More "real" but riskier live. | |
| Both | Curated samples as default, plus custom upload. Most flexible, more work. | |

**User's choice:** Curated sample files.

**Q2: How should the user pick a sample g-code file to load?**

| Option | Description | Selected |
|--------|-------------|----------|
| Simple dropdown/select | Native/shadcn select listing sample names. Fast, fits existing minimal chrome. | ✓ |
| Card/button list with description | Each sample as a small card with name + one-line description. More polished, more UI work. | |

**User's choice:** Simple dropdown/select.

---

## Move-Type Color Coding

**Q1: What color scheme should distinguish rapid/joint (G0) moves from linear/cutting (G1/G2/G3) moves?**

| Option | Description | Selected |
|--------|-------------|----------|
| Gray (rapid) + warm color (cutting) | Rapid in muted gray/dashed, cutting in warm high-contrast color. Common CAM-viewer convention. | ✓ |
| Two distinct saturated colors | e.g. green/orange, both fully colored. Higher contrast but rapid competes for attention. | |
| You decide | Claude picks within the existing neutral palette. | |

**User's choice:** Gray (rapid) + warm color (cutting).

**Q2: Should rapid moves also use a different line style (not just color)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Dashed for rapid, solid for cutting | Matches CAM-viewer convention; reads even without color (accessibility). | ✓ |
| Solid for both, color-only signal | Simpler to implement, color contrast alone carries the distinction. | |

**User's choice:** Dashed for rapid, solid for cutting.

---

## Toolpath Scale/Fit in the Cell

**Q1: How should the toolpath's size relate to the rail/floor built in Phase 1?**

| Option | Description | Selected |
|--------|-------------|----------|
| Camera auto-fits to the toolpath | Camera frames/zooms to the toolpath's bounding box on load. Works regardless of real-world scale. | ✓ |
| Toolpath must fit the existing footprint as-is | Camera stays at Phase 1 default framing; samples authored to already fit. Simpler, more constrained. | |

**User's choice:** Camera auto-fits to the toolpath.

**Q2: Where should the toolpath be positioned relative to the robot/rail?**

| Option | Description | Selected |
|--------|-------------|----------|
| Anchored near the robot's reachable workspace | Toolpath origin placed in front of the robot within reach. Reads as "the thing being worked on." | ✓ |
| Plotted at the g-code file's own coordinates | Rendered exactly at raw X/Y/Z values. Simpler, but could land anywhere. | |

**User's choice:** Anchored near the robot's reachable workspace.

---

## Printing vs. Milling Sample Coverage

**Q1: Should Phase 2's bundled samples cover both dialects now, or just one?**

| Option | Description | Selected |
|--------|-------------|----------|
| Both — one printing, one milling sample | Exercises the dialect-variety pitfall; both needed eventually for Phase 7's tab switch anyway. | ✓ |
| One sample only, milling-style | Closer to typical CNC/robotics demo; exercises more of the parser (arcs). Printing deferred. | |
| One sample only, printing-style | Simpler g-code, faster to source a clean sample. Milling deferred. | |

**User's choice:** Both — one printing sample, one milling sample.

**Q2: Where should the two sample g-code files come from?**

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-authored, purpose-built | Full control over scale/complexity; no obscure real-world dialect quirks. | ✓ |
| Sourced from real slicer/CAM output | More authentic, but often huge and needs trimming/rescaling. | |

**User's choice:** Hand-authored, purpose-built.

---

## Claude's Discretion

- Exact hex values for the rapid/cutting color pair (within the gray/warm-color pairing).
- Exact dash pattern/gap ratio for rapid-move lines.
- Precise numeric values of the D-06 anchor-offset transform (must be documented as a stable, referenced constant for Phase 3 to consume).
- Whether/how feed rate is stored per classified segment (parsed per SIM-01 even though not visualized until later phases).

## Deferred Ideas

- Depth-of-engagement coloring during milling cuts (SIM-06) — Phase 6's scope.
- Start/end markers per operation (SIM-03) — Phase 6's scope.
- Playback/animation of the toolpath (SIM-04, SIM-05) — Phases 3/4's scope.
- File-upload UI — not requested this phase; user chose curated samples only for demo reliability. Noted so the reasoning isn't lost if reconsidered later.
