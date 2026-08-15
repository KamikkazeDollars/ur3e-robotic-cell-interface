import { create } from 'zustand'
import { DEFAULT_TAB_ID, type TabId } from '../ui/tabs/tab-registry'
import type { CellMode } from '../cell-mode'

/** Which mode the cell is set to — drives the ModeBar segmented control and
 * the mounted-tool chip only. This is the Phase 7 surface (TOOL-01/TOOL-02):
 * visual-only this pass, and must not be read by anything under
 * `src/scene/`, `src/trajectory/` or `src/kinematics/` — Phase 7 owns the
 * real tool-changer swap.
 *
 * The union itself now lives in `src/cell-mode.ts` (G-04-1 gap closure):
 * `src/gcode/samples.ts` also needs it to tag bundled samples with a mode,
 * and a dependency-free module lets it reach the type without importing
 * this store. Re-exported here so the existing
 * `import { useUiShellStore, type CellMode } from '../../store/uiShellStore'`
 * form (`ModeBar.tsx`) keeps compiling unchanged. */
export type { CellMode }

/**
 * Pure UI-chrome state, kept in a store separate from `cellStore` on
 * purpose: `cellStore` holds simulation truth (toolpath, trajectory, scrub),
 * this holds which tab/mode the shell displays. Keeping them apart means a
 * later phase can delete or rewire this store without touching simulation
 * state.
 */
interface UiShellState {
  activeTab: TabId
  setActiveTab: (id: TabId) => void
  cellMode: CellMode
  setCellMode: (mode: CellMode) => void
}

export const useUiShellStore = create<UiShellState>((set) => ({
  activeTab: DEFAULT_TAB_ID,
  setActiveTab: (id) => set({ activeTab: id }),
  cellMode: 'printing',
  setCellMode: (mode) => set({ cellMode: mode }),
}))
