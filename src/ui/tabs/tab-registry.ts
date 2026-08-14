/**
 * Single source of truth for the left tab rail's tab set (quick plan
 * 260815-3cn). Data only — no JSX, no React import — so `tab-registry.test.ts`
 * can import it without a DOM, and so `TabRail.tsx` / `TabPanel.tsx` both map
 * over the same array instead of maintaining a second, driftable list.
 *
 * RED stub: `TAB_DEFS` is intentionally empty here so `tab-registry.test.ts`
 * fails before the real tab set is filled in during the GREEN pass.
 */

export type TabId =
  | 'dashboard'
  | 'operations'
  | 'setup'
  | 'vision'
  | 'calibrate'
  | 'io'
  | 'optimization'

export interface TabDef {
  id: TabId
  label: string
  /** Roadmap phase (5-8) that wires this tab's real behaviour/data. */
  phase: number
  /** One-line description of what the tab covers, used by placeholder copy. */
  blurb: string
}

export const TAB_DEFS: readonly TabDef[] = []

export const DEFAULT_TAB_ID: TabId = 'dashboard'
