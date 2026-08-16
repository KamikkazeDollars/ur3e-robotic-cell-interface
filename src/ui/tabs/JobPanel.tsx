import { PanelShell, PanelSection, ReadoutRow } from '../shell/PlaceholderPanel'
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

/**
 * Shared per-mode job panel (Task 3 stub, fleshed out with upload/job
 * readout by Task 4). Renders the mode's title and its mounted-tool line via
 * the shared `PanelShell`/`PanelSection` primitives.
 */
export default function JobPanel({ mode }: { mode: CellMode }) {
  return (
    <PanelShell title={TAB_TITLE[mode]}>
      <PanelSection heading="Tool">
        <ReadoutRow label="Mounted tool" value={MOUNTED_TOOL_LABEL[mode]} />
      </PanelSection>
    </PanelShell>
  )
}
