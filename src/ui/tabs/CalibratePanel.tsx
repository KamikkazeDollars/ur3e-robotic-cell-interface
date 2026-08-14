import { PanelShell, PanelSection, PhaseNote } from '../shell/PlaceholderPanel'
import { Button } from '../../components/ui/button'

const jointRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-sm)',
}

const jointLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
}

const jointInputStyle: React.CSSProperties = {
  width: '80px',
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: '1px solid var(--ui-border)',
  background: 'var(--ui-surface-raised)',
  color: 'var(--ui-fg)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-label)',
}

const operationSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '8px',
  border: '1px solid var(--ui-border)',
  background: 'var(--ui-surface-raised)',
  color: 'var(--ui-fg)',
  fontSize: 'var(--text-label)',
}

const JOINTS = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6']

/**
 * CALIB-01/02. Presentational only. Every control below is disabled — no
 * home-pose value is real yet, and there is no operation to select.
 */
export default function CalibratePanel() {
  return (
    <PanelShell title="Calibrate">
      <PanelSection heading="Home position">
        {JOINTS.map((joint) => (
          <div key={joint} style={jointRowStyle}>
            <span style={jointLabelStyle}>{joint} (°)</span>
            <input type="number" value={0} disabled readOnly style={jointInputStyle} />
          </div>
        ))}
      </PanelSection>
      <PanelSection heading="Per-operation positions">
        <select style={operationSelectStyle} disabled defaultValue="">
          <option value="">No operation selected</option>
        </select>
        <Button disabled size="sm">
          Preview pose
        </Button>
      </PanelSection>
      <PhaseNote phase={8}>
        the forward-kinematics pose preview becomes interactive here.
      </PhaseNote>
    </PanelShell>
  )
}
