import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useCellStore } from '../store/cellStore'
import { toRenderBuckets } from '../gcode/parseToolpath'

// D-03: muted gray for rapid (G0) moves, warm orange for cutting (G1/G2/G3)
// moves — both read clearly against the Dominant (#FAFAFA) background and
// the Secondary (#E4E7EB) floor, and stay clear of the Accent blue
// (#2563EB), which is reserved for the nav cube and the Reset View CTA.
export const RAPID_COLOR = '#9CA3AF'
export const CUTTING_COLOR = '#EA580C'

// G-02-03: both line widths roughly doubled from their original values (2/3)
// — the previous widths read as too thin to clearly distinguish move class
// at the toolpath's on-screen scale; the cutting width stays larger than the
// rapid width, preserving the existing visual hierarchy between move classes.
const RAPID_LINE_WIDTH = 4
const CUTTING_LINE_WIDTH = 6

// G-02-03: overall start/end marker sphere radius (metres) — sized well
// above either line's on-screen width at this toolpath's scale (bundled
// samples span roughly 0.13-0.15m per side) so each marker reads as a
// clearly visible bullet point, not a speck.
const MARKER_RADIUS = 0.012

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

  if (!buckets) return null

  const { rapidPoints, cuttingPoints } = buckets

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
          <mesh position={endpoints.start}>
            <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
            <meshStandardMaterial color={CUTTING_COLOR} />
          </mesh>
          <mesh position={endpoints.end}>
            <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
            <meshStandardMaterial color={CUTTING_COLOR} />
          </mesh>
        </>
      )}
    </>
  )
}
