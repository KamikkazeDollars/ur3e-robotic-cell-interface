# Phase 4: Playback Engine - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can press Play and watch the UR3e (including the 7th-axis rail) animate continuously along the full compiled trajectory from Phase 3, in a fixed, demo-friendly real-time-style duration — completing the "must not fail" core simulation before any secondary tab work begins. This phase owns the animation clock, the Play/Pause control, and the time-to-scrub-fraction mapping; it does not introduce new kinematics (Phase 3's trajectory compile is reused verbatim) and does not touch telemetry display (Phase 5) or per-operation timing/markers (Phase 6). Covers SIM-04 (press play, animate the UR3e following the toolpath in real time, synced to the visible trajectory).

</domain>

<decisions>
## Implementation Decisions

### Playback Duration & Speed
- **D-01:** Total playback duration is a fixed, normalized value (~10 seconds) for every sample, not derived from the g-code's real feed rates (F-values) and not scaled by toolpath complexity/segment count. All bundled samples take the same ~10s to play. — **Reversibility:** reversible — a later per-sample or feed-rate-derived duration mode can be added by changing only the time→fraction mapping function; nothing about the precomputed trajectory (Phase 3) or the store's `scrubFraction` contract changes.
- **D-02:** Within that fixed duration, rapid (G0) moves consume proportionally less playback time than cutting (G1/G2/G3) moves — mirrors real CAM-viewer/machine behavior (rapids are fast, cuts are the work) and reinforces the existing rapid/cutting color distinction from Phase 2. The time-to-arc-length-fraction mapping must be move-type-weighted, not a uniform `elapsed / totalDuration` lookup. — **Reversibility:** reversible — isolated to the weighting function; a uniform-speed fallback is a one-function swap.

### Play/Pause/Scrub Interplay
- **D-03:** The Phase 3 scrub slider (`src/ui/ScrubControl.tsx`) is reused as the single dual-purpose control: it both displays playback progress (advancing automatically while playing) and remains the manual seek control. No separate playback-only progress bar is built.
- **D-04:** Dragging the slider while playback is running immediately pauses playback and seeks to the dragged position — same interaction Phase 3 already established for manual scrubbing. The user must press Play again to resume. No live "drag while still animating" coordination is needed.
- **D-05:** Pressing Play resumes from the trajectory's current `scrubFraction`, not from 0 — consistent with the slider being a single dual-purpose control. Scrubbing to a point then pressing Play continues forward from there.
- **D-06:** When playback reaches the end of the toolpath (`scrubFraction` reaches 1), it stops and holds the final pose. The Play control resets to its "Play" (not "Pause") state so a subsequent press is unambiguous.
- **D-07 (Claude's discretion — reconciles D-05 and D-06):** If the user presses Play again while `scrubFraction` is already at (or extremely close to) 1 — i.e., the previous playback run just completed — treat it as a restart from 0 rather than literally "resuming" from 1, which would produce a zero-duration play that looks like nothing happened. This is the only case where Play does not resume from the literal current fraction; document it inline as the specific edge case D-05/D-06 leave ambiguous.

### Claude's Discretion
- No playback-speed multiplier (1x/2x/4x) control is planned for this phase — not raised as a gray area during discussion, and the fixed ~10s duration (D-01) already serves the "watchable in a demo" goal without one. `ARCHITECTURE.md`'s Playback Controller sketch mentions a `speedMultiplier` field in its illustrative state shape; treat that as optional headroom in the type, not a requirement to build a UI control for it.
- Exact Play/Pause button placement, icon, and styling — no specific visual reference given; match the existing minimal chrome (Reset View button, sample dropdown, scrub slider) from Phases 1–3.
- Exact easing/interpolation between precomputed trajectory samples during playback (linear interpolation between adjacent samples is the expected default, consistent with how `ScrubMarker.tsx` already interpolates for manual scrubbing) — implementation detail for the planner/researcher.
- Whether the animation clock is implemented as a small hook (`usePlaybackClock`) per `ARCHITECTURE.md`'s suggested structure, or inlined into an existing component — `ARCHITECTURE.md` already proposes `playback/usePlaybackClock.ts`; the planner should follow that unless a concrete reason not to emerges during research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Playback architecture (primary)
- `.planning/research/ARCHITECTURE.md` §"Playback Controller" (component table) — owns the animation clock (`currentTime`, `isPlaying`, `speedMultiplier`), advances time via `requestAnimationFrame`, looks up/interpolates the trajectory, writes pose into the store imperatively.
- `.planning/research/ARCHITECTURE.md` §"Recommended Project Structure" — `playback/usePlaybackClock.ts` (rAF loop, time → interpolated frame, writes to store) as the suggested module location.
- `.planning/research/ARCHITECTURE.md` §"Pattern 1: Precompute-then-playback" — playback is pure interpolation/array lookup over Phase 3's precomputed trajectory; no IK solving happens during the animation loop.
- `.planning/research/ARCHITECTURE.md` §"Pattern 2" (imperative `useFrame` update pattern, ~line 121-128) — the playback clock updates state at 60fps via ref/imperative path; Three.js objects read store values inside `useFrame`, not via React prop re-renders.
- `.planning/research/ARCHITECTURE.md` §"Primary Flow: g-code → rendered, telemetry-backed playback" (~line 158-199) — `playback.currentTime` is the only thing that changes at animation speed; everything else is a pure function of `(jointTrajectory, currentTime)` — the core invariant this phase must protect so Phase 5's telemetry can never desync.

### Known pitfalls for this phase
- `.planning/research/PITFALLS.md` §Pitfall 10 (React re-renders on every animation frame via `setState`) — drive all per-frame animation through refs mutated inside `useFrame`, never `useState`/Zustand-reactive-subscription in the render loop; use frame delta so speed is consistent across hardware/frame rates.
- `.planning/research/PITFALLS.md` §Pitfall 12 (geometry-recreation memory leak) — the playhead/TCP marker and any per-frame-updated geometry must mutate `BufferAttribute` data in place, not recreate geometry objects; verify with an extended playback session.
- `.planning/research/PITFALLS.md` §Pitfall 2 (singularities mishandled during animation) and §Pitfall 3 (multiple IK solutions cause pose flipping) — already mitigated by Phase 3's D-03 continuity rule and precomputed trajectory; this phase must not reintroduce per-frame IK solving that would resurface either pitfall.
- `.planning/research/PITFALLS.md` §"Playback frame rate degrades on longer toolpaths" note (~line 211) — confirms the precompute-once approach (already built in Phase 3) is what keeps this phase's animation loop cheap; playback must not re-run any per-frame solve.

### Phase 3 handoff (this phase's direct input — MUST read before touching playback)
- `src/store/cellStore.ts` — `trajectory: CompiledTrajectory | null`, `scrubFraction: number` (0–1, coarse-cadence), `setScrubFraction(fraction)` (clamps into [0,1]). Playback's animation clock drives this same `scrubFraction` value — it does not introduce a parallel time representation.
- `src/trajectory/compile.ts` / `CompiledTrajectory` — the precomputed `{scrubFraction, railPos, joints[6], tcpPose}` array this phase interpolates over.
- `src/trajectory/arc-length.ts` — the existing arc-length parameterization; the move-type-weighted time→fraction mapping (D-02) builds on this, not a new arc-length scheme.
- `src/scene/ScrubMarker.tsx` — the existing imperative `useFrame` + `getState()` driver pattern for the scrub-position marker; the playback clock should extend or mirror this pattern, not invent a second imperative-update convention.
- `src/ui/ScrubControl.tsx` — the existing scrub slider (D-03 reuses this as the dual-purpose control).
- `.planning/phases/03-inverse-kinematics-trajectory-compile-scrub/03-CONTEXT.md` §D-05 — Phase 3 explicitly reserved "real time" semantics for Phase 4 and confirmed Phase 4 "can reuse the same precomputed trajectory by mapping real elapsed time onto this same fraction" — this phase is that mapping.

### Design system
- `.planning/phases/01-static-rig-kinematics-foundation/01-UI-SPEC.md` — Dominant/Secondary/Accent palette; a new Play/Pause control must stay within the established color discipline (no new reserved-accent usage beyond what's already defined).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/store/cellStore.ts` — `scrubFraction`/`setScrubFraction` is the exact value the playback clock writes to every tick; no new store field is needed for "current position," only new fields for `isPlaying` (and possibly `playbackStartedAt`/similar clock bookkeeping, kept minimal per the coarse-cadence rule — the per-frame value itself must not round-trip through Zustand-reactive subscriptions, only imperative `getState()`/`setState()`).
- `src/scene/ScrubMarker.tsx` — established pattern for reading `scrubFraction`-derived state imperatively inside `useFrame` via `getState()`, reused rather than reinvented for the playback-driven pose update.
- `src/trajectory/arc-length.ts` — existing arc-length utilities the move-type-weighted duration mapping (D-02) extends.

### Established Patterns
- Per-frame values never round-trip through reactive Zustand subscriptions or React state (Phase 1's rule, reinforced by Phase 3's `cellStore.ts` header comment on coarse-cadence writes) — the playback clock must follow the same discipline: `isPlaying` (a discrete, human-interaction-frequency toggle) is a normal reactive store field; the advancing time/fraction itself is not.
- Store `catch` blocks record only a status enum, never a raw exception (T-02-04/D-06 discipline) — carries forward if the playback clock needs any failure-mode handling (unlikely, since it only reads an already-validated precomputed trajectory).

### Integration Points
- The playback clock sits between a new Play/Pause control (DOM/React chrome, following `ScrubControl.tsx`/`ResetViewButton.tsx`'s "controlled component dispatches a store action" convention) and the existing `scrubFraction`-driven pose/marker rendering path — it does not need a new rendering path, only a new *driver* of the value that path already consumes.

</code_context>

<specifics>
## Specific Ideas

No specific visual references beyond what's captured in Decisions above (fixed ~10s duration, rapid-moves-play-faster weighting, dual-purpose slider, pause-on-drag, resume-from-position, stop-and-hold at end).

</specifics>

<deferred>
## Deferred Ideas

- **Playback-speed multiplier UI (1x/2x/4x)** — not raised as a gray area during discussion; `ARCHITECTURE.md`'s illustrative Playback Controller state includes a `speedMultiplier` field, but no UI control is planned for this phase (see Claude's Discretion above). Could be added later without restructuring the clock.
- **Real feed-rate-derived playback duration** — explicitly rejected in favor of normalized fixed duration (D-01); noted here so a future "accuracy mode" idea isn't silently reconsidered without the original demo-reliability reasoning.
- **Telemetry/Dashboard display of playback state** — explicitly Phase 5's scope (DASH-01/02/03); this phase only needs to make `playback.currentTime`/`scrubFraction` and the trajectory available as a clean read surface, not build any Dashboard UI.
- **Per-operation timing, distinct start/end markers per operation, mill engagement coloring** — explicitly Phase 6's scope, unchanged from Phases 2/3's own deferred-ideas lists.
- **Auto-loop playback** — explicitly rejected in favor of "stop and hold final pose" (D-06); noted here in case a future "kiosk/demo loop mode" idea comes up.

None else — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-playback-engine*
*Context gathered: 2026-08-15*
