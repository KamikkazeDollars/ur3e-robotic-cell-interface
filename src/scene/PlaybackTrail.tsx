import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Line2, LineSegments2 } from 'three-stdlib'
import { useCellStore } from '../store/cellStore'
import { buildTrailGeometry, traversedSegmentCount } from './trail-progress'

// D-06/D-07: a bright teal in the same family as `ScrubMarker.tsx`'s
// `SCRUB_MARKER_COLOR` (#0F766E), so the highlight and the marker read as
// one system — deliberately NOT `Toolpath.tsx`'s `RAPID_COLOR`/
// `CUTTING_COLOR`, nor the app's accent red (nav cube hover / active-tab
// indicator).
export const TRAIL_COLOR = '#2DD4BF'

// Strictly wider than `Toolpath.tsx`'s (unexported) `CUTTING_LINE_WIDTH`
// (currently 6), so the highlight reads as a band drawn around the base
// stroke rather than a coincident line fighting it at equal width.
const TRAIL_LINE_WIDTH = 9

/**
 * The traversed-path highlight (gap closure G-04-1). Grows over the drawn
 * toolpath as playback advances, driven imperatively per frame exactly like
 * `ScrubMarker.tsx`: the only per-frame writes are the line geometry's
 * `instanceCount` (an existing `InstancedBufferGeometry`'s integer draw
 * count — `LineSegmentsGeometry`, which `LineGeometry` extends, already
 * carries it) and the object's `visible` flag. No geometry, material, or
 * vector/colour object is ever constructed inside the frame callback
 * (CLAUDE.md's per-frame-allocation anti-pattern; T-04-13's threat
 * disposition relies on this).
 *
 * Subscribes reactively to `trajectory` only — a once-per-sample-selection
 * value, the coarse cadence `cellStore.ts`'s header comment sanctions for
 * reactive selectors — and memoizes `buildTrailGeometry` on it.
 * `livePlayback` is read via `useCellStore.getState()` inside `useFrame`,
 * the same idiom `ScrubMarker.tsx`/`RobotPose.tsx` use, so this component
 * never itself forces a React re-render at animation cadence.
 */
export default function PlaybackTrail() {
  const trajectory = useCellStore((state) => state.trajectory)
  const trail = useMemo(() => buildTrailGeometry(trajectory), [trajectory])

  const lineRef = useRef<Line2 | LineSegments2>(null)

  // Hooks called unconditionally, above the render below, so hook order
  // stays stable regardless of whether `trail` is present this render.
  useFrame(() => {
    const line = lineRef.current
    if (!line || !trail) return

    const { livePlayback } = useCellStore.getState()
    const count = traversedSegmentCount(trail, livePlayback.fraction)
    line.geometry.instanceCount = count
    line.visible = count > 0
  })

  if (!trail) return null

  return (
    <Line
      ref={lineRef}
      points={trail.points}
      color={TRAIL_COLOR}
      lineWidth={TRAIL_LINE_WIDTH}
      // Not `segments` — unlike `Toolpath.tsx`'s disjoint-pair rapid/cutting
      // buckets, the trail points form one continuous polyline.
      //
      // renderOrder 1 makes the highlight draw AFTER `Toolpath`'s
      // default-order (0) lines, so at equal depth three.js's default
      // `LessEqualDepth` test lets the highlight win instead of z-fighting
      // with the base stroke. This is why the depth test is left enabled
      // (never `depthTest={false}`) — disabling it would also draw the
      // highlight through the robot mesh.
      renderOrder={1}
      visible={false}
    />
  )
}
