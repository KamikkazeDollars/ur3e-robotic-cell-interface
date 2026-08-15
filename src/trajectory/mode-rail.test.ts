// End-to-end proof (G-04-1 gap closure, 04-06-PLAN.md) that the resolved
// rail position genuinely differs by cell mode while the compiled MOTION
// stays translation-identical. Because the entire scene shifts by one rigid
// X translation and `resolveRailPosition` follows it exactly (proven in
// `rail.test.ts`'s translation-covariance test), every reach,
// singularity-classification and table-clearance property the Phase 3
// tests already establish for the centred case transfers to both mode
// stations WITHOUT being re-derived here — and if a future change ever
// breaks that equivalence, this test fails rather than the breakage
// surfacing as an unreachable pose or a wrist snap during a demo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { compileTrajectory } from './compile'
import { parseToolpath } from '../gcode/parseToolpath'
import { toolpathAnchorForMode } from '../gcode/toolpath-anchor'
import {
  RAIL_CENTER_X,
  RAIL_TRAVEL,
  RAIL_RESOLUTION_CANDIDATES,
  MODE_RAIL_START_OFFSET_M,
} from '../kinematics'
import type { CellMode } from '../cell-mode'

function readSample(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

const GRID_STEP = (RAIL_TRAVEL.max - RAIL_TRAVEL.min) / (RAIL_RESOLUTION_CANDIDATES - 1)

const SAMPLE_FILES = ['print-sample', 'mill-sample'] as const
const MODES: readonly CellMode[] = ['printing', 'milling']

describe('mode-rail end-to-end: the carriage genuinely moves by mode (G-04-1)', () => {
  for (const sampleFile of SAMPLE_FILES) {
    describe(`public/gcode/${sampleFile}.gcode`, () => {
      const gcodeText = readSample(`public/gcode/${sampleFile}.gcode`)
      const centred = compileTrajectory(parseToolpath(gcodeText))

      it('the default centred compile is ready', () => {
        expect(centred.status).toBe('ready')
      })

      for (const mode of MODES) {
        const signedOffset = mode === 'printing' ? MODE_RAIL_START_OFFSET_M : -MODE_RAIL_START_OFFSET_M
        const modeCompiled = compileTrajectory(parseToolpath(gcodeText, toolpathAnchorForMode(mode)))

        it(`${mode}: compiles to status 'ready' — the mode offset never pushes a point out of reach`, () => {
          expect(modeCompiled.status).toBe('ready')
        })

        it(`${mode}: railPos is at least 0.5m ${mode === 'printing' ? 'right of' : 'left of'} RAIL_CENTER_X`, () => {
          if (mode === 'printing') {
            expect(modeCompiled.railPos).toBeGreaterThanOrEqual(RAIL_CENTER_X + 0.5)
          } else {
            expect(modeCompiled.railPos).toBeLessThanOrEqual(RAIL_CENTER_X - 0.5)
          }
        })

        it(`${mode}: railPos equals the centred compile's railPos plus the signed mode offset, within one resolver candidate step`, () => {
          expect(Math.abs(modeCompiled.railPos - (centred.railPos + signedOffset))).toBeLessThanOrEqual(GRID_STEP)
        })

        it(`${mode}: sample count matches the centred compile`, () => {
          expect(modeCompiled.samples.length).toBe(centred.samples.length)
        })

        it(`${mode}: every sample's point X is the centred compile's point X plus the signed offset (1e-6), Y/Z match (1e-9), and every joint matches within 1e-6 rad`, () => {
          expect(modeCompiled.samples.length).toBe(centred.samples.length)
          for (let i = 0; i < centred.samples.length; i++) {
            const base = centred.samples[i]
            const shifted = modeCompiled.samples[i]

            expect(shifted.point[0]).toBeCloseTo(base.point[0] + signedOffset, 6)
            expect(shifted.point[1]).toBeCloseTo(base.point[1], 9)
            expect(shifted.point[2]).toBeCloseTo(base.point[2], 9)

            for (let j = 0; j < base.joints.length; j++) {
              expect(shifted.joints[j]).toBeCloseTo(base.joints[j], 6)
            }
          }
        })
      }
    })
  }
})
