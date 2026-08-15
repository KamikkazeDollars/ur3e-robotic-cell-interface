// Gap closure G-03-4 (marker sizing half). Previously `Toolpath.tsx` and
// `ScrubMarker.tsx` each declared a hardcoded absolute marker radius
// (0.012m / 0.02m) with zero relationship to the toolpath actually being
// drawn. Against the bundled print sample (0.150m largest span) that
// rendered at roughly a sixth of the whole path's own extent; against the
// smaller mill sample (0.120m) it was worse still. `ParsedToolpath.bounds`
// was already being computed by `parseToolpath.ts` but never consulted for
// sizing anything. This module is the "pure, testable half" of that concern
// — the same split `parseToolpath.ts`'s `toRenderBuckets` already
// established for render-adjacent logic in this repo: no React, no three.js
// imports, every export a pure function or constant, fully covered by
// `marker-scale.test.ts` independent of any 3D render.
import type { ParsedToolpath } from '../gcode/parseToolpath'

/** Fraction of the toolpath's largest axis span used for the endpoint
 * marker radius. Puts the marker's DIAMETER at 4% of the path's own
 * extent — a bullet point resting on the path, not a feature competing
 * with it. */
export const MARKER_RADIUS_FRACTION = 0.02

/** Floor for a degenerate or absent bounding box (null bounds, or a
 * zero-span box), so a marker is always visible instead of collapsing to
 * a zero-radius, invisible sphere. */
export const MIN_MARKER_RADIUS = 0.0015

/** Ceiling for an implausibly large path. Deliberately below the previous
 * hardcoded 0.012m radius, so this change can never make a marker larger
 * than it already was, even on synthetic or malformed data. */
export const MAX_MARKER_RADIUS = 0.01

/** The scrub marker stays the primary, currently-moving indicator: this
 * multiplies the endpoint radius rather than being an independent clamp,
 * so the scrub-vs-endpoint size hierarchy holds by construction at every
 * toolpath scale, not because two separately chosen constants happen to be
 * ordered correctly today.
 *
 * Gap closure G-04-1 (04-UAT.md): raised from 1.75 to 3.5. At 1.75, the
 * marker rendered at roughly a five-millimetre radius against a path whose
 * largest span is about 150mm, swept in ten seconds — legible while
 * dragging the slider by hand, but reported as invisible during a
 * full-speed autoplay run. The construction that guarantees the scrub
 * marker stays strictly larger than the endpoint markers is unchanged: it
 * still multiplies `markerRadiusFromBounds` rather than clamping
 * independently — see `MIN_SCRUB_MARKER_DIAMETER_FRACTION` below for the
 * asserted legibility floor this multiplier must clear. */
export const SCRUB_MARKER_SCALE = 3.5

/** Legibility floor (gap closure G-04-1): the scrub marker's rendered
 * DIAMETER must be at least this fraction of the toolpath's own largest
 * axis span, asserted in `marker-scale.test.ts` rather than trusted from
 * `SCRUB_MARKER_SCALE`'s literal value alone — the same "assert the
 * property rather than trust the literal" discipline `MIN_MARKER_CONTRAST`
 * already establishes in this file. A future edit that lowers
 * `SCRUB_MARKER_SCALE` below what this floor allows fails a test instead of
 * silently shipping a marker too small to follow by eye during autoplay. */
export const MIN_SCRUB_MARKER_DIAMETER_FRACTION = 0.12

/** The vertical guide stem's radius, as a fraction of the marker radius it
 * sits beneath — thinner than the marker itself, so the marker reads as
 * the anchor and the stem as its support, not as two markers stacked. */
export const GUIDE_STEM_RADIUS_RATIO = 0.35

/** The tabletop footprint pad's radius, as a fraction of the marker radius
 * above it — wider than the marker, so the anchor stays legible even where
 * the stem is barely taller than the marker's own radius. */
export const GUIDE_FOOTPRINT_RADIUS_RATIO = 2.5

/** Half a millimetre of lift above the workbench top for the footprint pad,
 * enough to avoid z-fighting with the opaque tabletop slab without visibly
 * floating off it. */
export const GUIDE_FOOTPRINT_LIFT = 0.0005

/** Contrast floor (WCAG ratio) the marker/guide line tones must clear
 * against the workbench surface they are drawn on — asserted in
 * `marker-scale.test.ts` so a future workbench-tone edit that would hide
 * the markers on the table fails a test rather than shipping. */
export const MIN_MARKER_CONTRAST = 2

/** The largest of the three per-axis spans (`max - min`) in `bounds`, or
 * `0` when `bounds` is `null` — the axis-agnostic size figure every marker
 * dimension in this module is derived from. A bounds that is narrow in X
 * but wide in Z sizes off Z, never off a fixed axis. */
export function largestSpan(bounds: ParsedToolpath['bounds']): number {
  if (!bounds) return 0
  const spanX = bounds.max[0] - bounds.min[0]
  const spanY = bounds.max[1] - bounds.min[1]
  const spanZ = bounds.max[2] - bounds.min[2]
  return Math.max(spanX, spanY, spanZ)
}

/**
 * Endpoint marker radius (metres) derived from the toolpath's own bounds:
 * `largestSpan(bounds) * MARKER_RADIUS_FRACTION`, clamped into
 * `[MIN_MARKER_RADIUS, MAX_MARKER_RADIUS]`. Written so a `null`, zero or
 * non-finite span lands on the minimum rather than propagating — a `NaN`
 * must never reach a `sphereGeometry`/`cylinderGeometry` argument, where
 * three.js would silently drop the mesh instead of throwing.
 */
export function markerRadiusFromBounds(bounds: ParsedToolpath['bounds']): number {
  const span = largestSpan(bounds)
  const raw = span * MARKER_RADIUS_FRACTION
  if (!Number.isFinite(raw) || raw <= MIN_MARKER_RADIUS) return MIN_MARKER_RADIUS
  if (raw >= MAX_MARKER_RADIUS) return MAX_MARKER_RADIUS
  return raw
}

/**
 * Scrub-marker radius (metres), derived from the same bounds as the
 * endpoint markers. Deliberately multiplies `markerRadiusFromBounds`
 * rather than clamping independently against its own min/max — that is
 * what guarantees `scrubMarkerRadiusFromBounds(b) > markerRadiusFromBounds(b)`
 * for every input, by construction.
 */
export function scrubMarkerRadiusFromBounds(bounds: ParsedToolpath['bounds']): number {
  return markerRadiusFromBounds(bounds) * SCRUB_MARKER_SCALE
}

/** The vertical guide stem's radius (metres) beneath a marker of the given
 * radius. */
export function guideStemRadius(markerRadius: number): number {
  return markerRadius * GUIDE_STEM_RADIUS_RATIO
}

/** The tabletop footprint pad's radius (metres) beneath a marker of the
 * given radius. */
export function guideFootprintRadius(markerRadius: number): number {
  return markerRadius * GUIDE_FOOTPRINT_RADIUS_RATIO
}
