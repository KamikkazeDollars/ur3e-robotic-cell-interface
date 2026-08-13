import { useCellStore } from '../store/cellStore'
import { SCENE_STATUS_COPY } from './scene-status-copy'

// UI-SPEC "Color" — chrome stays in the Secondary tone; Accent is reserved
// for the nav-cube hover state and the Reset View CTA only.
const SECONDARY_TONE = '#E4E7EB'

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-md) var(--space-lg)',
  borderRadius: '8px',
  background: SECONDARY_TONE,
  fontSize: 'var(--text-body)',
  lineHeight: 'var(--leading-body)',
  fontWeight: 'var(--weight-regular)',
  color: '#08060d',
}

/**
 * DOM overlay rendering the loading and error states over the R3F canvas
 * (01-UI-SPEC.md "UI Considerations" — loading/error/populated are the
 * three covered states for the robot-model media element). Renders nothing
 * when the model is ready — the populated state is the 3D scene itself.
 *
 * Both strings come from `SCENE_STATUS_COPY` rather than being inlined here,
 * so the unit-tested copy and the displayed copy cannot drift.
 */
export default function SceneStatusOverlay() {
  const robotLoadStatus = useCellStore((state) => state.robotLoadStatus)

  if (robotLoadStatus === 'ready') return null

  return (
    <div style={panelStyle} role="status">
      {robotLoadStatus === 'loading' && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '1em',
            height: '1em',
            borderRadius: '50%',
            border: '2px solid #08060d33',
            borderTopColor: '#08060d',
            animation: 'gsd-scene-status-spin 0.8s linear infinite',
          }}
        />
      )}
      <span>{robotLoadStatus === 'loading' ? SCENE_STATUS_COPY.loading : SCENE_STATUS_COPY.error}</span>
      <style>
        {`@keyframes gsd-scene-status-spin { to { transform: rotate(360deg); } }`}
      </style>
    </div>
  )
}
