import { Button } from '../components/ui/button'
import { useCellStore } from '../store/cellStore'

/**
 * The phase's one primary DOM call-to-action (UI-SPEC "Color" — Accent is
 * reserved for this button, the nav-cube hover state, and nothing else).
 *
 * Rendered at the UI-SPEC Label type size in the semibold weight (an
 * actionable control, not passive text) — overriding the registry Button's
 * default `text-sm font-medium` via `className`, which `cn`/`tailwind-merge`
 * resolves in this component's favor since it is applied last.
 *
 * The click handler only dispatches the store's reset action — it never
 * reaches into the 3D scene, the camera, or the robot directly.
 */
export default function ResetViewButton() {
  const requestCameraReset = useCellStore((state) => state.requestCameraReset)

  return (
    <Button
      onClick={requestCameraReset}
      className="text-[length:var(--text-label)] leading-[var(--leading-label)] font-semibold"
    >
      Reset View
    </Button>
  )
}
