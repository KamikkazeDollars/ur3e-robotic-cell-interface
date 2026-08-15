import { Play, Pause } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useCellStore } from '../store/cellStore'

/**
 * D-03/SIM-04's Play/Pause control (Phase 4, tracer plan 04-01). Follows
 * `ResetViewButton.tsx`'s convention verbatim: a controlled component that
 * only dispatches a store action and never reaches into the scene, camera,
 * or robot directly.
 *
 * Uses `variant="secondary"` deliberately, not the registry Button's
 * default variant: the default variant renders `--primary`, which resolves
 * to `--ui-accent`, and the 01-UI-SPEC reserves that accent for exactly the
 * nav-cube hover, the Reset View button, and camera-control active states.
 * A second accent-styled button here would break that reservation.
 */
export default function PlaybackControl() {
  const isPlaying = useCellStore((state) => state.isPlaying)
  const play = useCellStore((state) => state.play)
  const pause = useCellStore((state) => state.pause)
  const trajectory = useCellStore((state) => state.trajectory)

  const disabled = !trajectory || trajectory.samples.length === 0

  return (
    <Button
      variant="secondary"
      size="icon-sm"
      disabled={disabled}
      onClick={() => (isPlaying ? pause() : play())}
      aria-label={isPlaying ? 'Pause playback' : 'Play toolpath'}
    >
      {isPlaying ? <Pause /> : <Play />}
    </Button>
  )
}
