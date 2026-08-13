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
    <Canvas
      gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor(DOMINANT_TONE)}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={45} />

      {/* Neutral studio lighting — soft ambient + a single directional key light (D-06) */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />

      {/* Floor plane — grounds the cell and gives OrbitControls a natural pivot (D-05) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color={SECONDARY_TONE} />
      </mesh>

      {/* Rail rig + UR3e mount point — inserted by plan 01-04 */}
      <group name="rail-rig-mount" />

      <OrbitControls makeDefault />
      <NavCube />
    </Canvas>
  )
}
