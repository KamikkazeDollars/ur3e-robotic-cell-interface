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
// `EDITABLE_PANEL_SOURCE_PATHS`.
//
// Quick 260817-jfy: `RunPanel.tsx` lost its editable surface entirely (it is
// now a read-only telemetry readout — manual control lives solely on
// `FreeMovementPanel.tsx`). Looping the panel-shaped assertions below over
// Run would now be VACUOUS: it no longer references `manualJointDegrees`
// (assertion 1 would fail honestly), and its manual-pose dispatch call set
// is empty, so the allowlist-membership assertion (2) would pass trivially
// against nothing — neither outcome is acceptable. Run therefore left this
// set; its coverage moved to the explicit, non-vacuous
// `RunPanel.tsx — read-only readout guards` describe block below, which
// asserts the dispatch set has `size === 0` rather than merely allowlisting
// it. A `FreeMovementPanel.tsx — still the only editable manual-jog surface`
// guard follows it, so a future edit stripping manual control from BOTH
// panels can't silently pass every remaining assertion in this file.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const WIDGET_SOURCE_PATH = 'src/ui/JogControl.tsx'
const RUN_SOURCE_PATH = 'src/ui/tabs/RunPanel.tsx'
const FREE_MOVEMENT_SOURCE_PATH = 'src/ui/tabs/FreeMovementPanel.tsx'
const EDITABLE_PANEL_SOURCE_PATHS = [FREE_MOVEMENT_SOURCE_PATH]

function readSourceAt(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

/** Strips block comments and whole-line `//` comments so the read-only
 * guards below describe real JSX, never prose in a doc comment — copied
 * verbatim from `playback-chrome-visibility.test.ts`. This is what lets
 * `RunPanel.tsx`'s doc comment discuss the removed jog widget freely
 * without self-invalidating a guard. */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return withoutBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

// Assembled from string fragments so the forbidden tag never appears as a
// literal in this test's own source — same technique the spinner-input-type
// assertion below already uses.
const JOG_CONTROL_TAG = ['<', 'JogControl'].join('')

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

for (const panelPath of EDITABLE_PANEL_SOURCE_PATHS) {
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

describe('RunPanel.tsx — read-only readout guards (quick 260817-jfy)', () => {
  it('never renders the jog widget tag', () => {
    const source = stripComments(readSourceAt(RUN_SOURCE_PATH))
    const matches = source.match(new RegExp(JOG_CONTROL_TAG, 'g')) ?? []
    expect(matches).toHaveLength(0)
  })

  it('renders no <input element at all', () => {
    const source = stripComments(readSourceAt(RUN_SOURCE_PATH))
    expect(source).not.toMatch(/<input\b/)
  })

  it('renders no <Button element at all', () => {
    const source = stripComments(readSourceAt(RUN_SOURCE_PATH))
    expect(source).not.toMatch(/<Button\b/)
  })

  it('dispatches an EMPTY set of manual-pose store actions — a non-vacuous guard, not an allowlist membership check', () => {
    const source = stripComments(readSourceAt(RUN_SOURCE_PATH))
    const callRe = /\b(set\w*Manual\w*|clear\w*Manual\w*|home\w*Manual\w*)\s*\(/g
    const found = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = callRe.exec(source)) !== null) {
      found.add(m[1])
    }
    expect(found.size).toBe(0)
  })

  it('is wired to the live derivation (livePoseJointDegrees, manualRailMillimetres, scrubFraction), never left frozen', () => {
    const source = readSourceAt(RUN_SOURCE_PATH)
    expect(source).toMatch(/\blivePoseJointDegrees\b/)
    expect(source).toMatch(/\bmanualRailMillimetres\b/)
    expect(source).toMatch(/\bscrubFraction\b/)
  })
})

describe('FreeMovementPanel.tsx — still the only editable manual-jog surface (quick 260817-jfy)', () => {
  it('renders the jog widget tag at least once', () => {
    const source = stripComments(readSourceAt(FREE_MOVEMENT_SOURCE_PATH))
    const matches = source.match(new RegExp(JOG_CONTROL_TAG, 'g')) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
