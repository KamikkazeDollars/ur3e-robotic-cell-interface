/**
 * Single source of truth for the left tab rail's tab set (quick plan
 * 260815-3cn, pruned quick plan 260816-m6d, reverted to a single toggleable
 * entry quick plan 260816-nup — U-5, split into two real destinations quick
 * plan 260817-gdv — Task 2). Data only — no JSX, no React import — so
 * `tab-registry.test.ts` can import it without a DOM, and so `TabRail.tsx` /
 * `TabPanel.tsx` both map over the same array instead of maintaining a
 * second, driftable list.
 *
 * U-5 revert: Printing/Milling moved back to the compact top `ModeBar`
 * (`src/ui/shell/ModeBar.tsx`) — they are no longer left-rail tabs.
 *
 * Quick 260817-gdv: the rail now carries two destinations — "Run" (the
 * renamed Dashboard tab; `RunPanel.tsx`) and "Free Movement" (a deliberate
 * copy of Run, started identical and expected to diverge into a distinct
 * manual-jog surface; `FreeMovementPanel.tsx`). The id rename away from the
 * old single-tab name `'dashboard'` is deliberate: a tab labelled "Run"
 * sitting next to a real "Free Movement" sibling must not still be keyed by
 * the old dashboard name — `TabId`'s `Record<TabId, _>` usages in
 * `TabRail.tsx`/`TabPanel.tsx` force every call site to be updated together,
 * so the rename cannot be done halfway.
 */
export type TabId = 'run' | 'free-movement'

export interface TabDef {
  id: TabId
  label: string
}

export const TAB_DEFS: readonly TabDef[] = [
  { id: 'run', label: 'Run' },
  { id: 'free-movement', label: 'Free Movement' },
]

export const DEFAULT_TAB_ID: TabId = 'run'
