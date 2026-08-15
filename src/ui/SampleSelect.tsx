import { useCellStore } from '../store/cellStore'
import { useUiShellStore } from '../store/uiShellStore'
import { samplesForMode } from '../gcode/samples'
import { SCENE_STATUS_COPY } from './scene-status-copy'

// D-02: a plain native `<select>` rather than a registry component —
// `src/components/ui/` only has `button.tsx` today, and the installed
// shadcn CLI (4.x) diverges from the 3.8.4 preset flow STATE.md records
// this project as pinned to, so pulling in a registry select would reopen a
// resolved decision for a control this simple. Styled with the existing
// UI-SPEC custom properties (Label type size, spacing scale, surface/border
// roles for the fill, muted-foreground role for text) rather than a new
// one-off palette.
const selectStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '8px',
  border: '1px solid var(--ui-border)',
  background: 'var(--ui-surface-raised)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg)',
}

// Muted-foreground static text at the label type size — never the Accent
// tone reserved for the nav cube and the Reset View button (UI-SPEC "Color").
const noteStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg-muted)',
}

/**
 * Sample-selection dropdown (D-02). Reads `selectedSampleId` and dispatches
 * `selectSample` on change — mirroring `ResetViewButton.tsx`'s convention
 * that a DOM control only dispatches a store action and never touches the
 * scene, camera or parser directly.
 *
 * Also states the samples' assumed unit and, when the parser refused any
 * command, how many — both read off the parsed toolpath rather than a
 * second hard-coded literal, so the label can never drift from what the
 * parser actually reported. PITFALLS.md's unit-ambiguity entry calls for
 * surfacing the assumed unit rather than hard-coding it invisibly; a
 * silently truncated path presented as the whole job is this phase's own
 * transparency prohibition (SIM-01).
 *
 * Also renders a second `role="status"` note (D-06/SIM-05) when the
 * compiled trajectory froze at an unreachable point: the fixed
 * `trajectoryFrozen` copy plus how many samples were reached out of how
 * many were intended, read from the trajectory's own `samples.length` and
 * `requestedSampleCount` — never a second hardcoded number. This is
 * deliberately non-blocking chrome, not the centred `SceneStatusOverlay`
 * panel reserved for blocking states.
 *
 * G-04-1 gap closure: the option list is filtered to the active cell mode
 * via `samplesForMode(cellMode)` rather than rendered from the full
 * `GCODE_SAMPLES` list — the picker now offers only jobs the currently
 * mounted tool suits. `useCellModeSampleSync.ts` (mounted once at the App
 * shell level) keeps the loaded selection consistent when the mode changes
 * out from under it.
 */
export default function SampleSelect() {
  const selectedSampleId = useCellStore((state) => state.selectedSampleId)
  const selectSample = useCellStore((state) => state.selectSample)
  const toolpath = useCellStore((state) => state.toolpath)
  const trajectory = useCellStore((state) => state.trajectory)
  const cellMode = useUiShellStore((state) => state.cellMode)
  const availableSamples = samplesForMode(cellMode)

  const unitLabel = toolpath?.unit ?? 'mm'
  const skippedMotionCount = toolpath?.skippedMotionCount ?? 0
  const isFrozen = trajectory?.status === 'frozen-at-unreachable'
  const reachedCount = trajectory?.samples.length ?? 0
  const requestedCount = trajectory?.requestedSampleCount ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <select
        aria-label="G-code sample"
        value={selectedSampleId ?? ''}
        onChange={(event) => {
          void selectSample(event.target.value)
        }}
        style={selectStyle}
      >
        <option value="" disabled>
          Select a g-code sample…
        </option>
        {availableSamples.map((sample) => (
          <option key={sample.id} value={sample.id}>
            {sample.label}
          </option>
        ))}
      </select>
      <span style={noteStyle}>Samples are interpreted in {unitLabel}.</span>
      {skippedMotionCount > 0 && (
        <span style={noteStyle} role="status">
          {skippedMotionCount} command{skippedMotionCount === 1 ? '' : 's'} in this file could not be
          rendered and {skippedMotionCount === 1 ? 'was' : 'were'} skipped.
        </span>
      )}
      {isFrozen && (
        <span style={noteStyle} role="status">
          {SCENE_STATUS_COPY.trajectoryFrozen} Reached {reachedCount} of {requestedCount} intended
          sample{requestedCount === 1 ? '' : 's'}
          {/* WR-04 review follow-up: reachedCount <= 1 means only the
              literal parked-pose sample landed before freezing — the very
              first IK-solved travel waypoint (the lift point) was already
              unreachable, so the robot never leaves its parked stance for
              the whole scrub range. Calling this out explicitly avoids it
              reading as "scrubbing does nothing" rather than "this sample's
              approach move is unreachable". */}
          {reachedCount <= 1 ? ', including the approach move' : ''}.
        </span>
      )}
    </div>
  )
}
