---
phase: 03-inverse-kinematics-trajectory-compile-scrub
plan: 02
subsystem: kinematics
tags: [ur3e, inverse-kinematics, dh-parameters, zustand, react-three-fiber, singularity]

# Dependency graph
requires:
  - phase: 03-01
    provides: closed-form UR3e IK solver, rail resolution, arc-length trajectory compiler, scrub control
provides:
  - "classifySingularity: pure wrist/shoulder/elbow singularity classification (D-08)"
  - "singularityFlags stored on every CompiledTrajectory sample, ready for Phase 5's Dashboard"
  - "frozen-trajectory disclosure (D-06/SIM-05) in SampleSelect's app chrome"
  - "RailRig carriage rendered at the compiler's resolved rail position"
  - "settled joint-limit provenance citation in ur3e-dh.ts"
affects: [05-telemetry-dashboard, 04-playback]

# Actuals (#2632)
actuals:
  tokens: 5386
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure kinematics classifiers live in src/kinematics/, framework-free, mirroring forward-kinematics.ts's isWithinJointLimits shape"
    - "Scene components read coarse-cadence (per-selection, not per-frame) store fields via a reactive Zustand selector, reserving useFrame/refs for genuinely per-frame values"

key-files:
  created:
    - src/kinematics/singularity.ts
    - src/kinematics/singularity.test.ts
  modified:
    - src/kinematics/index.ts
    - src/kinematics/ur3e-dh.ts
    - src/trajectory/compile.ts
    - src/trajectory/compile.test.ts
    - src/ui/scene-status-copy.ts
    - src/ui/scene-status-copy.test.ts
    - src/ui/SampleSelect.tsx
    - src/scene/RailRig.tsx

key-decisions:
  - "Corrected the shoulder-singularity distance check to compare against the joint-4 DH offset (its true theoretical floor for this non-spherical-wrist chain), not against zero — the plan's literal wording would have made the flag permanently false for every reachable pose"
  - "RailRig reads trajectory.railPos via a reactive Zustand selector (not useFrame), since the value changes at most once per sample selection — the coarse cadence the store's own performance discipline sanctions"

patterns-established:
  - "Singularity/limit classifiers are pure functions over JointAngles, unit-tested against numerically-derived (not hand-guessed) reference joint tuples"

requirements-completed: [SIM-05]

coverage:
  - id: D1
    description: "classifySingularity correctly flags wrist, shoulder, and elbow singular families from a joint tuple, and every compiled trajectory sample carries the resulting flags without them affecting branch selection"
    requirement: "SIM-05"
    verification:
      - kind: unit
        ref: "src/kinematics/singularity.test.ts#classifySingularity"
        status: pass
      - kind: unit
        ref: "src/trajectory/compile.test.ts#every sample carries singularityFlags whose `any` field agrees with the disjunction of the other three"
        status: pass
    human_judgment: false
  - id: D2
    description: "A trajectory that froze at an unreachable point discloses the shortfall (reached/intended counts) in non-blocking app chrome, sourced from fixed copy plus the trajectory's own numbers"
    requirement: "SIM-05"
    verification:
      - kind: unit
        ref: "src/ui/scene-status-copy.test.ts#trajectoryFrozen copy exists, is non-empty, and carries no placeholder/interpolation syntax"
        status: pass
    human_judgment: true
    rationale: "The visual rendering of the disclosure note in SampleSelect.tsx (role=\"status\", placement beneath the skipped-command note) is not exercised by a DOM-rendering test in this plan; 03-03's sign-off covers the visual pass per the plan's own <verify> note."
  - id: D3
    description: "The rail carriage's rendered X position derives from the trajectory compiler's resolved rail position, falling back to the travel centre with no sample loaded"
    requirement: "SIM-05"
    verification:
      - kind: unit
        ref: "npm run build (tsc -b && vite build) exit 0"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that the carriage renders correctly in the running scene is not covered by an automated test in this plan; 03-03's sign-off covers the visual pass."

duration: 7min
completed: 2026-08-14
status: complete
---

# Phase 3 Plan 2: Singularity Classification, Frozen-Trajectory Disclosure, Rail Agreement Summary

**`classifySingularity` stored per compiled sample, a frozen-trajectory disclosure sourced from fixed copy, and the rail carriage rendered at the compiler's own resolved rail position instead of a hardcoded travel-centre literal.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-08-14T20:41:00+03:00 (approx.)
- **Completed:** 2026-08-14T20:47:16+03:00
- **Tasks:** 3
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- `classifySingularity` (D-08): a pure, framework-free function classifying a joint tuple against the wrist, shoulder, and elbow singular families, exported from the kinematics barrel and unit-tested against four numerically-derived reference poses (one per family plus a clean control)
- Every `CompiledTrajectory` sample now carries `singularityFlags`, computed once at compile time alongside `tcpPosition`, explicitly documented as an observation that never influences branch selection
- A frozen-trajectory disclosure (D-06/SIM-05): fixed `trajectoryFrozen` copy plus reached/intended sample counts, rendered as a second `role="status"` note in `SampleSelect.tsx`
- The rail carriage's rendered X now derives from the trajectory compiler's resolved `railPos` via a reactive store selector, falling back to `RAIL_CENTER_X` with nothing loaded
- The UR3e joint-limit table's provenance comment settled: cites the official ROS 2 description package and the UR3e user manual (e-Series 5.8), with an explicit warning against normalising the elbow's narrower range

## Task Commits

Each task was committed atomically:

1. **Task 1: Classify wrist, shoulder and elbow singularities and store them per compiled sample** - `42193e1` (feat)
2. **Task 2: Disclose a trajectory that froze at an unreachable point** - `8ab887f` (feat)
3. **Task 3: Render the carriage at the resolved rail position and settle the joint-limit provenance** - `f31c9b9` (feat)

_No TDD tasks in this plan; each is a single feat commit._

## Files Created/Modified
- `src/kinematics/singularity.ts` - `classifySingularity`, `SingularityFlags`, and both epsilon constants (D-08)
- `src/kinematics/singularity.test.ts` - coverage for each singular family plus a non-singular control pose
- `src/kinematics/index.ts` - barrel export widened to include the singularity module
- `src/kinematics/ur3e-dh.ts` - joint-limit provenance comment settled with official citation and a normalisation warning; no numeric value changed
- `src/trajectory/compile.ts` - `TrajectorySample.singularityFlags` populated once per accepted sample
- `src/trajectory/compile.test.ts` - asserts every sample carries flags whose `any` agrees with the disjunction of the other three
- `src/ui/scene-status-copy.ts` - `trajectoryFrozen` fixed-copy key, no interpolation
- `src/ui/scene-status-copy.test.ts` - asserts the new key is non-empty and carries no placeholder syntax
- `src/ui/SampleSelect.tsx` - renders the frozen-trajectory note with real reached/intended counts
- `src/scene/RailRig.tsx` - carriage X reads `trajectory.railPos` via a Zustand selector, falling back to `RAIL_CENTER_X`

## Decisions Made
- Corrected the shoulder-singularity distance check (deviation, see below) — the mathematically correct comparison for this non-spherical-wrist DH chain is against the joint-4 offset, not zero.
- Used a reactive Zustand selector (not `useFrame`) for the carriage's rail position, since it changes at most once per sample selection — matching the store's own coarse-cadence discipline documented in `RailRig.tsx`'s comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the shoulder singularity's distance comparison**
- **Found during:** Task 1 (singularity classification)
- **Issue:** The plan's interfaces block described the shoulder family as "distance from the wrist centre to the joint-1 axis below a threshold," implying comparison against near-zero. Numerically verifying across the full joint-angle domain (theta1–theta4, theta5/6 have no effect on this distance) showed the wrist centre — `forwardKinematics(joints).frames[3]`'s translation — can NEVER reach a planar distance below the joint-4 DH offset (~0.13105m) from the joint-1 axis, for any joint tuple. Comparing raw distance against `SINGULARITY_DISTANCE_EPSILON` (0.02m) would make `shoulder` permanently `false` for every reachable pose — this is the standard result for a non-spherical-wrist chain (UR-series robots): the true shoulder-singularity locus is where that distance reaches its own floor, equal to the joint-4 offset (`distance² = d4²`), not zero.
- **Fix:** Compare `distanceFromAxis` against `UR3E_DH[3].d` (the joint-4 offset) rather than zero: `shoulder = Math.abs(distanceFromAxis - wristOffset) < SINGULARITY_DISTANCE_EPSILON`. Documented the derivation and the correction explicitly in `singularity.ts`'s own comment so a future reader doesn't "fix" it back to the plan's literal wording.
- **Files modified:** `src/kinematics/singularity.ts`
- **Verification:** `src/kinematics/singularity.test.ts` includes a dedicated shoulder-family test using a numerically-located joint tuple that drives the distance down to the offset floor; `npm test` and `npm run build` both pass.
- **Committed in:** `42193e1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness — without the fix, the shoulder singularity family would be permanently non-functional despite appearing implemented (a silent dead-code path Phase 5's Dashboard would have inherited). No scope creep; the fix stayed within `singularity.ts`.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `classifySingularity` and `singularityFlags` are ready for Phase 5's Dashboard to consume without deriving new kinematics.
- The frozen-trajectory disclosure and rail-agreement carriage position are both implemented and unit/build-verified; 03-03 (per this plan's own `<verify>` note) covers the remaining visual sign-off pass for both.
- Known open issue carried from 03-01, out of scope here: the home-to-toolpath travel move can still visually clip through the table in some cases despite passing its automated/analytical check — documented in 03-01-SUMMARY.md and STATE.md's Blockers/Concerns, to be consolidated after 03-03.

---
*Phase: 03-inverse-kinematics-trajectory-compile-scrub*
*Completed: 2026-08-14*

## Self-Check: PASSED
All created/modified files verified present on disk; all three task commits (`42193e1`, `8ab887f`, `f31c9b9`) verified present in `git log`.
