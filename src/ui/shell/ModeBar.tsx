import { useRef, useState } from 'react'
import { useUiShellStore, type CellMode } from '../../store/uiShellStore'
import { useCellStore, MAX_UPLOAD_BYTES } from '../../store/cellStore'
import { samplesForMode } from '../../gcode/samples'
import { shellContentLeft } from './shell-geometry'

/**
 * U-5 revert (quick 260816-nup): restores the compact top-of-scene
 * Printing/Milling toggle that quick 260816-m6d replaced with left-rail
 * tabs + a wide docked panel. Rebuilt from the prior `ModeBar.tsx`
 * (recoverable at `git show ac0b1a1^:src/ui/shell/ModeBar.tsx`) for its
 * container/segment styling, deliberately WITHOUT the `PhaseNote` footer
 * that prior bar carried — 260816-m6d removed roadmap-phase text app-wide
 * and this revert must not reintroduce it.
 *
 * The per-mode job controls (upload, bundled-sample fallback, loaded-job
 * label, error status) move wholesale IN from the deleted `JobPanel.tsx` —
 * every real behaviour gained in 260816-m6d (per-mode upload, auto-load on
 * mount/mode-change via `useModeJobSync.ts`, the size-cap rejection
 * message) is carried over verbatim, only the container changed from a
 * docked panel to this compact top bar, and only for the CURRENT
 * `cellMode` (the other mode's job controls are simply not rendered here —
 * `uploadedJobs` itself stays keyed per mode in the store regardless of
 * which mode's controls are currently visible).
 */
const MOUNTED_TOOL_LABEL: Record<CellMode, string> = {
  printing: 'Print head',
  milling: 'Mill spindle',
}

const MAX_UPLOAD_MB = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)

const containerStyle = (panelOpen: boolean): React.CSSProperties => ({
  position: 'fixed',
  top: 'var(--space-lg)',
  left: shellContentLeft(panelOpen),
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-md)',
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '8px',
  background: 'var(--ui-surface)',
  border: '1px solid var(--ui-border)',
})

const segmentedStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-xs)',
}

function segmentStyle(selected: boolean): React.CSSProperties {
  return {
    padding: 'var(--space-xs) var(--space-md)',
    borderRadius: '6px',
    border: 'none',
    fontSize: 'var(--text-label)',
    lineHeight: 'var(--leading-label)',
    fontWeight: selected ? 'var(--weight-semibold)' : 'var(--weight-regular)',
    background: selected ? 'var(--ui-accent)' : 'var(--ui-surface-raised)',
    color: selected ? 'var(--ui-accent-fg)' : 'var(--ui-fg-muted)',
    cursor: 'pointer',
  }
}

const chipStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  fontWeight: 'var(--weight-regular)',
  color: 'var(--ui-fg)',
  whiteSpace: 'nowrap',
}

const jobRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  flexWrap: 'wrap',
}

const jobLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
  whiteSpace: 'nowrap',
}

const buttonStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: '1px solid var(--ui-border)',
  background: 'var(--ui-surface-raised)',
  color: 'var(--ui-fg)',
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  cursor: 'pointer',
}

const statusStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-destructive)',
  flexBasis: '100%',
}

// Visually-hidden-but-accessible file input, triggered by the visible
// "Upload .gcode" button via a ref — carried over verbatim from the
// deleted JobPanel.tsx.
const hiddenInputStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export default function ModeBar() {
  const cellMode = useUiShellStore((state) => state.cellMode)
  const setCellMode = useUiShellStore((state) => state.setCellMode)
  // Quick 260817-gdv (Task 2): read straight from the store now that
  // `panelOpen` is its own field, rather than deriving it from a
  // (now-removed) null check on `activeTab`. Still fed into the SAME
  // `shellContentLeft(...)` derivation `App.tsx`'s overlay column reads, so
  // the two offsets can never drift apart.
  const panelOpen = useUiShellStore((state) => state.panelOpen)

  const inputRef = useRef<HTMLInputElement>(null)
  const [lastUploadTooLarge, setLastUploadTooLarge] = useState(false)

  const uploadedJob = useCellStore((state) => state.uploadedJobs[cellMode])
  const loadUploadedGcode = useCellStore((state) => state.loadUploadedGcode)
  const clearUploadedJob = useCellStore((state) => state.clearUploadedJob)
  const toolpathLoadStatus = useCellStore((state) => state.toolpathLoadStatus)

  const bundledSample = samplesForMode(cellMode)[0]
  const currentJobLabel = uploadedJob ? uploadedJob.fileName : (bundledSample?.label ?? '—')

  return (
    <div style={containerStyle(panelOpen)}>
      <div style={segmentedStyle} role="tablist" aria-label="Cell mode">
        <button
          type="button"
          role="tab"
          aria-selected={cellMode === 'printing'}
          style={segmentStyle(cellMode === 'printing')}
          onClick={() => setCellMode('printing')}
        >
          Printing
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cellMode === 'milling'}
          style={segmentStyle(cellMode === 'milling')}
          onClick={() => setCellMode('milling')}
        >
          Milling
        </button>
      </div>

      <span style={chipStyle}>Mounted tool: {MOUNTED_TOOL_LABEL[cellMode]}</span>

      <div style={jobRowStyle}>
        <span style={jobLabelStyle}>Job: {currentJobLabel}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".gcode,.nc,.txt,text/plain"
          style={hiddenInputStyle}
          aria-label={`Upload .gcode for ${cellMode}`}
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Clear the input's value immediately so re-selecting the same
            // filename fires this handler again on a later attempt.
            event.target.value = ''
            if (!file) return
            void file.text().then((text) => {
              setLastUploadTooLarge(text.length > MAX_UPLOAD_BYTES)
              void loadUploadedGcode(cellMode, file.name, text)
            })
          }}
        />
        <button type="button" style={buttonStyle} onClick={() => inputRef.current?.click()}>
          Upload .gcode
        </button>
        {uploadedJob && (
          <button type="button" style={buttonStyle} onClick={() => clearUploadedJob(cellMode)}>
            Use bundled sample
          </button>
        )}
      </div>

      {toolpathLoadStatus === 'error' && (
        <span style={statusStyle} role="status">
          {lastUploadTooLarge
            ? `File exceeds the ${MAX_UPLOAD_MB} MB upload limit and was rejected.`
            : 'Failed to load the job.'}
        </span>
      )}
    </div>
  )
}
