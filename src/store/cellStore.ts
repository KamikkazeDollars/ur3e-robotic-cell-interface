import { create } from 'zustand'
import { GCODE_SAMPLES } from '../gcode/samples'
import { parseToolpath, type ParsedToolpath } from '../gcode/parseToolpath'
import { toolpathAnchorForMode } from '../gcode/toolpath-anchor'
import { compileTrajectory, type CompiledTrajectory } from '../trajectory/compile'
import { useUiShellStore } from './uiShellStore'

/**
 * Minimal, coarse-cadence Zustand store — the shape Phases 5-8 extend.
 *
 * Hard constraint (CLAUDE.md / 01-RESEARCH.md Anti-Patterns): this store
 * carries UI-cadence intent only, never per-frame values. Joint angles, TCP
 * position, camera position, and any other value that changes on a render
 * frame must stay in refs/imperative Three.js updates (`useFrame`), not
 * here — pushing per-frame values through Zustand/React state forces a
 * full re-render every animation tick.
 *
 * `scrubFraction` is itself a coarse-cadence, drag-TICK value (one `set()`
 * per range-input `onChange` event), not a per-animation-frame value: it is
 * WHAT the user is asking for, read at whatever cadence the browser fires
 * `onChange` at. The per-frame consumer of it (`src/scene/RobotPose.tsx`)
 * reads it via `getState()` inside `useFrame`, never through a reactive
 * selector — no per-animation-frame value is ever WRITTEN here.
 *
 * Phase 4 (playback) adds a SECOND, non-reactive channel: `livePlayback`.
 * `scrubFraction` already has a subscribed reactive DOM consumer
 * (`ScrubControl.tsx`'s slider), so `usePlaybackClock.ts` cannot write its
 * 60fps position into it directly without re-rendering that slider every
 * animation frame — the exact anti-pattern this file's header already
 * forbids. `livePlayback.fraction` is the escape hatch: a referentially
 * stable object, mutated by direct property assignment (never `set()`), so
 * Zustand never notifies subscribers on that write. `RobotPose.tsx`/
 * `ScrubMarker.tsx` read it via `getState()` inside their own `useFrame`
 * loops, exactly as they already read `trajectory`. `setScrubFraction`
 * keeps the two channels in lockstep on every REACTIVE write (a manual
 * drag, or the clock's own throttled sync), so the scene never reads a
 * stale value between throttled syncs.
 */
/** Coarse-cadence robot-model load status — changes at most twice in the
 * app's lifetime (loading -> ready, or loading -> error), so it belongs in
 * the store unlike per-frame values (CLAUDE.md anti-pattern). */
export type RobotLoadStatus = 'loading' | 'ready' | 'error'

/** Coarse-cadence toolpath load status — changes once per sample selection
 * (idle -> parsing -> ready, or idle -> parsing -> error), same rationale as
 * `RobotLoadStatus`: this is UI-cadence intent, not a per-frame value. */
export type ToolpathLoadStatus = 'idle' | 'parsing' | 'ready' | 'error'

/**
 * Distinguishes who dispatched a `selectSample` call (G-04-1 checkpoint
 * follow-up, plan 04-06). A manual dropdown pick (`SampleSelect.tsx`, the
 * default when no origin is passed) wants the existing tight D-05 auto-frame
 * `ToolpathCameraFit.tsx` performs on load. A mode switch's automatic
 * reselection (`useCellModeSampleSync.ts`, dispatched when the loaded sample
 * no longer matches the newly active mode) also flips `toolpathLoadStatus`
 * to 'ready' — the SAME trigger `ToolpathCameraFit.tsx` reacts to — but the
 * user did not ask to zoom in on whichever job the mode-sync silently
 * picked for them; they asked to see the rail sweep across the whole cell.
 * `lastSelectSampleOrigin` lets `ToolpathCameraFit.tsx` tell the two cases
 * apart without `SampleSelect.tsx` having to change at all (its call omits
 * the argument, so it keeps defaulting to 'manual').
 */
export type SelectSampleOrigin = 'manual' | 'mode-sync'

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
  /** The compiled IK trajectory for the currently selected sample — `null`
   * until `selectSample` both parses AND compiles successfully. Compiled
   * exactly once per sample selection (never on a scrub-drag event), inside
   * the same stale-request guard `toolpath` itself is set under, so a
   * superseded compile can never reach the store. */
  trajectory: CompiledTrajectory | null
  /** The `SelectSampleOrigin` of the most recently DISPATCHED `selectSample`
   * call, written on every branch (unknown-id, parsing-entry, success,
   * failure) alongside that branch's other fields — the same
   * every-branch-writes-together convention `scrubFraction`/
   * `livePlayback.fraction` already follow in this function. Read (never
   * subscribed) by `ToolpathCameraFit.tsx` inside its own
   * `toolpathLoadStatus` effect, via `getState()`, exactly as that effect
   * already reads `toolpath.bounds` non-reactively. */
  lastSelectSampleOrigin: SelectSampleOrigin
  /** Coarse-cadence scrub position in [0, 1] along the current trajectory's
   * arc-length parameterisation — see the file-header comment above. */
  scrubFraction: number
  /** Clamps into [0, 1] before writing, so a scrub control can never push
   * the store out of the range `pointAtFraction` accepts. Also keeps
   * `livePlayback.fraction` in lockstep (see file-header comment) —
   * NEVER sets `isPlaying`: `usePlaybackClock.ts`'s own throttled sync
   * calls this same setter, so a setter that stopped playback would make
   * a running clock stop itself on its first sync tick (Pitfall 4). */
  setScrubFraction: (fraction: number) => void
  /** Discrete, human-interaction-frequency toggle — a Play/Pause press is
   * UI cadence, not a per-frame value, so this is a normal reactive field,
   * mirroring the `robotLoadStatus`/`setRobotLoadStatus` convention. */
  isPlaying: boolean
  /** Dispatched by `PlaybackControl.tsx`'s Play button. */
  play: () => void
  /** Dispatched by `PlaybackControl.tsx`'s Pause button, and by
   * `usePlaybackClock.ts` itself when the run reaches the end (D-06). */
  pause: () => void
  /** The non-reactive 60fps position channel — see file-header comment.
   * A referentially STABLE object, created once in the initial state and
   * NEVER replaced; `usePlaybackClock.ts` mutates `.fraction` directly,
   * without ever calling `set()`. */
  livePlayback: { fraction: number }
  /**
   * Resolves `sampleId` from `GCODE_SAMPLES`, fetches its bundled file, and
   * parses it via `parseToolpath`. This is a once-per-selection write (the
   * file's own top-of-file rule permits it) — nothing here is written from
   * a render frame. Wrapped in try/catch so a parse/fetch failure lands on
   * status 'error' instead of throwing into React. Immediately after
   * `parseToolpath` succeeds (inside the same stale-request guard),
   * compiles the trajectory via `compileTrajectory` and resets
   * `scrubFraction` to zero for the new sample.
   *
   * `origin` defaults to `'manual'` — every pre-existing call site
   * (`SampleSelect.tsx`'s dropdown `onChange`, and every test in this
   * file written before G-04-1's checkpoint follow-up) keeps behaving
   * exactly as before with no code change required. Only
   * `useCellModeSampleSync.ts` passes `'mode-sync'` explicitly, tagging its
   * automatic reselection so `ToolpathCameraFit.tsx` can defer to the wide
   * Reset View framing instead of the tight D-05 auto-frame a human's own
   * dropdown pick still gets.
   */
  selectSample: (sampleId: string, origin?: SelectSampleOrigin) => Promise<void>
}

/**
 * Monotonically increasing token guarding `selectSample` against a stale
 * in-flight response (T-02-10) — the same "incrementing counter, not a
 * boolean" idiom `resetToken` already establishes in this file. Module
 * scoped rather than a `CellState` field: it is internal bookkeeping for
 * discarding superseded async work, never a rendered value, so it has no
 * business in the store shape components subscribe to.
 */
let selectSampleRequestId = 0

export const useCellStore = create<CellState>((set, get) => ({
  resetToken: 0,
  requestCameraReset: () => set((state) => ({ resetToken: state.resetToken + 1 })),
  robotLoadStatus: 'loading',
  setRobotLoadStatus: (status) => set({ robotLoadStatus: status }),
  selectedSampleId: null,
  toolpathLoadStatus: 'idle',
  toolpath: null,
  trajectory: null,
  lastSelectSampleOrigin: 'manual',
  scrubFraction: 0,
  setScrubFraction: (fraction) => {
    const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
    // Keep the non-reactive channel in lockstep on every REACTIVE write
    // (manual drag OR the clock's own throttled sync) so RobotPose.tsx/
    // ScrubMarker.tsx never read a stale value between throttled syncs.
    get().livePlayback.fraction = clamped
    set({ scrubFraction: clamped })
  },
  isPlaying: false,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  livePlayback: { fraction: 0 },
  selectSample: async (sampleId, origin = 'manual') => {
    selectSampleRequestId += 1
    const requestId = selectSampleRequestId

    const sample = GCODE_SAMPLES.find((candidate) => candidate.id === sampleId)
    if (!sample) {
      // Reset both scrub channels here too (not just the success path below)
      // so an unknown sampleId can't leave the marker/robot pose parked at a
      // stale fraction left over from whatever was selected before.
      get().livePlayback.fraction = 0
      set({
        selectedSampleId: sampleId,
        toolpathLoadStatus: 'error',
        toolpath: null,
        trajectory: null,
        isPlaying: false,
        scrubFraction: 0,
        lastSelectSampleOrigin: origin,
      })
      return
    }

    // Same reset on entering 'parsing': the previous sample's trajectory is
    // being torn down (toolpath/trajectory: null above), so its scrub
    // position must go with it rather than surviving into the new load.
    get().livePlayback.fraction = 0
    set({
      selectedSampleId: sampleId,
      toolpathLoadStatus: 'parsing',
      toolpath: null,
      trajectory: null,
      isPlaying: false,
      scrubFraction: 0,
      lastSelectSampleOrigin: origin,
    })

    // G-04-1 gap closure: resolve the anchor from the cell's mode BEFORE the
    // first await, so it reflects the mode as it was when this selection was
    // dispatched rather than whatever it drifted to during the fetch. Read
    // via getState() (never a subscription) — this store is not a React
    // component and must not acquire one. `parseToolpath` itself is pure and
    // must not know about UI state, so this store — the one component that
    // already orchestrates fetch, parse and compile for a selection — is
    // where the cell's current configuration is resolved into a world-space
    // station. A mode change during an in-flight load dispatches its own
    // selection through `useCellModeSampleSync`, and the request-id guard
    // below already discards any selection this one supersedes.
    const anchor = toolpathAnchorForMode(useUiShellStore.getState().cellMode)

    try {
      const response = await fetch(sample.filePath)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${sample.filePath}: ${response.status}`)
      }
      const gcodeText = await response.text()
      const toolpath = parseToolpath(gcodeText, anchor)
      // Stale-response guard (T-02-10): if a newer selectSample call has
      // started since this one began, this response is superseded — discard
      // it rather than stamping a newer selection with an older result. A
      // slow fetch resolving after a faster, later selection would
      // otherwise leave the scene showing whichever fetch happened to
      // resolve last, a last-write-wins race that only shows up on a slow
      // connection — exactly when a live demo is running.
      if (requestId !== selectSampleRequestId) return
      // Trajectory compile runs here, still inside the stale-request guard
      // above and before any further await — so an older selection's
      // compile can never land after a newer selection has already reset
      // the store (03-01-PLAN.md must_haves).
      const trajectory = compileTrajectory(toolpath)
      // isPlaying: false and livePlayback.fraction reset alongside
      // scrubFraction so picking a new sample mid-run stops the clock
      // instead of animating a stale position against a fresh trajectory.
      get().livePlayback.fraction = 0
      set({
        toolpath,
        toolpathLoadStatus: 'ready',
        trajectory,
        scrubFraction: 0,
        isPlaying: false,
        lastSelectSampleOrigin: origin,
      })
    } catch (err) {
      console.error('Failed to load g-code sample:', err)
      // Same discard on the failure path: a slow failure must not stamp an
      // error status over a newer selection that already succeeded.
      if (requestId !== selectSampleRequestId) return
      get().livePlayback.fraction = 0
      set({
        toolpathLoadStatus: 'error',
        toolpath: null,
        trajectory: null,
        isPlaying: false,
        scrubFraction: 0,
        lastSelectSampleOrigin: origin,
      })
    }
  },
}))
