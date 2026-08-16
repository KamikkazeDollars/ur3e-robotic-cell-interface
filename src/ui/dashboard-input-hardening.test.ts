// Quick 260816-qym, Task 2: structural guards over DashboardPanel.tsx's
// manual-jog input surface. Reads the real source from disk with `node:fs`,
// the same discipline `src/collision/playback-path-unguarded.test.ts` and
// `src/scene/cell-scene-order.test.ts` already use in this repo (available
// because Vitest runs in the `node` environment here), rather than trusting
// a comment to stay honest across a future edit.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SOURCE_PATH = 'src/ui/tabs/DashboardPanel.tsx'

function readSource(): string {
  return readFileSync(join(process.cwd(), SOURCE_PATH), 'utf8')
}

describe('DashboardPanel.tsx — input hardening structural guards (quick 260816-qym)', () => {
  it('declares the manual-jog inputs as textual entry with a decimal input mode', () => {
    const source = readSource()
    expect(source).toMatch(/type="text"/)
    expect(source).toMatch(/inputMode="decimal"/)
    expect(source).toMatch(/autoComplete="off"/)
  })

  it('contains zero occurrences of the spinner-capable native input type declaration', () => {
    const source = readSource()
    // Built here, not restated as a comment elsewhere in the source file
    // (this plan's own constraint), so a future edit can't accidentally
    // reintroduce the numeric input type while this assertion still passes.
    const spinnerCapableInputType = ['type', '=', '"', 'number', '"'].join('')
    expect(source).not.toContain(spinnerCapableInputType)
  })

  it('references commitNumberFieldDraft and both manual-pose-readback selectors', () => {
    const source = readSource()
    expect(source).toMatch(/\bcommitNumberFieldDraft\b/)
    expect(source).toMatch(/\bmanualJointDegrees\b/)
    expect(source).toMatch(/\bmanualRailMillimetres\b/)
  })

  it('dispatches no manual-pose store action other than setManualJointAngle, setManualRailPos, clearManualJog, and homeManualPose', () => {
    const source = readSource()

    // No direct object-literal write into a manualJog-shaped field, and no
    // direct property assignment (`.manualJog = ...`) — the component has
    // no access to the store's own `set()` anyway, but this guards against a
    // future refactor accidentally acquiring one. Deliberately does NOT flag
    // `const manualJog = useCellStore(...)` — a plain local read/selector,
    // not a write into the store.
    expect(source).not.toMatch(/\bmanualJog\s*:/)
    expect(source).not.toMatch(/\.manualJog\s*=[^=]/)

    // Every CALLED function whose name looks like a manual-pose store
    // action (set*Manual*/clear*Manual*/home*Manual*) must be one of the
    // four allowed names. Selectors (manualJointDegrees/manualRailMillimetres)
    // don't start with set/clear/home, so this pattern can't false-positive
    // on them.
    const allowed = new Set(['setManualJointAngle', 'setManualRailPos', 'clearManualJog', 'homeManualPose'])
    const callRe = /\b(set\w*Manual\w*|clear\w*Manual\w*|home\w*Manual\w*)\s*\(/g
    const found = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = callRe.exec(source)) !== null) {
      found.add(m[1])
    }
    for (const name of found) {
      expect(allowed.has(name)).toBe(true)
    }
  })
})
