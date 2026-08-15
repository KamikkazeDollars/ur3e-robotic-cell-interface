// Anti-drift gate for the 3D scene's surface tones (gap closure G-03-6).
// Proves the TypeScript palette and the src/index.css tokens it mirrors
// can never silently diverge, and — once Task 2 appends the second describe
// block below — that no scene component declares a color of its own.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  SCENE_PALETTE,
  relativeLuminance,
  contrastRatio,
  MIN_SURFACE_CONTRAST,
} from './scene-palette'

const CSS_PATH = join(process.cwd(), 'src/index.css')

function readCss(): string {
  return readFileSync(CSS_PATH, 'utf8')
}

/** Extracts a `--token: value;` declaration from the first `:root` block in
 * src/index.css. Throws when the token is absent, so a missing or typo'd
 * token name fails as a clear error rather than an undefined comparison. */
function getRootTokenValue(css: string, token: string): string {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/)
  if (!rootMatch) {
    throw new Error('getRootTokenValue: no :root block found in src/index.css')
  }
  const declMatch = rootMatch[1].match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
  if (!declMatch) {
    throw new Error(`getRootTokenValue: token "${token}" not declared in :root`)
  }
  return declMatch[1].trim()
}

describe('SCENE_PALETTE / src/index.css token sync', () => {
  it("every palette entry's hex matches its named token's declared value", () => {
    const css = readCss()
    for (const [name, tone] of Object.entries(SCENE_PALETTE)) {
      const declared = getRootTokenValue(css, tone.token)
      expect(declared.toLowerCase(), `${name} (${tone.token})`).toBe(tone.hex.toLowerCase())
    }
  })
})

describe('structural surface separation', () => {
  it('floor, workbench and rail are pairwise distinct by value', () => {
    const { floor, workbench, rail } = SCENE_PALETTE
    expect(floor.hex.toLowerCase()).not.toBe(workbench.hex.toLowerCase())
    expect(workbench.hex.toLowerCase()).not.toBe(rail.hex.toLowerCase())
    expect(floor.hex.toLowerCase()).not.toBe(rail.hex.toLowerCase())
  })

  it('floor/workbench, workbench/rail and floor/rail each clear MIN_SURFACE_CONTRAST', () => {
    const { floor, workbench, rail } = SCENE_PALETTE
    expect(contrastRatio(floor.hex, workbench.hex)).toBeGreaterThanOrEqual(MIN_SURFACE_CONTRAST)
    expect(contrastRatio(workbench.hex, rail.hex)).toBeGreaterThanOrEqual(MIN_SURFACE_CONTRAST)
    expect(contrastRatio(floor.hex, rail.hex)).toBeGreaterThanOrEqual(MIN_SURFACE_CONTRAST)
  })

  it('background is distinct by value from all three structural tones', () => {
    const { background, floor, workbench, rail } = SCENE_PALETTE
    expect(background.hex.toLowerCase()).not.toBe(floor.hex.toLowerCase())
    expect(background.hex.toLowerCase()).not.toBe(workbench.hex.toLowerCase())
    expect(background.hex.toLowerCase()).not.toBe(rail.hex.toLowerCase())
  })
})

describe('relativeLuminance / contrastRatio', () => {
  it('black returns luminance 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 10)
  })

  it('white returns luminance 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
  })

  it('a color against itself returns a contrast ratio of exactly 1', () => {
    expect(contrastRatio('#4d5460', '#4d5460')).toBe(1)
  })

  it('is symmetric across operand order', () => {
    expect(contrastRatio('#26292e', '#7a828c')).toBe(contrastRatio('#7a828c', '#26292e'))
  })

  it('throws on a malformed input string', () => {
    expect(() => relativeLuminance('not-a-color')).toThrow()
    expect(() => relativeLuminance('#fff')).toThrow()
  })
})

// Scan behavior (Task 2): every scene component that paints structural
// surfaces must source its colors from SCENE_PALETTE, never declare a
// literal of its own. A future component added to this guarantee is a
// one-line addition to REWIRED_SCENE_FILES.
const REWIRED_SCENE_FILES = [
  'src/scene/RailRig.tsx',
  'src/scene/Workbench.tsx',
  'src/scene/CellScene.tsx',
  'src/scene/NavCube.tsx',
]

/** Strips block comments, then line comments, from a TS/TSX source string.
 * Order matters: stripping block comments first prevents a `//` inside a
 * `/* ... *\/` block from truncating the scan early. */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return withoutBlockComments.replace(/\/\/.*$/gm, '')
}

describe('scene components source colors from SCENE_PALETTE, not literals', () => {
  for (const relativePath of REWIRED_SCENE_FILES) {
    it(`${relativePath} contains no six-digit color literal outside comments`, () => {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8')
      const stripped = stripComments(source)
      expect(stripped.match(/#[0-9a-fA-F]{6}/g)).toBeNull()
    })

    it(`${relativePath} imports SCENE_PALETTE`, () => {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8')
      expect(source).toMatch(/import\s*\{[^}]*\bSCENE_PALETTE\b[^}]*\}\s*from\s*['"].*scene-palette['"]/)
    })
  }
})
