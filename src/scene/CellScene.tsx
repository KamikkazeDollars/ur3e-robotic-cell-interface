import { DoubleSide } from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import NavCube from './NavCube'
import CameraResetListener from './CameraResetListener'
import ToolpathCameraFit from './ToolpathCameraFit'
import RailRig, { RIG_FOOTPRINT_WIDTH, RIG_FOOTPRINT_DEPTH, RIG_Z_OFFSET, FLOOR_Z_CENTER } from './RailRig'
import Workbench from './Workbench'
import Toolpath from './Toolpath'
import PlaybackTrail from './PlaybackTrail'
import ScrubMarker from './ScrubMarker'
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from './camera-defaults'
import { RAIL_CENTER_X } from '../kinematics'
import { useCellStore } from '../store/cellStore'
import { SCENE_PALETTE } from './scene-palette'
import usePlaybackClock from '../playback/usePlaybackClock'

/** Renders nothing — exists purely to run `usePlaybackClock`'s `useFrame`
 * side effect inside the `<Canvas>` tree (Phase 4, plan 04-01), the same
 * "renders nothing, drives per-frame state imperatively" tier `ScrubMarker`
 * occupies for its own mesh. */
function PlaybackClock() {
  usePlaybackClock()
  return null
}

// Canvas clear color and floor tone are read from SCENE_PALETTE — kept in
// sync with src/index.css by scene-palette.test.ts, not by hand, so the
// WebGL canvas and the surrounding page chrome can never silently drift
// apart (D-06).

/**
 * R3F Canvas composition root — the phase's "one real route" analogue.
 *
 * Composition order (per PATTERNS.md's definitive ordering, revised by gap
 * closure G-04-1's frame-order correction):
 *   PlaybackClock (plan 04-01, moved here by plan 04-04's frame-order
 *      correction) FIRST, immediately after PerspectiveCamera and ahead of
 *      every per-frame consumer of `livePlayback.fraction` — it WRITES that
 *      channel inside its own `useFrame`, and R3F runs frame callbacks in
 *      subscription order, which follows mount order. Mounting the writer
 *      first is what guarantees every reader (RobotPose inside RailRig,
 *      PlaybackTrail, ScrubMarker) observes the CURRENT frame's fraction
 *      rather than the previous frame's stale value. Renders nothing —
 *      exists purely to run usePlaybackClock's useFrame side effect. ->
 *   lights (ambient + directional) -> floor plane -> rail/robot mount point
 *   -> Workbench (plan 02-04, scene furniture the toolpath visually rests
 *      on — mounted between the rig and the toolpath) -> Toolpath (plan
 *      02-01, mounted after the workbench, before OrbitControls) ->
 *      PlaybackTrail (plan 04-04, gap closure G-04-1: the traversed-path
 *      highlight — mounted immediately after Toolpath since it overlays
 *      that same drawn line, before ScrubMarker) -> ScrubMarker (plan
 *      03-03, D-07 current-scrub-position indicator — mounted immediately
 *      after PlaybackTrail since it rides the same drawn line, still
 *      before OrbitControls) -> OrbitControls (makeDefault) -> NavCube ->
 *      CameraResetListener
 *   -> ToolpathCameraFit (plan 02-03, mounted after CameraResetListener —
 *      D-05's toolpath fit is a distinct behaviour from the Reset View
 *      default framing the listener restores)
 *
 * Do NOT "fix" a future re-ordering regression with `useFrame`'s
 * render-priority argument instead of mount order: a non-zero priority
 * switches R3F out of automatic rendering and requires the app to drive
 * `gl.render` by hand — a far larger change than mount order, and one that
 * would silently blank the canvas if any consumer forgot it.
 * `cell-scene-order.test.ts` is the structural guard against this
 * regression, since a stale-frame read is invisible in every other
 * automated check.
 */
export default function CellScene() {
  // WR-03 review follow-up: read here (CellScene already imports both
  // RailRig and, transitively, the store) and pass down as a prop, so
  // RailRig.tsx stays a pure presentational component and doesn't add a
  // second, more direct edge into the pre-existing
  // RailRig -> cellStore -> compile -> toolpath-anchor -> RailRig cycle.
  //
  // CR-01 fix (04-REVIEW): `trajectory` goes `null` synchronously the
  // instant a new selection is dispatched, before the async fetch/parse/
  // compile resolves (cellStore.selectSample's unknown-id, parsing-entry,
  // and failure branches). Falling back to the hardcoded `RAIL_CENTER_X`
  // constant during that window made the carriage visibly snap through the
  // rail's midpoint on every reselection — most visibly on a mode switch,
  // since `railStartXForMode` deliberately parks each mode off-centre.
  // `lastRailPos` tracks the last successfully-compiled trajectory's rail
  // position (never reset by the null-out branches), so the fallback always
  // reflects the carriage's true last on-screen position instead of an
  // arbitrary constant.
  // Quick 260816-m6d: manual jog (a typed rail position) wins over the
  // compiled trajectory, which itself wins over the CR-01 last-known-good
  // fallback.
  const railPos = useCellStore(
    (state) => state.manualJog?.railPos ?? state.trajectory?.railPos ?? state.lastRailPos,
  )

  return (
    // `position: fixed` + `inset: 0` sizes this wrapper directly against the
    // viewport, independent of any ancestor's percentage-height chain — the
    // R3F Canvas measures ITS PARENT via ResizeObserver, so relying on
    // percentage cascades (html/body/#root) is fragile. Fixed+inset is the
    // standard hardened full-viewport R3F pattern.
    <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}>
      <Canvas
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(SCENE_PALETTE.background.hex)}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={45} />

        {/* Gap closure G-04-1 frame-order correction (plan 04-04): mounted
            FIRST among frame-callback consumers so usePlaybackClock's
            useFrame write to livePlayback.fraction runs before RobotPose
            (inside RailRig), PlaybackTrail, and ScrubMarker read it —
            otherwise each of those would read the PREVIOUS frame's value
            (R3F runs useFrame callbacks in mount/subscription order). See
            this component's top-level doc comment for the full rationale. */}
        <PlaybackClock />

        {/* Neutral studio lighting — soft ambient + a single directional key light (D-06) */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />

        {/* Floor plane — grounds the cell and gives OrbitControls a natural pivot (D-05).
            Sized to the rig's actual footprint (rail run + robot reach envelope
            + margin, all from RailRig.tsx — checkpoint follow-up item 3) rather
            than an arbitrary large plane. FLOOR_Z_CENTER sits behind RIG_Z_OFFSET
            (checkpoint follow-up, round 4, item 2): the rig reads as positioned
            near the floor's front (camera-side) edge, with extra floor depth
            extending behind it. DoubleSide so the floor stays visible when the
            camera orbits below the XZ plane (default FrontSide culls the
            plane's back face, making it disappear from below-horizon views). */}
        <mesh
          position={[RAIL_CENTER_X, 0, FLOOR_Z_CENTER]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[RIG_FOOTPRINT_WIDTH, RIG_FOOTPRINT_DEPTH]} />
          <meshStandardMaterial color={SCENE_PALETTE.floor.hex} side={DoubleSide} />
        </mesh>

        {/* Rail rig + UR3e mount point (plan 01-04): the 7th-axis rail with
            end-stops (D-07) and its carriage carrying the posed UR3e (D-01,
            D-02, D-08, D-09). Shifted forward off the world origin toward the
            default camera view (checkpoint follow-up item 2) rather than
            straddling the origin symmetrically. */}
        <group name="rail-rig-mount" position={[0, 0, RIG_Z_OFFSET]}>
          <RailRig railPos={railPos} />
        </group>

        {/* G-02-01 (plan 02-04): the workbench the toolpath visibly rests
            on — scene furniture, positioned entirely from the toolpath
            anchor constants, no wrapping transform. */}
        <Workbench />

        {/* SIM-01/SIM-02 (plan 02-01): the classified, D-06-anchored
            toolpath for whichever bundled sample is selected. Points arrive
            already in world space, so no wrapping group/transform here. */}
        <Toolpath />

        {/* Gap closure G-04-1 (plan 04-04): the traversed-path highlight —
            grows over the drawn toolpath as playback advances, driven
            imperatively per frame from the same livePlayback.fraction
            channel that poses the robot and drives the scrub marker below. */}
        <PlaybackTrail />

        {/* D-07 (plan 03-03): the current-scrub-position indicator riding
            the toolpath above, driven from the same trajectory sample index
            that poses the robot (SIM-05). */}
        <ScrubMarker />

        <OrbitControls makeDefault target={DEFAULT_CAMERA_TARGET} />
        <NavCube />
        <CameraResetListener />
        <ToolpathCameraFit />
      </Canvas>
    </div>
  )
}
