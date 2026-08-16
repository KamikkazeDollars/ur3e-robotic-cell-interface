---
phase: quick
plan: 260816-nup
type: execute
wave: 1
depends_on: []
files_modified:
  # created — collision/safety modules (U-1, U-2)
  - src/collision/pose-collision.ts
  - src/collision/pose-collision.test.ts
  - src/collision/manual-pose-safety.ts
  - src/collision/manual-pose-safety.test.ts
  - src/collision/index.ts
  - src/collision/playback-path-unguarded.test.ts
  # created — rail geometry gate (U-4)
  - src/scene/rail-rig-geometry.test.ts
  # created — restored compact mode toggle + shared shell geometry (U-5)
  - src/ui/shell/ModeBar.tsx
  - src/ui/shell/shell-geometry.ts
  - src/ui/shell/shell-geometry.test.ts
  # modified
  - src/scene/RailRig.tsx
  - src/scene/Workbench.tsx
  - src/gcode/toolpath-anchor.ts
  - src/store/cellStore.ts
  - src/store/cellStore.test.ts
  - src/store/uiShellStore.ts
  - src/ui/tabs/DashboardPanel.tsx
  - src/ui/tabs/tab-registry.ts
  - src/ui/tabs/tab-registry.test.ts
  - src/ui/shell/TabRail.tsx
  - src/ui/shell/TabPanel.tsx
  - src/ui/shell/PlaceholderPanel.tsx
  - src/App.tsx
  # deleted by Task 6
  - src/ui/tabs/JobPanel.tsx
autonomous: false

requirements:
  - DASH-01
  - DASH-03
  - SCENE-04
  - SIM-05

estimate:
  tokens: 435000
  raw_tokens: 200000
  tasks: 7
  confidence: low

must_haves:
  truths:
    - "U-1: Typing a joint angle that lands the arm in a wrist/shoulder/elbow singularity does NOT move the robot — the commanded pose is refused."
    - "U-2: Typing a joint angle or rail position that would drive any part of the arm through the workbench, below the floor, or into the rail/carriage hardware does NOT move the robot — the commanded pose is refused."
    - "U-3: When a manual entry is refused, a visible error message appears in the Dashboard panel and the field snaps back to the value the robot is actually holding, with the robot never having visibly moved."
    - "U-3: The next accepted manual entry clears that error message."
    - "U-3: Out-of-range ordinary numbers (e.g. 600 into a ±360 joint field) still clamp silently to the joint/rail limit exactly as before — clamping is not an error."
    - "U-3: g-code playback still runs, scrubs, and passes through singular configurations exactly as before — the new guard never touches the trajectory path."
    - "U-4: Driving the rail to −1500 mm and +1500 mm leaves the carriage and the robot standing clearly on top of the visible rail track with margin to spare at both ends."
    - "U-4: The rail's logical travel range is still exactly ±1.5 m."
    - "U-5: Printing and Milling are a compact toggle near the top of the 3D view, not left-rail tabs, and selecting either no longer opens a wide docked side panel."
    - "U-5: The per-mode .gcode upload button is present in that compact top area, still independent per mode, and the bundled sample still auto-loads per mode on mount and on mode change."
    - "U-5: The scrub bar still stays hidden until Play is pressed and the Play button is still the enlarged centred control."
  artifacts:
    - src/collision/pose-collision.ts
    - src/collision/manual-pose-safety.ts
    - src/ui/shell/ModeBar.tsx
    - src/ui/shell/shell-geometry.ts
  key_links:
    - "cellStore.setManualJointAngle / setManualRailPos -> validateManualPose -> (classifySingularity + classifyPoseCollision) — the ONLY gate; compile.ts must reach none of it."
    - "classifyPoseCollision -> forwardKinematics(joints, railPos - RAIL_CENTER_X).frames -> dhFrameToScene(..., ROBOT_MOUNT_WORLD) — the one existing, already-proven world-space composition, reused not reinvented."
    - "cellStore.manualJogError -> DashboardPanel error row; NumberField's existing onBlur snap-back is the revert."
    - "RailRig.TRACK_OVERHANG -> TRACK_LENGTH -> RIG_FOOTPRINT_WIDTH (floor grows by derivation, not by a second edit)."
    - "uiShellStore.activeTab (now nullable) -> shellContentLeft() -> App.tsx overlay column + ModeBar left offset (one shared derivation, no drift)."
---

<objective>
Close five real gaps the user found while testing quick task 260816-m6d:

1. **U-1** — manual joint control must refuse singular poses (`classifySingularity` exists since Phase 3 but gates nothing).
2. **U-2** — manual joint/rail control must refuse poses that pass through the workbench, the floor, or the rail/carriage hardware. There is NO collision detection anywhere in this codebase today; this plan adds the first one, as a pure, unit-tested, framework-free module.
3. **U-3** — on refusal, show an error and leave the last valid pose in place (revert), reusing `NumberField`'s existing blur snap-back. Range clamping keeps working unchanged. The g-code/toolpath playback path is deliberately NOT gated.
4. **U-4** — the rail's 3D model is visually too short for its ±1500 mm travel; grow the cosmetic track length generously. `RAIL_TRAVEL` itself does not change.
5. **U-5** — revert Printing/Milling from left-rail tabs + wide docked panel back to a compact top mode toggle (the equivalent of the deleted `ModeBar.tsx`), moving the per-mode upload button into it. Presentation only — every behaviour gained in 260816-m6d keeps working.

Purpose: the manual-control surface built in 260816-m6d is currently able to command physically impossible poses, and the reworked navigation cost the app its full-width 3D scene. Both are visible in the first 30 seconds of a demo.

Output: a new `src/collision/` module pair (geometry + verdict), a validated `manualJog` commit path in `cellStore`, a longer rail track mesh, a restored `ModeBar.tsx`, and a single-tab (toggleable) rail.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260816-m6d-dashboard-rework-manual-joint-rail-contr/260816-m6d-SUMMARY.md

# The exact world-space composition the collision check must reuse (do NOT re-derive):
@src/trajectory/compile.ts
@src/gcode/toolpath-anchor.ts
@src/kinematics/forward-kinematics.ts
@src/kinematics/singularity.ts

# The surfaces being changed:
@src/scene/RailRig.tsx
@src/scene/Workbench.tsx
@src/store/cellStore.ts
@src/ui/tabs/DashboardPanel.tsx
</context>

<interface_context>
**Already proven, reuse verbatim — this planning session re-ran the math and confirmed it:**

```
worldPoint(frame_i) = dhFrameToScene(
  { x: frames[i][0][3], y: frames[i][1][3], z: frames[i][2][3] },
  ROBOT_MOUNT_WORLD,
)
where frames = forwardKinematics(joints, railPos - RAIL_CENTER_X).frames
      dhFrameToScene(dh, m) = [dh.x + m.x, dh.z + m.y, m.z - dh.y]   (src/trajectory/compile.ts)
      ROBOT_MOUNT_WORLD     = { x: RAIL_CENTER_X, y: CARRIAGE_TOP_Y, z: RIG_Z_OFFSET }
```

Cross-check that fixes this composition (recomputed this session, agrees to 4 dp with the value
already documented in `toolpath-anchor.ts`): `UR3E_READY_POSE` at `railPos = RAIL_CENTER_X`
puts frame 6 at world `(-0.1839, 0.8263, 0.6310)`.

Do NOT apply `toUrdfJointAngles` inside the collision module. That +π offset is a *render*
hand-off correction for `urdf-loader`'s `setJointValue`; `forwardKinematics` is already in the
DH/controller frame that `dhFrameToScene` inverts, and `compile.ts` proves the round trip.

Scene numbers this session computed from the real constants (use as test anchors, but derive
them in code from the imported constants — never retype them as literals):
| Quantity | Value (m) |
|---|---|
| `CARRIAGE_TOP_Y` | 0.1900 |
| `CARRIAGE_FRONT_FACE_Z` | 0.6900 |
| `WORKBENCH_TOP_Y` | 0.4131 |
| `TOOLPATH_ANCHOR_OFFSET.z` | 0.8100 |
| workbench Z span | 0.7100 … 0.9600 |
| `UR3E_PARKED_POSE` lowest world keypoint Y | 0.2365 |

`UR3E_PARKED_POSE` was verified this session to be BOTH non-singular AND collision-free at
`railPos ∈ {RAIL_CENTER_X, railStartXForMode('printing'), railStartXForMode('milling'), RAIL_TRAVEL.max}`.
That is load-bearing: it is the seed `setManualJointAngle`/`setManualRailPos` fall back to, so if
it were rejected the whole manual-control surface would be dead on arrival.
</interface_context>

<source_coverage_audit>
| Source | Item | Covered by |
|---|---|---|
| GOAL | Manual control cannot command physically impossible poses | Tasks 2, 3, 4 |
| GOAL | Rail model matches its stated travel | Task 1 |
| GOAL | Printing/Milling back to a compact top toggle | Task 6 |
| REQ | DASH-01 (live joint angles surface) | Tasks 4, 5 |
| REQ | DASH-03 (rail position / remaining travel) | Tasks 1, 4 |
| REQ | SCENE-04 (robot rendered at a correct pose incl. 7th axis) | Tasks 1, 2 |
| REQ | SIM-05 (pause/scrub playback) — regression guard only | Tasks 4, 7 |
| USER | U-1 singularity gate | Task 3 (verdict), Task 4 (wiring) |
| USER | U-2 table/floor/rail collision limiting | Task 2 (geometry), Task 4 (wiring) |
| USER | U-3 error + revert to last valid, clamp unchanged, playback untouched | Tasks 4, 5 |
| USER | U-4 rail model length | Task 1 |
| USER | U-5 compact top toggle, upload relocated, behaviour preserved | Task 6 |
| RESEARCH | n/a — no research phase for this quick task (per constraints) | — |

No unplanned items. No deferred items. No package-manager installs in this plan.
</source_coverage_audit>

<tasks>

<task type="auto">
  <name>Task 1: Grow the rail track's visual length to genuinely carry the carriage at ±1500 mm (U-4)</name>
  <files>src/scene/RailRig.tsx, src/scene/rail-rig-geometry.test.ts</files>
  <read_first>src/scene/RailRig.tsx, src/kinematics/rail.ts</read_first>
  <action>
Per U-4. In `src/scene/RailRig.tsx`, replace the bare `TRACK_OVERHANG = 0.15` literal with a
derivation that is self-documenting and cannot silently regress:

- Add `const TRACK_END_MARGIN = 0.3` — a named, chosen cosmetic margin (state in its comment
  that it is a chosen figure for visual comfort, not a sourced hardware spec, matching the
  honesty convention `rail.ts` and `singularity.ts` already apply to their own chosen constants).
- Redefine `TRACK_OVERHANG` as `CARRIAGE_BASE_WIDTH / 2 + TRACK_END_MARGIN`, so the track always
  extends past each travel limit by the carriage's own half-footprint plus real margin. Move
  `CARRIAGE_BASE_WIDTH`'s declaration above `TRACK_OVERHANG` if the current ordering requires it.
- Update `TRACK_OVERHANG`'s comment: it no longer exists so the end-stop blocks sit on the rail
  ends; it now exists so the carriage AND the robot standing on it are clearly still over the
  visible track at both travel extremes. The end-stop blocks stay exactly where they are, at
  `RAIL_TRAVEL.min` / `RAIL_TRAVEL.max` — the track now visibly continues past them, which is
  how real linear-rail hardware reads.
- `TRACK_LENGTH`'s existing derivation is unchanged in form; it simply grows. `RIG_FOOTPRINT_WIDTH`
  and therefore `CellScene.tsx`'s floor plane grow with it BY DERIVATION — do not edit `CellScene.tsx`.
- `RAIL_TRAVEL` in `src/kinematics/rail.ts` must NOT be touched. Nothing about the logical ±1.5 m
  travel range changes.

Also export the geometry the collision module (Task 2) needs, following this file's existing
"exported so X can derive instead of restating" convention already used for `CARRIAGE_TOP_Y` /
`CARRIAGE_BASE_DEPTH`: export `RAIL_PROFILE_WIDTH`, `RAIL_PROFILE_HEIGHT`, `RAIL_GAP`,
`TRACK_OVERHANG`, `TRACK_END_MARGIN`, `END_STOP_WIDTH`, `END_STOP_HEIGHT`, `END_STOP_DEPTH`,
`CARRIAGE_BASE_WIDTH`. Add a short note on the export block that these exist so a single
geometry source feeds both the rendered mesh and the pose-collision envelope.

Create `src/scene/rail-rig-geometry.test.ts` (Vitest, node env, same import-a-tsx-module pattern
`src/gcode/toolpath-anchor.test.ts` already relies on) asserting:
  1. `RAIL_TRAVEL.min === -1.5` and `RAIL_TRAVEL.max === 1.5` — the travel spec did not move.
  2. `TRACK_LENGTH / 2 - RAIL_TRAVEL.max >= CARRIAGE_BASE_WIDTH / 2 + TRACK_END_MARGIN` — at the
     travel extreme the carriage's outer edge still has at least `TRACK_END_MARGIN` of track under it.
  3. `TRACK_END_MARGIN >= 0.25` — the margin is generous, not the bare minimum U-4 rejected.
  4. `TRACK_LENGTH > RAIL_TRAVEL.max - RAIL_TRAVEL.min + 2 * (CARRIAGE_BASE_WIDTH / 2)` — strictly
     longer than the "carriage only just fits" case that produced the reported defect.
  5. `RIG_FOOTPRINT_WIDTH > TRACK_LENGTH` — the floor still fully contains the track.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx vitest run src/scene/rail-rig-geometry.test.ts src/gcode/toolpath-anchor.test.ts src/scene/camera-fit-origin.test.ts</automated>
  </verify>
  <done>The new geometry test passes; `RAIL_TRAVEL` is byte-identical to before; `TRACK_LENGTH` is measurably longer than the old `3.3 m`; the toolpath-anchor and camera-fit suites still pass unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: New pure collision module — world-space keypoints vs floor / workbench / rig AABBs (U-2)</name>
  <files>src/collision/pose-collision.ts, src/collision/pose-collision.test.ts, src/collision/index.ts, src/gcode/toolpath-anchor.ts, src/scene/Workbench.tsx</files>
  <read_first>src/trajectory/compile.ts, src/gcode/toolpath-anchor.ts, src/scene/Workbench.tsx, src/kinematics/singularity.ts</read_first>
  <behavior>
    - `UR3E_PARKED_POSE` is collision-free at `RAIL_CENTER_X`, at both `railStartXForMode` stations, and at `RAIL_TRAVEL.max` (this is the seed pose — if it fails, the feature is dead).
    - A pose whose keypoints drop below the floor plane reports `floor: true`.
    - A pose whose keypoints enter the workbench slab's footprint below its top surface reports `workbench: true`; a keypoint resting exactly AT `WORKBENCH_TOP_Y` does NOT.
    - A pose whose keypoints enter the carriage/rail-track/end-stop envelope reports `rig: true`.
    - `any` is the OR of the three, mirroring `SingularityFlags.any`.
    - `poseKeypointsWorld` returns a deterministic point count and its first point is frame 1's own world origin, which is invariant to every joint angle except the rail position.
    - Frame 6 of `UR3E_READY_POSE` at `RAIL_CENTER_X` lands at world `(-0.1839, 0.8263, 0.6310)` to 4 dp — the composition anchor.
  </behavior>
  <action>
Per U-2. FIRST move the workbench footprint constants so the collision module never has to import
a React component for them, and so there is exactly one derivation of the bench footprint:

- In `src/gcode/toolpath-anchor.ts`, BELOW `TOOLPATH_ANCHOR_OFFSET`, add and export
  `WORKBENCH_WIDTH_X`, `WORKBENCH_THICKNESS_Y`, `WORKBENCH_NEAR_Z`, `WORKBENCH_FAR_Z`, carrying
  over verbatim the derivations currently private to `src/scene/Workbench.tsx`
  (`TABLETOP_WIDTH`, `TABLETOP_THICKNESS`, `CARRIAGE_FRONT_FACE_Z + NEAR_EDGE_STANDOFF`,
  `TOOLPATH_ANCHOR_OFFSET.z + FAR_EDGE_PAD`) along with the standoff/pad constants they need.
  Keep every existing comment's intent; note that these moved here because both the rendered
  bench and the pose-collision envelope must read one footprint.
- Rewrite `src/scene/Workbench.tsx` to import those four values instead of declaring its own,
  deriving its remaining locals (`TABLETOP_DEPTH`, `TABLETOP_CENTER_Z`, `TABLETOP_CENTER_Y`, leg
  geometry) from them. The rendered bench must be pixel-identical — this is a move, not a redesign.

THEN create `src/collision/pose-collision.ts`. Write the test file first and commit it failing,
mirroring the RED→GREEN discipline `joint-clamp.test.ts` / `manual-jog.test.ts` established.

Module contract (framework-free: no React, no three.js, no urdf-loader, no store import —
`singularity.ts`'s own discipline):

- `export const COLLISION_LINK_RADIUS_M = 0.04` — chosen effective half-thickness of a UR3e link,
  a heuristic for a pragmatic keypoint test, explicitly NOT a datasheet value (say so in the comment,
  matching `SINGULARITY_ANGLE_EPSILON`'s honesty).
- `export const COLLISION_LINK_SUBDIVISIONS = 6` — interpolated samples per inter-frame segment,
  so a long link cannot straddle an obstacle with both its endpoints clear.
- `export const FLOOR_CLEARANCE_EPSILON_M = 0.005` and `export const WORKBENCH_PENETRATION_EPSILON_M = 0.005`.
- `export interface CollisionFlags { floor: boolean; workbench: boolean; rig: boolean; any: boolean }`
  — deliberately the same shape as `SingularityFlags`.
- `export function poseKeypointsWorld(joints: JointAngles, railPos: number): [number, number, number][]`
  Builds the six frame origins via `forwardKinematics(joints, railPos - RAIL_CENTER_X).frames`, maps
  each through `dhFrameToScene(..., ROBOT_MOUNT_WORLD)` imported from `src/trajectory/compile.ts`
  (import it, do NOT restate the three-line conversion), then emits, for each of the five
  consecutive-frame segments, `COLLISION_LINK_SUBDIVISIONS` points from the segment start inclusive,
  finishing with frame 6's own origin — 31 points total.
  It deliberately STARTS at frame 1 and never includes the mount point itself: the robot's base is
  bolted onto the carriage, so a chain that began at the mount would report a permanent collision
  with the hardware it is mounted on. Document that in the function's comment.
- `export function classifyPoseCollision(joints: JointAngles, railPos: number, workbenchX: number): CollisionFlags`
  Tests every keypoint against:
    * floor — hit when `y &lt; COLLISION_LINK_RADIUS_M - FLOOR_CLEARANCE_EPSILON_M`.
    * workbench slab — an AABB at `x ∈ workbenchX ± WORKBENCH_WIDTH_X / 2`,
      `z ∈ [WORKBENCH_NEAR_Z, WORKBENCH_FAR_Z]`, `y ∈ [0, WORKBENCH_TOP_Y]`, deliberately solid all
      the way to the floor (conservative: it swallows the legs and the under-table volume rather
      than modelling four thin posts — say so in the comment). X and Z faces are inflated by
      `COLLISION_LINK_RADIUS_M`; the TOP face is not inflated and instead requires penetration of
      more than `WORKBENCH_PENETRATION_EPSILON_M` below `WORKBENCH_TOP_Y`, so a flange resting on
      the bench surface is not a collision while an arm passing through the slab is.
    * rig — the union of three inflated AABBs: the rail track
      (`x ∈ RAIL_CENTER_X ± TRACK_LENGTH / 2`, `y ∈ [0, RAIL_PROFILE_HEIGHT]`,
      `z ∈ RIG_Z_OFFSET ± (RAIL_GAP / 2 + RAIL_PROFILE_WIDTH / 2)`); the two end-stop blocks at
      `RAIL_TRAVEL.min` / `.max` (`x ± END_STOP_WIDTH / 2`, `y ∈ [0, RAIL_PROFILE_HEIGHT + END_STOP_HEIGHT]`,
      `z ∈ RIG_Z_OFFSET ± END_STOP_DEPTH / 2`); and the carriage, which MOVES with the commanded
      rail position (`x ∈ railPos ± CARRIAGE_BASE_WIDTH / 2`, `y ∈ [0, CARRIAGE_TOP_Y]`,
      `z ∈ RIG_Z_OFFSET ± CARRIAGE_BASE_DEPTH / 2`).
  Every dimension above is IMPORTED from `src/scene/RailRig.tsx` (exported in Task 1) and
  `src/gcode/toolpath-anchor.ts` — no number in this module may be a retyped scene literal. Note in
  the header that importing `RailRig.tsx` for geometry constants is the precedent
  `src/gcode/toolpath-anchor.ts` already set, not a new coupling.
- `src/collision/index.ts` — a barrel re-exporting the public surface, mirroring `src/kinematics/index.ts`.

Test file `src/collision/pose-collision.test.ts` covers every bullet in `&lt;behavior&gt;` above plus:
keypoint count is exactly `5 * COLLISION_LINK_SUBDIVISIONS + 1`; frame-1 world origin is invariant
across three wildly different joint tuples at a fixed rail position and shifts by exactly the rail
delta when the rail moves; and a table-penetrating pose is reported `workbench: true` while the same
pose lifted above `WORKBENCH_TOP_Y` is clean. Derive expected values from the imported constants,
never from retyped literals (the anchor table in `&lt;interface_context&gt;` is for sanity-checking your
output, not for pasting into assertions).
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx vitest run src/collision/pose-collision.test.ts src/gcode/toolpath-anchor.test.ts</automated>
  </verify>
  <done>`classifyPoseCollision` reports all-false for `UR3E_PARKED_POSE` at all four tested rail positions, reports true for constructed floor/workbench/rig cases, and every dimension in the module traces to an imported constant. The rendered workbench is unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Compose singularity + collision into one manual-pose verdict with human copy (U-1, U-2, U-3)</name>
  <files>src/collision/manual-pose-safety.ts, src/collision/manual-pose-safety.test.ts, src/collision/index.ts, src/collision/playback-path-unguarded.test.ts</files>
  <read_first>src/kinematics/singularity.ts, src/ui/scene-status-copy.ts</read_first>
  <behavior>
    - A non-singular, collision-free pose returns `{ ok: true, reason: null, message: null }`.
    - A pose with `classifySingularity(...).elbow` returns `ok: false` and the elbow reason.
    - A pose that is both singular and colliding reports the SINGULARITY reason (singularity is checked first, deterministically).
    - Every reason code has non-empty copy, and no two reason codes share the same string.
    - `UR3E_PARKED_POSE` at every mode station returns `ok: true`.
    - An elbow angle of exactly `UR3E_JOINT_LIMITS[2].max` (= π) returns `ok: false` — the elbow's own travel limit IS the elbow singularity, so clamping to it produces a refused pose.
  </behavior>
  <action>
Per U-1 and U-3. Create `src/collision/manual-pose-safety.ts` — pure, framework-free, test-first.

- `export type ManualPoseRejectionReason = 'singular-wrist' | 'singular-shoulder' | 'singular-elbow' | 'collision-floor' | 'collision-workbench' | 'collision-rig'`
- `export const MANUAL_POSE_REJECTION_COPY: Record<ManualPoseRejectionReason, string>` — one short,
  plain-language sentence per reason, each stating both what was refused and that the last valid
  position was kept. Keep the copy in this module rather than in `src/ui/`: the store is the writer
  of the resulting message and must not import upward from the UI layer. Note that rationale in the
  file header, alongside the precedent that `src/ui/scene-status-copy.ts` sets for centralising
  user-facing strings in one tested place.
- `export interface ManualPoseVerdict { ok: boolean; reason: ManualPoseRejectionReason | null; message: string | null }`
- `export function validateManualPose(joints: JointAngles, railPos: number, workbenchX: number): ManualPoseVerdict`
  Calls `classifySingularity(joints)` first and returns the wrist → shoulder → elbow reason in that
  fixed order; only if clean calls `classifyPoseCollision(joints, railPos, workbenchX)` and returns
  floor → workbench → rig in that fixed order. Fixed precedence so the message a user sees for a
  given entry is deterministic across runs.

Re-export the new surface from `src/collision/index.ts`.

Also add `src/collision/playback-path-unguarded.test.ts` — the structural guard that this gate never
leaks onto the g-code path. Following `src/scene/cell-scene-order.test.ts`'s existing
read-the-source-from-disk-with-node:fs pattern, read `src/trajectory/compile.ts` and
`src/scene/RobotPose.tsx` and assert neither file's source contains an import from the new
collision directory. Explain in the test's header that Phase 3 deliberately lets compiled samples
pass through singular configurations and already has its own separately-fixed table-clearance
travel move, so hard-blocking there would regress already-human-verified playback.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx vitest run src/collision/</automated>
  </verify>
  <done>`validateManualPose` returns ok for the parked pose at every station, returns a distinct, non-empty message for each of the six reasons, resolves singularity before collision, and the structural guard proves the trajectory/playback path imports nothing from `src/collision/`.</done>
</task>

<task type="auto">
  <name>Task 4: Gate cellStore's manual-jog commits behind the verdict, add manualJogError (U-1, U-2, U-3)</name>
  <files>src/store/cellStore.ts, src/store/cellStore.test.ts</files>
  <read_first>src/store/cellStore.ts, src/store/cellStore.test.ts, src/gcode/toolpath-anchor.ts</read_first>
  <action>
Per U-3. Add a validation layer ON TOP of the existing clamping in `src/store/cellStore.ts` —
`clampJointAngle` / `clampRailPosition` behaviour is unchanged and stays where it is.

- Add `manualJogError: string | null` to `CellState`, initialised `null`, with a doc comment
  stating: it holds the message for the most recent REFUSED manual entry; it is cleared by the next
  accepted commit and by `clearManualJog`; it is a human-cadence field, not a per-frame value, so it
  belongs in this store under the file header's own rule.
- Inside the store factory (next to `loadJobSource`), add a private
  `commitManualJog(next: { joints: JointAngles; railPos: number })` helper. It resolves the bench's
  current station as `toolpathAnchorForMode(useUiShellStore.getState().cellMode).x` — read via
  `getState()`, never a subscription, exactly as `loadJobSource` already reads `cellMode` — then
  calls `validateManualPose(next.joints, next.railPos, workbenchX)`.
    * verdict not ok → `set({ manualJogError: verdict.message })` and RETURN. `manualJog` is not
      written at all, so the previously committed pose survives untouched and every subscriber
      (`RobotPose`, `CellScene`'s rail selector, `DashboardPanel`'s value props) keeps reading the
      last valid pose. This is the whole revert mechanism — nothing else reverts anything.
    * verdict ok → `set({ manualJog: next, manualJogError: null })`.
- `setManualJointAngle` and `setManualRailPos` keep their existing seeding and clamping verbatim and
  then hand the clamped candidate to `commitManualJog` instead of calling `set` themselves.
- `clearManualJog` must also drop the error, while staying a strict no-op when there is nothing to
  clear (an existing test asserts the state object is referentially identical after a redundant
  call): guard on `manualJog !== null || manualJogError !== null` before the single
  `set({ manualJog: null, manualJogError: null })`.
- Nothing else changes. `loadJobSource`'s branches already call `clearManualJog()`, so a new job
  clears the error for free; `play()` already calls it too.

Then update `src/store/cellStore.test.ts`. This planning session ran the new guard against the
existing manual-jog suite; exactly two cases change outcome, and both change for a correct reason:

  1. `"setManualJointAngle honours the elbow's narrower limit (index 2)"` — clamping 4 rad onto
     `UR3E_JOINT_LIMITS[2].max` (= π) lands exactly on the elbow singularity, so the commit is now
     refused. Rewrite this case to assert the new, more interesting truth: the elbow clamp still
     produces the limit value at the clamp layer (that coverage already lives in
     `joint-clamp.test.ts`), and the STORE now leaves `manualJog` untouched while setting a
     non-null `manualJogError` — with a comment explaining that the elbow's mechanical travel limit
     and the elbow singularity coincide, so this is expected, not a regression.
  2. `"each setter produces a new tuple reference on every call"` — its second write,
     `setManualJointAngle(1, 0.2)`, drives the arm into the floor and the carriage and is now
     refused. Change that second write to a geometrically inert one — `setManualJointAngle(5, 0.2)`
     (wrist_3 rotates about its own tool axis and moves no frame origin) — and additionally assert
     `manualJogError` is `null` afterwards, so the test proves the call was accepted rather than
     silently swallowed.

The other four existing manual-jog cases were verified to still pass unchanged
(`setManualJointAngle(0, 10)` → 2π, `setManualJointAngle(0, 0.1)`, `setManualRailPos(99)` → 1.5,
and the `clearManualJog` no-op). Do not weaken them. Extend the `beforeEach` to also reset
`manualJogError: null`.

Add new cases:
  - `manualJogError` starts `null`.
  - A refused commit leaves `manualJog` referentially identical to what it was before the call.
  - A refused commit sets a non-empty `manualJogError`.
  - The next accepted commit clears `manualJogError` back to `null`.
  - `clearManualJog()` clears a set `manualJogError`.
  - `play()` clears a set `manualJogError` (it already routes through `clearManualJog`).
  - Ordinary out-of-range input that clamps to a still-valid pose leaves `manualJogError` `null` —
    clamping is not an error.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx vitest run src/store/ src/collision/ &amp;&amp; npx tsc -b</automated>
  </verify>
  <done>Refused entries never write `manualJog`; accepted entries clear the error; every pre-existing clamping assertion still holds except the two documented cases, which now assert the correct new behaviour; `tsc -b` is clean.</done>
</task>

<task type="auto">
  <name>Task 5: Surface the rejection in the Dashboard and make the field revert observable (U-3)</name>
  <files>src/ui/tabs/DashboardPanel.tsx</files>
  <read_first>src/ui/tabs/DashboardPanel.tsx, src/index.css</read_first>
  <action>
Per U-3. Two changes in `src/ui/tabs/DashboardPanel.tsx`, no new component files.

(a) Error surface. Subscribe `manualJogError` with a single-field selector alongside the existing
ones and render, as the FIRST child inside `PanelShell` (above both `PanelSection`s so it can never
be scrolled out of sight while a field is focused), a `role="alert"` row that renders
`manualJogError` verbatim when it is non-null and nothing at all when it is null. Style it from the
existing token vocabulary only: `var(--ui-destructive)` for the text colour (declared in
`src/index.css` and reserved as distinct from `--ui-accent`), `var(--text-label)` /
`var(--leading-label)` for type, `var(--space-sm)` padding, `8px` radius and a
`1px solid var(--ui-border)` edge on `var(--ui-surface-raised)` — matching `inputStyle`'s own
surface treatment. Declare it as a module-scope `CSSProperties` object like every other style in
this file. Do not introduce a new colour.

(b) Make the revert actually observable. `NumberField` currently dispatches `onCommit` on EVERY
keystroke, so typing toward a refused value commits the partial values along the way and the field
snaps back on blur to whichever partial was last accepted — not to the value the user started from.
Move the commit to blur and Enter:
  - `onChange` updates the local `draft` only (no `onCommit`).
  - `onBlur` parses `draft` via the existing `parseNumericInput`; when it parses, call `onCommit`
    once; then, unconditionally and after that call, reset `draft` from the `value` prop, which is
    the existing snap-back and is now also the revert — a refused commit leaves `value` unchanged,
    so the field returns to the pose the robot is actually holding.
  - `onKeyDown` for `Enter` calls `event.currentTarget.blur()` so Enter routes through the exact
    same single path rather than duplicating it.
Keep the input controlled by `draft`, keep the existing `aria-label`, `min`/`max` hint row, unit
span and `type="number"`. Update `NumberField`'s doc comment to state the commit cadence and why
it changed: committing per keystroke both flung the arm through every partial value and made
"revert to the last valid position" unobservable. Do NOT add a revert token, a second draft-sync
effect, or any other new revert mechanism — the blur snap-back is the one mechanism.

Leave the "Manual command is currently overriding playback." row and the "Return to toolpath"
button exactly as they are; the latter already routes through `clearManualJog`, which now also
clears the error.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; npx tsc -b &amp;&amp; npx vitest run</automated>
  </verify>
  <done>The Dashboard renders a destructive-toned alert row only while `manualJogError` is set; each joint/rail field commits exactly once per blur or Enter and snaps its text back to the store's value afterwards; the full suite is green.</done>
</task>

<task type="auto">
  <name>Task 6: Restore the compact Printing/Milling top toggle, relocate the upload, free the 3D scene (U-5)</name>
  <files>src/ui/shell/ModeBar.tsx, src/ui/shell/shell-geometry.ts, src/ui/shell/shell-geometry.test.ts, src/ui/tabs/tab-registry.ts, src/ui/tabs/tab-registry.test.ts, src/ui/shell/TabRail.tsx, src/ui/shell/TabPanel.tsx, src/ui/shell/PlaceholderPanel.tsx, src/store/uiShellStore.ts, src/App.tsx, src/ui/tabs/JobPanel.tsx</files>
  <read_first>src/ui/tabs/JobPanel.tsx, src/ui/shell/TabRail.tsx, src/ui/shell/TabPanel.tsx, src/store/uiShellStore.ts, src/App.tsx, src/ui/useModeJobSync.ts</read_first>
  <action>
Per U-5 — a presentation-layer reversion. Every behaviour gained in 260816-m6d must still work:
per-mode upload (`uploadedJobs`, `loadUploadedGcode`, `clearUploadedJob`), auto-load-on-mount and
on-mode-change (`useModeJobSync`), and the `playbackStarted`-gated scrub bar plus enlarged Play
button. `src/ui/useModeJobSync.ts`, `src/ui/SampleSelect.tsx`, `src/ui/PlaybackControl.tsx` and
`src/ui/ScrubControl.tsx` are NOT modified by this task.

The prior `ModeBar.tsx` is recoverable for reference at `git show ac0b1a1^:src/ui/shell/ModeBar.tsx`
— read it for its container/segment styling, then rebuild rather than restoring blind (it carried a
`PhaseNote` footer that 260816-m6d deliberately removed app-wide; that must not come back).

1. **Shared shell geometry.** Create `src/ui/shell/shell-geometry.ts` exporting
   `shellContentLeft(panelOpen: boolean): string`, returning
   `calc(var(--shell-rail-width) + var(--shell-panel-width) + var(--space-lg))` when the docked panel
   is open and `calc(var(--shell-rail-width) + var(--space-lg))` when it is not. Both the new
   `ModeBar` and `App.tsx`'s bottom-left overlay column consume it, so the two offsets can never
   drift — the same single-source discipline `tab-registry.ts` applies to the tab set. Add
   `shell-geometry.test.ts` asserting the two strings differ, that both reference the rail width
   token, and that only the open form references the panel width token.

2. **`src/ui/shell/ModeBar.tsx` (new).** A compact fixed overlay pinned near the TOP of the 3D view
   at `top: var(--space-lg)`, `left: shellContentLeft(panelOpen)`, `zIndex: 2`, on
   `var(--ui-surface)` with a `1px solid var(--ui-border)` edge and `8px` radius — the same chrome
   treatment the prior bar used. It contains, laid out compactly:
     - A Printing/Milling segmented control (`role="tablist"`, one `role="tab"` button each with
       `aria-selected`), reading `cellMode` and dispatching `setCellMode` from `useUiShellStore`.
       Reuse the prior bar's selected/unselected segment styling (`--ui-accent` /
       `--ui-accent-fg` for the selected segment, `--ui-surface-raised` / `--ui-fg-muted` otherwise).
     - The mounted-tool chip, moving `MOUNTED_TOOL_LABEL` over from `JobPanel.tsx` unchanged.
     - The per-mode job controls, moved wholesale out of `JobPanel.tsx` for the CURRENT `cellMode`:
       the loaded-job label (uploaded filename, else `samplesForMode(mode)[0].label`, else an
       em dash), the visually-hidden `<input type="file">` + its ref-triggered "Upload .gcode"
       button, the conditional "Use bundled sample" button, and the `toolpathLoadStatus === 'error'`
       status line including the `MAX_UPLOAD_BYTES` over-size message. Carry over the
       `event.target.value = ''` reset and the `lastUploadTooLarge` local state verbatim — those are
       real behaviours, not styling. Keep it compact: a single row of controls plus a status line,
       not a stacked panel.
     - No `PhaseNote`, no roadmap-phase text of any kind.
   It reads `panelOpen` from `useUiShellStore`'s `activeTab` so it shifts with the docked panel.

3. **`src/ui/tabs/tab-registry.ts`.** `export type TabId = 'dashboard'`; `TAB_DEFS` becomes the
   single `{ id: 'dashboard', label: 'Dashboard' }`; `DEFAULT_TAB_ID` stays `'dashboard'` as the id
   the rail's one button dispatches. Delete `cellModeForTab` — with no mode tabs left there is no
   tab/mode correspondence to record, and `ModeBar` is once again the sole mode dispatcher. Rewrite
   the file header to state that the rail is now a single toggleable Dashboard entry and that
   Printing/Milling moved back to the compact top bar.

4. **`src/store/uiShellStore.ts`.** Make the panel closable so the 3D scene is full width by
   default: `activeTab: TabId | null`, initialised to `null`; `setActiveTab(id: TabId)` toggles —
   selecting the already-active tab sets `null`. Remove the `cellModeForTab` coupling added in
   260816-m6d and restore `setCellMode` as the mode dispatcher `ModeBar` calls. Document the
   decision in the store's header: with Printing/Milling no longer tabs, a permanently-docked
   single-tab panel would keep eating scene width for no navigational reason, so the one remaining
   tab is a toggle and the app opens on the full-width scene.

5. **`src/ui/shell/TabPanel.tsx`.** `PANELS: Record<TabId, ComponentType> = { dashboard: DashboardPanel }`.
   Return `null` when `activeTab === null` so the docked container is not rendered at all. Drop the
   `PrintingPanel`/`MillingPanel` wrappers and the `JobPanel` import.

6. **`src/ui/shell/TabRail.tsx`.** `TAB_ICONS: Record<TabId, LucideIcon> = { dashboard: LayoutDashboard }`.
   Drop the printer/drill icon imports. Give the button toggle semantics (`aria-pressed` reflecting
   whether the panel is open) in place of `aria-current`, and keep the active indicator bar bound to
   the open state.

7. **`src/App.tsx`.** Mount `<ModeBar />` after `<TabPanel />`. Replace the bottom-left overlay
   column's hardcoded `left` string with `shellContentLeft(panelOpen)`, reading `activeTab` from
   `useUiShellStore`. Everything else in `App.tsx` — `useModeJobSync()`, `playbackStarted &&
   <ScrubControl />`, `SampleSelect`, `PlaybackControl`, `ResetViewButton` — is untouched.

8. **Delete `src/ui/tabs/JobPanel.tsx`** once its contents live in `ModeBar.tsx`.

9. **`src/ui/shell/PlaceholderPanel.tsx`.** Comment-only: it now backs one panel, not three.

10. **`src/ui/tabs/tab-registry.test.ts`.** Update to the single-entry registry: exactly one entry,
    id `'dashboard'`, non-empty label, `DEFAULT_TAB_ID` present in the registry, and the
    every-id-has-a-panel / no-orphan-`PANELS`-key gate preserved. Remove the `cellModeForTab`
    describe block. Add a case asserting `TAB_DEFS` contains neither of the two cell-mode ids, so a
    future edit cannot quietly reintroduce mode tabs.
  </action>
  <verify>
    <automated>cd "C:/Users/munte/Claude Projects/Interface" &amp;&amp; test ! -f src/ui/tabs/JobPanel.tsx &amp;&amp; test -f src/ui/shell/ModeBar.tsx &amp;&amp; npx tsc -b &amp;&amp; npx vitest run &amp;&amp; npm run build</automated>
  </verify>
  <done>`JobPanel.tsx` is gone and `ModeBar.tsx` exists; the tab rail carries one toggleable Dashboard entry; the app opens with no docked panel and a full-width scene; type-check, full test suite and production build are all clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Live browser sign-off on rail length, manual-jog rejection/revert, playback, and layout</name>
  <what-built>
Manual-control safety (singularity + collision rejection with error and revert), a longer rail
track model, and the Printing/Milling compact top toggle replacing the docked tab panel.

Automated coverage is in place (`npx vitest run`, `npx tsc -b`, `npm run build` all green), but the
prior quick task recorded that no browser automation exists in this environment — every visual and
interaction claim below is unverified until a human looks at it.
  </what-built>
  <how-to-verify>
Run `npm run dev` and open the printed URL, then check each item:

**U-4 rail model.** Open the Dashboard tab, type `-1500` into the rail Position field and press
Enter, then `1500`. At BOTH extremes the carriage and the robot standing on it must sit clearly on
top of the visible rail track with obvious track still showing beyond them — the reported symptom
was the robot's centre landing exactly where the rail model ended.

**U-1/U-2/U-3 manual safety.** With the Dashboard open, drive the Shoulder field progressively more
negative (e.g. −60, −120, −200, −250, −270). At some point an entry must be REFUSED: a red-toned
error message appears at the top of the Dashboard panel, the field snaps back to the previous
value, and the robot does not move at all. Then type a valid value — the error must disappear.
Separately, type `600` into the Base field: it must clamp silently to 360 with NO error (clamping
is not a rejection). Also try driving the Elbow to its maximum (`180`): that is expected to be
refused, because the elbow's travel limit coincides with the elbow singularity.

**U-3 playback untouched.** Press Play on the loaded sample and let it run, then scrub the timeline.
Playback must behave exactly as before — no new errors, no refusals, no stalls.

**U-5 layout.** On first load there must be NO wide docked side panel and the 3D scene must span the
full width right of the narrow icon rail. Printing/Milling must be a compact toggle near the top of
the scene, carrying the mounted-tool label AND the "Upload .gcode" button. Switching between them
must still auto-load each mode's job. Upload a .gcode on Printing, switch to Milling, switch back —
Printing must still show your uploaded file and Milling its own job. Clicking the Dashboard icon
opens the panel; clicking it again closes it and the scene goes full width.
  </how-to-verify>
  <resume-signal>Type "approved", or describe exactly which of the five checks failed and what you saw.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user keyboard → `cellStore` manual-jog setters | Arbitrary numeric text becomes a commanded robot pose |
| local file picker → `loadUploadedGcode` | Untrusted local file text enters the parser (pre-existing, relocated only) |
| scene geometry constants → collision envelope | A wrong constant silently produces false-negative safety verdicts |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-NUP-01 | Denial of Service | `NumberField` → `commitManualJog` (FK + 31-keypoint scan per commit) | low | mitigate | Task 5 moves commits to blur/Enter (one solve per committed entry, not per keystroke); keypoint count is a bounded `5 * COLLISION_LINK_SUBDIVISIONS + 1` constant, and `forwardKinematics` is closed-form with no iteration |
| T-NUP-02 | Tampering | `parseNumericInput` → `clampJointAngle` / `clampRailPosition` | medium | mitigate | Existing range clamp retained unchanged and now composed with `validateManualPose`, so no text input can produce an out-of-range OR physically impossible commanded pose |
| T-NUP-03 | Information Disclosure | `MANUAL_POSE_REJECTION_COPY` | low | accept | Copy states only which safety rule was hit; no internal paths, stack traces, or numeric internals are surfaced |
| T-NUP-04 | Spoofing (false safety) | `classifyPoseCollision` world composition | high | mitigate | Composition is imported from `dhFrameToScene`/`ROBOT_MOUNT_WORLD` rather than re-derived, anchored by a 4-dp regression assertion on `UR3E_READY_POSE`'s frame-6 world position, and every obstacle dimension traces to an imported scene constant (no retyped literals) |
| T-NUP-05 | Repudiation | refused commits leaving no trace | low | accept | `manualJogError` is transient by design (cleared on the next accepted commit); this is a simulation-only interview build with no audit requirement |
| T-NUP-06 | Elevation of Privilege | `src/collision/` reaching the g-code playback path | medium | mitigate | `playback-path-unguarded.test.ts` asserts from disk that `compile.ts` and `RobotPose.tsx` import nothing from `src/collision/` |
| T-NUP-SC | Tampering | npm/pip/cargo installs | n/a | accept | This plan installs no packages — no package-manager command runs in any task, so the package-legitimacy gate does not apply |
</threat_model>

<verification>
- `npx vitest run` — full suite green, including the 341 pre-existing tests plus the new
  `src/collision/`, `src/scene/rail-rig-geometry.test.ts` and `src/ui/shell/shell-geometry.test.ts` files.
- `npx tsc -b` — clean (the real build gate; bare `tsc --noEmit` checks nothing here, per STATE.md).
- `npm run build` — clean production build.
- `test ! -f src/ui/tabs/JobPanel.tsx` and `test -f src/ui/shell/ModeBar.tsx`.
- `grep -rn "Arrives in Phase" src/` — still no matches (the restored mode bar must not reintroduce
  the roadmap-phase footer the prior task removed).
- Human checkpoint (Task 7) — the only route by which any visual or interaction claim in this plan
  becomes verified; no browser automation exists in this environment.
</verification>

<success_criteria>
- A manual joint or rail entry that would produce a singular pose, or drive any sampled arm keypoint
  through the floor, the workbench slab, or the rail/carriage/end-stop envelope, never reaches
  `manualJog`; the robot does not move; a message appears; the field returns to the held value.
- Ordinary out-of-range numbers still clamp silently to the joint/rail limit with no error.
- `compileTrajectory` and `RobotPose` are byte-unchanged in behaviour and import nothing from
  `src/collision/`; playback and scrubbing still pass through singular configurations.
- `RAIL_TRAVEL` is unchanged at ±1.5 m while the rendered track extends past each limit by at least
  the carriage half-width plus `TRACK_END_MARGIN`.
- The tab rail carries one toggleable Dashboard entry; Printing/Milling are a compact top toggle
  carrying the per-mode upload; per-mode upload, auto-load-on-mode-change, the `playbackStarted`
  scrub gate and the enlarged Play button all still work.
- All three build/test gates pass and the human checkpoint is approved.
</success_criteria>

<output>
Create `.planning/quick/260816-nup-manual-control-safety-block-singular-col/260816-nup-SUMMARY.md` when done.
</output>
