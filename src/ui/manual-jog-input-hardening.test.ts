// Quick 260816-qym, Task 2: structural guards over the manual-jog input
// surface. Reads the real source from disk with `node:fs`, the same
// discipline `src/collision/playback-path-unguarded.test.ts` and
// `src/scene/cell-scene-order.test.ts` already use in this repo (available
// because Vitest runs in the `node` environment here), rather than trusting
// a comment to stay honest across a future edit.
//
// Quick 260817-gdv: the shared `JogControl` widget moved out of the single
// Dashboard panel into `src/ui/JogControl.tsx`, and the panel itself split
// into two independently-editable copies (`RunPanel.tsx`,
// `FreeMovementPanel.tsx`). The widget-shaped assertions (textual entry,
// no spinner-capable native input, the slider's single write path) now read
// `WIDGET_SOURCE_PATH` — they describe the widget, which now lives there.
// The panel-shaped assertions (selector references, the manual-pose store
// action allowlist, no direct `manualJog` write) loop over
// `PANEL_SOURCE_PATHS` so BOTH panel copies are guarded exactly as tightly
// as the original single file was.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const WIDGET_SOURCE_PATH = 'src/ui/JogControl.tsx'
const PANEL_SOURCE_PATHS = ['src/ui/tabs/RunPanel.tsx', 'src/ui/tabs/FreeMovementPanel.tsx']

function readSourceAt(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('JogControl.tsx — input hardening structural guards (quick 260816-qym, moved to the shared widget in quick 260817-gdv)', () => {
  it('declares the manual-jog inputs as textual entry with a decimal input mode', () => {
    const source = readSourceAt(WIDGET_SOURCE_PATH)
    expect(source).toMatch(/type="text"/)
    expect(source).toMatch(/inputMode="decimal"/)
    expect(source).toMatch(/autoComplete="off"/)
  })

  it('contains zero occurrences of the spinner-capable native input type declaration', () => {
    const source = readSourceAt(WIDGET_SOURCE_PATH)
    // Built here, not restated as a comment elsewhere in the source file
    // (this plan's own constraint), so a future edit can't accidentally
    // reintroduce the numeric input type while this assertion still passes.
    const spinnerCapableInputType = ['type', '=', '"', 'number', '"'].join('')
    expect(source).not.toContain(spinnerCapableInputType)
  })

  it('references commitNumberFieldDraft for its commit path', () => {
    const source = readSourceAt(WIDGET_SOURCE_PATH)
    expect(source).toMatch(/\bcommitNumberFieldDraft\b/)
  })
})

describe('JogControl.tsx — sliders (quick 260816-qym, Task 5)', () => {
  it('renders a range input for the manual-jog axes', () => {
    const source = readSourceAt(WIDGET_SOURCE_PATH)
    expect(source).toMatch(/type="range"/)
  })

  it("the range input's change handler routes to the SAME onCommit the typed field's commit path uses — no second write path into manualJog", () => {
    const source = readSourceAt(WIDGET_SOURCE_PATH)
    // The literal onChange body wired to the slider — proves it dispatches
    // the identical `onCommit` prop `commitNumberFieldDraft` also receives
    // in this same component, rather than a second, independent handler.
    expect(source).toMatch(/onChange=\{\(event\) => onCommit\(Number\(event\.target\.value\)\)\}/)
  })
})

for (const panelPath of PANEL_SOURCE_PATHS) {
  describe(`${panelPath} — manual-jog panel structural guards (quick 260817-gdv)`, () => {
    it('references both manual-pose-readback selectors', () => {
      const source = readSourceAt(panelPath)
      expect(source).toMatch(/\bmanualJointDegrees\b/)
      expect(source).toMatch(/\bmanualRailMillimetres\b/)
    })

    it('dispatches no manual-pose store action other than setManualJointAngle, setManualRailPos, clearManualJog, and homeManualPose', () => {
      const source = readSourceAt(panelPath)

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
}
