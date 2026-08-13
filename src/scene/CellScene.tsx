import { DoubleSide } from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import NavCube from './NavCube'
import CameraResetListener from './CameraResetListener'
import RailRig, { RIG_FOOTPRINT_WIDTH, RIG_FOOTPRINT_DEPTH, RIG_Z_OFFSET, FLOOR_Z_CENTER } from './RailRig'
import Toolpath from './Toolpath'
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from './camera-defaults'
import { RAIL_CENTER_X } from '../kinematics'

// UI-SPEC Dominant / Secondary tones — kept in sync with the DOM background (index.css)
// so the WebGL canvas and the surrounding page chrome don't clash (D-06).
const DOMINANT_TONE = '#FAFAFA'
const SECONDARY_TONE = '#E4E7EB'

/**
 * R3F Canvas composition root — the phase's "one real route" analogue.
 *
 * Composition order (per PATTERNS.md's definitive ordering):
 *   lights (ambient + directional) -> floor plane -> rail/robot mount point
 *   -> Toolpath (plan 02-01, mounted after the rig, before OrbitControls)
 *   -> OrbitControls (makeDefault) -> NavCube
 */
export default function CellScene() {
  return (
    // `position: fixed` + `inset: 0` sizes this wrapper directly against the
    // viewport, independent of any ancestor's percentage-height chain — the
    // R3F Canvas measures ITS PARENT via ResizeObserver, so relying on
    // percentage cascades (html/body/#root) is fragile. Fixed+inset is the
    // standard hardened full-viewport R3F pattern.
    <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}>
      <Canvas
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(DOMINANT_TONE)}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={45} />

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
          <meshStandardMaterial color={SECONDARY_TONE} side={DoubleSide} />
        </mesh>

        {/* Rail rig + UR3e mount point (plan 01-04): the 7th-axis rail with
            end-stops (D-07) and its carriage carrying the posed UR3e (D-01,
            D-02, D-08, D-09). Shifted forward off the world origin toward the
            default camera view (checkpoint follow-up item 2) rather than
            straddling the origin symmetrically. */}
        <group name="rail-rig-mount" position={[0, 0, RIG_Z_OFFSET]}>
          <RailRig />
        </group>

        {/* SIM-01/SIM-02 (plan 02-01): the classified, D-06-anchored
            toolpath for whichever bundled sample is selected. Points arrive
            already in world space, so no wrapping group/transform here. */}
        <Toolpath />

        <OrbitControls makeDefault target={DEFAULT_CAMERA_TARGET} />
        <NavCube />
        <CameraResetListener />
      </Canvas>
    </div>
  )
}
