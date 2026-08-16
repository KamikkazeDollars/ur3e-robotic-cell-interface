import { create } from 'zustand'
import { GCODE_SAMPLES, firstSampleIdForMode, type GcodeSample } from '../gcode/samples'
import { parseToolpath, type ParsedToolpath } from '../gcode/parseToolpath'
import { toolpathAnchorForMode } from '../gcode/toolpath-anchor'
import { compileTrajectory, type CompiledTrajectory } from '../trajectory/compile'
import {
  RAIL_CENTER_X,
  clampRailPosition,
  clampJointAngle,
  UR3E_PARKED_POSE,
  type JointAngles,
} from '../kinematics'
import { useUiShellStore } from './uiShellStore'
import type { CellMode } from '../cell-mode'

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
 * reselection (`useModeJobSync.ts`, dispatched whenever `cellMode` changes)
 * also flips `toolpathLoadStatus` to 'ready' — the SAME trigger
 * `ToolpathCameraFit.tsx` reacts to — but the user did not ask to zoom in on
 * whichever job the mode-sync silently picked for them; they asked to see
 * the rail sweep across the whole cell. `lastSelectSampleOrigin` lets
 * `ToolpathCameraFit.tsx` tell the two cases apart without `SampleSelect.tsx`
 * having to change at all (its call omits the argument, so it keeps
 * defaulting to 'manual').
 */
export type SelectSampleOrigin = 'manual' | 'mode-sync'

/**
 * Where a job's g-code text comes from — resolved once at the top of
 * `loadJobSource` (quick 260816-m6d) and never restated. A bundled sample
 * fetches its file at `filePath`; an upload already has its text in memory
 * (read via `File.text()` at the UI layer, before this store ever sees it).
 */
type JobSource =
  | { kind: 'sample'; sampleId: string }
  | { kind: 'upload'; mode: CellMode; fileName: string; text: string }

/** Size cap (bytes, approximated by JS string length — g-code is plain
 * ASCII/UTF-8 text, so this is a tight-enough proxy) for an uploaded file
 * (T-M6D-01). The parser's own `MAX_TOOLPATH_SEGMENTS` cap already bounds
 * render geometry regardless of file size; this cap exists so a huge file
 * fails fast with a visible status line instead of spending a long parse
 * pass only to hit that later ceiling. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Sentinel `selectedSampleId` value used while an uploaded job (rather than
 * a bundled sample) is loaded — matches no entry in `GCODE_SAMPLES`, so
 * `SampleSelect.tsx` can render it as a distinct, displayable-but-unselectable
 * option instead of falling back to its "select a sample" placeholder. */
export const UPLOADED_JOB_ID = '__uploaded__'

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
  /** The currently selected bundled sample's id (`GCODE_SAMPLES[].id`), the
   * `UPLOADED_JOB_ID` sentinel while an uploaded job is loaded, or `null`
   * before anything has loaded. Read by `SampleSelect.tsx`'s controlled
   * `<select>`. */
  selectedSampleId: string | null
  /** The selected job's fetch/parse status, read by the scene-status
   * overlay pattern this store already follows for the robot load. */
  toolpathLoadStatus: ToolpathLoadStatus
  /** The parsed, classified, D-06-anchored toolpath — `null` until a
   * selection resolves successfully. `Toolpath.tsx` reads this to render. */
  toolpath: ParsedToolpath | null
  /** The compiled IK trajectory for the currently selected job — `null`
   * until a load both parses AND compiles successfully. Compiled exactly
   * once per load (never on a scrub-drag event), inside the same
   * stale-request guard `toolpath` itself is set under, so a superseded
   * compile can never reach the store. */
  trajectory: CompiledTrajectory | null
  /** The rail position of the last successfully-compiled trajectory (04-REVIEW
   * CR-01). Defaults to `RAIL_CENTER_X` and is updated ONLY alongside
   * `trajectory` in the loader's success branch — the null-out branches
   * (unknown id, entering 'parsing', fetch/compile failure) deliberately
   * leave it untouched. `trajectory` itself goes `null` synchronously the
   * moment a new selection is dispatched, before the async fetch/parse/
   * compile resolves; without a separate "last known good" field,
   * `CellScene.tsx`'s rail-position selector had nothing to fall back to but
   * the hardcoded rail midpoint, so every reselection (including every mode
   * switch, which intentionally parks the carriage off-centre) made the
   * carriage visibly snap through `RAIL_CENTER_X` before settling on the new
   * trajectory's real position. This field only ever moves forward to a real
   * solve, never resets, so the fallback always reads the carriage's true
   * last on-screen position instead of an arbitrary constant. */
  lastRailPos: number
  /** The `SelectSampleOrigin` of the most recently DISPATCHED load, written
   * on every branch (unknown-id, parsing-entry, success, failure) alongside
   * that branch's other fields — the same every-branch-writes-together
   * convention `scrubFraction`/`livePlayback.fraction` already follow.
   * Read (never subscribed) by `ToolpathCameraFit.tsx` inside its own
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
  /** True once `play()` has been dispatched at least once for the CURRENT
   * job (quick 260816-m6d). `App.tsx` gates `ScrubControl`'s mount on this,
   * so the timeline stays hidden until the user presses Play, then stays
   * visible/draggable for the rest of that job's session. Reset to `false`
   * on every branch of the shared job loader that already resets
   * `scrubFraction` — loading a new job hides the bar again and the
   * "press Play to unlock the timeline" affordance repeats per job.
   * Deliberately NOT reset by `pause()` — the whole point is that the bar
   * stays draggable once playback has begun. */
  playbackStarted: boolean
  /** The non-reactive 60fps position channel — see file-header comment.
   * A referentially STABLE object, created once in the initial state and
   * NEVER replaced; `usePlaybackClock.ts` mutates `.fraction` directly,
   * without ever calling `set()`. */
  livePlayback: { fraction: number }
  /**
   * Resolves `sampleId` from `GCODE_SAMPLES` and loads it via the shared
   * `loadJobSource` loader. This is a once-per-selection write (the file's
   * own top-of-file rule permits it) — nothing here is written from a
   * render frame.
   *
   * `origin` defaults to `'manual'` — every pre-existing call site
   * (`SampleSelect.tsx`'s dropdown `onChange`, and every test in this file
   * written before G-04-1's checkpoint follow-up) keeps behaving exactly as
   * before with no code change required. Only `useModeJobSync.ts` passes
   * `'mode-sync'` explicitly, tagging its automatic reselection so
   * `ToolpathCameraFit.tsx` can defer to the wide Reset View framing instead
   * of the tight D-05 auto-frame a human's own dropdown pick still gets.
   */
  selectSample: (sampleId: string, origin?: SelectSampleOrigin) => Promise<void>
  /**
   * Manually commanded joint/rail pose from the Dashboard's typed
   * manual-jog controls (quick 260816-m6d). `null` means "the compiled
   * trajectory drives the robot" — today's only behaviour, so nothing
   * changes until the user types something.
   *
   * This field is allowed in a store whose own file header forbids
   * per-frame values because it changes at HUMAN TYPING cadence, not
   * per-animation-frame — its per-frame consumer (`RobotPose.tsx`) reads it
   * non-reactively via `getState()` inside `useFrame`, exactly like
   * `trajectory`/`livePlayback` above.
   */
  manualJog: { joints: JointAngles; railPos: number } | null
  /** Seeds `manualJog` from `UR3E_PARKED_POSE` and the current rail position
   * when it is currently null, then writes the clamped angle into the
   * indexed slot of a NEW tuple — never mutates the existing one, since
   * Zustand subscribers compare by reference. */
  setManualJointAngle: (jointIndex: number, radians: number) => void
  /** Same seeding rule as `setManualJointAngle`, then clamps into
   * `RAIL_TRAVEL` via `clampRailPosition`. */
  setManualRailPos: (metres: number) => void
  /** Returns `manualJog` to `null`, handing control back to the compiled
   * trajectory. Only calls `set()` when it is not already null, so a
   * repeated call cannot churn subscribers. */
  clearManualJog: () => void
  /** Per-mode uploaded job, `null` when that mode has no upload active
   * (quick 260816-m6d). Keyed per `CellMode` so a file uploaded on one tab
   * can never replace the other tab's job. */
  uploadedJobs: Record<CellMode, { fileName: string; text: string } | null>
  /** Rejects text over `MAX_UPLOAD_BYTES` by setting `toolpathLoadStatus:
   * 'error'` and leaving the previous job's `uploadedJobs` entry untouched;
   * otherwise records the entry and delegates to the shared loader with
   * `selectedSampleId` set to `UPLOADED_JOB_ID`. */
  loadUploadedGcode: (mode: CellMode, fileName: string, text: string) => Promise<void>
  /** Drops `mode`'s uploaded job and reloads its bundled sample. */
  clearUploadedJob: (mode: CellMode) => void
  /** Dispatches `mode`'s uploaded job when it has one, otherwise the first
   * bundled sample for `mode`. When a mode has neither (no bundled sample
   * and no upload), sets an idle/empty state rather than dispatching an
   * empty id. */
  loadJobForMode: (mode: CellMode, origin?: SelectSampleOrigin) => Promise<void>
}

/**
 * Monotonically increasing token guarding the shared loader against a stale
 * in-flight response (T-02-10) — the same "incrementing counter, not a
 * boolean" idiom `resetToken` already establishes in this file. Module
 * scoped rather than a `CellState` field: it is internal bookkeeping for
 * discarding superseded async work, never a rendered value, so it has no
 * business in the store shape components subscribe to.
 */
let selectSampleRequestId = 0

export const useCellStore = create<CellState>((set, get) => {
  /**
   * The shared job loader (quick 260816-m6d refactor of the original
   * `selectSample` body): fetches/reads, parses, and compiles a job from
   * either a bundled sample or an uploaded file. Preserves every behaviour
   * the original single-purpose function established — the monotonic
   * `selectSampleRequestId` stale-response guard, resolving the anchor
   * BEFORE the first await, compiling inside the same guard before any
   * further await, writing `lastRailPos` only on the success branch,
   * resetting `scrubFraction`/`livePlayback.fraction`/`isPlaying`/
   * `playbackStarted`/`manualJog` on every branch, and recording
   * `lastSelectSampleOrigin` on every branch. For an upload the only
   * difference is where the g-code text comes from (the in-memory string
   * instead of `fetch`) and that the anchor is resolved from the source's
   * own `mode` rather than the live store read.
   */
  async function loadJobSource(source: JobSource, origin: SelectSampleOrigin): Promise<void> {
    selectSampleRequestId += 1
    const requestId = selectSampleRequestId

    let sample: GcodeSample | undefined
    if (source.kind === 'sample') {
      sample = GCODE_SAMPLES.find((candidate) => candidate.id === source.sampleId)
      if (!sample) {
        // Reset both scrub channels here too (not just the success path
        // below) so an unknown sampleId can't leave the marker/robot pose
        // parked at a stale fraction left over from whatever was selected
        // before.
        get().livePlayback.fraction = 0
        get().clearManualJog()
        set({
          selectedSampleId: source.sampleId,
          toolpathLoadStatus: 'error',
          toolpath: null,
          trajectory: null,
          isPlaying: false,
          playbackStarted: false,
          scrubFraction: 0,
          lastSelectSampleOrigin: origin,
        })
        return
      }
    }

    const selectedSampleId = source.kind === 'upload' ? UPLOADED_JOB_ID : source.sampleId

    // Same reset on entering 'parsing': the previous job's trajectory is
    // being torn down (toolpath/trajectory: null above), so its scrub
    // position must go with it rather than surviving into the new load.
    get().livePlayback.fraction = 0
    get().clearManualJog()
    set({
      selectedSampleId,
      toolpathLoadStatus: 'parsing',
      toolpath: null,
      trajectory: null,
      isPlaying: false,
      playbackStarted: false,
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
    // selection through `useModeJobSync`, and the request-id guard below
    // already discards any selection this one supersedes. An upload instead
    // resolves the anchor from the source's OWN mode, not the live store —
    // it was uploaded for a specific tab and must anchor there even if the
    // active tab has since changed.
    const anchor =
      source.kind === 'upload'
        ? toolpathAnchorForMode(source.mode)
        : toolpathAnchorForMode(useUiShellStore.getState().cellMode)

    try {
      let gcodeText: string
      if (source.kind === 'upload') {
        gcodeText = source.text
      } else {
        const response = await fetch(sample!.filePath)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${sample!.filePath}: ${response.status}`)
        }
        gcodeText = await response.text()
      }

      const toolpath = parseToolpath(gcodeText, anchor)
      // Stale-response guard (T-02-10): if a newer load has started since
      // this one began, this response is superseded — discard it rather
      // than stamping a newer selection with an older result. A slow fetch
      // resolving after a faster, later selection would otherwise leave the
      // scene showing whichever fetch happened to resolve last, a
      // last-write-wins race that only shows up on a slow connection —
      // exactly when a live demo is running.
      if (requestId !== selectSampleRequestId) return
      // Trajectory compile runs here, still inside the stale-request guard
      // above and before any further await — so an older selection's
      // compile can never land after a newer selection has already reset
      // the store (03-01-PLAN.md must_haves).
      const trajectory = compileTrajectory(toolpath)
      // isPlaying/playbackStarted: false and livePlayback.fraction reset
      // alongside scrubFraction so picking a new job mid-run stops the
      // clock instead of animating a stale position against a fresh
      // trajectory, and hides the scrub bar again until Play is pressed
      // for this job.
      get().livePlayback.fraction = 0
      get().clearManualJog()
      set({
        toolpath,
        toolpathLoadStatus: 'ready',
        trajectory,
        // 04-REVIEW CR-01: the only branch that ever writes lastRailPos —
        // it must move forward exactly alongside a successful trajectory
        // compile and never reset in the null-out branches below.
        lastRailPos: trajectory.railPos,
        scrubFraction: 0,
        isPlaying: false,
        playbackStarted: false,
        lastSelectSampleOrigin: origin,
      })
    } catch (err) {
      console.error('Failed to load g-code job:', err)
      // Same discard on the failure path: a slow failure must not stamp an
      // error status over a newer selection that already succeeded.
      if (requestId !== selectSampleRequestId) return
      get().livePlayback.fraction = 0
      get().clearManualJog()
      set({
        toolpathLoadStatus: 'error',
        toolpath: null,
        trajectory: null,
        isPlaying: false,
        playbackStarted: false,
        scrubFraction: 0,
        lastSelectSampleOrigin: origin,
      })
    }
  }

  return {
    resetToken: 0,
    requestCameraReset: () => set((state) => ({ resetToken: state.resetToken + 1 })),
    robotLoadStatus: 'loading',
    setRobotLoadStatus: (status) => set({ robotLoadStatus: status }),
    selectedSampleId: null,
    toolpathLoadStatus: 'idle',
    toolpath: null,
    trajectory: null,
    lastRailPos: RAIL_CENTER_X,
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
    play: () => {
      // Pressing Play means "run the toolpath" — it must take the robot back
      // off manual command (quick 260816-m6d).
      get().clearManualJog()
      set({ isPlaying: true, playbackStarted: true })
    },
    pause: () => set({ isPlaying: false }),
    playbackStarted: false,
    livePlayback: { fraction: 0 },
    selectSample: (sampleId, origin = 'manual') => loadJobSource({ kind: 'sample', sampleId }, origin),
    manualJog: null,
    setManualJointAngle: (jointIndex, radians) => {
      const seed = get().manualJog ?? {
        joints: UR3E_PARKED_POSE,
        railPos: get().trajectory?.railPos ?? get().lastRailPos,
      }
      const nextJoints = [...seed.joints] as JointAngles
      nextJoints[jointIndex] = clampJointAngle(jointIndex, radians)
      set({ manualJog: { joints: nextJoints, railPos: seed.railPos } })
    },
    setManualRailPos: (metres) => {
      const seed = get().manualJog ?? {
        joints: UR3E_PARKED_POSE,
        railPos: get().trajectory?.railPos ?? get().lastRailPos,
      }
      set({ manualJog: { joints: seed.joints, railPos: clampRailPosition(metres) } })
    },
    clearManualJog: () => {
      if (get().manualJog !== null) set({ manualJog: null })
    },
    uploadedJobs: { printing: null, milling: null },
    loadUploadedGcode: async (mode, fileName, text) => {
      if (text.length > MAX_UPLOAD_BYTES) {
        set({ toolpathLoadStatus: 'error' })
        return
      }
      set((state) => ({
        uploadedJobs: { ...state.uploadedJobs, [mode]: { fileName, text } },
      }))
      await loadJobSource({ kind: 'upload', mode, fileName, text }, 'manual')
    },
    clearUploadedJob: (mode) => {
      set((state) => ({
        uploadedJobs: { ...state.uploadedJobs, [mode]: null },
      }))
      void get().loadJobForMode(mode, 'manual')
    },
    loadJobForMode: async (mode, origin = 'manual') => {
      const uploaded = get().uploadedJobs[mode]
      if (uploaded) {
        await loadJobSource({ kind: 'upload', mode, fileName: uploaded.fileName, text: uploaded.text }, origin)
        return
      }
      const sampleId = firstSampleIdForMode(mode)
      if (sampleId === null) {
        // A mode with no bundled sample and no upload degrades to an idle,
        // empty state rather than dispatching an empty id.
        get().livePlayback.fraction = 0
        get().clearManualJog()
        set({
          selectedSampleId: null,
          toolpathLoadStatus: 'idle',
          toolpath: null,
          trajectory: null,
          isPlaying: false,
          playbackStarted: false,
          scrubFraction: 0,
          lastSelectSampleOrigin: origin,
        })
        return
      }
      await get().selectSample(sampleId, origin)
    },
  }
})
