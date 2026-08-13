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
          lineWidth={2}
        />
      )}
      {cuttingPoints.length > 0 && (
        <Line points={cuttingPoints} segments color={CUTTING_COLOR} lineWidth={3} />
      )}
    </>
  )
}
