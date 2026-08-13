# Phase 2: G-code Import + Static Toolpath - Research

**Researched:** 2026-08-13
**Domain:** Browser-side G-code parsing/classification and static, color-coded 3D toolpath rendering (React Three Fiber)
**Confidence:** HIGH (the two highest-risk unknowns — gcode-toolpath's actual API surface and its Vite browser-build compatibility — were resolved by reading the real npm package source and empirically reproducing a `vite build` against it, not by trusting docs or training memory)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**G-code Source**
- **D-01:** No file-upload UI. The app ships with curated, bundled sample g-code files only — REQUIREMENTS.md already scopes out general-purpose g-code authoring/upload, and bundled samples eliminate the risk of an unvetted file hitting a parser edge case live during the interview demo. — Reversibility: reversible.
- **D-02:** Sample selection is a simple dropdown/select (not a card list).

**Move-Type Color Coding**
- **D-03:** Rapid/joint (G0) moves render in a muted gray; linear/cutting (G1/G2/G3) moves render in a warm, high-contrast color (e.g. orange/red). Mirrors the common CAM-viewer convention. Stays clear of Accent blue (`#2563EB`). Exact hex values are Claude's discretion within this gray/warm pairing — pick values that read clearly against Dominant (`#FAFAFA`)/Secondary (`#E4E7EB`) and are colorblind-distinguishable from Accent blue.
- **D-04:** Rapid moves are dashed; cutting moves are solid. Line style carries the move-type distinction in addition to color. — Reversibility: reversible.

**Toolpath Scale/Fit in the Cell**
- **D-05:** The camera auto-fits/zooms to the loaded toolpath's bounding box when a sample is selected, rather than assuming every sample already fits the Phase 1 default framing. — Reversibility: costly (Phase 3+ may extend camera-framing logic for scrub/playback).
- **D-06:** The toolpath is anchored near the robot's reachable workspace (positioned in front of the robot within its reach envelope), not plotted at the g-code file's own raw coordinates. — Reversibility: costly (Phase 3's IK will target these same world-space toolpath points). Document the exact anchor-offset transform clearly so Phase 3 can consume it as a known, stable input.

**Printing vs. Milling Sample Coverage**
- **D-07:** Ship two bundled samples: one printing-style (extrusion-style G1 moves) and one milling-style (arcs — G2/G3 — with depth passes).
- **D-08:** Both sample files are hand-authored (not sourced from a real slicer/CAM export) — small, clean, standard G0/G1/G2/G3 syntax, sized/scaled to sit well within the Phase 1 cell's footprint.

### Claude's Discretion
- Exact hex values for the rapid/cutting color pair (within the gray/warm-color pairing locked by D-03).
- Exact dash pattern/gap ratio for rapid-move lines (D-04).
- The precise anchor-offset transform's numeric values (D-06) — document whatever is chosen so Phase 3 can treat it as a stable, referenced constant, not a re-derived guess.
- Move classification scheme for feed rate: SIM-01 requires feed rate to be parsed per segment even though Phase 2 doesn't yet visualize it (that's OPT-01/DASH-02 territory) — store it on the classified segment now so later phases don't need to re-parse.

### Deferred Ideas (OUT OF SCOPE)
- **Depth-of-engagement coloring during milling cuts (SIM-06)** — Phase 6's scope.
- **Start/end markers per operation (SIM-03)** — Phase 6's scope.
- **Playback/animation of the toolpath (SIM-04, SIM-05)** — Phases 3/4's scope. Phase 2's toolpath is fully static — the whole path renders at once, robot does not move.
- **File-upload UI** — user explicitly chose curated samples only for this phase (D-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIM-01 | User can upload a g-code file and have the system parse it into a classified toolpath (move type, coordinates, feed rate per segment) — scoped down to bundled-sample loading per D-01 | `gcode-toolpath`/`gcode-parser` API details below (addLine/addArcCurve, modal fields) **plus** the verified finding that `gcode-toolpath` silently drops feed rate — Code Examples section gives the exact wrapper pattern needed to actually satisfy the "feed rate per segment" clause |
| SIM-02 | User sees the parsed toolpath rendered in the 3D scene as a color-coded line — rapid/joint moves visually distinct from linear/cutting moves | drei `Line`/`Line2` per-vertex-color and `dashed` findings below, plus the verified constraint that dash state is material-level (not per-vertex), which drives the "two batches" rendering pattern in Code Examples |
</phase_requirements>

## Summary

This phase has one deceptively simple-looking core task — "parse g-code, draw a colored line" — that hides two build-breaking and one requirement-breaking gap, all confirmed this session by reading actual package source (not docs) and by empirically running `vite build` against the real dependency. First: **`gcode-toolpath`'s `addLine`/`addArcCurve` callbacks never carry the F-word (feed rate)** — the library's motion handlers parse `X`/`Y`/`Z`/`I`/`J`/`K`/`R` but never read `params.F`, and `modal.feedrate` is a dead field (a typo elsewhere in the library sets `modal.feedmode` instead, which nothing consumes). SIM-01 requires "feed rate per segment," so a thin, independent feed-rate tracker must be layered on top of `gcode-toolpath`, not obtained from it. Second: **`gcode-parser` (a transitive dependency of `gcode-toolpath` via `gcode-interpreter`) imports Node.js built-ins (`fs`, `stream`, `events`, `timers`) at module top level**, including `class GCodeLineStream extends Transform` — a class-extends clause evaluated at module-load time. A from-scratch `vite build` against this exact dependency reproduced a hard build failure (`"Transform" is not exported by "__vite-browser-external"`), not just a console warning. The verified fix is adding `vite-plugin-node-polyfills` (confirmed via a second from-scratch build that it resolves the failure). Third: drei's `<Line>` component makes `dashed` and `color` **material-level** properties of a single batched geometry — you cannot mix dashed-gray and solid-orange segments in one `<Line vertexColors>` call. Since D-03/D-04 need exactly two visually distinct treatments (dashed gray rapid vs. solid warm cutting) with no need for a third gradient, the correct pattern is **two separate batched `<Line segments>` instances** (one per move-type bucket), each a single draw call — satisfying both D-03/D-04 and PITFALLS.md Pitfall 11 (no per-segment objects) without needing per-vertex color machinery at all.

**Primary recommendation:** Build a thin classification layer on top of `gcode-toolpath` + `gcode-parser` (don't hand-roll the modal-state/arc-plane machinery — it's genuinely non-trivial and battle-tested) that (a) pre-scans the raw parsed lines for F-words to reconstruct per-segment feed rate independently of `addLine`/`addArcCurve`, (b) tessellates G2/G3 arcs into line-strip points using the verified `v0`=center / `v1`=start / `v2`=end semantics and the line's own `modal.motion` for CW/CCW direction, and (c) buckets every resulting segment into exactly two `<Line segments>` batches (rapid-dashed-gray vs. cutting-solid-warm) rather than a single vertex-colored batch. Add `vite-plugin-node-polyfills` to `vite.config.ts` before writing any parser code — do this first, as an early smoke-test task, since it is the one dependency-level risk that can silently pass `npm run dev` and only fail at `npm run build`.

## Architectural Responsibility Map

This project has no backend/API tier (per PROJECT.md: "Persistent backend/database/accounts: No multi-user or persistence requirement; client-side state only") — every capability in this phase lives entirely in the Browser/Client tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| G-code parsing & move classification | Browser/Client | — | Bundled static asset (D-01), parsed in-memory by `gcode-toolpath`/`gcode-parser`; no server round-trip exists in this app |
| Feed-rate extraction (SIM-01 gap-fill) | Browser/Client | — | Must run alongside the parse pass since `gcode-toolpath` doesn't carry it through; same in-memory pipeline |
| Toolpath geometry construction (arc tessellation, coordinate anchoring D-06) | Browser/Client | — | Pure JS/TS transform of parsed segments into `THREE.Vector3` arrays before handing to R3F |
| Toolpath rendering (color/dash-coded line) | Browser/Client (R3F/WebGL) | — | drei `Line`/`Line2`, mounted inside the existing `CellScene.tsx` Canvas |
| Camera auto-fit (D-05) | Browser/Client (R3F/WebGL) | — | Imperative `useThree` + `Box3`, matching the existing `CameraResetListener.tsx` pattern |
| Sample-selection UI (dropdown, D-02) | Browser/Client (DOM/React) | — | Controlled component reading/writing `cellStore.ts`, same pattern as `ResetViewButton.tsx` |

## Standard Stack

This section extends `.planning/research/STACK.md` §"G-code Parsing / Toolpath Generation" and §"Supporting Libraries" with phase-specific findings; it does not restate those sections' rationale for choosing `gcode-toolpath`/`gcode-parser`/drei `Line` in the first place.

### Core (phase-specific)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `gcode-toolpath` | 3.0.0 (verified on npm registry, published 2024-11-17) | Modal-state G-code interpreter → `addLine`/`addArcCurve` segment callbacks | Already selected in STACK.md; this phase adds the concrete API contract (below) and the critical feed-rate gap |
| `gcode-parser` | 2.2.0 (verified on npm registry, published 2024-11-20) | Line tokenizer (`parseStringSync`) — used directly by this phase for an independent feed-rate pre-scan, not only as `gcode-toolpath`'s internal dependency | STACK.md already flags this as "add as a direct dependency if you need custom line-level processing" — SIM-01's feed-rate requirement is exactly that case |
| `vite-plugin-node-polyfills` | 0.28.0 (verified on npm registry, published 2026-05-18) | Polyfills `stream`/`events`/`timers` for the browser so `gcode-parser`'s Node-builtin imports don't break `vite build` | **New finding this session, not in STACK.md.** Required — without it, `npm run build` fails hard (empirically reproduced, see Common Pitfalls). `npm run dev` may appear to work while `npm run build` fails, so this must be verified with a real production build, not just the dev server. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vite-plugin-node-polyfills` | Hand-roll a minimal G-code tokenizer + modal-state machine (zero Node-builtin dependency risk) | Fully avoids the Vite/Node-builtin class of bugs, and this session's source-reading already provides the complete algorithm to port (regex word-tokenizer, modal defaults, arc plane/center math). Only reach for this fallback if `vite-plugin-node-polyfills` itself causes a *different* build problem (unlikely — verified working, OK legitimacy verdict, 1.5M weekly downloads) — the polyfill path is lower-effort and reuses `gcode-toolpath`'s already-battle-tested arc/modal logic. |
| Single `<Line vertexColors>` batch for the whole toolpath | Two `<Line segments>` batches (rapid vs. cutting) | A single vertex-colored batch is the generically "correct" drei answer for *N*-color-per-vertex toolpaths, but D-03 only needs exactly two discrete colors, and D-04 needs a **material-level** dashed/solid split that per-vertex color cannot express in drei's `Line`. Two batches is simpler, still O(1) draw calls (satisfies PITFALLS.md Pitfall 11), and is the only way to get both dash and color right without hand-rolling a custom `LineMaterial` shader. |

**Installation (additive to STACK.md's install block):**
```bash
npm install gcode-toolpath@^3.0 gcode-parser@^2.2
npm install -D vite-plugin-node-polyfills@^0.28
```

**Version verification performed this session:**
```
npm view gcode-toolpath version           # 3.0.0
npm view gcode-toolpath time.modified     # 2024-11-17T14:45:10.274Z
npm view gcode-parser version             # 2.2.0
npm view gcode-parser time.modified       # 2024-11-20T12:47:57.666Z
npm view vite-plugin-node-polyfills version         # 0.28.0
npm view vite-plugin-node-polyfills time.modified   # 2026-05-18T02:14:16.174Z
npm view gcode-toolpath scripts.postinstall   # (empty — no postinstall script)
npm view gcode-parser scripts.postinstall     # (empty — no postinstall script)
```
`[VERIFIED: npm registry]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `gcode-toolpath` | npm | published 2024-11-17 (~21 months) | 460/wk | github.com/cncjs/gcode-toolpath | `SUS` (low-downloads only) | Flagged — planner must add `checkpoint:human-verify` before install |
| `gcode-parser` | npm | published 2024-11-20 (~21 months) | 798/wk | github.com/cncjs/gcode-parser | `SUS` (low-downloads only) | Flagged — planner must add `checkpoint:human-verify` before install |
| `gcode-interpreter` (transitive, via `gcode-toolpath`) | npm | published 2024-11-17 | 610/wk | github.com/cncjs/gcode-interpreter | `SUS` (low-downloads only) | Not a direct install; no separate checkpoint needed, but note it's the actual runtime engine `gcode-toolpath` wraps (see Code Examples — `new Toolpath(...)` literally returns an instance of this package's `Interpreter` class) |
| `vite-plugin-node-polyfills` | npm | published 2026-05-18 | 1,541,255/wk | github.com/davidmyersdev/vite-plugin-node-polyfills | `OK` | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `gcode-toolpath`, `gcode-parser` (and transitively `gcode-interpreter`). All three verdicts are driven purely by the legitimacy checker's low-weekly-download heuristic — not by age, missing repo, deprecation, or postinstall-script signals (all clean on those axes). All three are published by the `cncjs` GitHub org, a real, long-running open-source CNC-sender project (MIT licensed), and this session directly downloaded and read their actual shipped source (`npm pack` + extraction, not just `npm view`) to verify the API — this is the strongest verification tier available, beyond what the automated checker alone provides. **Recommendation: proceed with these packages, but the planner should still insert a `checkpoint:human-verify` before the `npm install` step per the SUS protocol**, since the low-download signal alone doesn't rule out abandonment risk for a project with a hard deadline.

`[VERIFIED: npm registry + package-legitimacy checker + direct source read]`

## Architecture Patterns

### System Architecture Diagram

```
Bundled sample .gcode files (public/gcode/*.gcode, D-01/D-08)
        │
        ▼
[Sample dropdown, D-02] ──selects──▶ raw g-code string (fetch from /public)
        │
        ▼
┌─────────────────────────── Parse & classify (new module, e.g. src/gcode/) ───────────────────────────┐
│                                                                                                          │
│  gcode-parser.parseStringSync(text)  ──▶  ordered [{line, words}]  ──▶  feed-rate pre-scan            │
│         │                                        (independent pass, carries forward last F seen)        │
│         │                                                       │                                       │
│         ▼                                                       │                                       │
│  new Toolpath({ addLine, addArcCurve }).loadFromStringSync(text) │                                       │
│         │  fires in file order                                  │                                       │
│         ▼                                                       ▼                                       │
│  addLine(modal, v1, v2)  /  addArcCurve(modal, v1, v2=center, v0=start...) ──zip-by-order──▶ feed rate  │
│         │                                                                                                │
│         ▼                                                                                                │
│  arc tessellation (G2/G3 only, hand-written — library does not tessellate) ──▶ flat polyline points     │
│         │                                                                                                │
│         ▼                                                                                                │
│  classified segments: { type: 'rapid'|'cut', points: Vector3[], feedRate: number|null }[]               │
└───────────────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                    D-06 anchor-offset transform (translate into robot's reach envelope)
                                         │
                       ┌─────────────────┴─────────────────┐
                       ▼                                     ▼
        rapid-move points bucket                    cutting-move points bucket
        <Line segments dashed color="gray" />        <Line segments color="warm" />
        (one batched draw call)                       (one batched draw call)
                       │                                     │
                       └────────────────┬────────────────────┘
                                         ▼
                         mounted inside CellScene.tsx's Canvas
                                         │
                                         ▼
                    D-05 camera auto-fit (Box3 over all segment points,
                    imperative useThree + OrbitControls, new sibling
                    component to CameraResetListener.tsx)
```

### Recommended Project Structure
```
src/
├── gcode/                       # NEW this phase
│   ├── samples.ts                # sample dropdown metadata (id, label, file path)
│   ├── parseToolpath.ts          # gcode-toolpath/gcode-parser wrapper — the SIM-01 classification pipeline
│   ├── parseToolpath.test.ts     # Vitest: classified segment counts/types per bundled sample (mirrors urdf-asset.test.ts's asset-integrity discipline)
│   ├── arcTessellation.ts        # G2/G3 v0/v1/v2 → polyline points (hand-written, library doesn't tessellate)
│   ├── arcTessellation.test.ts
│   └── toolpath-anchor.ts        # D-06 anchor-offset transform (exported constant(s), consumed by Phase 3)
├── scene/
│   ├── Toolpath.tsx               # NEW — mounts the two <Line segments> batches inside CellScene
│   └── ToolpathCameraFit.tsx      # NEW — D-05, sibling to CameraResetListener.tsx
public/
└── gcode/
    ├── print-sample.gcode         # D-07/D-08 — printing-style, hand-authored, mm
    └── mill-sample.gcode          # D-07/D-08 — milling-style with arcs + depth passes, hand-authored, mm
```

### Pattern 1: gcode-toolpath / gcode-parser API contract (verified by reading shipped source)

**What:** `new Toolpath(options)` is a constructor **function that returns an object other than `this`** — the returned value is actually an instance of `gcode-interpreter`'s `Interpreter` class (`gcode-toolpath`'s own constructor ends with `return toolpath` where `toolpath = new Interpreter({handlers: this.handlers})`). This means the returned object's real, documented instance methods (`loadFromString`, `loadFromStringSync`, `loadFromFile`, `loadFromStream`) come from `gcode-interpreter`, not from `gcode-toolpath` itself.

**When to use:** Every call site in this phase — this is the only supported way to drive the parser.

**Example (constructor options and callback shapes, quoted from `gcode-toolpath@3.0.0`'s actual shipped `dist/esm/Toolpath.js`, read via `npm pack` this session):**
```js
// Source: gcode-toolpath@3.0.0 dist/esm/Toolpath.js (read via npm pack, this session)
// Constructor comment, verbatim:
//   @param {object} [options]
//   @param {object} [options.position]
//   @param {object} [options.modal]
//   @param {function} [options.addLine]
//   @param {function} [options.addArcCurve]

// Default modal object, verbatim keys (note: "feedrate" not "feedmode" —
// see the Common Pitfalls entry below for why this field never updates):
this.modal = {
  motion: 'G0',      // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
  wcs: 'G54',        // G54..G59
  plane: 'G17',      // G17: XY-plane, G18: ZX-plane, G19: YZ-plane
  units: 'G21',      // G20: Inches, G21: Millimeters
  distance: 'G90',   // G90: Absolute, G91: Relative
  arc: 'G91.1',      // Arc IJK distance mode
  feedrate: 'G94',   // G93/G94/G95 — this is a MODE flag, not a numeric value
  cutter: 'G40',
  tlo: 'G49',
  program: 'M0',
  spindle: 'M5',
  coolant: 'M9',
  tool: 0,
};

// G1 handler, verbatim shape (addLine call site):
this.offsetAddLine(v1, v2);
// where offsetAddLine calls: this.fn.addLine(this.modal, this.offsetG92(start), this.offsetG92(end))
// i.e. addLine(modal, v1, v2) — v1/v2 are {x, y, z} in mm, already G92-offset-corrected.

// G2/G3 handler, verbatim shape (addArcCurve call site):
this.offsetAddArcCurve(v1, v2, v0);
// where offsetAddArcCurve calls: this.fn.addArcCurve(this.modal, this.offsetG92(start), this.offsetG92(end), this.offsetG92(center))
// i.e. addArcCurve(modal, v1=start, v2=end, v0=CENTER) — v0 IS the arc center, not a "fixed point" of
// unclear meaning (source code comment literally says "// fixed point" next to v0's declaration, but
// the assignment `v0 = { x: translateI(params.I), y: translateJ(params.J), z: translateK(params.K) }`
// computes it directly from I/J/K, which by G-code definition IS the arc center offset from v1).

// CW/CG direction is NOT passed to addArcCurve as a boolean — the library computes an internal
// isClockwise flag (true for G2, false for G3) used only for its own R-form-to-IJ radius math; the
// caller must read direction from `modal.motion` ('G2' vs 'G3') instead.

// Plane remap (verbatim structure, XY/ZX/YZ branches) — v1/v2/v0's x/y/z fields are REASSIGNED
// per plane before being passed to addArcCurve:
//   G17 (XY, default): [v.x, v.y, v.z] unchanged
//   G18 (ZX):          [v.x, v.y, v.z] = [v.z, v.x, v.y]
//   G19 (YZ):          [v.x, v.y, v.z] = [v.y, v.z, v.x]
// Both bundled samples (D-08) should stay on the G17 default plane to avoid needing to un-remap
// this in the arc-tessellation code — document this as a deliberate authoring constraint.
```
`[VERIFIED: npm registry gcode-toolpath@3.0.0 dist/esm/Toolpath.js, read this session via npm pack]`

### Pattern 2: Independent feed-rate pre-scan (fills the SIM-01 gap gcode-toolpath leaves)

**What:** Since `gcode-toolpath`'s handlers never read `params.F`, feed rate must be tracked by running `gcode-parser.parseStringSync()` directly and carrying forward the last-seen F value (feed rate is modal in real G-code — it persists across lines until overridden), then zipping that per-motion-line feed rate onto the `addLine`/`addArcCurve` calls **by call order**, since both passes walk the same file top-to-bottom and only "motion-bearing" lines produce a segment in each.

**When to use:** Wherever segments are classified for SIM-01 — this is not optional; without it, feed rate silently reads `undefined`/`null` for every segment, and SIM-01 explicitly requires it stored per segment even though it isn't rendered until OPT-01/DASH-02.

**Example:**
```ts
// Source: verified by reading gcode-parser@2.2.0 dist/esm/index.js (parseStringSync/parseLine)
// and gcode-toolpath@3.0.0 dist/esm/Toolpath.js (G0/G1/G2/G3 handlers never read params.F),
// this session, via npm pack + Read.
import { parseStringSync } from 'gcode-parser'
import Toolpath from 'gcode-toolpath'

function extractFeedRateQueue(gcodeText: string): (number | null)[] {
  const lines = parseStringSync(gcodeText) // [{ line, words: [letter, value][] }]
  const queue: (number | null)[] = []
  let currentFeedRate: number | null = null

  for (const { words } of lines) {
    const fWord = words.find(([letter]) => letter === 'F')
    if (fWord) currentFeedRate = Number(fWord[1])

    const hasMotionWord = words.some(([letter, value]) =>
      letter === 'G' && [0, 1, 2, 3].includes(Number(value)),
    )
    // A bare coordinate line reuses the *previous* motion mode (gcode-interpreter's own
    // documented behavior — see Interpreter.js's `letter === 'X'|'Y'|'Z'|...` branch) and DOES
    // still fire addLine/addArcCurve, so it must also push a feed-rate entry to stay aligned.
    const hasBareCoordinateWord = words.some(([letter]) =>
      ['X', 'Y', 'Z', 'I', 'J', 'K'].includes(letter),
    )
    if (hasMotionWord || hasBareCoordinateWord) {
      queue.push(currentFeedRate)
    }
  }
  return queue
}

// Usage: build the queue first, then consume it in addLine/addArcCurve call order.
const feedRateQueue = extractFeedRateQueue(gcodeText)
let feedRateIndex = 0

const toolpath = new Toolpath({
  addLine: (modal, v1, v2) => {
    const feedRate = feedRateQueue[feedRateIndex++]
    // ...push classified segment { type: modal.motion === 'G0' ? 'rapid' : 'cut', v1, v2, feedRate }
  },
  addArcCurve: (modal, v1, v2, v0) => {
    const feedRate = feedRateQueue[feedRateIndex++]
    // ...tessellate arc, push classified segment(s) with the same feedRate
  },
})
toolpath.loadFromStringSync(gcodeText)
```
`[VERIFIED: gcode-parser@2.2.0 + gcode-toolpath@3.0.0 source, read this session]`

### Pattern 3: Two-batch dashed/solid color-coded rendering (drei `Line`)

**What:** drei's `<Line>` (`@react-three/drei@10.7.8`, confirmed installed) wraps `Line2`/`LineSegments2` + `LineGeometry`/`LineSegmentsGeometry` + `LineMaterial` from `three-stdlib`. `dashed` and `color` are **material-level** props applied once per `<Line>` instance — they cannot vary per-vertex within one instance. `vertexColors` (an array of per-point colors) exists for *color* variation within one batch, but forces the base `color` to white and has no equivalent per-vertex mechanism for dash state. Since D-03/D-04 only need two fixed treatments (rapid = dashed gray, cutting = solid warm), the correct pattern is two separate `<Line segments>` batches — not one `vertexColors` batch.

**When to use:** Rendering the classified toolpath from Pattern 1/2's output.

**Example:**
```tsx
// Source: @react-three/drei@10.7.8 node_modules/@react-three/drei/core/Line.js + Line.d.ts
// (read directly from the installed package this session).
import { Line } from '@react-three/drei'

const RAPID_COLOR = '#9CA3AF'   // muted gray — distinct from Secondary (#E4E7EB) and Accent (#2563EB)
const CUTTING_COLOR = '#EA580C' // warm orange — distinct from Accent blue, colorblind-safe pairing

function ToolpathLines({ rapidPoints, cuttingPoints }: {
  rapidPoints: [number, number, number][]   // flat pairs: consecutive points = one disjoint segment
  cuttingPoints: [number, number, number][]
}) {
  return (
    <>
      {rapidPoints.length > 0 && (
        <Line
          points={rapidPoints}
          segments                 // LineSegmentsGeometry: consecutive PAIRS are independent
          color={RAPID_COLOR}      // segments, not one continuous polyline — correct for rapid
          dashed                   // moves, which are NOT contiguous with each other
          dashSize={0.02}
          gapSize={0.015}
          lineWidth={2}
        />
      )}
      {cuttingPoints.length > 0 && (
        <Line
          points={cuttingPoints}
          segments
          color={CUTTING_COLOR}
          lineWidth={3}
        />
      )}
    </>
  )
}
```
**Gotcha (verified via source read, not assumed):** `segments={true}` mode treats the flat `points` array as consecutive *pairs*, each an independent line segment (via `LineSegmentsGeometry`) — this is the correct mode here because a "rapid moves" bucket or a "cutting moves" bucket assembled from a real toolpath is generally **not** one continuous polyline (rapid and cutting segments interleave throughout the file). Using the default (non-`segments`) continuous `Line2` mode would draw phantom connecting lines across every gap between same-type segments.

`[VERIFIED: node_modules/@react-three/drei/core/Line.js + Line.d.ts, three-stdlib/lines/LineMaterial.d.ts, read this session]`

### Pattern 4: Camera auto-fit to toolpath bounding box (D-05)

**What:** Compute a `THREE.Box3` directly from the toolpath's own point array (`Box3.setFromPoints`, cheaper than `Box3.setFromObject` since no mesh traversal is needed — the raw coordinates already exist from Pattern 1/2), derive a camera distance from the box's largest dimension and the `PerspectiveCamera`'s vertical FOV, and imperatively move the camera + `OrbitControls.target`.

**When to use:** Whenever a new sample is selected (D-05) — mirrors the existing `CameraResetListener.tsx` pattern (in-Canvas component, `useThree` for camera/controls refs, `useEffect` keyed on a Zustand-store field) rather than introducing drei's separate `<Bounds>` provider/context architecture, which would sit awkwardly alongside the project's established imperative-reset pattern.

**Example:**
```tsx
// Source: standard three.js Box3/PerspectiveCamera fit-to-bounds technique (WebSearch,
// cross-checked across multiple independent three.js tutorials — MEDIUM confidence,
// this is well-established, non-controversial three.js API usage, not phase-specific to
// gcode/drei) combined with this project's own verified CameraResetListener.tsx pattern.
import { useEffect } from 'react'
import { Box3, Vector3 } from 'three'
import { useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCellStore } from '../store/cellStore'

export default function ToolpathCameraFit({ points }: { points: Vector3[] }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null
  const selectedSampleId = useCellStore((state) => state.selectedSampleId) // new store field, this phase

  useEffect(() => {
    if (!controls || points.length === 0) return

    const box = new Box3().setFromPoints(points)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    const fovRadians = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const margin = 1.4 // padding factor, matches drei Bounds' default-ish feel
    const distance = (maxDim / 2 / Math.tan(fovRadians / 2)) * margin

    // Preserve the existing default viewing DIRECTION (camera-defaults.ts), just re-anchor
    // distance/target to the new bounding box rather than picking an arbitrary new angle.
    const direction = camera.position.clone().sub(controls.target).normalize()
    camera.position.copy(center.clone().add(direction.multiplyScalar(distance)))
    controls.target.copy(center)
    controls.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSampleId])

  return null
}
```
`[CITED: standard three.js Box3/PerspectiveCamera fit technique, cross-checked via WebSearch]` for the fit-math; `[VERIFIED: src/scene/CameraResetListener.tsx, read this session]` for the imperative-pattern shape it's modeled on.

### Anti-Patterns to Avoid
- **Trusting `gcode-toolpath`'s `modal.feedrate` field as a numeric feed rate:** it is a *mode* flag (`'G93'`/`'G94'`/`'G95'`) and, due to an internal typo (`modal.feedmode` is set instead), never even updates from its `'G94'` default. Do not read it expecting a number.
- **Using drei `<Line vertexColors>` to try to encode BOTH color and dash state in one batch:** `dashed` is a whole-material flag; there is no per-vertex dash mechanism. Use two `segments` batches instead (Pattern 3).
- **Calling `gcode-parser`'s `parseFile`/`loadFromFile`/`loadFromStream` in this app:** those paths use Node's `fs`/stream APIs, which don't exist in the browser and aren't polyfilled by `vite-plugin-node-polyfills`'s recommended `include` list (`fs` is intentionally left externalized, not polyfilled, in the verified fix). Only `parseStringSync`/`loadFromStringSync` (fed a string fetched from `/public/gcode/*.gcode` via `fetch()`) are safe to call.
- **Verifying the Vite/Node-builtin fix only via `npm run dev`:** this session confirmed the dev server does not surface the same failure `vite build` does (esbuild's dev-time externalization is more permissive than Rollup's production bundling) — always confirm with an actual `npm run build` before considering the dependency integration done.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| G-code modal-state tracking (units, distance mode, plane, G92 offsets) | A custom G-code interpreter/state machine | `gcode-toolpath` (`new Toolpath({addLine, addArcCurve}).loadFromStringSync(text)`) | Already battle-tested against the `cncjs` ecosystem's real-world G-code; the only real gap (feed rate) is small and cheaply patched (Pattern 2) — reimplementing the whole modal-state machine to fix one missing field is a worse trade |
| Thick, per-batch-colorable toolpath lines | Raw `THREE.Line`/`LineBasicMaterial`, or manual `LineSegments2`/`LineGeometry` wiring | drei's `<Line>` (Pattern 3) | Already selected in STACK.md; this phase confirms it has everything needed (dash props, segments mode) without dropping to raw `three-stdlib` APIs |
| Camera-fit-to-bounds math | A generic camera-framing utility library | Hand-rolled `Box3`-based component (Pattern 4), ~20 lines | This is genuinely small enough, and specific enough to this project's existing imperative camera pattern, that a library (even drei's own `<Bounds>`) adds more architectural surface than it saves — see Alternatives Considered |

**Key insight:** The two things worth reaching for a library for in this phase (`gcode-toolpath` for modal-state G-code interpretation, drei `Line` for GPU-batched colored polylines) are both already selected in STACK.md and both hold up under this session's source-level verification — the risk in this phase isn't "wrong library," it's "library has an undocumented gap (feed rate) and an undocumented browser-build incompatibility (Node builtins)" that must be worked around explicitly, not discovered mid-implementation.

## Common Pitfalls

> This section covers findings NEW this session, specific to the exact `gcode-toolpath`/`gcode-parser`/drei `Line` combination. It does not repeat `.planning/research/PITFALLS.md`'s Pitfalls 6–13 (dialect assumptions, arc edge cases, unit ambiguity, batching, geometry leaks, joint-space interpolation) — those still apply and were already researched at the project level; read them before planning this phase.

### Pitfall A: `gcode-toolpath` silently drops feed rate — SIM-01 will fail a literal reading of its own requirement if unaddressed

**What goes wrong:** SIM-01 requires "feed rate per segment." A naive implementation that trusts `addLine(modal, v1, v2)`/`addArcCurve(modal, v1, v2, v0)` to carry everything needed per segment will find no feed-rate field anywhere on `modal` or on `v1`/`v2` — because there isn't one. The library's G0–G3 handlers destructure only `params.X/Y/Z/I/J/K/R` from the parsed line's words; `params.F` is present in the data (verified — `gcode-parser` does preserve it) but is never read by `gcode-toolpath`.

**Why it happens:** `gcode-toolpath` was built for the `cncjs` sender's own toolpath-preview use case, where feed rate isn't needed to draw the path shape — only the geometry is. This is a real gap between what the library was built for and what SIM-01 needs.

**How to avoid:** Implement Pattern 2 (independent feed-rate pre-scan via `gcode-parser.parseStringSync`) as part of the same task that wires up `gcode-toolpath` — not as a follow-up. Store `feedRate: number | null` on every classified segment now, even though nothing renders it until OPT-01/DASH-02 (per CONTEXT.md's "Claude's Discretion" note).

**Warning signs:** A classified-segment type/interface that has no `feedRate` field, or a `parseToolpath.test.ts` that only asserts move-type counts and never asserts a feed-rate value on any segment.

### Pitfall B: `gcode-parser`'s Node-builtin imports break `vite build` (not just a warning — a hard failure), even though `npm run dev` may look fine

**What goes wrong:** `gcode-parser`'s (and therefore `gcode-toolpath`'s, via `gcode-interpreter`) shipped ESM bundle has top-level `import fs from 'fs'; import events from 'events'; import timers from 'timers'; import stream, { Transform } from 'stream';`, and defines `class GCodeLineStream extends Transform` at module scope — a class-extends clause evaluated the instant the module loads, not lazily when a stream-based function is actually called. This session reproduced, from a clean scratch Vite 7 project with only `gcode-toolpath` installed, that `npx vite build` fails with:
```
error during build:
node_modules/gcode-parser/dist/esm/index.js (5:17): "Transform" is not exported by
"__vite-browser-external", imported by "node_modules/gcode-parser/dist/esm/index.js".
```
**Why it happens:** Vite externalizes Node built-ins for browser targets by stubbing them with an empty module, which is silently fine for imports that are only ever *called* (unused function references), but breaks immediately for anything used in a `class ... extends` position, since that's evaluated eagerly at parse/load time, not on first call.

**How to avoid:** Add `vite-plugin-node-polyfills` to `vite.config.ts` with `include: ['stream', 'events', 'timers']` (do **not** need to include `fs` — `parseFile`/`loadFromFile`/`loadFromStream` are never called in this app, only `parseStringSync`/`loadFromStringSync`). This session verified, from the same clean scratch project, that adding this plugin makes `npx vite build` succeed (54 modules transformed, ~37.6kB gzipped output, no errors). Do this as an early Wave-0-style task, before writing any real parsing code, so the risk is retired before the rest of the phase depends on it.

**Warning signs:** `npm run dev` runs cleanly (esbuild's dev-time externalization is more permissive) while `npm run build` fails — always verify with a real production build, since this project's `build` script (`tsc -b && vite build`, confirmed in `package.json`) is what actually gets deployed (per DEPLOY-01/02).

### Pitfall C: Arc plane remap means `v0`/`v1`/`v2` are not literal world X/Y/Z unless the G-code stays on the G17 (XY) plane

**What goes wrong:** `gcode-toolpath` remaps the `x`/`y`/`z` fields of `v1`/`v2`/`v0` differently depending on `modal.plane` (G17/G18/G19) before calling `addArcCurve` — verified directly in the source (see Pattern 1). If a milling sample ever issues G18 or G19, downstream code that treats `v0.x`/`v0.y`/`v0.z` as literal scene coordinates without un-remapping will place the tessellated arc in the wrong plane.

**Why it happens:** This remap exists so the arc-plane math inside `gcode-toolpath` can always assume "XY" internally — it's a real, intentional library behavior, not a bug, but it's easy to miss since it's invisible unless a sample actually switches planes.

**How to avoid:** Per D-08 (hand-authored samples), author both bundled samples to only ever use the default G17 (XY) plane — never emit G18/G19. Document this as a deliberate authoring constraint alongside the existing mm-only unit decision, the same way CONTEXT.md already documents "author them in mm and omit inch-mode testing this phase."

**Warning signs:** A milling sample with a G18/G19 line renders an arc in a visually wrong orientation relative to the rest of the toolpath.

### Pitfall D: `CARRIAGE_TOP_Y` (needed for the D-06 world-space anchor calculation) is a private, unexported constant

**What goes wrong:** D-06's anchor-offset transform needs to place the toolpath in the robot's actual reachable workspace in world space. The canonical refs point to `RailRig.tsx`'s exported `RIG_Z_OFFSET`/`ROBOT_REACH_ENVELOPE`/`RIG_FOOTPRINT_WIDTH`/`RIG_FOOTPRINT_DEPTH`, but the constant that actually determines the robot's mounting HEIGHT above the rail — `CARRIAGE_TOP_Y` (`= RAIL_TOP_Y + CARRIAGE_BASE_HEIGHT + CARRIAGE_BLOCK_HEIGHT`, i.e. `0.04 + 0.05 + 0.1 = 0.19` — verified by reading `RailRig.tsx` this session) — is a module-private `const`, not exported. Without it, the anchor's Y (vertical) component can only be guessed.

**Why it happens:** `CARRIAGE_TOP_Y` was only ever needed internally by `RailRig.tsx` (to nest `<RobotModel />` at the right height) until this phase needs to reason about the robot's TCP position in absolute world space.

**How to avoid:** Export `CARRIAGE_TOP_Y` from `RailRig.tsx` (or an equivalently-named constant) as part of this phase's D-06 task, following the project's established "single source of truth, never restated as a literal" rule (the same rule `RAIL_TRAVEL`/`RAIL_CENTER_X`/`RIG_Z_OFFSET` already follow). See the Code Examples section below for the full derivation chain this constant feeds into.

**Warning signs:** A new "anchor offset" constant that hardcodes a vertical offset number instead of importing `CARRIAGE_TOP_Y`.

## Code Examples

### Deriving the D-06 world-space anchor point

This session computed the UR3e's ready-pose TCP position by porting the exact, verified logic from `src/kinematics/forward-kinematics.ts` and `src/kinematics/ur3e-dh.ts` (values copied verbatim from those files, read this session) into a standalone script, then applying the verified `-90°` X-axis frame rotation from `src/scene/RobotModel.tsx` (`loadedRobot.rotation.x = -Math.PI / 2`, with the comment "The description uses a z-up frame; the scene is y-up. Rotating about x preserves the world x axis").

```
// Step 1 — forwardKinematics(UR3E_READY_POSE) in the DH module's native z-up frame
// (computed this session by porting src/kinematics/forward-kinematics.ts + ur3e-dh.ts verbatim):
tcpPosition (DH frame) ≈ { x: -0.1839, y: -0.13105, z: 0.63628 }   // metres

// Step 2 — apply RobotModel.tsx's verified Rx(-90°) frame rotation (z-up → y-up):
// Rx(-90°): x' = x, y' = z, z' = -y
tcpPosition (scene-local, robot-group frame) ≈ { x: -0.184, y: 0.636, z: 0.131 }

// Step 3 — compose with the scene-graph offsets the robot is actually mounted under
// (verified this session: CellScene.tsx `<group position={[0,0,RIG_Z_OFFSET]}>` wrapping
// RailRig.tsx's `<group position={[RAIL_CENTER_X,0,0]}>` carriage group, itself wrapping
// `<group position={[0,CARRIAGE_TOP_Y,0]}><RobotModel /></group>`):
//   world.x = RAIL_CENTER_X (0)      + local.x  = -0.184
//   world.y = CARRIAGE_TOP_Y (0.19)  + local.y  =  0.826
//   world.z = RIG_Z_OFFSET (0.5)     + local.z  =  0.631
tcpPosition (world space, UR3e ready pose) ≈ { x: -0.184, y: 0.826, z: 0.631 }
```
**This numeric result should be treated as a derived starting point for the D-06 anchor discretion call, not hardcoded blindly** — confirm it by actually calling `forwardKinematics(UR3E_READY_POSE)` from the real module at implementation time (e.g. in a scratch test or console log) rather than trusting this session's manual port, since even a careful port of a matrix-chain computation carries some transcription risk. The **method** (compose FK's z-up TCP position through the Rx(-90°) frame rotation, then through `RAIL_CENTER_X`/`CARRIAGE_TOP_Y`/`RIG_Z_OFFSET`) is the load-bearing, verified part.

`[VERIFIED: src/kinematics/forward-kinematics.ts, src/kinematics/ur3e-dh.ts, src/scene/RobotModel.tsx, src/scene/RailRig.tsx, src/scene/CellScene.tsx — all read this session; quotes above are verbatim from those files]`. Given this, a reasonable D-06 anchor choice: translate the toolpath's own local bounding-box center (after parsing, before any Three.js placement) to sit roughly `ROBOT_REACH_ENVELOPE` (0.5m, exported from `RailRig.tsx`) in front of this TCP point along world Z, resting near the floor plane (world Y ≈ 0) rather than at TCP height — i.e., the robot "reaches down" to the workpiece, matching how the milling/printing samples' own Z=0 baseline should read as "resting on the floor/worktable," not floating at TCP height.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact hex values `#9CA3AF` (rapid gray) / `#EA580C` (cutting warm orange) | Code Examples, Pattern 3 | Low — explicitly Claude's discretion per CONTEXT.md; any gray/warm pairing distinct from `#E4E7EB`/`#2563EB` satisfies D-03. Easy to change, no data-model impact. |
| A2 | Dash tuning values `dashSize={0.02}`/`gapSize={0.015}` | Code Examples, Pattern 3 | Low — explicitly Claude's discretion per CONTEXT.md (D-04); these need visual tuning against the actual sample scale once rendered, not a hard requirement. |
| A3 | Camera-fit margin factor `1.4` and fit formula in Pattern 4 | Code Examples, Pattern 4 | Low-Medium — standard three.js technique, cross-checked via WebSearch (`[CITED]`, not independently executed this session against this project's actual scene). Verify visually once implemented; the box/distance math itself is standard and low-risk. |
| A4 | World-space TCP anchor point `≈ {-0.184, 0.826, 0.631}` for `UR3E_READY_POSE` | Code Examples, "Deriving the D-06 world-space anchor point" | Medium — derived by porting verified source through a manual (scripted, not executed-in-repo) matrix chain. If wrong, the toolpath could render outside the robot's visible reach envelope, undermining D-06's intent, though nothing else in the phase depends on the exact number (the *method* is what matters and is fully verified). |

## Open Questions

1. **Does the `vite-plugin-node-polyfills` fix hold up for `npm run dev` + a real in-browser console check, not just `vite build`?**
   - What we know: This session verified `npx vite build` succeeds with the plugin added (empirically, from a clean scratch project). `npm run dev`'s failure mode was not separately reproduced (only inferred from Vite's own documented dev-vs-build externalization difference).
   - What's unclear: Whether the dev server needs the same polyfill include list, or behaves fine either way.
   - Recommendation: Treat the polyfill addition as needed regardless (it's cheap, `OK` legitimacy verdict, and fixes the build either way); the planner's first task for this phase should include an explicit `npm run dev` AND `npm run build && npm run preview` smoke test importing `gcode-toolpath`, before any real parsing logic is written.

2. **Exact numeric value for the D-06 anchor-offset transform.**
   - What we know: The method (Code Examples section) and a derived approximate TCP world position.
   - What's unclear: The precise final placement (e.g., how much of `ROBOT_REACH_ENVELOPE` margin to use, whether the toolpath should be centered on TCP-X or offset) is explicitly left to Claude's discretion in CONTEXT.md.
   - Recommendation: The planner should treat this as a single, clearly-named exported constant (e.g. `TOOLPATH_ANCHOR_OFFSET` in a new `src/gcode/toolpath-anchor.ts`), computed from `RAIL_CENTER_X`/`CARRIAGE_TOP_Y`(needs export, Pitfall D)/`RIG_Z_OFFSET`/`ROBOT_REACH_ENVELOPE` rather than hardcoded literals, so Phase 3 can consume it as documented in the canonical refs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/dev tooling | ✓ | v22 (system `node`, confirmed this session) | — |
| npm | Package installs | ✓ | 11.17.0 (confirmed this session) | — |
| `gcode-toolpath`/`gcode-parser`/`gcode-interpreter` | SIM-01 parsing pipeline | ✓ (registry-confirmed, not yet installed in this project's `package.json`) | 3.0.0 / 2.2.0 / 3.0.0 | Hand-rolled tokenizer/state-machine (see Alternatives Considered) if these ever become unavailable |
| `vite-plugin-node-polyfills` | Making the above installable in a Vite browser build without a hard `vite build` failure | ✓ (registry-confirmed) | 0.28.0 | Hand-rolled parser (removes the Node-builtin dependency entirely) |

**Missing dependencies with no fallback:** none — all required tooling is available.
**Missing dependencies with fallback:** none currently missing; fallback path (hand-rolled parser) documented above in case the `gcode-toolpath`/`gcode-parser`/`vite-plugin-node-polyfills` combination proves unworkable during implementation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed installed, `package.json` `"test": "vitest run"`) |
| Config file | `vite.config.ts` (`test: { environment: 'node' }` — confirmed this session; sufficient for this phase's pure-logic parser/tessellation/anchor-math tests, no DOM needed) |
| Quick run command | `npx vitest run src/gcode` (once the directory exists) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-01 | Bundled print/mill samples parse into classified segments with correct move type + feed rate per segment | unit | `npx vitest run src/gcode/parseToolpath.test.ts` | ❌ Wave 0 |
| SIM-01 | Arc (G2/G3) tessellation produces the expected point count/shape for a known center/radius | unit | `npx vitest run src/gcode/arcTessellation.test.ts` | ❌ Wave 0 |
| SIM-02 | Segment → render-bucket assignment (rapid vs. cutting → correct color/dash bucket) is a pure, testable function separate from the actual R3F render | unit | `npx vitest run src/gcode/parseToolpath.test.ts` (same file, additional assertions on bucket assignment) | ❌ Wave 0 |
| SIM-02 | Toolpath visually renders as two visually distinct line styles in the 3D scene | manual/UAT | — (visual verification, not automatable in this project's current `node`-environment Vitest setup) | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run src/gcode` (fast — pure-logic tests, no DOM/WebGL)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; SIM-02's visual distinctness is confirmed via manual UAT (matches how Phase 1's SCENE-04/SCENE-03 were signed off, per STATE.md's "live-URL visual sign-off" precedent).

### Wave 0 Gaps
- [ ] `src/gcode/parseToolpath.test.ts` — covers SIM-01 (segment classification, feed rate) and part of SIM-02 (bucket assignment)
- [ ] `src/gcode/arcTessellation.test.ts` — covers SIM-01's arc-handling correctness
- [ ] `public/gcode/print-sample.gcode` + `public/gcode/mill-sample.gcode` — the two D-07/D-08 bundled sample files themselves are also a Wave 0 prerequisite (nothing can be tested without them existing)
- [ ] Early smoke-test task (not a Vitest file — a manual `npm run dev` + `npm run build && npm run preview` check) importing `gcode-toolpath` with `vite-plugin-node-polyfills` configured, per Pitfall B — this should run **before** the above test files are written, since it retires the highest-uncertainty risk first

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this app (single-user client-side simulation, per PROJECT.md/REQUIREMENTS.md Out of Scope) |
| V3 Session Management | no | No sessions/accounts |
| V4 Access Control | no | No access-control surface |
| V5 Input Validation | yes (reduced severity) | Bundled sample files (D-01) are developer-authored, not user-uploaded — the primary "input" this phase parses is not attacker-controlled. Still worth defensive parsing (graceful handling of a malformed/unexpected line rather than an uncaught exception) so a future file-upload feature (explicitly deferred, not this phase) doesn't inherit a parser that assumes well-formed input. Reuse the existing `SceneStatusOverlay`/`scene-status-copy.ts` error-state pattern (canonical refs) for a parse failure, rather than a silent crash. |
| V6 Cryptography | no | Nothing cryptographic in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/degenerate G-code (e.g. thousands of near-duplicate points, `NaN` coordinates from a parser edge case) causing a WebGL crash or an unresponsive tab | Denial of Service (self-inflicted, not attacker-driven, since files are bundled not uploaded) | Basic sanity checks after parsing: reject/clamp `NaN`/`Infinity` coordinates before constructing `Box3`/`Vector3` arrays (a `NaN` bounding box would break Pattern 4's camera-fit math silently); cap segment count as a defensive ceiling even though D-08's hand-authored samples are small by construction |
| A future file-upload feature (explicitly out of scope this phase, D-01) reusing this phase's parser without adding validation | Tampering (if ever built) | Not this phase's concern to fix, but Pitfall A/the parser module's test suite should be written so a later upload feature can add a validation layer in front of the same `parseToolpath.ts` entry point without needing to touch its internals |

## Sources

### Primary (HIGH confidence — read directly this session)
- `gcode-toolpath@3.0.0` — `dist/esm/Toolpath.js`, `dist/esm/index.js`, `package.json` (downloaded via `npm pack`, extracted, read with `Read`)
- `gcode-parser@2.2.0` — `dist/esm/index.js`, `package.json` (downloaded via `npm pack`, extracted, read with `Read`)
- `gcode-interpreter@3.0.0` — `dist/esm/Interpreter.js` (downloaded via `npm pack`, extracted, read with `Read`)
- `@react-three/drei@10.7.8` — `node_modules/@react-three/drei/core/Line.js`, `Line.d.ts` (already installed, read directly)
- `three-stdlib` (via `@react-three/drei`'s dependency) — `node_modules/three-stdlib/lines/LineMaterial.d.ts` and `.js` (read directly for dash-property confirmation)
- `src/kinematics/forward-kinematics.ts`, `src/kinematics/ur3e-dh.ts`, `src/kinematics/rail.ts`, `src/scene/RobotModel.tsx`, `src/scene/RailRig.tsx`, `src/scene/CellScene.tsx`, `src/scene/CameraResetListener.tsx`, `src/scene/NavCube.tsx`, `src/store/cellStore.ts`, `src/ui/SceneStatusOverlay.tsx`, `src/ui/scene-status-copy.ts`, `src/scene/urdf-asset.test.ts`, `src/scene/camera-defaults.ts` (this project's own code, read this session)
- `npm view` direct registry lookups for `gcode-toolpath`, `gcode-parser`, `gcode-interpreter`, `vite-plugin-node-polyfills` (version, publish date, postinstall script)
- Empirical `npx vite build` reproduction of the Node-builtin failure, and a second empirical `npx vite build` confirming `vite-plugin-node-polyfills` fixes it (scratch Vite 7 project, this session)
- `gsd-tools query package-legitimacy check` output for `gcode-toolpath`, `gcode-parser`, `gcode-interpreter`, `vite-plugin-node-polyfills`

### Secondary (MEDIUM confidence)
- WebSearch, cross-checked across multiple standard three.js tutorials: `Box3`-based camera-fit-to-bounds technique (Pattern 4's math)
- WebSearch: `@react-three/drei` `Bounds` component overview (informed the "why not `<Bounds>`" Alternatives Considered entry)
- WebSearch: `gcode-toolpath`/`gcode-parser` maintenance/ecosystem status (cncjs org context)

### Tertiary (LOW confidence)
- None used directly in final recommendations — all load-bearing API/build claims were escalated to primary-source verification this session rather than left at WebSearch-only confidence.

## Metadata

**Confidence breakdown:**
- Standard stack (gcode-toolpath/gcode-parser/vite-plugin-node-polyfills API & build compatibility): HIGH — verified via direct source read + empirical build reproduction, not docs or training memory
- Architecture (rendering pattern, camera-fit): HIGH for the drei `Line` API contract (source-read), MEDIUM for the camera-fit math specifics (standard technique, cross-checked but not executed against this project's actual scene this session)
- Pitfalls: HIGH — all four phase-specific pitfalls were discovered via direct source inspection or empirical reproduction this session, not inferred

**Research date:** 2026-08-13
**Valid until:** 30 days (stable npm packages, no fast-moving framework churn expected in this window) — re-verify `vite-plugin-node-polyfills` and `gcode-toolpath`/`gcode-parser` versions if planning is delayed past that window, since low-download niche packages can occasionally see breaking patch releases without much community signal.

---
*Phase: 2-g-code-import-static-toolpath*
*Research completed: 2026-08-13*
