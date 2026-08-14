# Phase 3: Inverse Kinematics + Trajectory Compile + Scrub - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 3-inverse-kinematics-trajectory-compile-scrub
**Areas discussed:** Rail placement granularity

---

## Gray areas presented (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Rail placement granularity | Research recommends one rail position per "operation," but Phase 2's toolpath has no operations concept yet — does Phase 3 pick one position for the whole toolpath, or something finer-grained? | ✓ |
| Scrub control semantics | What does the scrub control parameterize — point index, arc-length fraction, or something else, given Phase 3 has no real "time" yet? | |
| Unreachable point / IK failure behavior | What happens when a scrub target is outside the workspace or the closed-form solver returns no valid solution? | |
| Scrub-position indicator on the toolpath | Should the toolpath show a marker at the current scrub position? | |

**User's choice:** Only "Rail placement granularity" selected. The other three were left to Claude's discretion.

---

## Rail placement granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One rail position for the whole toolpath | Simplest; matches the research heuristic degenerating to a single "operation" since nothing splits the path yet | ✓ |
| Re-solve rail position when reach gets tight | Cluster the toolpath into segments, pick a rail position per cluster, closer to true per-operation behavior | |
| You decide | Claude picks based on IK implementation cleanliness | |

**User's choice:** One rail position for the whole toolpath.
**Notes:** Follow-up on how that single position gets computed was itself left to Claude's discretion (user selected "Next area / done" rather than "More questions").

---

## Claude's Discretion

- **Rail X computation:** minimize worst-case 3D reach distance from `ROBOT_MOUNT_WORLD` to any toolpath point, clamped to `RAIL_TRAVEL` — a general algorithm, not hardcoded to `RAIL_CENTER_X`, even though it will likely resolve near `RAIL_CENTER_X` for both bundled samples given their small X-spans.
- **IK solution continuity:** closed-form solver, nearest-branch-to-previous-scrub selection, seeded from `UR3E_READY_POSE` — locked directly from prior research (ARCHITECTURE.md/PITFALLS.md), not re-asked as a fresh question since it was already the documented recommended approach.
- **Trajectory compile architecture:** precompute-then-playback (whole toolpath run through IK once per selection, scrub reads the precomputed array) — per the phase's own name and ARCHITECTURE.md Pattern 1.
- **Scrub control semantics:** 0–1 arc-length fraction, not point index or synthetic time.
- **IK failure handling:** freeze at last valid pose + non-blocking status message, never silent/crash — continuing Phase 2's disclosure discipline.
- **Scrub-position indicator:** a single current-position marker on the toolpath, distinct from Phase 2's start/end markers.
- **Singularity detection:** build the pure detection logic now (kinematics phase is the natural place for it per ARCHITECTURE.md), defer UI surfacing to Phase 5's Dashboard.
- Exact scrub widget styling, arc-length sampling resolution, and the specific IK-derivation reference source were left fully open (implementation detail, not a user-facing decision).

## Deferred Ideas

- Real-time playback / play-pause (Phase 4)
- Per-operation rail re-solving (Phase 6, once operations exist — noted as a deliberate simplification here, not an oversight)
- Singularity UI display (Phase 5)
- Depth-of-engagement coloring, per-operation markers, operations tree (Phase 6, carried from Phase 2's own deferred list)
- Calibrate-tab home-position/joint overrides (Phase 8)
