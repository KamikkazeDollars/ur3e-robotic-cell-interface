# Phase 4: Playback Engine - Research

**Researched:** 2026-08-15
**Domain:** Client-side animation clock driving an already-precomputed robot trajectory (React Three Fiber imperative render loop + Zustand coarse/fine-cadence state split)
**Confidence:** MEDIUM-HIGH (codebase-verified for all existing-code claims; MEDIUM for the two external-pattern citations; explicit ASSUMED tags on tunable constants and design choices CONTEXT.md left open)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Total playback duration is a fixed, normalized value (~10 seconds) for every sample, not derived from the g-code's real feed rates (F-values) and not scaled by toolpath complexity/segment count. All bundled samples take the same ~10s to play. — Reversible: a later per-sample or feed-rate-derived duration mode changes only the time→fraction mapping function.
- **D-02:** Within that fixed duration, rapid (G0) moves consume proportionally less playback time than cutting (G1/G2/G3) moves. The time-to-arc-length-fraction mapping must be move-type-weighted, not a uniform `elapsed / totalDuration` lookup. — Reversible: isolated to the weighting function.
- **D-03:** The Phase 3 scrub slider (`src/ui/ScrubControl.tsx`) is reused as the single dual-purpose control: it both displays playback progress (advancing automatically while playing) and remains the manual seek control. No separate playback-only progress bar is built.
- **D-04:** Dragging the slider while playback is running immediately pauses playback and seeks to the dragged position. The user must press Play again to resume.
- **D-05:** Pressing Play resumes from the trajectory's current `scrubFraction`, not from 0.
- **D-06:** When playback reaches the end (`scrubFraction` reaches 1), it stops and holds the final pose. The Play control resets to its "Play" (not "Pause") state.
- **D-07 (Claude's discretion — reconciles D-05 and D-06):** If Play is pressed while `scrubFraction` is already at (or extremely close to) 1, treat it as a restart from 0 rather than a literal zero-duration "resume."

### Claude's Discretion

- No playback-speed multiplier (1x/2x/4x) control is planned for this phase. `ARCHITECTURE.md`'s Playback Controller sketch mentions a `speedMultiplier` field — treat as optional headroom in the type, not a requirement to build UI for it.
- Exact Play/Pause button placement, icon, and styling — match existing minimal chrome (Reset View button, sample dropdown, scrub slider).
- Exact easing/interpolation between precomputed trajectory samples during playback — CONTEXT.md states linear interpolation is "the expected default, consistent with how `ScrubMarker.tsx` already interpolates." **This premise is factually incorrect** (see Verified Correction below) — the researcher's recommendation accounts for this.
- Whether the animation clock is a small hook (`usePlaybackClock`) per `ARCHITECTURE.md`, or inlined — follow `ARCHITECTURE.md`'s suggested structure unless a concrete reason not to emerges.

### Deferred Ideas (OUT OF SCOPE)

- Playback-speed multiplier UI (1x/2x/4x).
- Real feed-rate-derived playback duration (explicitly rejected, D-01).
- Telemetry/Dashboard display of playback state (Phase 5's scope — this phase only needs `playback.currentTime`/`scrubFraction` and the trajectory available as a clean read surface).
- Per-operation timing, distinct start/end markers, mill engagement coloring (Phase 6's scope).
- Auto-loop playback (explicitly rejected in favor of "stop and hold final pose," D-06).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIM-04 | User can press play to animate the UR3e robot following the toolpath in real time, synced to the visible trajectory | See Architecture Patterns (dual-cadence clock design), Code Examples (`usePlaybackClock`, store extensions), and Common Pitfalls (per-frame reactive writes) below — this is the entire content of this research document. |

</phase_requirements>

## Summary

Phase 3 already built everything this phase needs to read: `cellStore.trajectory` (a dense, precomputed, monotonically-`scrubFraction`-ordered sample array), `cellStore.scrubFraction`/`setScrubFraction` (the single position channel both the robot pose driver and the scrub marker already consume via `getState()` inside their own `useFrame` loops), and `ScrubControl.tsx` (the slider Phase 4 must reuse per D-03). Phase 4's actual job is narrow: add an animation clock that advances `scrubFraction` over real time (weighted so rapids play faster than cuts, D-02) instead of only ever being set by a drag event.

The one genuinely hard design problem this phase must solve — and the one CONTEXT.md's "Integration Points" note glosses over as "just a new driver of the value that path already consumes" — is that **the existing `scrubFraction` field is a *reactive* Zustand field, and `ScrubControl.tsx` reads it reactively** (`useCellStore((s) => s.scrubFraction)`) to drive the slider's `value` and percentage readout. Writing to it 60 times/second during playback would re-render `ScrubControl.tsx` 60 times/second — a direct violation of the "no per-frame value through Zustand/React state" rule this codebase enforces everywhere else (`cellStore.ts`'s own file-header comment, CLAUDE.md's "What NOT to Use" table, `PITFALLS.md` Pitfall 10). The recommended resolution (detailed below) is a **dual-cadence write split**: a non-reactive, directly-mutated ref-like field in the store carries the true 60fps position that `RobotPose.tsx`/`ScrubMarker.tsx` read (a drop-in extension of the `getState()`-inside-`useFrame` pattern they already use), while the reactive `scrubFraction` field is synced from it at a throttled (~10-20Hz) cadence purely to keep the slider's visible position and the D-05 "resume from here" anchor honest.

The second real gap is data, not architecture: `CompiledTrajectory`'s `TrajectorySample` carries no move-type (rapid/cut) tag and no travel-vs-toolpath phase flag, both of which D-02's weighted mapping needs. Two viable closures are presented (a compile.ts extension vs. an external point-matching technique); the researcher recommends the compile.ts extension as the more robust engineering choice, flagged clearly as touching a Phase-3-owned file so the planner/user can make the call explicitly rather than by omission.

No new npm packages are required — `@react-three/fiber`'s `useFrame`, Zustand, and lucide-react (already a dependency, unused so far) cover everything.

**Primary recommendation:** Add a non-reactive `livePlayback: { fraction: number }` ref object to `cellStore` (mutated directly by a new `usePlaybackClock` hook's `useFrame`, never via `set()`), extend `RobotPose.tsx`/`ScrubMarker.tsx` to read it instead of `scrubFraction`, and throttle the clock's writes to the reactive `scrubFraction`/`setScrubFraction` to ~10-20Hz for the slider display and D-05 resume anchor.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weighted time→fraction mapping (D-01/D-02 math) | Pure TS module (`playback/duration-mapping.ts`, framework-free) | — | Same discipline as `kinematics/`, `gcode/`, `trajectory/arc-length.ts` — must be independently unit-testable, no React/Three import [VERIFIED: src/trajectory/arc-length.ts:1-9 header comment: "Framework-free (no rendering engine, no store, no UI import)"]. |
| Animation clock tick (rAF-driven elapsed-time advance) | R3F imperative (`playback/usePlaybackClock.ts`, `useFrame`) | Zustand reactive (`isPlaying` read via `getState()`) | Must run every render frame without triggering React re-renders — the established `useFrame` + `getState()` idiom [VERIFIED: src/scene/RobotPose.tsx:34-48, src/scene/ScrubMarker.tsx:58-84]. |
| Robot pose / TCP marker per-frame update | R3F imperative (`scene/RobotPose.tsx`, `scene/ScrubMarker.tsx`, extended) | Zustand imperative ref (`livePlayback.fraction`) | Already the exact pattern these two files use for scrub-drag; playback is "a new driver of the same read path," per CONTEXT.md's own framing — but only if the read path stays non-reactive at 60fps (see Summary). |
| Play/Pause control | React DOM UI chrome (`ui/PlaybackControl.tsx`) | Zustand reactive (`isPlaying`) | Discrete, human-interaction-frequency state — safe as a normal reactive store field, matching `resetToken`/`robotLoadStatus` precedent [VERIFIED: src/store/cellStore.ts:33-50]. |
| Slider progress display + D-05 resume anchor | Zustand reactive (`scrubFraction`, throttled writes) | React DOM UI (`ui/ScrubControl.tsx`, unchanged) | Must stay reactive (existing consumer already subscribes this way) but must NOT be written at animation frequency — throttled sync is the load-bearing design decision of this phase. |
| Move-type (rapid/cut) weighting data source | Pure TS module reading `ParsedToolpath.segments` | Optional: `trajectory/compile.ts` extension | `ParsedToolpath.segments[].type` already carries this [VERIFIED: src/gcode/parseToolpath.ts:20-35]; `CompiledTrajectory` currently does not (see Open Questions). |

## Standard Stack

No new libraries. Every capability this phase needs is already installed and already used elsewhere in this codebase:

| Library | Version (installed) | Purpose in this phase | Why no alternative needed |
|---------|---------|---------|--------------|
| `@react-three/fiber` | ^9.7.0 [VERIFIED: package.json:15] | `useFrame` drives the animation clock every render frame | Already the sole per-frame driver mechanism in this codebase (`RobotPose.tsx`, `ScrubMarker.tsx`) [VERIFIED: package.json] |
| `zustand` | ^5.0.15 [VERIFIED: package.json:29] | `isPlaying` (reactive) + `livePlayback` (non-reactive ref) live in the existing `cellStore` | One store, already established; no second store needed |
| `lucide-react` | ^1.31.0 [VERIFIED: package.json:21] | `Play`/`Pause` icons for the new control, matching the icon-capable `Button` component already installed | Already a dependency, unused by any component read so far in this codebase — free to use for the Play/Pause icon |
| `class-variance-authority` / shadcn `Button` | installed [VERIFIED: src/components/ui/button.tsx] | The Play/Pause control's base component, reusing `variant="secondary"`/`"outline"` (see UI-SPEC note below) | `ResetViewButton.tsx` already establishes "controlled component dispatches a store action" via this same `Button` [VERIFIED: src/ui/ResetViewButton.tsx] |

**Installation:** none required.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `useFrame`-driven manual elapsed-time accumulation | `THREE.Clock` / R3F's built-in `state.clock.elapsedTime` directly as the playback position | R3F's `state.clock` runs continuously from Canvas mount and has no native pause/resume/seek semantics — would need the same manual bookkeeping anyway to support D-04/D-05/D-06/D-07; simpler to own a dedicated elapsed-seconds ref from the start. |
| Reactive `scrubFraction` for both slider display and pose-driving | A single unthrottled 60fps reactive write | Rejected — this is the exact anti-pattern CLAUDE.md forbids (see Common Pitfalls #1); only acceptable if the planner explicitly accepts the tradeoff (documented as Option B in Open Questions). |
| Hand-rolled `requestAnimationFrame` loop outside R3F | Plain `requestAnimationFrame` in a `useEffect` | R3F's `useFrame` already provides frame-rate-independent `delta` and integrates with R3F's render-priority system; no reason to bypass it inside a `<Canvas>` tree the app already has mounted. |

## Package Legitimacy Audit

No new external packages are introduced by this phase — this section is not applicable. All dependencies used (`@react-three/fiber`, `zustand`, `lucide-react`, shadcn `Button`) were already audited and installed in Phases 1-3.

## Verified Correction to CONTEXT.md

CONTEXT.md's "Claude's Discretion" section states: *"linear interpolation between adjacent samples is the expected default, consistent with how `ScrubMarker.tsx` already interpolates for manual scrubbing."*

This premise is incorrect. Both existing per-frame consumers **round to the nearest sample index**, they do not interpolate:

```typescript
// src/scene/RobotPose.tsx:39-42 [VERIFIED]
const rawIndex = Math.round(scrubFraction * (samples.length - 1))
const index = Math.min(samples.length - 1, Math.max(0, rawIndex))
const sample = samples[index]
```

```typescript
// src/scene/ScrubMarker.tsx:70-74 [VERIFIED]
const rawIndex = Math.round(scrubFraction * (samples.length - 1))
const index = Math.min(samples.length - 1, Math.max(0, rawIndex))
const sample = samples[index]
```

This has been visually fine for manual scrubbing because samples are dense (one IK solve every 2mm, up to `MAX_TRAJECTORY_SAMPLES = 4000` [VERIFIED: src/trajectory/compile.ts:50-57]) — a drag event landing on the "wrong" neighboring sample is imperceptible at that density. The **stated intent** in CONTEXT.md (interpolation, for smoothness) is still the right goal for playback specifically, because playback advances by *time*, not by drag distance, and a short/simple toolpath can have very few samples (as low as 2). See Architecture Patterns below for the recommended approach: introduce a real bracketing-pair interpolation lookup for the playback clock's consumption, and optionally unify `RobotPose.tsx`/`ScrubMarker.tsx` onto it so both code paths share one lookup function instead of two independent copies of the same nearest-index arithmetic (this literally already happens once — see `ScrubMarker.tsx`'s own doc comment on why it duplicates `RobotPose.tsx`'s index derivation verbatim "so the marker and the robot pose can never silently drift apart" [VERIFIED: src/scene/ScrubMarker.tsx:19-25] — a shared function achieves that guarantee more strongly than duplicated logic).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  DOM: PlaybackControl (Play/Pause button)                        │
│  onClick -> store.play() / store.pause()   [discrete, reactive]  │
└───────────────────────────┬───────────────────────────────────────┘
                             │ writes isPlaying (reactive)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  cellStore (Zustand)                                              │
│   isPlaying: boolean            <- reactive, UI-cadence           │
│   scrubFraction: number         <- reactive, THROTTLED writes     │
│                                     during playback (~10-20Hz)     │
│   livePlayback: { fraction }    <- NON-reactive ref, mutated      │
│                                     directly, 60fps, never set()  │
│   trajectory: CompiledTrajectory (Phase 3, read-only this phase)  │
└──────┬───────────────────────────────────────┬────────────────────┘
       │ getState() every useFrame tick          │ reactive selector
       ▼                                          ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│ usePlaybackClock (R3F,     │         │ ScrubControl (DOM slider) │
│ useFrame(state, delta)):   │         │ value = scrubFraction     │
│  1. if !isPlaying, return  │         │ onChange -> pause() +     │
│  2. clamp delta            │         │   setScrubFraction(v)     │
│  3. elapsed += delta       │         │   (D-04 pause-on-drag)    │
│  4. fraction = weighted    │         └───────────────────────────┘
│     mapping(elapsed)       │
│  5. livePlayback.fraction  │
│     = fraction  (SILENT)   │
│  6. throttled: also call   │
│     setScrubFraction(f)    │
│  7. if fraction >= 1:      │
│     force write 1, pause() │
└──────────────┬──────────────┘
               │ getState().livePlayback.fraction, every frame
               ▼
┌───────────────────────────────────────────────────────────────────┐
│  R3F Scene (imperative, useFrame + getState(), unchanged pattern)  │
│   RobotPose.tsx     -> setJointValue per joint (interpolated)      │
│   ScrubMarker.tsx   -> mesh.position.set(...) (interpolated)       │
└───────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── playback/
│   ├── duration-mapping.ts       # NEW — pure: elapsed seconds <-> weighted scrubFraction
│   ├── duration-mapping.test.ts  # NEW — unit tests, no React/Three
│   └── usePlaybackClock.ts       # NEW — R3F hook, useFrame-driven clock
├── trajectory/
│   ├── sample-lookup.ts          # NEW (recommended) — shared interpolated sample lookup,
│   │                               replacing the duplicated nearest-index snippets in
│   │                               RobotPose.tsx and ScrubMarker.tsx
│   └── compile.ts                # UNCHANGED, or minimally extended — see Open Questions
├── scene/
│   ├── RobotPose.tsx             # EXTENDED — read livePlayback.fraction, use sample-lookup
│   └── ScrubMarker.tsx           # EXTENDED — same
├── ui/
│   ├── PlaybackControl.tsx       # NEW — Play/Pause button
│   └── ScrubControl.tsx          # EXTENDED — onChange pauses playback (D-04)
└── store/
    └── cellStore.ts              # EXTENDED — isPlaying, play()/pause(), livePlayback ref
```

### Pattern 1: Dual-cadence store writes (the load-bearing pattern for this phase)

**What:** Split "the value that changes every animation frame" from "the value React components reactively subscribe to." The former is a plain mutable object created once in the store's initial state and mutated in place via direct property assignment (never `set()`), so Zustand never notifies subscribers on that write. The latter is the existing `scrubFraction` field, synced from the former at a throttled cadence.

**When to use:** Whenever a per-frame value must also be visible to a *reactive* React consumer (here: the slider). If no reactive consumer existed, the plain `getState()`-inside-`useFrame` pattern already used by `RobotPose.tsx`/`ScrubMarker.tsx` would be sufficient on its own — the split is required specifically because `ScrubControl.tsx` already subscribes reactively to `scrubFraction`.

**Example:**
```typescript
// store/cellStore.ts — additive changes only
interface CellState {
  // ...existing fields unchanged...

  /** Discrete, human-interaction-frequency toggle — safe as a normal
   * reactive field, same rationale as `robotLoadStatus`. */
  isPlaying: boolean
  play: () => void
  pause: () => void

  /** A referentially-STABLE object, created once here and never replaced.
   * `usePlaybackClock` mutates `.fraction` directly every animation frame
   * WITHOUT calling `set()` — this is the non-reactive escape hatch that
   * lets RobotPose.tsx/ScrubMarker.tsx read a true 60fps position via
   * `getState()` without ever triggering a React re-render, matching this
   * store's own "no per-frame value is ever WRITTEN [reactively] here"
   * rule (see file header). */
  livePlayback: { fraction: number }
}

export const useCellStore = create<CellState>((set, get) => ({
  // ...existing fields...
  isPlaying: false,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  livePlayback: { fraction: 0 },
  setScrubFraction: (fraction) => {
    const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
    // Keep the non-reactive channel in lockstep on every REACTIVE write
    // (manual drag OR the clock's own throttled sync) so RobotPose/
    // ScrubMarker never read a stale value between throttled syncs.
    get().livePlayback.fraction = clamped
    set({ scrubFraction: clamped })
  },
  // ...
}))
```

```typescript
// playback/usePlaybackClock.ts
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCellStore } from '../store/cellStore'
import { buildDurationMapping, PLAYBACK_TOTAL_DURATION_SECONDS } from './duration-mapping'

const RESUME_EPSILON = 1e-3
const STORE_SYNC_INTERVAL_S = 0.08 // ~12.5Hz — cheap for one leaf DOM component,
                                    // frequent enough that the slider reads as live

/** Caps a single frame's delta so a backgrounded/refocused tab (where the
 * browser throttles rAF, sometimes to seconds between frames) cannot jump
 * playback position forward in one visible step. */
const MAX_FRAME_DELTA_S = 0.1

export default function usePlaybackClock() {
  const elapsedRef = useRef(0)
  const syncAccumulatorRef = useRef(0)
  const mappingRef = useRef<ReturnType<typeof buildDurationMapping> | null>(null)

  useFrame((_state, rawDelta) => {
    const { isPlaying, toolpath, trajectory, scrubFraction, setScrubFraction, pause } =
      useCellStore.getState()

    if (!isPlaying || !toolpath || !trajectory || trajectory.samples.length === 0) return

    // Rebuild only when the loaded sample changes (cheap: mapping is built
    // once per selection, not per frame) — see Open Questions for what
    // `buildDurationMapping` needs from `trajectory`.
    if (!mappingRef.current || mappingRef.current.toolpath !== toolpath) {
      mappingRef.current = buildDurationMapping(toolpath, trajectory)

      // D-05: resume from the CURRENT scrubFraction, not from 0 — unless
      // D-07's restart-from-end case applies.
      const resuming = scrubFraction < 1 - RESUME_EPSILON
      elapsedRef.current = resuming
        ? mappingRef.current.fractionToElapsed(scrubFraction)
        : 0 // D-07
    }

    const delta = Math.min(rawDelta, MAX_FRAME_DELTA_S)
    elapsedRef.current += delta

    const finished = elapsedRef.current >= PLAYBACK_TOTAL_DURATION_SECONDS
    const fraction = finished ? 1 : mappingRef.current.elapsedToFraction(elapsedRef.current)

    // 60fps, non-reactive — RobotPose/ScrubMarker read this every frame.
    useCellStore.getState().livePlayback.fraction = fraction

    // Throttled reactive sync — keeps the slider + D-05 resume anchor honest
    // without re-rendering ScrubControl at animation frequency.
    syncAccumulatorRef.current += delta
    if (finished || syncAccumulatorRef.current >= STORE_SYNC_INTERVAL_S) {
      syncAccumulatorRef.current = 0
      setScrubFraction(fraction) // exact 1 on the finishing frame (D-06)
    }

    if (finished) {
      pause() // D-06: Play control resets to "Play", not "Pause"
      mappingRef.current = null // force resume-position recompute on next Play
    }
  })
}
```

```typescript
// scene/RobotPose.tsx — the one line that changes
- const { trajectory, scrubFraction } = useCellStore.getState()
+ const { trajectory, livePlayback } = useCellStore.getState()
- const rawIndex = Math.round(scrubFraction * (samples.length - 1))
+ const rawIndex = Math.round(livePlayback.fraction * (samples.length - 1))
```
(`ScrubMarker.tsx` gets the identical one-line change — or both are refactored onto the shared `trajectory/sample-lookup.ts` helper recommended above, which also resolves the interpolation gap noted in "Verified Correction to CONTEXT.md.")

**Trade-offs:** Slightly more moving parts than a single field, but this is the only design that satisfies both D-03 (slider visibly tracks playback) and SIM-04's second success criterion ("driven by an imperative render loop rather than per-frame React state updates") simultaneously. [CITED: Zustand community "Best Practices for Storing Non-Reactive State" discussion, pmndrs/zustand GitHub — a documented pattern of embedding a stable mutable object in Zustand state and mutating it outside `set()` for exactly this class of problem; MEDIUM confidence, cross-checked against the official R3F docs' `useFrame`/`delta` guidance at r3f.docs.pmnd.rs.]

### Pattern 2: `pause()` belongs to the drag handler, never to `setScrubFraction`

**What:** D-04 requires that dragging the slider while playing immediately pauses. The pause action must be wired into `ScrubControl.tsx`'s `onChange` handler specifically — **not** into `setScrubFraction` itself, because `setScrubFraction` is also the function the playback clock's own throttled sync calls every ~80ms (see Pattern 1's code). If `setScrubFraction` unconditionally set `isPlaying: false`, the clock would pause itself on its very next sync tick.

**Example:**
```typescript
// ui/ScrubControl.tsx — onChange handler, updated
const setScrubFraction = useCellStore((state) => state.setScrubFraction)
const pause = useCellStore((state) => state.pause)
const isPlaying = useCellStore((state) => state.isPlaying)

// ...
onChange={(event) => {
  if (isPlaying) pause() // D-04
  setScrubFraction(Number(event.target.value))
}}
```

**Anti-pattern this avoids:** Conflating "the clock wrote a new position" with "the user dragged the slider" — they call the same setter but must not share the same side effect.

### Anti-Patterns to Avoid

- **Writing `scrubFraction` reactively at 60fps "because it's simpler":** re-renders every reactive subscriber (currently just `ScrubControl.tsx`, but this list only grows — Phase 5's Dashboard will read playback-derived values too) at animation frequency. Directly the anti-pattern CLAUDE.md's "What NOT to Use" table names explicitly.
- **Solving the D-05 "resume from here" requirement by storing `elapsedSeconds` in Zustand:** `elapsedSeconds` is exactly as per-frame as `scrubFraction` — it belongs in the clock hook's own `useRef`, derived from `scrubFraction` only at the moment Play is pressed (a discrete, coarse-cadence read), never written back reactively every frame.
- **Re-solving IK inside the playback loop:** trajectory is already fully precomputed (Phase 3); `usePlaybackClock` must only interpolate/look up, never call `solveUR6IK` or any kinematics function. [CITED: ARCHITECTURE.md Anti-Pattern 3, PITFALLS.md Pitfall 2/3]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame-rate-independent timing | A fixed per-frame increment (`elapsed += 1/60`) | `useFrame`'s own `delta` parameter | Already the established pattern in this codebase's own pitfalls research [VERIFIED via PITFALLS.md Pitfall 10: "Use frame delta... so playback speed is consistent across different hardware/frame rates"]; a fixed increment breaks on high-refresh-rate displays and drops frames identically. |
| A second animation clock for telemetry | An independent `setInterval`/rAF loop for Dashboard numbers "so Phase 5 doesn't need to touch this phase's code" | Phase 5 reads the same `trajectory` + `livePlayback.fraction`/`scrubFraction` this phase produces | ARCHITECTURE.md Anti-Pattern 2 names this exact mistake ("Telemetry as an independently-running fake simulation") — Phase 4's whole job is to make sure there is exactly one clock. |
| A generic tweening/animation library for the 10s playback ramp | `react-spring`, `framer-motion`, GSAP, etc. | The weighted-arc-length mapping in `duration-mapping.ts` | Those libraries animate *values* (e.g., a single number 0→1) with easing curves — they have no concept of "this path is precomputed, discretely-sampled, and IK-constrained." Would add a dependency to solve a problem that's a ~40-line pure function here. |

**Key insight:** Every piece this phase needs — the clock, the interpolation, the weighting — is small, pure, and specific to the already-precomputed trajectory shape Phase 3 produced. Reaching for a general animation library would fight the domain (discrete IK samples, not continuous tweenable values) more than it would help.

## Common Pitfalls

### Pitfall 1: Writing the reactive `scrubFraction` field every animation frame

**What goes wrong:** `ScrubControl.tsx` re-renders 60 times/second during playback (it subscribes reactively: `useCellStore((state) => state.scrubFraction)` [VERIFIED: src/ui/ScrubControl.tsx:58]). Individually cheap, but it is the exact class of bug this codebase has gone out of its way to prevent everywhere else, and it compounds once Phase 5's Dashboard adds more reactive subscribers to playback-derived state.

**Why it happens:** The single-field design ("just write `scrubFraction`, it already drives everything") is the natural first implementation, and CONTEXT.md's own "Integration Points" note ("it does not need a new rendering path, only a new driver of the value that path already consumes") reads as license to do exactly this.

**How to avoid:** Pattern 1 above — split into a non-reactive `livePlayback.fraction` (60fps, read by `RobotPose.tsx`/`ScrubMarker.tsx`) and a throttled reactive `scrubFraction` sync (~10-20Hz, read by `ScrubControl.tsx`).

**Warning signs:** React DevTools Profiler shows `ScrubControl` (or anything else reading `scrubFraction` reactively) re-rendering every frame during playback.

### Pitfall 2: Throttling `scrubFraction` without a separate 60fps channel — the robot visibly steps

**What goes wrong:** If the fix for Pitfall 1 is applied *only* by throttling writes to `scrubFraction` (without adding `livePlayback`), the robot's pose updates only as often as the throttle fires (e.g., 10-20 times/second), because `RobotPose.tsx`/`ScrubMarker.tsx` currently read `scrubFraction` too. The motion becomes visibly stepped — directly contradicting SIM-04's "track the robot's current position smoothly" success criterion.

**Why it happens:** Throttling looks like the obvious, minimal fix for Pitfall 1 in isolation, without noticing that the SAME field also drives the 3D scene's smoothness, not just the slider's.

**How to avoid:** The two consumers (slider vs. 3D scene) need two different cadences on two different fields — this is precisely what `livePlayback` (60fps) + throttled `scrubFraction` (10-20Hz) provides.

**Warning signs:** Playback looks smooth in a code review but visibly "ticks" on screen at whatever throttle interval was chosen.

### Pitfall 3: Unclamped `useFrame` delta on a backgrounded/refocused tab

**What goes wrong:** Browsers throttle or fully suspend `requestAnimationFrame` in background tabs. When the tab regains focus, the next frame's `delta` can be several seconds. Added directly to `elapsedRef.current`, this jumps playback position forward in one visible frame — or, worse, straight past `PLAYBACK_TOTAL_DURATION_SECONDS`, ending playback instantly on refocus.

**Why it happens:** `useFrame`'s `delta` parameter is trusted implicitly as "small," which it is under normal conditions but is not a guarantee.

**How to avoid:** Clamp delta before accumulating (`Math.min(rawDelta, MAX_FRAME_DELTA_S)` in the Pattern 1 example above — 100ms is a reasonable ceiling, tunable).

**Warning signs:** Switching tabs mid-playback and switching back shows the robot having jumped far along (or finished) the toolpath instead of continuing smoothly from where it was.

### Pitfall 4: `pause()` wired into `setScrubFraction` instead of the drag handler

**What goes wrong:** If D-04's "dragging pauses playback" is implemented by making `setScrubFraction` itself set `isPlaying: false`, the playback clock's own throttled sync call (which also goes through `setScrubFraction`, per Pattern 1) pauses playback on its very next sync tick — playback would stop itself within ~80ms of starting.

**Why it happens:** "Pause whenever the position is set" sounds like a correct paraphrase of D-04 until the throttled-sync design (Pattern 1) is in place and shares the same setter.

**How to avoid:** Pattern 2 above — the pause side effect belongs to `ScrubControl.tsx`'s `onChange` handler specifically, never to `setScrubFraction`.

**Warning signs:** Play immediately reverts to "Play" state (or the robot freezes) within the first throttle interval of pressing it.

### Pitfall 5: D-07's "restart from end" case forgotten, or checked with exact equality

**What goes wrong:** Checking `scrubFraction === 1` exactly can miss a value like `0.9999997` produced by floating-point accumulation, so Play silently produces a zero-duration/no-visible-motion press right after a completed run — the exact bug D-07 exists to prevent.

**How to avoid:** Use an epsilon comparison (`scrubFraction < 1 - RESUME_EPSILON`, see Pattern 1's `usePlaybackClock` example) rather than exact equality, in both directions (treating "close enough to 1" as "finished," matching D-06's own semantics).

**Warning signs:** Manual test: let a sample play to completion, immediately press Play again — if nothing visibly happens, this pitfall has been hit.

## Code Examples

### Weighted duration mapping (pure, testable)

```typescript
// playback/duration-mapping.ts
import type { ParsedToolpath } from '../gcode/parseToolpath'
import type { CompiledTrajectory } from '../trajectory/compile'
import { flattenToolpathPoints } from '../trajectory/arc-length'

export const PLAYBACK_TOTAL_DURATION_SECONDS = 10

// [ASSUMED] Starting-point tuning constants — no source (real feed rates,
// D-01) informs this ratio; visually tune during implementation. Rapids
// consume proportionally LESS weighted time per unit distance than cuts.
const RAPID_TIME_WEIGHT = 1
const CUT_TIME_WEIGHT = 4

interface Breakpoint {
  /** Cumulative REAL arc-length fraction along the toolpath-only portion
   * (0 at the toolpath's first point, 1 at its last — NOT the whole
   * compiled trajectory, which also includes the prepended travel move). */
  realFraction: number
  /** Cumulative WEIGHTED-time fraction at this same point, 0 to 1. */
  weightedFraction: number
}

export interface DurationMapping {
  toolpath: ParsedToolpath
  elapsedToFraction: (elapsedSeconds: number) => number
  fractionToElapsed: (scrubFraction: number) => number
}

/**
 * Builds the D-02 weighted mapping from `toolpath.segments` (per-segment
 * move type is already classified there — see the "Verified Correction"
 * and "Open Questions" sections for why this reads from the ORIGINAL
 * segments rather than from `CompiledTrajectory`, which does not carry
 * move-type per sample).
 */
export function buildDurationMapping(
  toolpath: ParsedToolpath,
  trajectory: CompiledTrajectory,
): DurationMapping {
  const breakpoints: Breakpoint[] = [{ realFraction: 0, weightedFraction: 0 }]
  let realCumulative = 0
  let weightedCumulative = 0

  for (const segment of toolpath.segments) {
    const weight = segment.type === 'rapid' ? RAPID_TIME_WEIGHT : CUT_TIME_WEIGHT
    for (let i = 0; i < segment.points.length - 1; i++) {
      const [x0, y0, z0] = segment.points[i]
      const [x1, y1, z1] = segment.points[i + 1]
      const length = Math.hypot(x1 - x0, y1 - y0, z1 - z0)
      if (length < 1e-12) continue
      realCumulative += length
      weightedCumulative += length / weight
      breakpoints.push({ realFraction: realCumulative, weightedFraction: weightedCumulative })
    }
  }

  const totalReal = realCumulative || 1
  const totalWeighted = weightedCumulative || 1
  for (const bp of breakpoints) {
    bp.realFraction /= totalReal
    bp.weightedFraction /= totalWeighted
  }

  // Rescale the toolpath-local [0,1] real-fraction into the compiled
  // trajectory's overall scrubFraction range — see Open Questions for how
  // `boundaryFraction` is obtained.
  const boundaryFraction = findTravelToolpathBoundary(trajectory, toolpath)

  function toOverallScrubFraction(realFraction: number): number {
    return boundaryFraction + realFraction * (1 - boundaryFraction)
  }
  function toLocalRealFraction(overallScrubFraction: number): number {
    if (overallScrubFraction <= boundaryFraction) return 0
    return (overallScrubFraction - boundaryFraction) / (1 - boundaryFraction)
  }

  function weightedFractionAt(localRealFraction: number): number {
    // Find bracketing breakpoints and lerp — breakpoints.length is small
    // (one entry per segment endpoint, not per compiled IK sample).
    let hi = 1
    while (hi < breakpoints.length - 1 && breakpoints[hi].realFraction < localRealFraction) hi++
    const lo = hi - 1
    const span = breakpoints[hi].realFraction - breakpoints[lo].realFraction
    const ratio = span < 1e-12 ? 0 : (localRealFraction - breakpoints[lo].realFraction) / span
    return breakpoints[lo].weightedFraction + ratio * (breakpoints[hi].weightedFraction - breakpoints[lo].weightedFraction)
  }

  function realFractionAtWeighted(weightedFraction: number): number {
    let hi = 1
    while (hi < breakpoints.length - 1 && breakpoints[hi].weightedFraction < weightedFraction) hi++
    const lo = hi - 1
    const span = breakpoints[hi].weightedFraction - breakpoints[lo].weightedFraction
    const ratio = span < 1e-12 ? 0 : (weightedFraction - breakpoints[lo].weightedFraction) / span
    return breakpoints[lo].realFraction + ratio * (breakpoints[hi].realFraction - breakpoints[lo].realFraction)
  }

  return {
    toolpath,
    elapsedToFraction: (elapsedSeconds) => {
      const weightedFraction = Math.min(1, Math.max(0, elapsedSeconds / PLAYBACK_TOTAL_DURATION_SECONDS))
      return toOverallScrubFraction(weightedFractionAt(realFractionForWeighted(weightedFraction)))
    },
    fractionToElapsed: (scrubFraction) => {
      const localReal = toLocalRealFraction(scrubFraction)
      const weightedFraction = weightedFractionAt(localReal)
      return weightedFraction * PLAYBACK_TOTAL_DURATION_SECONDS
    },
  }

  // (helper name fixed up for clarity — realFractionForWeighted ===
  // realFractionAtWeighted; kept as one function above in the real module)
}
```

*(This skeleton favors clarity over line-count; the planner should collapse `weightedFractionAt`/`realFractionAtWeighted` into one parameterized binary-search helper in the actual implementation, and `flattenToolpathPoints`'s import above is unused in this sketch — segment-level iteration was used instead for granularity reasons explained in Open Questions; remove the unused import when implementing.)*

### Interpolated sample lookup (recommended, resolves the "Verified Correction")

```typescript
// trajectory/sample-lookup.ts
import type { CompiledTrajectory, TrajectorySample } from './compile'

/** Bracketing-pair linear interpolation over CompiledTrajectory.samples,
 * replacing the nearest-index rounding both RobotPose.tsx and
 * ScrubMarker.tsx currently duplicate. Samples are monotonically
 * non-decreasing in scrubFraction (compile.ts's own contract), so a linear
 * scan-with-early-exit or binary search both work; binary search shown. */
export function sampleAtFraction(
  trajectory: CompiledTrajectory,
  fraction: number,
): { point: [number, number, number]; joints: TrajectorySample['joints'] } {
  const { samples } = trajectory
  const clamped = Math.min(1, Math.max(0, fraction))

  let lo = 0
  let hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].scrubFraction < clamped) lo = mid + 1
    else hi = mid
  }
  const upper = samples[lo]
  const lower = samples[Math.max(0, lo - 1)]
  const span = upper.scrubFraction - lower.scrubFraction
  const ratio = span < 1e-12 ? 0 : (clamped - lower.scrubFraction) / span

  return {
    point: [0, 1, 2].map((i) => lower.point[i] + (upper.point[i] - lower.point[i]) * ratio) as [number, number, number],
    joints: [0, 1, 2, 3, 4, 5].map((i) => lower.joints[i] + (upper.joints[i] - lower.joints[i]) * ratio) as TrajectorySample['joints'],
  }
}
```

Joint-space lerp between ADJACENT samples (spaced ~2mm apart in task space, continuity-selected per D-03 branch selection) is safe here — this is not the Pitfall 13 "bowing" case, which applies to lerping between *sparse* waypoints kilometers apart in joint-solution-space; adjacent 2mm-spaced samples are close enough in joint space that the difference between task-space and joint-space interpolation is sub-visual.

### Play/Pause control (matches existing UI conventions)

```typescript
// ui/PlaybackControl.tsx
import { Play, Pause } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useCellStore } from '../store/cellStore'

/**
 * D-03/SIM-04's Play/Pause control. Uses `variant="secondary"` — NOT the
 * default variant — because the default variant renders `--ui-accent`
 * [VERIFIED: src/index.css:155-156 `--primary: var(--ui-accent)`], which
 * UI-SPEC reserves for exactly the nav-cube hover, the Reset View button,
 * and camera-control active states [VERIFIED: .planning/phases/01.../01-UI-SPEC.md
 * "Accent (10%) ... Reserved for exactly: (1) the nav-cube's active/hovered
 * face highlight, (2) the 'Reset View' button ... (3) camera-control
 * active/toggled states ... Nothing else"]. A second accent-styled button
 * would violate that reservation.
 */
export default function PlaybackControl() {
  const isPlaying = useCellStore((state) => state.isPlaying)
  const play = useCellStore((state) => state.play)
  const pause = useCellStore((state) => state.pause)
  const trajectory = useCellStore((state) => state.trajectory)

  const disabled = !trajectory || trajectory.samples.length === 0

  return (
    <Button
      variant="secondary"
      size="icon-sm"
      disabled={disabled}
      onClick={() => (isPlaying ? pause() : play())}
      aria-label={isPlaying ? 'Pause playback' : 'Play toolpath'}
    >
      {isPlaying ? <Pause /> : <Play />}
    </Button>
  )
}
```

Mount alongside `ScrubControl` in `App.tsx`'s existing overlay container (D-03 co-locates them), and mount `usePlaybackClock()` once inside `CellScene.tsx`'s `<Canvas>` — the same tier `ScrubMarker` already occupies (a component that renders nothing/renders a marker but exists purely to run a `useFrame` side effect):

```typescript
// scene/CellScene.tsx — one addition, same tier as ScrubMarker
function PlaybackClock() {
  usePlaybackClock()
  return null
}
// ...inside <Canvas>, alongside <ScrubMarker />:
<PlaybackClock />
```

## Open Questions

1. **How does `duration-mapping.ts` obtain `boundaryFraction` (the split between the prepended travel move and the toolpath proper) without duplicating `compile.ts`'s internal travel-waypoint logic?**
   - What we know: `CompiledTrajectory.samples` is a single flat array covering BOTH the prepended travel move (parked pose → toolpath's first point) and the toolpath itself, sharing one `[0,1]` `scrubFraction` range [VERIFIED: src/trajectory/compile.ts:168-229 doc comment]. Neither a per-sample `isTravel` flag nor a top-level `travelLength`/`toolpathLength` split is exposed on the current `CompiledTrajectory`/`TrajectorySample` contract [VERIFIED: src/trajectory/compile.ts:93-139, full interface definitions read].
   - What's unclear: whether the planner should (a) extend `compile.ts`/`CompiledTrajectory` with a small, non-kinematic `travelLength`/`toolpathLength` (or per-sample `isTravel`) field — the cleanest fix, computed from data `compileTrajectory` already has in scope, but touches a Phase-3-owned file CONTEXT.md's phase boundary describes as "reused verbatim"; or (b) detect the boundary externally in Phase 4 code by finding the first sample whose `.point` is bit-for-bit identical to `flattenToolpathPoints(toolpath.segments)[0]` — reliable because `compileTrajectory`'s travel phase's final waypoint IS a literal reference to `points[0]` (not a recomputed approximation) [VERIFIED: src/trajectory/compile.ts:268 `travelPoints: ... = [homeTcpPoint, liftPoint, aboveFirstPoint, points[0]]` and :83-84 `pointAtFraction` returns `points[points.length - 1]` — i.e. the same array — exactly at `clamped === 1`], but adds an O(samples) scan and a "why does this work" comment burden Phase 3 didn't ask for.
   - Recommendation: Option (a) — it is a smaller, more legible change than it first appears (two numbers, computed from values `compileTrajectory` already holds locally), and avoids the fragile-looking point-identity trick. Flag this explicitly to the user/planner as a narrow, deliberate touch to `trajectory/compile.ts`, not a silent scope expansion.

2. **Should the "how much weighted time does the prepended travel move consume" question be answered at all, or should the travel move simply not be weighted (treated as instantaneous/rapid-speed throughout)?**
   - What we know: D-02 is phrased in terms of g-code move types (G0/G1/G2/G3); the travel move is synthetic, not part of the uploaded g-code, and conceptually is a non-cutting positioning move.
   - What's unclear: CONTEXT.md's Decisions don't address the travel phase at all — it was scoped into existence entirely within Phase 3.
   - Recommendation: treat the whole travel phase as "rapid weight" for timing purposes (matching the visual language it already borrows from rapid moves — see `TOOL-DOWN"` travel semantics in `compile.ts`'s doc comments) — i.e., the travel portion plays at the same relative speed as a G0 move would. This needs a single line of confirmation from the user during planning, not a deep investigation.

3. **Exact `RAPID_TIME_WEIGHT`/`CUT_TIME_WEIGHT` ratio (currently `1`/`4` in the Code Examples sketch).**
   - What we know: D-01 already establishes that this phase does not aim for physical accuracy (no real feed rates used) — CONTEXT.md's own reasoning ("mirrors real CAM-viewer/machine behavior... reinforces the existing rapid/cutting color distinction") is qualitative, not numeric.
   - What's unclear: no source (in this codebase or CONTEXT.md) specifies an exact ratio.
   - Recommendation: ship a reasonable starting constant (recommend 3-5x) and treat it as a one-line tuning constant to eyeball during implementation against the two bundled samples — not worth a `checkpoint:human-verify` gate, since it is cosmetic/qualitative by D-01's own framing, not a correctness-affecting value.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `RAPID_TIME_WEIGHT = 1` / `CUT_TIME_WEIGHT = 4` is a reasonable starting ratio for D-02's weighting | Code Examples, Open Questions #3 | Low — cosmetic tuning constant, easily adjusted without touching any other code; D-01 already establishes this phase doesn't aim for numeric accuracy. |
| A2 | The prepended travel-move phase should be weighted as "rapid speed" for D-02 purposes | Open Questions #2 | Low-Medium — if wrong, the travel move (a fixed, usually short diagonal repositioning) plays back at cutting speed, extending its share of the fixed 10s duration; visually noticeable but not incorrect-looking (still monotone motion into the first cut). Needs one line of user confirmation, not deep rework if changed. |
| A3 | `~10-20Hz` (80ms) is an acceptable throttle interval for the reactive `scrubFraction` sync | Architecture Patterns Pattern 1 | Low — purely a UI-smoothness/store-write-frequency tuning knob; can be changed without touching the 60fps `livePlayback` channel or any other logic. |
| A4 | `MAX_FRAME_DELTA_S = 0.1` (100ms) is a safe clamp ceiling for backgrounded-tab rAF resumption | Common Pitfalls #3 | Low — a standard game-loop safety constant; too low would visibly slow playback on a genuinely slow frame, too high would allow a bigger visible jump. Easy to retune. |
| A5 | Extending `trajectory/compile.ts` with `travelLength`/`toolpathLength` (Open Questions #1, Option a) is an acceptable, narrow touch to a Phase-3-owned file, consistent with "no new kinematics" | Open Questions #1 | Medium — if the user/planner insists on zero touches to Phase 3 files, Option (b) (external point-identity detection) must be used instead; both are documented above so this is a quick decision, not a blocker. |

## Security Domain

ASVS Level 1, `security_enforcement: true` [VERIFIED: .planning/config.json workflow.security_enforcement/security_asvs_level]. This phase adds no new input surface, no new network calls, and no new persisted data — it only adds a client-side animation clock over already-validated, already-precomputed data (Phase 2/3 own all g-code input validation).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app (client-side-only SPA, no accounts, per PROJECT.md Out of Scope). |
| V3 Session Management | No | N/A. |
| V4 Access Control | No | N/A. |
| V5 Input Validation | No new surface | `setScrubFraction`'s existing NaN/Infinity/range clamp [VERIFIED: src/store/cellStore.ts:106-107] already covers every value this phase writes into it — the playback clock computes `fraction` from `Math.min(1, Math.max(0, ...))`-bounded arithmetic and routes every reactive write through the same `setScrubFraction`, so no new unvalidated input path is introduced. |
| V6 Cryptography | No | N/A. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Runaway `useFrame` loop consuming CPU indefinitely if `isPlaying` never clears (e.g., a bug leaves the tab animating forever after the user navigates away) | Denial of Service (client-side, self-inflicted) | D-06's forced completion (`pause()` on `finished`) already bounds every playback run to `PLAYBACK_TOTAL_DURATION_SECONDS`; no additional mitigation needed beyond implementing D-06 correctly. |
| Malformed/adversarial `trajectory.samples` (e.g., a future code path producing NaN in a sample's `point`/`joints`) propagating into `setJointValue`/`mesh.position.set` | Tampering (data integrity, not an external attacker in this offline demo app) | Out of scope for this phase — `trajectory` is produced entirely by Phase 3's `compileTrajectory`, which already never emits NaN (guarded by `classifySingularity`/`validBranches` upstream); this phase only reads it. |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json:45] |
| Config file | `vite.config.ts` (`test: { environment: 'node' }`) [VERIFIED: vite.config.ts:40-42] — no `jsdom`/DOM environment configured, so React component rendering is not exercised by this project's test suite; all existing tests target pure logic modules or the Zustand store directly via `getState()`/`setState()`, never `@testing-library/react` (not installed) [VERIFIED: package.json devDependencies — no `@testing-library/*` present]. |
| Quick run command | `npx vitest run src/playback` |
| Full suite command | `npm test` (= `vitest run`) [VERIFIED: package.json:11] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-04 | Weighted elapsed-time-to-scrubFraction mapping is monotonic, respects D-01's fixed duration, and weights rapid vs. cut segments correctly | unit | `npx vitest run src/playback/duration-mapping.test.ts` | ❌ Wave 0 |
| SIM-04 | D-07: `fractionToElapsed`/clock resume logic treats `scrubFraction` ≈ 1 as a restart-from-0, not a zero-duration resume | unit | `npx vitest run src/playback/duration-mapping.test.ts` (or a dedicated clock-resume-logic unit if the resume/restart branching is extracted as its own pure function) | ❌ Wave 0 |
| SIM-04 | `cellStore.play()`/`pause()` toggle `isPlaying` correctly; `livePlayback.fraction` stays in sync with `setScrubFraction` calls (Pattern 1's lockstep write) | unit | `npx vitest run src/store/cellStore.test.ts` (extend existing file, following its established `describe('useCellStore — ...')` per-feature block convention [VERIFIED: src/store/cellStore.test.ts:1-118 structure]) | ⚠️ extend existing file, not new |
| SIM-04 | `sampleAtFraction` bracketing-pair interpolation returns exact endpoints at fraction 0/1 and a correct midpoint lerp for a hand-computable 2-sample trajectory | unit | `npx vitest run src/trajectory/sample-lookup.test.ts` | ❌ Wave 0 (only if the shared-lookup refactor is adopted) |
| SIM-04 (manual/visual) | Robot animates continuously and smoothly when Play is pressed; slider tracks progress; drag-while-playing pauses+seeks (D-04); Play after completion restarts (D-07) | manual-only | N/A — no jsdom/RTL in this project; requires visual confirmation in the running app, consistent with how Phase 1-3's 3D-rendering behavior was verified (`01-UAT.md` live-URL visual sign-off pattern [VERIFIED: .planning/STATE.md "Phase 1 UAT passed 1/1 (live-URL visual sign-off...)"]) | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run src/playback src/store/cellStore.test.ts src/trajectory` (targeted, fast)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual playback UAT (per the row above) is the only way to verify the animation-smoothness/timing behavior itself, matching this project's established pattern of visual sign-off for 3D-rendering-dependent behavior that a `node`-environment Vitest suite cannot exercise.

### Wave 0 Gaps

- [ ] `src/playback/duration-mapping.test.ts` — covers SIM-04's weighted-mapping math (new file, new module)
- [ ] `src/trajectory/sample-lookup.test.ts` — covers the interpolated lookup, if the shared-refactor recommendation is adopted (new file, new module)
- [ ] No framework install needed — Vitest is already configured and used identically by every other pure-TS module in this codebase.

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `src/store/cellStore.ts` — full file read, coarse/per-frame discipline documented in its own header comment
- `src/scene/RobotPose.tsx`, `src/scene/ScrubMarker.tsx` — existing nearest-index `useFrame`+`getState()` pattern
- `src/ui/ScrubControl.tsx`, `src/ui/ResetViewButton.tsx`, `src/App.tsx` — existing UI/overlay conventions
- `src/trajectory/compile.ts`, `src/trajectory/arc-length.ts` — `CompiledTrajectory`/`TrajectorySample` contract, arc-length utilities
- `src/gcode/parseToolpath.ts` — `ClassifiedSegment`/`ParsedToolpath` move-type data
- `src/scene/CellScene.tsx`, `src/scene/RailRig.tsx`, `src/scene/RobotModel.tsx` — scene composition/mount points
- `src/components/ui/button.tsx`, `src/index.css` — Button variants, `--ui-accent` reservation
- `package.json`, `vite.config.ts` — installed versions, test environment
- `.planning/phases/01-static-rig-kinematics-foundation/01-UI-SPEC.md` — Accent color reservation rule
- `.planning/phases/04-playback-engine/04-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — Playback Controller / `usePlaybackClock` suggested location and Pattern 1/2 (precompute-then-playback, store-driven imperative rendering), written 2026-08-13 for this project
- `.planning/research/PITFALLS.md` — Pitfall 10 (per-frame React state), Pitfall 12 (geometry recreation), Pitfall 13 (joint-space interpolation), written 2026-08-13 for this project
- WebSearch, cross-checked against official domains (r3f.docs.pmnd.rs `useFrame`/delta guidance; pmndrs/zustand GitHub discussion on non-reactive state patterns) — confidence tier MEDIUM per `classify-confidence --provider websearch --verified`

### Tertiary (LOW confidence)
- None used as load-bearing — all playback-clock design claims are either direct codebase reads or cross-checked web sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every capability already verified installed and in use
- Architecture (dual-cadence store split): MEDIUM-HIGH — the problem (reactive-write-vs-60fps tension) is directly verified from codebase reads; the specific resolution pattern is a cross-checked but not project-specific-verified technique
- Data-contract gap (move-type/boundary on CompiledTrajectory): HIGH — directly verified absent by reading `compile.ts`'s full interface definitions; two concrete resolutions presented, flagged for a planning-time decision rather than silently chosen
- Pitfalls: HIGH — every pitfall traces to a specific, quoted line range in this codebase or this project's own prior research documents

**Research date:** 2026-08-15
**Valid until:** Should remain valid for the life of this phase (no external API/library surface to go stale); re-verify only if Phase 3's `CompiledTrajectory` contract changes before this phase is planned/executed.
