import { create } from 'zustand'
import { DEFAULT_TAB_ID, cellModeForTab, type TabId } from '../ui/tabs/tab-registry'
import type { CellMode } from '../cell-mode'

/** Which mode the cell is set to — drives the ModeBar segmented control and
 * the mounted-tool chip.
 *
 * Boundary revision (G-04-1 gap closure, 04-06-PLAN.md): `cellMode` is now a
 * real cell-configuration input, not visual-only chrome. It selects which
 * bundled jobs the sample picker offers (`src/gcode/samples.ts`, plan
 * 04-05's `samplesForMode`), and which station along the rail the loaded
 * job and the workbench sit at (`toolpathAnchorForMode`, consumed by
 * `cellStore.ts`'s `selectSample` and `src/scene/Workbench.tsx`). This is a
 * deliberate reversal of this field's original rule ("must not be read by
 * anything under `src/scene/`, `src/trajectory/` or `src/kinematics/`"),
 * recorded here as a conscious decision driven by the G-04-1 UAT report,
 * not an unexplained erosion of the boundary.
 *
 * What has NOT changed: Phase 7 still owns the actual tool-changer swap and
 * the mounted-tool geometry (TOOL-01/TOOL-02 remain future work), and no
 * per-frame value is ever written to this store — `cellMode` still only
 * changes at human interaction cadence (a mode-bar click), read via
 * `getState()` at selection time by non-React code or via a normal reactive
 * selector by components, exactly like every other field here.
 *
 * The union itself lives in `src/cell-mode.ts`: `src/gcode/samples.ts` also
 * needs it to tag bundled samples with a mode, and a dependency-free module
 * lets it reach the type without importing this store. Re-exported here so
 * the existing
 * `import { useUiShellStore, type CellMode } from '../../store/uiShellStore'`
 * form (`ModeBar.tsx`) keeps compiling unchanged. */
export type { CellMode }

/**
 * Pure UI-chrome state, kept in a store separate from `cellStore` on
 * purpose: `cellStore` holds simulation truth (toolpath, trajectory, scrub),
 * this holds which tab/mode the shell displays. Keeping them apart means a
 * later phase can delete or rewire this store without touching simulation
 * state.
 *
 * Quick 260816-m6d: the tab id and the cell mode are now deliberately
 * COUPLED for two of the three tabs (printing/milling), and that coupling
 * lives here, in `setActiveTab`, rather than in `TabRail.tsx`. Clicking the
 * Printing or Milling tab both switches the visible panel AND reconfigures
 * which mode the cell is set to, in the same `set()` call, so the two can
 * never observably disagree for even one render. `setCellMode` remains the
 * store's own mode setter, but the tab rail is now its only UI-facing
 * dispatcher — nothing else in the app should call it directly.
 */
interface UiShellState {
  activeTab: TabId
  setActiveTab: (id: TabId) => void
  cellMode: CellMode
  setCellMode: (mode: CellMode) => void
}

export const useUiShellStore = create<UiShellState>((set) => ({
  activeTab: DEFAULT_TAB_ID,
  setActiveTab: (id) => {
    const mode = cellModeForTab(id)
    if (mode) {
      // Printing/Milling: switch the visible tab AND the cell mode together
      // — opening one of the two mode tabs IS choosing that mode.
      set({ activeTab: id, cellMode: mode })
    } else {
      // Dashboard: opening it must not change which mode the cell is
      // configured for.
      set({ activeTab: id })
    }
  },
  cellMode: 'printing',
  setCellMode: (mode) => set({ cellMode: mode }),
}))
