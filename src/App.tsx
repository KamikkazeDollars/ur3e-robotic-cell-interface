import CellScene from './scene/CellScene'
import ResetViewButton from './ui/ResetViewButton'
import SampleSelect from './ui/SampleSelect'
import PlaybackControl from './ui/PlaybackControl'
import ScrubControl from './ui/ScrubControl'
import SceneStatusOverlay from './ui/SceneStatusOverlay'
import TabRail from './ui/shell/TabRail'
import TabPanel from './ui/shell/TabPanel'
import ModeBar from './ui/shell/ModeBar'
import { shellContentLeft } from './ui/shell/shell-geometry'
import { showsPlaybackControls } from './ui/shell/playback-chrome-visibility'
import useModeJobSync from './ui/useModeJobSync'
import usePlaybackTabGuard from './ui/usePlaybackTabGuard'
import { useCellStore } from './store/cellStore'
import { useUiShellStore } from './store/uiShellStore'

function App() {
  // G-04-1 gap closure, superseded by quick 260816-m6d's useModeJobSync:
  // mounted once at the shell level so each mode's job (bundled sample or
  // upload) loads automatically, including on the initial mount. See the
  // hook's own header comment for why this crossing lives here rather than
  // inside uiShellStore's setCellMode.
  useModeJobSync()

  // Quick 260817-gdv (Task 3): mounted alongside useModeJobSync — the other
  // shell-level crossing between uiShellStore (which tab) and cellStore
  // (playback state). Pauses the clock when the user navigates away from
  // Run mid-playback; see the hook's own header for why the transport
  // controls being unmounted below isn't enough on its own.
  usePlaybackTabGuard()

  // Quick 260816-m6d: the scrub/timeline bar stays unmounted until the user
  // presses Play for the current job — its appearance reads as the timeline
  // unlocking rather than the layout reflowing somewhere else, since it
  // mounts in the same overlay position beneath the Play button.
  const playbackStarted = useCellStore((state) => state.playbackStarted)

  // Quick 260817-gdv (Task 2): read straight from the store now that
  // `panelOpen` is its own field, rather than deriving it from a
  // (now-removed) null check on `activeTab`. This overlay column's left
  // offset comes from the same `shellContentLeft` derivation `ModeBar`
  // reads, so the two can never drift apart from each other.
  const panelOpen = useUiShellStore((state) => state.panelOpen)

  // Quick 260817-gdv (Task 3): the toolpath transport (Play/Pause + scrub)
  // is Run-only. Single flag, derived from the shared predicate — never an
  // inline tab comparison — and used to gate BOTH transport controls below.
  const activeTab = useUiShellStore((state) => state.activeTab)
  const showPlayback = showsPlaybackControls(activeTab)

  return (
    <>
      <CellScene />
      <SceneStatusOverlay />
      <TabRail />
      <TabPanel />
      {/* Quick 260817-jfy: the mode bar (Printing/Milling toggle, mounted-tool
          chip, job label, upload control) is Run-only chrome for the same
          reason the job picker below is — it is the job/mode selection
          surface, not something a Free Movement session needs. Reuses the
          single shared visibility flag rather than a second predicate.
          Per-mode job auto-loading is unaffected: useModeJobSync() is
          mounted at this shell level, not inside the bar, so mode/job
          loading survives an unmount/remount cycle. */}
      {showPlayback && <ModeBar />}
      {/* Peripheral overlay, `lg` (24px) padding from the viewport edges — a
          secondary control that must not compete with the robot for
          attention (UI-SPEC "Color" visual-focal-point rule). Mirrors the
          Reset View overlay's spacing/z-index on the opposite corner.
          ScrubControl (D-05) shares this same overlay, directly beneath
          SampleSelect, rather than adding a third fixed container. Offset
          left past the rail (+ panel, when open) using the same
          `shellContentLeft` derivation `ModeBar` reads, so the two layouts
          can never drift apart.

          Quick 260817-iyv: all three children of this overlay — the
          `SampleSelect` job picker, `PlaybackControl` and `ScrubControl` —
          are Run-only, gated by the single `showPlayback` flag derived from
          the shared `showsPlaybackControls` predicate, never an inline tab
          comparison. On any other tab they are genuinely absent from the
          DOM, not merely hidden. This deliberately reverses quick
          260817-gdv's earlier carve-out, which kept the picker mounted on
          every tab on the reasoning that it selects the job the 3D scene
          renders regardless of tab; that reasoning no longer applies — the
          picker is now treated as Run-tab chrome, like the rest of the
          transport, so this is not an oversight. Gating the picker also
          withdraws its assumed-unit, skipped-command and frozen-trajectory
          notes from non-Run tabs, which is intended: those notes annotate
          the selected job, while the blocking-state channel
          (`SceneStatusOverlay`) is a separate component that stays mounted
          on every tab. */}
      <div
        style={{
          position: 'fixed',
          left: shellContentLeft(panelOpen),
          bottom: 'var(--space-lg)',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        {showPlayback && <SampleSelect />}
        {showPlayback && <PlaybackControl />}
        {showPlayback && playbackStarted && <ScrubControl />}
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
