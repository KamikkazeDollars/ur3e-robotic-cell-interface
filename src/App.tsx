import CellScene from './scene/CellScene'
import ResetViewButton from './ui/ResetViewButton'
import SceneStatusOverlay from './ui/SceneStatusOverlay'

function App() {
  return (
    <>
      <CellScene />
      <SceneStatusOverlay />
      {/* Peripheral overlay, `lg` (24px) padding from the viewport edges — a
          secondary control that must not compete with the robot for
          attention (UI-SPEC "Color" visual-focal-point rule). */}
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
