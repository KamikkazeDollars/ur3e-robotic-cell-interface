import { create } from 'zustand'
import { DEFAULT_TAB_ID, type TabId } from '../ui/tabs/tab-registry'
import type { CellMode } from '../cell-mode'

/** Which mode the cell is set to — drives `ModeBar`'s segmented control and
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
 * U-5 revert (quick 260816-nup): quick 260816-m6d coupled the tab id and
 * the cell mode together (clicking Printing/Milling both switched the
 * visible panel AND the cell mode). With Printing/Milling moved back to
 * the compact top `ModeBar` and the rail down to a single toggleable
 * Dashboard entry, that coupling has no tab left to live on — `cellMode`
 * dispatch is once again ONLY `setCellMode`, called directly by `ModeBar`.
 *
 * Quick 260817-gdv (Task 2) — tab identity split from panel-open: with a
 * second real tab landing (Free Movement, alongside the renamed Run), the
 * old nullable `activeTab | null` design (U-5) stopped working: it
 * conflated "which tab am I on" with "is the docked panel showing", so
 * closing the panel would also mean "on no tab" — which the Task 3
 * playback-visibility gate (`showsPlaybackControls(activeTab)`) needs to
 * answer unambiguously, and which would otherwise silently strip the Play
 * button from the app's default opening state. `activeTab` is now a
 * non-nullable `TabId`, defaulting to `DEFAULT_TAB_ID` ('run'), and a
 * separate `panelOpen: boolean` (default `false`) carries the docked-panel
 * toggle that `activeTab | null` used to encode. Net effect: the app still
 * opens on a full-width scene (panelOpen starts false) WITH the Play button
 * available (activeTab starts 'run'), and "which tab am I on" is now a
 * testable input independent of whether the panel happens to be open.
 *
 * `setActiveTab(id)`:
 * - same id as the current `activeTab` -> TOGGLE `panelOpen` only (matches
 *   the old toggle-to-close behaviour for the tab you're already on).
 * - different id -> switch `activeTab` to it AND force `panelOpen` true
 *   (clicking a different destination always opens the panel on it).
 *
 * `cellMode` dispatch is still only `setCellMode` — this split does not
 * reopen that boundary.
 */
interface UiShellState {
  activeTab: TabId
  panelOpen: boolean
  setActiveTab: (id: TabId) => void
  cellMode: CellMode
  setCellMode: (mode: CellMode) => void
}

export const useUiShellStore = create<UiShellState>((set, get) => ({
  activeTab: DEFAULT_TAB_ID,
  panelOpen: false,
  setActiveTab: (id) => {
    if (get().activeTab === id) {
      set({ panelOpen: !get().panelOpen })
    } else {
      set({ activeTab: id, panelOpen: true })
    }
  },
  cellMode: 'printing',
  setCellMode: (mode) => set({ cellMode: mode }),
}))
