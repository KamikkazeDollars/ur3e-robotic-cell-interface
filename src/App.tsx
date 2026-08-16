import CellScene from './scene/CellScene'
import ResetViewButton from './ui/ResetViewButton'
import SampleSelect from './ui/SampleSelect'
import PlaybackControl from './ui/PlaybackControl'
import ScrubControl from './ui/ScrubControl'
import SceneStatusOverlay from './ui/SceneStatusOverlay'
import TabRail from './ui/shell/TabRail'
import TabPanel from './ui/shell/TabPanel'
import useModeJobSync from './ui/useModeJobSync'
import { useCellStore } from './store/cellStore'

function App() {
  // G-04-1 gap closure, superseded by quick 260816-m6d's useModeJobSync:
  // mounted once at the shell level so each mode's job (bundled sample or
  // upload) loads automatically, including on the initial mount. See the
  // hook's own header comment for why this crossing lives here rather than
  // inside uiShellStore's setCellMode.
  useModeJobSync()

  // Quick 260816-m6d: the scrub/timeline bar stays unmounted until the user
  // presses Play for the current job — its appearance reads as the timeline
  // unlocking rather than the layout reflowing somewhere else, since it
  // mounts in the same overlay position beneath the Play button.
  const playbackStarted = useCellStore((state) => state.playbackStarted)

  return (
    <>
      <CellScene />
      <SceneStatusOverlay />
      <TabRail />
      <TabPanel />
      {/* Peripheral overlay, `lg` (24px) padding from the viewport edges — a
          secondary control that must not compete with the robot for
          attention (UI-SPEC "Color" visual-focal-point rule). Mirrors the
          Reset View overlay's spacing/z-index on the opposite corner.
          ScrubControl (D-05) shares this same overlay, directly beneath
          SampleSelect, rather than adding a third fixed container. Offset
          left past the new rail + panel (quick plan 260815-3cn) using the
          same shell geometry tokens TabRail/TabPanel read, so the two
          layouts can never drift apart. */}
      <div
        style={{
          position: 'fixed',
          left: 'calc(var(--shell-rail-width) + var(--shell-panel-width) + var(--space-lg))',
          bottom: 'var(--space-lg)',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        <SampleSelect />
        <PlaybackControl />
        {playbackStarted && <ScrubControl />}
      </div>
      <div
        style={{
          position: 'fixed',
          right: 'var(--space-lg)',
          bottom: 'var(--space-lg)',
          zIndex: 1,
        }}
      >
        <ResetViewButton />
      </div>
    </>
  )
}

export default App
