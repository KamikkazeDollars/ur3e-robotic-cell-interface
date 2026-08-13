import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCellStore } from '../store/cellStore'
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from './camera-defaults'

/**
 * In-Canvas subscriber that renders nothing. Restores the default camera
 * framing on the default `OrbitControls` (registered via `makeDefault` in
 * CellScene.tsx) whenever the store's `resetToken` changes (SCENE-02).
 *
 * Does not act on mount: the camera is already at the default framing
 * then, and moving it unprompted would be a camera move the user did not
 * ask for — the plan's explicit safety prohibition.
 */
export default function CameraResetListener() {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null
  const resetToken = useCellStore((state) => state.resetToken)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!hasMounted.current) {
      // First run is the initial mount — the camera already sits at the
      // default framing then, so there is nothing to restore.
      hasMounted.current = true
      return
    }
    if (!controls) return

    camera.position.set(...DEFAULT_CAMERA_POSITION)
    controls.target.set(...DEFAULT_CAMERA_TARGET)
    controls.update()
    // Intentionally reacting only to resetToken — camera/controls are
    // stable object references from R3F's default-controls registration,
    // not per-frame values that should re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])

  return null
}
