// Asset-integrity gate for both bundled g-code samples (mirrors
// urdf-asset.test.ts's discipline): reads the actual shipped fixtures from
// disk with readFileSync so this test gates the real assets, not an inline
// copy that can drift from them. Every expected count below comes from this
// phase's own authoring contract (02-01 Step 2 for the print sample, plan
// 02-02 Task 2's exact command budget for the mill sample) — never from
// running the parser and recording its output, which would make this a
// self-confirming snapshot instead of a gate.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseToolpath, toRenderBuckets, MAX_TOOLPATH_SEGMENTS } from './parseToolpath'

function readSample(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('parseToolpath — print sample (public/gcode/print-sample.gcode)', () => {
  const printText = readSample('public/gcode/print-sample.gcode')
  const result = parseToolpath(printText)
  const rapid = result.segments.filter((s) => s.type === 'rapid')
  const cut = result.segments.filter((s) => s.type === 'cut')

  it('parses into exactly 7 rapid and 12 cut segments', () => {
    expect(rapid.length).toBe(7)
    expect(cut.length).toBe(12)
  })

  it('every segment has source "line" and exactly 2 points', () => {
    for (const segment of result.segments) {
      expect(segment.source).toBe('line')
      expect(segment.points.length).toBe(2)
    }
  })

  it('the first cut segment reports feedRate 1200 and the last reports 900', () => {
    expect(cut[0].feedRate).toBe(1200)
    expect(cut[cut.length - 1].feedRate).toBe(900)
  })

  it('unit is "mm", skippedMotionCount is 0, and every coordinate is finite', () => {
    expect(result.unit).toBe('mm')
    expect(result.skippedMotionCount).toBe(0)
    for (const segment of result.segments) {
      for (const [x, y, z] of segment.points) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
        expect(Number.isFinite(z)).toBe(true)
      }
    }
  })

  it('toRenderBuckets returns 14 rapid entries and 24 cutting entries', () => {
    const buckets = toRenderBuckets(result.segments)
    expect(buckets.rapidPoints.length).toBe(14)
    expect(buckets.cuttingPoints.length).toBe(24)
  })
})

describe('parseToolpath — mill sample (public/gcode/mill-sample.gcode)', () => {
  const millText = readSample('public/gcode/mill-sample.gcode')
  const result = parseToolpath(millText)
  const rapid = result.segments.filter((s) => s.type === 'rapid')
  const cut = result.segments.filter((s) => s.type === 'cut')
  const arcCut = cut.filter((s) => s.source === 'arc')
  const lineCut = cut.filter((s) => s.source === 'line')

  it('parses into exactly 3 rapid and 27 cut segments', () => {
    expect(rapid.length).toBe(3)
    expect(cut.length).toBe(27)
  })

  it('exactly 12 cut segments have source "arc", each with more than 2 points', () => {
    expect(arcCut.length).toBe(12)
    for (const segment of arcCut) {
      expect(segment.points.length).toBeGreaterThan(2)
    }
  })

  it('every "line"-source segment (rapid and cut) has exactly 2 points', () => {
    for (const segment of result.segments) {
      if (segment.source === 'line') {
        expect(segment.points.length).toBe(2)
      }
    }
    expect(lineCut.length).toBe(15)
  })

  it('at least one cut segment reports feedRate 300 (a plunge) and at least one reports 600 (a contour move); no segment reports a fabricated zero', () => {
    const feedRates = cut.map((s) => s.feedRate)
    expect(feedRates).toContain(300)
    expect(feedRates).toContain(600)
    expect(feedRates.every((f) => f !== 0)).toBe(true)
    expect(result.segments.map((s) => s.feedRate).every((f) => f !== 0)).toBe(true)
  })

  it('unit is "mm", skippedMotionCount is 0, and every coordinate is finite', () => {
    expect(result.unit).toBe('mm')
    expect(result.skippedMotionCount).toBe(0)
    for (const segment of result.segments) {
      for (const [x, y, z] of segment.points) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
        expect(Number.isFinite(z)).toBe(true)
      }
    }
  })

  it('toRenderBuckets: rapid bucket holds 6 entries; cutting bucket holds 2*(n-1) entries summed across every cut segment', () => {
    const buckets = toRenderBuckets(result.segments)
    expect(buckets.rapidPoints.length).toBe(6)

    const expectedCuttingEntries = cut.reduce(
      (sum, segment) => sum + 2 * (segment.points.length - 1),
      0,
    )
    expect(buckets.cuttingPoints.length).toBe(expectedCuttingEntries)
  })
})

describe('parseToolpath — synthetic edge cases', () => {
  it('a g-code string with no motion commands at all returns zero segments, null bounds, and does not throw', () => {
    const text = 'G21\nG90\nG17\n'
    expect(() => parseToolpath(text)).not.toThrow()
    const result = parseToolpath(text)
    expect(result.segments).toEqual([])
    expect(result.bounds).toBeNull()
  })

  it('a g-code string containing only rapid moves puts every entry in the rapid bucket and leaves the cutting bucket empty', () => {
    const text = 'G21\nG90\nG17\nG0 X10 Y10 Z5\nG0 X20 Y20 Z10\n'
    const result = parseToolpath(text)
    expect(result.segments.every((s) => s.type === 'rapid')).toBe(true)
    const buckets = toRenderBuckets(result.segments)
    expect(buckets.rapidPoints.length).toBeGreaterThan(0)
    expect(buckets.cuttingPoints.length).toBe(0)
  })

  it('a g-code string whose motion command repeats the position already in force yields no segment for that command', () => {
    const text = 'G21\nG90\nG17\nG0 X10 Y10 Z5\nG1 X10 Y10 Z5 F300\n'
    const result = parseToolpath(text)
    // Only the initial G0 rapid produces a segment; the G1 to the same
    // position is zero-length and dropped silently (a no-op, not a refusal).
    expect(result.segments.length).toBe(1)
    expect(result.segments[0].type).toBe('rapid')
    expect(result.segments.some((s) => s.type === 'cut')).toBe(false)
  })
})

describe('parseToolpath — defensive guards (T-02-02)', () => {
  // Note: `gcode-parser`'s own tokenizer only recognises well-formed numeric
  // word values (verified this session: a non-numeric X, and an out-of-range
  // exponential literal like `X1e999`, are both rejected or misread by its
  // regex tokenizer before a word is ever produced — they never reach
  // `addLine`/`addArcCurve` as a NaN/Infinity coordinate). The non-finite
  // guard in `parseToolpath.ts` therefore has no reachable trigger through
  // this library's real text front door with the two hand-authored bundled
  // samples; it remains a defensive line for a future upload feature that
  // might drive the interpreter's callbacks directly. Verified present via
  // Task 2's acceptance criteria (`isFinite`/`Number.isFinite` grep), not
  // exercised here as a functional test for that reason.

  it('truncates at MAX_TOOLPATH_SEGMENTS and reports the dropped-command count via skippedMotionCount', () => {
    const overflowBy = 5
    const lineCount = MAX_TOOLPATH_SEGMENTS + overflowBy
    const lines = ['G21', 'G90', 'G17']
    for (let i = 1; i <= lineCount; i++) {
      // Every X strictly increases, so no line is ever a zero-length no-op.
      lines.push(`G1 X${i} Y0 Z0 F600`)
    }
    const result = parseToolpath(lines.join('\n'))
    expect(result.segments.length).toBe(MAX_TOOLPATH_SEGMENTS)
    expect(result.skippedMotionCount).toBe(overflowBy)
  })
})
