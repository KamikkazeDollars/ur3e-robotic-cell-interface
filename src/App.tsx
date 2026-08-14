import CellScene from './scene/CellScene'
import ResetViewButton from './ui/ResetViewButton'
import SampleSelect from './ui/SampleSelect'
import ScrubControl from './ui/ScrubControl'
import SceneStatusOverlay from './ui/SceneStatusOverlay'

function App() {
  return (
    <>
      <CellScene />
      <SceneStatusOverlay />
      {/* Peripheral overlay, `lg` (24px) padding from the viewport edges — a
          secondary control that must not compete with the robot for
          attention (UI-SPEC "Color" visual-focal-point rule). Mirrors the
          Reset View overlay's spacing/z-index on the opposite corner.
          ScrubControl (D-05) shares this same overlay, directly beneath
          SampleSelect, rather than adding a third fixed container. */}
      <div
        style={{
          position: 'fixed',
          left: 'var(--space-lg)',
          bottom: 'var(--space-lg)',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        <SampleSelect />
        <ScrubControl />
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
