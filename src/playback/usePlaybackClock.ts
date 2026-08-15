import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCellStore } from '../store/cellStore'
import {
  UNIFORM_FRACTION_MAPPING,
  resumeElapsedSeconds,
  stepClock,
  type ClockState,
  type FractionMapping,
} from './clock-step'
import type { ParsedToolpath } from '../gcode/parseToolpath'

/** The active mapping together with the `ParsedToolpath` object identity it
 * was built for — rebuilt only when the loaded sample changes, never every
 * frame. Plan 04-02 swaps `UNIFORM_FRACTION_MAPPING` for
 * `buildDurationMapping(toolpath, trajectory)` here with no other change. */
interface MappingRecord {
  toolpath: ParsedToolpath
  mapping: FractionMapping
}

/**
 * R3F hook driving the playback clock (Phase 4, tracer plan 04-01). Mirrors
 * `ScrubMarker.tsx`'s `useFrame` + `getState()` idiom: reads `isPlaying`/
 * `trajectory`/`scrubFraction` imperatively every frame rather than via a
 * reactive selector, so this hook never itself causes a React re-render.
 *
 * This hook must never solve inverse kinematics and must never import from
 * `src/kinematics` — Phase 3 already precomputed every pose; re-deriving
 * one here would reintroduce the branch-flip and singularity failures
 * Phase 3 closed.
 */
export default function usePlaybackClock() {
  const clockStateRef = useRef<ClockState>({ elapsedSeconds: 0, sinceSyncSeconds: 0 })
  const mappingRecordRef = useRef<MappingRecord | null>(null)
  const wasPlayingRef = useRef(false)

  useFrame((_state, rawDelta) => {
    const { isPlaying, toolpath, trajectory, scrubFraction, setScrubFraction, pause, livePlayback } =
      useCellStore.getState()

    if (!isPlaying || !toolpath || !trajectory || trajectory.samples.length === 0) {
      wasPlayingRef.current = false
      return
    }

    // Rebuild the mapping only when it doesn't exist yet or the loaded
    // sample changed — cheap: built once per selection, not per frame.
    if (!mappingRecordRef.current || mappingRecordRef.current.toolpath !== toolpath) {
      mappingRecordRef.current = { toolpath, mapping: UNIFORM_FRACTION_MAPPING }
    }
    const mapping = mappingRecordRef.current.mapping

    // Re-seed on the TRANSITION into playing, not only on a toolpath
    // change — load-bearing: a user who pauses, drags the slider, and
    // presses Play again must resume from the dragged position (D-05),
    // which only happens if the elapsed seed is recomputed on every Play
    // press, not just once per sample.
    if (!wasPlayingRef.current) {
      wasPlayingRef.current = true
      clockStateRef.current = {
        elapsedSeconds: resumeElapsedSeconds(scrubFraction, mapping),
        sinceSyncSeconds: 0,
      }
    }

    const step = stepClock(clockStateRef.current, rawDelta, mapping)
    clockStateRef.current = { elapsedSeconds: step.elapsedSeconds, sinceSyncSeconds: step.sinceSyncSeconds }

    // 60fps, non-reactive write — RobotPose.tsx/ScrubMarker.tsx read this
    // every frame via getState(), never a reactive selector.
    livePlayback.fraction = step.fraction

    // Throttled reactive sync — keeps the slider + D-05 resume anchor
    // honest without re-rendering ScrubControl.tsx at animation frequency.
    if (step.shouldSync) {
      setScrubFraction(step.fraction)
    }

    if (step.finished) {
      // D-06: the run stops, the final pose is held because
      // livePlayback.fraction stays at 1, and the control reads "Play"
      // again.
      pause()
      wasPlayingRef.current = false
    }
  })
}
