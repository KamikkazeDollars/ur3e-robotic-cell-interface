import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { Line } from '@react-three/drei'
import { useCellStore } from '../store/cellStore'
import { toRenderBuckets } from '../gcode/parseToolpath'
import { WORKBENCH_TOP_Y } from '../gcode/toolpath-anchor'
import {
  markerRadiusFromBounds,
  guideStemRadius,
  guideFootprintRadius,
  GUIDE_FOOTPRINT_LIFT,
} from './marker-scale'

// D-03: muted gray for rapid (G0) moves, warm orange for cutting (G1/G2/G3)
// moves. Both tones are chosen to read against the current dark canvas
// (`SCENE_PALETTE.background`) and the workbench surface these markers and
// guides are drawn on (`SCENE_PALETTE.workbench`) — the readability of both
// against the bench is asserted in `marker-scale.test.ts`'s
// `MIN_MARKER_CONTRAST` gate, so this comment points at that gate rather
// than restating the property in prose.
export const RAPID_COLOR = '#9CA3AF'
export const CUTTING_COLOR = '#EA580C'

// G-02-03: both line widths roughly doubled from their original values (2/3)
// — the previous widths read as too thin to clearly distinguish move class
// at the toolpath's on-screen scale; the cutting width stays larger than the
// rapid width, preserving the existing visual hierarchy between move classes.
const RAPID_LINE_WIDTH = 4
const CUTTING_LINE_WIDTH = 6

/**
 * One start/end anchor: a marker sphere, a vertical guide stem running down
 * to the workbench surface, and a flat footprint pad on the tabletop
 * directly beneath it (G-03-4 gap closure). Bundled as one component so the
 * three pieces of a single anchor can never drift apart or be rendered
 * inconsistently between the start and end markers.
 *
 * `liftedPoint` is already raised by `radius` on Y (see `liftMarker` below)
 * so the marker's BOTTOM, not its centre, rests at the toolpath point —
 * which is also what guarantees the stem's height (liftedPoint.y minus
 * `WORKBENCH_TOP_Y`) is always positive: a marker sits at least its own
 * radius above the tabletop even at the toolpath's lowest point.
 */
function AnchoredMarker({
  point,
  liftedPoint,
  radius,
}: {
  point: readonly [number, number, number]
  liftedPoint: readonly [number, number, number]
  radius: number
}) {
  const stemRadius = guideStemRadius(radius)
  const footprintRadius = guideFootprintRadius(radius)
  const stemHeight = liftedPoint[1] - WORKBENCH_TOP_Y
  const stemCenterY = (WORKBENCH_TOP_Y + liftedPoint[1]) / 2

  return (
    <>
      <mesh position={liftedPoint}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={CUTTING_COLOR} />
      </mesh>
      {/* Guard the stem's height: skip a degenerate zero-or-negative-height
          cylinder (should not occur given the lift invariant above, but a
          geometry constructor must never receive a non-positive dimension)
          and render the footprint pad alone instead. */}
      {stemHeight > 0 && (
        <mesh position={[point[0], stemCenterY, point[2]]}>
          <cylinderGeometry args={[stemRadius, stemRadius, stemHeight, 12]} />
          <meshStandardMaterial color={CUTTING_COLOR} />
        </mesh>
      )}
      {/* Flat tabletop footprint pad — unlit (`meshBasicMaterial`) so it
          reads as a crisp target pad at any lighting angle rather than
          dimming as the key light rakes across it, and double-sided so it
          stays visible when the camera orbits below the tabletop, matching
          `CellScene.tsx`'s floor-plane treatment. */}
      <mesh
        position={[point[0], WORKBENCH_TOP_Y + GUIDE_FOOTPRINT_LIFT, point[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[footprintRadius, 24]} />
        <meshBasicMaterial color={CUTTING_COLOR} side={DoubleSide} />
      </mesh>
    </>
  )
}

/**
 * Mounts the classified toolpath as exactly two batched drei Line draw
 * calls (D-03/D-04, 02-RESEARCH.md Pattern 3) — one dash-styled gray
 * rapid-move batch, one solid warm cutting-move batch — rather than one
 * vertexColors batch, since the dash treatment is a material-level flag
 * drei's Line component can't vary per vertex. Each batch's point array is
 * read as disjoint pairs (the `segments` prop below), since a rapid or
 * cutting bucket assembled from a real toolpath is generally not one
 * continuous polyline (rapid and cutting moves interleave throughout the
 * file) — the default continuous mode would draw phantom connectors across
 * every gap between same-class moves.
 *
 * Points arrive already anchored in world space (D-06, `parseToolpath.ts`),
 * so this component applies no group transform of its own.
 *
 * Note on the `toolpath-anchor` import: `toolpath-anchor.ts` imports from
 * `RailRig.tsx`, and this file is imported only by `CellScene.tsx` — adding
 * this edge introduces no module cycle (unlike the direct store read from
 * `RailRig` that WR-03 removed). The dependency is acyclic and direct, so it
 * is imported here rather than threaded through as a prop.
 */
export default function Toolpath() {
  const toolpath = useCellStore((state) => state.toolpath)

  const buckets = useMemo(() => {
    if (!toolpath) return null
    return toRenderBuckets(toolpath.segments)
  }, [toolpath])

  // G-02-03: the overall toolpath's single start and single end point (not
  // per-operation — this phase's toolpath is one continuous parsed path;
  // per-operation markers are ROADMAP Phase 6's job). Memoized alongside
  // `buckets` above, and computed before the early return below, so React's
  // hook-call order stays stable across renders.
  const endpoints = useMemo(() => {
    if (!toolpath || toolpath.segments.length === 0) return null
    const firstSegment = toolpath.segments[0]
    const lastSegment = toolpath.segments[toolpath.segments.length - 1]
    return {
      start: firstSegment.points[0],
      end: lastSegment.points[lastSegment.points.length - 1],
    }
  }, [toolpath])

  // G-03-4: marker radius scales with the toolpath's own extent instead of
  // a hardcoded absolute value. Derived before the early return below, same
  // hook-order-stability rationale as `endpoints` above.
  const markerRadius = useMemo(
    () => markerRadiusFromBounds(toolpath?.bounds ?? null),
    [toolpath],
  )

  if (!buckets) return null

  const { rapidPoints, cuttingPoints } = buckets

  // The toolpath's own minimum Y is translated exactly onto the workbench
  // anchor's Y (parseToolpath.ts, D-06) — so a marker sitting at the
  // toolpath's lowest point is centered exactly on the tabletop surface. A
  // sphere centered there sinks half its radius below that opaque surface
  // and gets clipped by it (visible as a cut-off dome, not a full sphere).
  // Lifting the marker by its own radius keeps its BOTTOM at the point
  // instead of its centre, so it always rests visibly on top of the
  // workbench, regardless of which specific point ends up being the
  // start/end for a given sample. This is also what makes the guide stem's
  // height (see `AnchoredMarker`) always positive.
  const liftMarker = (point: readonly [number, number, number]): [number, number, number] => [
    point[0],
    point[1] + markerRadius,
    point[2],
  ]

  return (
    <>
      {rapidPoints.length > 0 && (
        <Line
          points={rapidPoints}
          segments
          color={RAPID_COLOR}
          dashed
          dashSize={0.02}
          gapSize={0.015}
          lineWidth={RAPID_LINE_WIDTH}
        />
      )}
      {cuttingPoints.length > 0 && (
        <Line points={cuttingPoints} segments color={CUTTING_COLOR} lineWidth={CUTTING_LINE_WIDTH} />
      )}
      {endpoints && (
        <>
          <AnchoredMarker
            point={endpoints.start}
            liftedPoint={liftMarker(endpoints.start)}
            radius={markerRadius}
          />
          <AnchoredMarker
            point={endpoints.end}
            liftedPoint={liftMarker(endpoints.end)}
            radius={markerRadius}
          />
        </>
      )}
    </>
  )
}
