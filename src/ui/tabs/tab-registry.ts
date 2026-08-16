/**
 * Single source of truth for the left tab rail's tab set (quick plan
 * 260815-3cn, pruned quick plan 260816-m6d). Data only — no JSX, no React
 * import — so `tab-registry.test.ts` can import it without a DOM, and so
 * `TabRail.tsx` / `TabPanel.tsx` both map over the same array instead of
 * maintaining a second, driftable list.
 *
 * Pruned to the three tabs the interview build actually presents: the two
 * cell modes (each a real, working job-loading surface — see
 * `JobPanel.tsx`) plus the reworked manual-control Dashboard. The other four
 * roadmap tabs (Operations, Setup, Vision, Calibrate, I/O, Optimization)
 * were static future-phase placeholders with no real behaviour — deleted
 * outright rather than kept around unreachable, per user direction that no
 * surface should announce a future roadmap phase it doesn't yet deliver.
 */
import type { CellMode } from '../../cell-mode'

export type TabId = CellMode | 'dashboard'

export interface TabDef {
  id: TabId
  label: string
}

export const TAB_DEFS: readonly TabDef[] = [
  { id: 'printing', label: 'Printing' },
  { id: 'milling', label: 'Milling' },
  { id: 'dashboard', label: 'Dashboard' },
]

export const DEFAULT_TAB_ID: TabId = 'dashboard'

/**
 * The tab/cell-mode correspondence, written down in exactly one place.
 * Returns the cell mode a tab click should also select, or `null` for a tab
 * (Dashboard) that must not change which mode the cell is configured for.
 */
export function cellModeForTab(id: TabId): CellMode | null {
  return id === 'printing' || id === 'milling' ? id : null
}
