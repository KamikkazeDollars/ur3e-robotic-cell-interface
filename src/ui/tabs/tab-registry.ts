/**
 * Single source of truth for the left tab rail's tab set (quick plan
 * 260815-3cn). Data only — no JSX, no React import — so `tab-registry.test.ts`
 * can import it without a DOM, and so `TabRail.tsx` / `TabPanel.tsx` both map
 * over the same array instead of maintaining a second, driftable list.
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

export const TAB_DEFS: readonly TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', phase: 5, blurb: 'Telemetry readouts' },
  { id: 'operations', label: 'Operations', phase: 6, blurb: 'Operations tree and engagement legend' },
  { id: 'setup', label: 'Setup', phase: 8, blurb: 'Cell device configuration' },
  { id: 'vision', label: 'Vision', phase: 8, blurb: 'Simulated force and contact' },
  { id: 'calibrate', label: 'Calibrate', phase: 8, blurb: 'Home and per-operation positions' },
  { id: 'io', label: 'I/O', phase: 8, blurb: 'Digital I/O status' },
  { id: 'optimization', label: 'Optimization', phase: 8, blurb: 'Feed-rate override and cycle time' },
]

export const DEFAULT_TAB_ID: TabId = 'dashboard'
