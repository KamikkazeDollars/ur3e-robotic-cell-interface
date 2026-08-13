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
}

export const useCellStore = create<CellState>((set) => ({
  resetToken: 0,
  requestCameraReset: () => set((state) => ({ resetToken: state.resetToken + 1 })),
}))
