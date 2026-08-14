import { Vector3 } from 'three'
import { GizmoHelper, GizmoViewcube } from '@react-three/drei'

// `GizmoViewcube`'s own source (@react-three/drei/core/GizmoViewcube.js)
// declares `defaultFaces = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']`
// applied as the standard THREE.BoxGeometry per-face material order
// (+x, -x, +y, -y, +z, -z) — i.e. in the cube's own local frame, +x is
// genuinely the "Right" face, +y is "Top", and +z is "Front". Verified
// directly against the installed package source, not assumed. The cube's
// visible box spans a half-extent of 30 units (its wrapping group is scaled
// [60,60,60] around a unit box) inside GizmoHelper's shared coordinate
// space.
//
// Checkpoint follow-up (round 2): the triad moves to the OPPOSITE corner —
// Left/Bottom/Back, [-30,-30,-30] — with each axis spanning the FULL cube
// edge (60 units) so its tip lands exactly on the cube's opposite corner,
// tracing that edge. From this corner: +x traces the Bottom/Back edge
// (y=-30, z=-30 fixed), +y traces the Left/Back edge (x=-30, z=-30 fixed),
// and +z traces the Left face's Bottom edge (x=-30, y=-30 fixed) — the
// exact edge the user asked for.
const AXES_ORIGIN = new Vector3(-30, -30, -30)
const AXES_X_DIR = new Vector3(1, 0, 0)
const AXES_Y_DIR = new Vector3(0, 1, 0)
const AXES_Z_DIR = new Vector3(0, 0, 1)
const AXES_LENGTH = 60 // full cube edge (-30 to +30), tip lands exactly on the opposite corner
const AXES_HEAD_LENGTH = 12 // ~20% of the shaft length — legible at the gizmo's actual on-screen size
const AXES_HEAD_WIDTH = 8

const AXIS_COLOR_X = 0xff0000 // red
const AXIS_COLOR_Y = 0x00ff00 // green
const AXIS_COLOR_Z = 0x0000ff // blue

/**
 * Fusion-360-style navigation cube (SCENE-03) with a small XYZ axis triad
 * fixed to its Left/Bottom/Back corner (checkpoint follow-up, item 1).
 *
 * `GizmoHelper` auto-discovers the scene's default `OrbitControls` (registered
 * via `makeDefault` in CellScene) — no manual camera-sync wiring is written here.
 * `GizmoViewcube`'s default `faces` prop already labels all six faces
 * (Front/Top/Bottom/Back/Left/Right); click-to-snap is handled internally via
 * the gizmo's own camera tween — no click handler is written here either.
 *
 * Three `THREE.ArrowHelper` instances (via R3F's lowercase arrow-helper
 * intrinsic element) replace the previous `AxesHelper` — `AxesHelper` has no arrowheads, and
 * the user asked for visibly arrowed axis lines tracing the cube's edges.
 * Standard X=red/Y=green/Z=blue coloring is set explicitly per arrow to
 * match the "standard axis colors" ask.
 *
 * UI-SPEC Accent (#2563EB) is reserved for the cube's hover/active face
 * highlight only — it must not appear in the floor, lighting, or rail/robot
 * code. The axis triad's colors are the standard X/Y/Z convention, not the
 * UI-SPEC accent/secondary tones.
 */
export default function NavCube() {
  return (
    <GizmoHelper alignment="top-right" margin={[80, 80]}>
      <GizmoViewcube
        color="#FAFAFA"
        strokeColor="#E4E7EB"
        hoverColor="#2563EB"
        textColor="#08060d"
        // G-02-04: 0.6 balances face-label legibility against letting the
        // Left/Bottom/Back axis triad read through the cube's near faces —
        // closes the "axis triad fully occluded by opaque faces" UAT report.
        opacity={0.6}
      />
      <arrowHelper
        args={[AXES_X_DIR, AXES_ORIGIN, AXES_LENGTH, AXIS_COLOR_X, AXES_HEAD_LENGTH, AXES_HEAD_WIDTH]}
      />
      <arrowHelper
        args={[AXES_Y_DIR, AXES_ORIGIN, AXES_LENGTH, AXIS_COLOR_Y, AXES_HEAD_LENGTH, AXES_HEAD_WIDTH]}
      />
      <arrowHelper
        args={[AXES_Z_DIR, AXES_ORIGIN, AXES_LENGTH, AXIS_COLOR_Z, AXES_HEAD_LENGTH, AXES_HEAD_WIDTH]}
      />
    </GizmoHelper>
  )
}
