/**
 * Single source of truth for the left tab rail's tab set (quick plan
 * 260815-3cn, pruned quick plan 260816-m6d, reverted to a single toggleable
 * entry quick plan 260816-nup — U-5). Data only — no JSX, no React import —
 * so `tab-registry.test.ts` can import it without a DOM, and so
 * `TabRail.tsx` / `TabPanel.tsx` both map over the same array instead of
 * maintaining a second, driftable list.
 *
 * U-5 revert: Printing/Milling moved back to the compact top `ModeBar`
 * (`src/ui/shell/ModeBar.tsx`) — they are no longer left-rail tabs, and a
 * permanently-docked panel for the one remaining tab would keep eating
 * scene width for no navigational reason (see `uiShellStore.ts`'s own doc
 * comment). The rail now carries exactly one toggleable Dashboard entry.
 */
export type TabId = 'dashboard'

export interface TabDef {
  id: TabId
  label: string
}

export const TAB_DEFS: readonly TabDef[] = [{ id: 'dashboard', label: 'Dashboard' }]

export const DEFAULT_TAB_ID: TabId = 'dashboard'
