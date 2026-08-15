# Phase 4: Playback Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 4-playback-engine
**Areas discussed:** Playback duration/speed, Play/pause/scrub interplay

---

## Playback duration/speed

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized duration | Playback always takes a fixed, demo-friendly duration regardless of the sample's real feed rates | ✓ |
| Real feed-rate-derived time | Duration computed from the g-code's actual F-values converted to real seconds | |

**User's choice:** Normalized duration.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed duration for all samples | Every sample plays back in the same fixed time regardless of arc length or segment count | ✓ |
| Scales with toolpath complexity | Longer/denser toolpaths take proportionally more time | |

**User's choice:** Fixed duration for all samples.

| Option | Description | Selected |
|--------|-------------|----------|
| Rapids play faster | Rapid/travel moves consume proportionally less of total playback time than cutting moves — matches real machine/CAM-viewer behavior | ✓ |
| Constant speed throughout | Robot moves at constant arc-length-per-second, no distinction between move types | |

**User's choice:** Rapids play faster.

| Option | Description | Selected |
|--------|-------------|----------|
| ~10 seconds | Short and punchy for a live interview demo | ✓ |
| ~15-20 seconds | Slower/more deliberate, more time to narrate details | |
| You decide | Leave exact number to Claude's discretion | |

**User's choice:** ~10 seconds.
**Notes:** Combined outcome recorded as CONTEXT.md D-01/D-02 — fixed ~10s duration, move-type-weighted time-to-fraction mapping.

---

## Play/pause/scrub interplay

| Option | Description | Selected |
|--------|-------------|----------|
| Same slider, dual-purpose | Phase 3's scrub slider both shows and drives progress; draggable, which pauses and seeks | ✓ |
| Separate progress bar | Playback gets its own read-only indicator; scrub slider stays manual-only | |

**User's choice:** Same slider, dual-purpose.

| Option | Description | Selected |
|--------|-------------|----------|
| Dragging pauses playback | Grabbing the slider immediately pauses and seeks, same as Phase 3's existing scrub behavior | ✓ |
| Dragging seeks live, playback keeps running | Animation clock keeps advancing from wherever the user drops the slider | |

**User's choice:** Dragging pauses playback.

| Option | Description | Selected |
|--------|-------------|----------|
| Resume from current position | Play continues forward from wherever the slider currently sits | ✓ |
| Play always restarts at 0% | Pressing Play always jumps back to the start first | |

**User's choice:** Resume from current position.

| Option | Description | Selected |
|--------|-------------|----------|
| Stop and hold final pose | Playback stops at 100%, robot holds final pose, Play button resets to "Play" | ✓ |
| Auto-loop back to start | Playback automatically restarts from 0% and keeps animating | |

**User's choice:** Stop and hold final pose.
**Notes:** Claude noted the interaction between "resume from current position" and "stop and hold at end" needs an explicit edge-case rule (pressing Play again at 100% restarts from 0 rather than literally resuming from a completed fraction) — captured as CONTEXT.md D-07.

---

## Claude's Discretion

- No playback-speed multiplier (1x/2x/4x) UI control — not raised as a gray area; fixed ~10s duration already serves the demo-watchability goal.
- Exact Play/Pause button placement, icon, and styling.
- Exact easing/interpolation between precomputed trajectory samples during playback.
- Whether the animation clock is a dedicated `usePlaybackClock` hook (per `ARCHITECTURE.md`'s suggestion) or inlined elsewhere.

## Deferred Ideas

- Playback-speed multiplier UI (1x/2x/4x) — could be added later without restructuring the clock.
- Real feed-rate-derived playback duration — explicitly rejected in favor of normalized fixed duration.
- Telemetry/Dashboard display of playback state — Phase 5's scope.
- Per-operation timing, distinct start/end markers per operation, mill engagement coloring — Phase 6's scope.
- Auto-loop playback — explicitly rejected in favor of stop-and-hold; noted in case a future "kiosk/demo loop mode" idea comes up.
