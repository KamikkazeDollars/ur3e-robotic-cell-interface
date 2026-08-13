import { DoubleSide } from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import NavCube from './NavCube'

// UI-SPEC Dominant / Secondary tones — kept in sync with the DOM background (index.css)
// so the WebGL canvas and the surrounding page chrome don't clash (D-06).
const DOMINANT_TONE = '#FAFAFA'
const SECONDARY_TONE = '#E4E7EB'

// Default camera framing: the rail runs ~3m along X and the robot stands ~1.5m
// tall, so the camera sits back and slightly elevated to hold the whole rig
// with comfortable margin. Plan 01-04 mounts the rail rig at the origin.
const DEFAULT_CAMERA_POSITION: [number, number, number] = [3.5, 2.5, 4.5]

/**
 * R3F Canvas composition root — the phase's "one real route" analogue.
 *
 * Composition order (per PATTERNS.md's definitive ordering):
 *   lights (ambient + directional) -> floor plane -> [rail/robot mount point,
 *   plan 01-04] -> OrbitControls (makeDefault) -> NavCube
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
            DoubleSide so the floor stays visible when the camera orbits below the
            XZ plane (default FrontSide culls the plane's back face, making it
            disappear from below-horizon views). */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color={SECONDARY_TONE} side={DoubleSide} />
        </mesh>

        {/* Rail rig + UR3e mount point — inserted by plan 01-04 */}
        <group name="rail-rig-mount" />

        <OrbitControls makeDefault />
        <NavCube />
      </Canvas>
    </div>
  )
}
