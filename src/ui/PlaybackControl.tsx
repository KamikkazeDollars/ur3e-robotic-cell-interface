import { Play, Pause } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useCellStore } from '../store/cellStore'

// Quick 260816-m6d: centres the (now larger) Play button across the
// overlay column's width, rather than letting it hug the left edge — its
// appearance reads as the focal control of the column, not just the first
// item in a stack.
const centerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
}

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
 *
 * Quick 260816-m6d: visibly larger than the neighbouring overlay controls —
 * `size="icon-lg"` (40px) widened further via `className` to a ~56px round
 * target with a ~28px glyph, which reads correctly against the 240px-wide
 * overlay column — and centred across that column's width via the
 * `centerRowStyle` wrapper above.
 */
export default function PlaybackControl() {
  const isPlaying = useCellStore((state) => state.isPlaying)
  const play = useCellStore((state) => state.play)
  const pause = useCellStore((state) => state.pause)
  const trajectory = useCellStore((state) => state.trajectory)

  const disabled = !trajectory || trajectory.samples.length === 0

  return (
    <div style={centerRowStyle}>
      <Button
        variant="secondary"
        size="icon-lg"
        className="size-14 [&_svg:not([class*='size-'])]:size-7"
        disabled={disabled}
        onClick={() => (isPlaying ? pause() : play())}
        aria-label={isPlaying ? 'Pause playback' : 'Play toolpath'}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
    </div>
  )
}
