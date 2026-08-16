import { useRef, useState } from 'react'
import { PanelShell, PanelSection, ReadoutRow } from '../shell/PlaceholderPanel'
import { Button } from '../../components/ui/button'
import { useCellStore, MAX_UPLOAD_BYTES } from '../../store/cellStore'
import { samplesForMode } from '../../gcode/samples'
import type { CellMode } from '../../cell-mode'

/** Mirrors the deleted `ModeBar.tsx`'s mounted-tool label — the one piece of
 * real information that control carried, now surfaced per-mode inside the
 * tab itself instead of a separate segmented control (quick 260816-m6d). */
const MOUNTED_TOOL_LABEL: Record<CellMode, string> = {
  printing: 'Print head',
  milling: 'Mill spindle',
}

const TAB_TITLE: Record<CellMode, string> = {
  printing: 'Printing',
  milling: 'Milling',
}

const MAX_UPLOAD_MB = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)

// Visually-hidden-but-accessible file input, triggered by the visible
// "Upload .gcode" button via a ref — the standard pattern for styling a
// file input consistently with the rest of the control surface.
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

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  flexWrap: 'wrap',
}

const statusStyle: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--leading-label)',
  color: 'var(--ui-fg-muted)',
}

/**
 * Per-mode job panel (quick 260816-m6d): each of the Printing/Milling tabs
 * gets its own independent .gcode upload — `uploadedJobs` is keyed per mode
 * in `cellStore`, so a file uploaded on one tab can never replace the
 * other's job. Dispatches store actions only; no scene or parser import.
 */
export default function JobPanel({ mode }: { mode: CellMode }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lastUploadTooLarge, setLastUploadTooLarge] = useState(false)

  const uploadedJob = useCellStore((state) => state.uploadedJobs[mode])
  const loadUploadedGcode = useCellStore((state) => state.loadUploadedGcode)
  const clearUploadedJob = useCellStore((state) => state.clearUploadedJob)
  const toolpathLoadStatus = useCellStore((state) => state.toolpathLoadStatus)

  const bundledSample = samplesForMode(mode)[0]
  const currentJobLabel = uploadedJob ? uploadedJob.fileName : (bundledSample?.label ?? '—')

  return (
    <PanelShell title={TAB_TITLE[mode]}>
      <PanelSection heading="Tool">
        <ReadoutRow label="Mounted tool" value={MOUNTED_TOOL_LABEL[mode]} />
      </PanelSection>
      <PanelSection heading="Job">
        <ReadoutRow label="Loaded job" value={currentJobLabel} />
        <input
          ref={inputRef}
          type="file"
          accept=".gcode,.nc,.txt,text/plain"
          style={hiddenInputStyle}
          aria-label={`Upload .gcode for ${TAB_TITLE[mode]}`}
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Clear the input's value immediately so re-selecting the same
            // filename fires this handler again on a later attempt.
            event.target.value = ''
            if (!file) return
            void file.text().then((text) => {
              setLastUploadTooLarge(text.length > MAX_UPLOAD_BYTES)
              void loadUploadedGcode(mode, file.name, text)
            })
          }}
        />
        <div style={buttonRowStyle}>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Upload .gcode
          </Button>
          {uploadedJob && (
            <Button variant="secondary" onClick={() => clearUploadedJob(mode)}>
              Use bundled sample
            </Button>
          )}
        </div>
        {toolpathLoadStatus === 'error' && (
          <span style={statusStyle} role="status">
            {lastUploadTooLarge
              ? `File exceeds the ${MAX_UPLOAD_MB} MB upload limit and was rejected.`
              : 'Failed to load the job.'}
          </span>
        )}
      </PanelSection>
    </PanelShell>
  )
}
