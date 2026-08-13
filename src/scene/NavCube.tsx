import { GizmoHelper, GizmoViewcube } from '@react-three/drei'

/**
 * Fusion-360-style navigation cube (SCENE-03).
 *
 * `GizmoHelper` auto-discovers the scene's default `OrbitControls` (registered
 * via `makeDefault` in CellScene) — no manual camera-sync wiring is written here.
 * `GizmoViewcube`'s default `faces` prop already labels all six faces
 * (Front/Top/Bottom/Back/Left/Right); click-to-snap is handled internally via
 * the gizmo's own camera tween — no click handler is written here either.
 *
 * UI-SPEC Accent (#2563EB) is reserved for this component's hover/active face
 * highlight only — it must not appear in the floor, lighting, or rail/robot code.
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
    </GizmoHelper>
  )
}
