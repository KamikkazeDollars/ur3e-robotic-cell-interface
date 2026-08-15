// Nyquist gate for gap closure G-03-4 (marker sizing half). Proves the
// proportional-sizing behavior that regresses the reported "markers read as
// oversized blobs" complaint, the null/degenerate/oversized clamp behavior,
// the scrub-vs-endpoint size hierarchy, and marker/guide readability against
// the workbench tone plan 03-04 introduced.
import { describe, it, expect } from 'vitest'
import {
  MARKER_RADIUS_FRACTION,
  MIN_MARKER_RADIUS,
  MAX_MARKER_RADIUS,
  SCRUB_MARKER_SCALE,
  GUIDE_STEM_RADIUS_RATIO,
  GUIDE_FOOTPRINT_RADIUS_RATIO,
  MIN_MARKER_CONTRAST,
  largestSpan,
  markerRadiusFromBounds,
  scrubMarkerRadiusFromBounds,
  guideStemRadius,
  guideFootprintRadius,
} from './marker-scale'
import type { ParsedToolpath } from '../gcode/parseToolpath'
import { RAPID_COLOR, CUTTING_COLOR } from './Toolpath'
import { SCENE_PALETTE, contrastRatio } from './scene-palette'

/** Builds a bounds fixture spanning `span` metres in X and Z and a tenth of
 * that in Y, mirroring the flat-ish shape both bundled samples (print:
 * 150x150x19.8mm, mill: 120x120x13mm) actually have. */
function boundsForSpan(span: number): NonNullable<ParsedToolpath['bounds']> {
  return {
    min: [0, 0, 0],
    max: [span, span / 10, span],
  }
}

describe('largestSpan', () => {
  it('returns the largest of the three per-axis spans, not a fixed axis', () => {
    // Narrow in X, wide in Z — must size off Z, not X.
    expect(largestSpan({ min: [0, 0, 0], max: [0.01, 0.02, 0.2] })).toBeCloseTo(0.2, 10)
  })

  it('returns 0 for null bounds', () => {
    expect(largestSpan(null)).toBe(0)
  })

  it('returns 0 for a degenerate bounds whose min equals its max', () => {
    expect(largestSpan({ min: [1, 2, 3], max: [1, 2, 3] })).toBe(0)
  })
})

describe('markerRadiusFromBounds', () => {
  it('the 0.150m print-sample span yields an endpoint radius of 0.003m', () => {
    expect(markerRadiusFromBounds(boundsForSpan(0.15))).toBeCloseTo(0.15 * MARKER_RADIUS_FRACTION, 10)
    expect(markerRadiusFromBounds(boundsForSpan(0.15))).toBeCloseTo(0.003, 10)
  })

  it('the 0.120m mill-sample span yields an endpoint radius of 0.0024m', () => {
    expect(markerRadiusFromBounds(boundsForSpan(0.12))).toBeCloseTo(0.12 * MARKER_RADIUS_FRACTION, 10)
    expect(markerRadiusFromBounds(boundsForSpan(0.12))).toBeCloseTo(0.0024, 10)
  })

  it('resulting marker diameter is at most 5% of the largest span, for both bundled sample sizes', () => {
    for (const span of [0.15, 0.12]) {
      const diameter = markerRadiusFromBounds(boundsForSpan(span)) * 2
      expect(diameter / span).toBeLessThanOrEqual(0.05)
    }
  })

  it('the previous hardcoded 0.012m radius would fail the diameter ceiling (regression gate)', () => {
    const OLD_HARDCODED_RADIUS = 0.012
    for (const span of [0.15, 0.12]) {
      const diameter = OLD_HARDCODED_RADIUS * 2
      expect(diameter / span).toBeGreaterThan(0.05)
    }
  })

  it('null bounds yields exactly MIN_MARKER_RADIUS', () => {
    expect(markerRadiusFromBounds(null)).toBe(MIN_MARKER_RADIUS)
  })

  it('a degenerate bounds whose min equals its max yields MIN_MARKER_RADIUS, not 0 and not NaN', () => {
    const radius = markerRadiusFromBounds({ min: [5, 5, 5], max: [5, 5, 5] })
    expect(radius).toBe(MIN_MARKER_RADIUS)
    expect(Number.isNaN(radius)).toBe(false)
  })

  it('a non-finite span never propagates NaN into the radius', () => {
    const radius = markerRadiusFromBounds({ min: [0, 0, 0], max: [Infinity, 0, 0] })
    expect(Number.isFinite(radius)).toBe(true)
    expect(Number.isNaN(radius)).toBe(false)
  })

  it('an enormous bounds is clamped to MAX_MARKER_RADIUS', () => {
    expect(markerRadiusFromBounds(boundsForSpan(1000))).toBe(MAX_MARKER_RADIUS)
  })
})

describe('scrubMarkerRadiusFromBounds', () => {
  it('is strictly greater than the endpoint radius for every input', () => {
    const cases: (ParsedToolpath['bounds'])[] = [
      null,
      { min: [0, 0, 0], max: [0, 0, 0] },
      boundsForSpan(0.15),
      boundsForSpan(0.12),
      boundsForSpan(1000),
    ]
    for (const bounds of cases) {
      expect(scrubMarkerRadiusFromBounds(bounds)).toBeGreaterThan(markerRadiusFromBounds(bounds))
    }
  })

  it('multiplies the endpoint radius by SCRUB_MARKER_SCALE', () => {
    const bounds = boundsForSpan(0.15)
    expect(scrubMarkerRadiusFromBounds(bounds)).toBeCloseTo(
      markerRadiusFromBounds(bounds) * SCRUB_MARKER_SCALE,
      10,
    )
  })
})

describe('guideStemRadius / guideFootprintRadius', () => {
  it('the guide stem radius is strictly less than the endpoint radius, for every input', () => {
    const markerRadii = [MIN_MARKER_RADIUS, markerRadiusFromBounds(boundsForSpan(0.15)), MAX_MARKER_RADIUS]
    for (const markerRadius of markerRadii) {
      expect(guideStemRadius(markerRadius)).toBeLessThan(markerRadius)
    }
  })

  it('the guide footprint radius is strictly greater than the endpoint radius, for every input', () => {
    const markerRadii = [MIN_MARKER_RADIUS, markerRadiusFromBounds(boundsForSpan(0.15)), MAX_MARKER_RADIUS]
    for (const markerRadius of markerRadii) {
      expect(guideFootprintRadius(markerRadius)).toBeGreaterThan(markerRadius)
    }
  })

  it('apply their documented ratios', () => {
    expect(guideStemRadius(0.01)).toBeCloseTo(0.01 * GUIDE_STEM_RADIUS_RATIO, 10)
    expect(guideFootprintRadius(0.01)).toBeCloseTo(0.01 * GUIDE_FOOTPRINT_RADIUS_RATIO, 10)
  })
})

describe('marker/guide line tones stay readable against the workbench', () => {
  it('both toolpath line tones clear MIN_MARKER_CONTRAST against SCENE_PALETTE.workbench.hex', () => {
    expect(contrastRatio(RAPID_COLOR, SCENE_PALETTE.workbench.hex)).toBeGreaterThanOrEqual(
      MIN_MARKER_CONTRAST,
    )
    expect(contrastRatio(CUTTING_COLOR, SCENE_PALETTE.workbench.hex)).toBeGreaterThanOrEqual(
      MIN_MARKER_CONTRAST,
    )
  })
})
