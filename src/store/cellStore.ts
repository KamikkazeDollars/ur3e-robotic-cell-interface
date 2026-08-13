import { create } from 'zustand'

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
}

export const useCellStore = create<CellState>((set) => ({
  resetToken: 0,
  requestCameraReset: () => set((state) => ({ resetToken: state.resetToken + 1 })),
  robotLoadStatus: 'loading',
  setRobotLoadStatus: (status) => set({ robotLoadStatus: status }),
}))
