// Single source of truth for every 3D scene surface color (gap closure
// G-03-6). Previously three scene components (RailRig.tsx, Workbench.tsx,
// CellScene.tsx) each declared their own private tone constant — two of
// them (RailRig's SECONDARY_TONE and Workbench's SECONDARY_TONE) landed on
// the identical hex literal, and that literal belonged to a light-theme
// palette this app no longer ships (it appears nowhere in the current
// --ui-* token set in src/index.css). Colors live here now; scene
// components read from this module, they do not declare their own.

/** A single scene surface tone, tied to the `--ui-*` design token it must
 * stay in sync with. */
export interface SceneTone {
  /** The `--ui-*` custom property in src/index.css this hex mirrors. */
  readonly token: string
  /** The literal three.js materials are given. Must equal the token's declared value. */
  readonly hex: string
}

// Lightness ordering of the three structural surfaces is deliberate:
//  - floor darkest, so the ground recedes and doesn't compete with the rig
//    standing on it.
//  - workbench mid and deliberately neutral, so both the warm cutting-move
//    line and the gray rapid-move line drawn on top of it stay legible
//    against it.
//  - rail lightest, so the rig hardware reads as machined steel and never
//    blends into the bench it stands beside.
export const SCENE_PALETTE = {
  background: { token: '--ui-dominant', hex: '#1c1e21' },
  floor: { token: '--ui-scene-floor', hex: '#26292e' },
  workbench: { token: '--ui-scene-bench', hex: '#4d5460' },
  rail: { token: '--ui-scene-rail', hex: '#7a828c' },
  navCubeFace: { token: '--ui-fg', hex: '#f2f3f5' },
  navCubeStroke: { token: '--ui-fg-muted', hex: '#a2a8b2' },
  navCubeHover: { token: '--ui-accent', hex: '#e11d2e' },
  navCubeText: { token: '--ui-dominant', hex: '#1c1e21' },
} as const satisfies Record<string, SceneTone>

/**
 * WCAG relative luminance of a `#rrggbb` string, 0..1.
 * Throws a descriptive error on any input that is not a six-digit
 * `#rrggbb` string, so a malformed palette entry fails loudly instead of
 * silently producing `NaN`.
 */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!match) {
    throw new Error(`relativeLuminance: expected a six-digit #rrggbb string, got "${hex}"`)
  }
  const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255)
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = channels.map(linearize)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG contrast ratio between two `#rrggbb` strings, 1..21. Symmetric across
 * operand order — the lighter/darker luminance is resolved internally
 * before dividing, so `contrastRatio(a, b) === contrastRatio(b, a)`.
 */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a)
  const luminanceB = relativeLuminance(b)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * The pairwise separation every distinct structural scene surface (floor,
 * workbench, rail) must clear against each other. The chosen tones clear it
 * with roughly 25% headroom — the floor/bench and bench/rail pairs both
 * land near 1.9, the floor/rail pair near 3.7. This threshold deliberately
 * governs only the three structural surfaces: background is asserted
 * distinct by value alone, because no two near-black tones can clear a
 * meaningful contrast ratio, and forcing one would push the ground plane
 * out of the dark theme.
 */
export const MIN_SURFACE_CONTRAST = 1.5
