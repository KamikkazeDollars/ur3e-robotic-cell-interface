import { GizmoHelper, GizmoViewcube } from '@react-three/drei'

// `GizmoViewcube`'s own source (@react-three/drei/core/GizmoViewcube.js)
// declares `defaultFaces = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']`
// applied as the standard THREE.BoxGeometry per-face material order
// (+x, -x, +y, -y, +z, -z) — i.e. in the cube's own local frame, +x is
// genuinely the "Right" face, +y is "Top", and +z is "Front". Verified
// directly against the installed package source, not assumed. The cube's
// visible box spans a half-extent of 30 units (its wrapping group is scaled
// [60,60,60] around a unit box) inside GizmoHelper's shared coordinate
// space, so the (+x,+y,+z) corner — where Right/Top/Front meet — sits at
// [30, 30, 30] in that same space.
const AXES_TRIAD_CORNER: readonly [number, number, number] = [30, 30, 30]
// Short enough not to overlap the cube's own faces — the lines originate at
// the corner and point away from the cube, reading as a small tripod fixed
// to that corner (classic Fusion 360 ViewCube styling).
const AXES_TRIAD_LENGTH = 16

/**
 * Fusion-360-style navigation cube (SCENE-03) with a small XYZ axis triad
 * fixed to its Right/Top/Front corner (checkpoint follow-up, item 1).
 *
 * `GizmoHelper` auto-discovers the scene's default `OrbitControls` (registered
 * via `makeDefault` in CellScene) — no manual camera-sync wiring is written here.
 * `GizmoViewcube`'s default `faces` prop already labels all six faces
 * (Front/Top/Bottom/Back/Left/Right); click-to-snap is handled internally via
 * the gizmo's own camera tween — no click handler is written here either.
 *
 * `THREE.AxesHelper` (via the `axesHelper` JSX intrinsic, R3F's standard thin
 * wrapper for a Three.js object needing no manual disposal) ships the
 * standard X=red/Y=green/Z=blue coloring already required here, so no
 * per-axis color override is written.
 *
 * UI-SPEC Accent (#2563EB) is reserved for the cube's hover/active face
 * highlight only — it must not appear in the floor, lighting, or rail/robot
 * code. The axis triad's colors are the standard X/Y/Z convention, not the
 * UI-SPEC accent/secondary tones, matching the explicit ask for "standard
 * axis colors."
 */
export default function NavCube() {
  return (
    <GizmoHelper alignment="top-right" margin={[80, 80]}>
      <GizmoViewcube
        color="#FAFAFA"
        strokeColor="#E4E7EB"
        hoverColor="#2563EB"
        textColor="#08060d"
      />
      <axesHelper args={[AXES_TRIAD_LENGTH]} position={AXES_TRIAD_CORNER} />
    </GizmoHelper>
  )
}
