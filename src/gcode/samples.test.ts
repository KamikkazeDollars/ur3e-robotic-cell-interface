// Nyquist gate for gap closure G-04-1 (04-05-PLAN.md). Proves every bundled
// sample carries a mode tag, that the mode-filtering helpers partition the
// list correctly, and that an unresolved sample id degrades safely rather
// than throwing or defaulting to a match.
import { describe, it, expect } from 'vitest'
import {
  GCODE_SAMPLES,
  samplesForMode,
  sampleMatchesMode,
  firstSampleIdForMode,
} from './samples'
import type { CellMode } from '../cell-mode'

const MODES: readonly CellMode[] = ['printing', 'milling']

describe('GCODE_SAMPLES mode tagging', () => {
  it('tags every entry with one of the two CellMode union members', () => {
    // Iterate the array rather than checking known entries by index, so a
    // third sample added later without a tag fails this test.
    for (const sample of GCODE_SAMPLES) {
      expect(MODES).toContain(sample.mode)
    }
  })

  it('gives every entry a distinct, non-empty filePath starting with /', () => {
    const filePaths = GCODE_SAMPLES.map((sample) => sample.filePath)
    expect(new Set(filePaths).size).toBe(filePaths.length)
    for (const filePath of filePaths) {
      expect(filePath.length).toBeGreaterThan(0)
      expect(filePath.startsWith('/')).toBe(true)
    }
  })
})

describe('samplesForMode', () => {
  it('returns a non-empty array for each mode', () => {
    for (const mode of MODES) {
      expect(samplesForMode(mode).length).toBeGreaterThan(0)
    }
  })

  it('partitions GCODE_SAMPLES: every returned entry matches the requested mode', () => {
    for (const mode of MODES) {
      for (const sample of samplesForMode(mode)) {
        expect(sample.mode).toBe(mode)
      }
    }
  })

  it('returns disjoint results across modes whose combined length equals GCODE_SAMPLES.length', () => {
    const printing = samplesForMode('printing')
    const milling = samplesForMode('milling')
    const printingIds = new Set(printing.map((sample) => sample.id))
    const millingIds = new Set(milling.map((sample) => sample.id))
    for (const id of printingIds) {
      expect(millingIds.has(id)).toBe(false)
    }
    expect(printing.length + milling.length).toBe(GCODE_SAMPLES.length)
  })
})

describe('sampleMatchesMode', () => {
  it('returns true for a known sample paired with its own mode', () => {
    const sample = GCODE_SAMPLES[0]
    expect(sampleMatchesMode(sample.id, sample.mode)).toBe(true)
  })

  it('returns false for a known sample paired with the other mode', () => {
    const sample = GCODE_SAMPLES[0]
    const otherMode: CellMode = sample.mode === 'printing' ? 'milling' : 'printing'
    expect(sampleMatchesMode(sample.id, otherMode)).toBe(false)
  })

  it('returns false for an unknown sample id paired with either mode', () => {
    for (const mode of MODES) {
      expect(sampleMatchesMode('does-not-exist', mode)).toBe(false)
    }
  })
})

describe('firstSampleIdForMode', () => {
  it('returns an id belonging to the requested mode, for both modes', () => {
    for (const mode of MODES) {
      const id = firstSampleIdForMode(mode)
      expect(id).not.toBeNull()
      const sample = GCODE_SAMPLES.find((candidate) => candidate.id === id)
      expect(sample?.mode).toBe(mode)
    }
  })
})
