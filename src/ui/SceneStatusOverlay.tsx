import { useCellStore } from '../store/cellStore'
import { SCENE_STATUS_COPY, toolpathStatusCopy } from './scene-status-copy'

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
 * three covered states for the robot-model media element, extended here to
 * cover the toolpath's own parsing/error states). Renders nothing when the
 * robot is ready and no toolpath is in a parsing/error state — the
 * populated state is the 3D scene itself.
 *
 * Robot-load status keeps priority over toolpath status: while the robot
 * model is still loading or has failed, that message shows and the
 * toolpath message does not, since a missing robot is the more fundamental
 * failure (there is nothing to anchor a toolpath to).
 *
 * All strings come from `SCENE_STATUS_COPY` rather than being inlined here
 * — including the toolpath ones — so the unit-tested copy and the displayed
 * copy cannot drift, and so a caught exception's message/stack (T-02-04)
 * never reaches the DOM: the store already discards the exception object
 * and keeps only the status enum, and this component never reads it.
 */
export default function SceneStatusOverlay() {
  const robotLoadStatus = useCellStore((state) => state.robotLoadStatus)
  const toolpathLoadStatus = useCellStore((state) => state.toolpathLoadStatus)

  const robotSettled = robotLoadStatus === 'ready'
  const toolpathVisible = toolpathLoadStatus === 'parsing' || toolpathLoadStatus === 'error'

  if (robotSettled && !toolpathVisible) return null

  const showSpinner = !robotSettled ? robotLoadStatus === 'loading' : toolpathLoadStatus === 'parsing'
  const message = !robotSettled
    ? robotLoadStatus === 'loading'
      ? SCENE_STATUS_COPY.loading
      : SCENE_STATUS_COPY.error
    : toolpathStatusCopy(toolpathLoadStatus === 'parsing' ? 'parsing' : 'error')

  return (
    <div style={panelStyle} role="status">
      {showSpinner && (
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
      <span>{message}</span>
      <style>
        {`@keyframes gsd-scene-status-spin { to { transform: rotate(360deg); } }`}
      </style>
    </div>
  )
}
