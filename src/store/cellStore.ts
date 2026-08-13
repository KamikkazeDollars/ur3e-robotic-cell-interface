import { create } from 'zustand'
import { GCODE_SAMPLES } from '../gcode/samples'
import { parseToolpath, type ParsedToolpath } from '../gcode/parseToolpath'

/**
 * Minimal, coarse-cadence Zustand store — the shape Phases 5-8 extend.
 *
 * Hard constraint (CLAUDE.md / 01-RESEARCH.md Anti-Patterns): this store
 * carries UI-cadence intent only, never per-frame values. Joint angles, TCP
 * position, camera position, and any other value that changes on a render
 * frame must stay in refs/imperative Three.js updates (`useFrame`), not
 * here — pushing per-frame values through Zustand/React state forces a
 * full re-render every animation tick.
 */
/** Coarse-cadence robot-model load status — changes at most twice in the
 * app's lifetime (loading -> ready, or loading -> error), so it belongs in
 * the store unlike per-frame values (CLAUDE.md anti-pattern). */
export type RobotLoadStatus = 'loading' | 'ready' | 'error'

/** Coarse-cadence toolpath load status — changes once per sample selection
 * (idle -> parsing -> ready, or idle -> parsing -> error), same rationale as
 * `RobotLoadStatus`: this is UI-cadence intent, not a per-frame value. */
export type ToolpathLoadStatus = 'idle' | 'parsing' | 'ready' | 'error'

interface CellState {
  /**
   * Monotonically increasing token, not a boolean flag. A boolean would
   * need a manual clear and would silently swallow a second click (the
   * state wouldn't change on the second `true -> true` "reset"); an
   * incrementing token produces a distinct value on every call, so every
   * click of "Reset View" fires the listener, no matter how many times in
   * a row.
   */
  resetToken: number
  /** Signals intent to restore the camera to the shared default framing. */
  requestCameraReset: () => void
  /** The UR3e URDF load status, read by `SceneStatusOverlay`. Starts at
   * 'loading' — the model has not loaded when the app first mounts. */
  robotLoadStatus: RobotLoadStatus
  /** Set by RobotModel's loader success/failure callbacks. Transitions are
   * not one-way (e.g. a future reload could go ready -> loading -> error). */
  setRobotLoadStatus: (status: RobotLoadStatus) => void
  /** The currently selected bundled sample's id (`GCODE_SAMPLES[].id`), or
   * `null` before the user picks one. Read by `SampleSelect.tsx`'s
   * controlled `<select>`. */
  selectedSampleId: string | null
  /** The selected sample's fetch/parse status, read by the scene-status
   * overlay pattern this store already follows for the robot load. */
  toolpathLoadStatus: ToolpathLoadStatus
  /** The parsed, classified, D-06-anchored toolpath — `null` until a
   * selection resolves successfully. `Toolpath.tsx` reads this to render. */
  toolpath: ParsedToolpath | null
  /**
   * Resolves `sampleId` from `GCODE_SAMPLES`, fetches its bundled file, and
   * parses it via `parseToolpath`. This is a once-per-selection write (the
   * file's own top-of-file rule permits it) — nothing here is written from
   * a render frame. Wrapped in try/catch so a parse/fetch failure lands on
   * status 'error' instead of throwing into React.
   */
  selectSample: (sampleId: string) => Promise<void>
}

export const useCellStore = create<CellState>((set) => ({
  resetToken: 0,
  requestCameraReset: () => set((state) => ({ resetToken: state.resetToken + 1 })),
  robotLoadStatus: 'loading',
  setRobotLoadStatus: (status) => set({ robotLoadStatus: status }),
  selectedSampleId: null,
  toolpathLoadStatus: 'idle',
  toolpath: null,
  selectSample: async (sampleId) => {
    const sample = GCODE_SAMPLES.find((candidate) => candidate.id === sampleId)
    if (!sample) {
      set({ selectedSampleId: sampleId, toolpathLoadStatus: 'error', toolpath: null })
      return
    }

    set({ selectedSampleId: sampleId, toolpathLoadStatus: 'parsing', toolpath: null })

    try {
      const response = await fetch(sample.filePath)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${sample.filePath}: ${response.status}`)
      }
      const gcodeText = await response.text()
      const toolpath = parseToolpath(gcodeText)
      set({ toolpath, toolpathLoadStatus: 'ready' })
    } catch (err) {
      console.error('Failed to load g-code sample:', err)
      set({ toolpathLoadStatus: 'error', toolpath: null })
    }
  },
}))
