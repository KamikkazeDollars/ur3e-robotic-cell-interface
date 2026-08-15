// G-04-1 checkpoint follow-up (plan 04-06 continuation). Proves the two
// halves of the reported regression at the unit level: (a) a manual
// dropdown pick still gets the tight D-05 auto-frame, and (b) a
// mode-switch's automatic reselection does not — it defers to the wide
// Reset View framing instead. This repo's Vitest setup runs under
// `environment: 'node'` (vite.config.ts) with no jsdom/canvas harness, so
// `ToolpathCameraFit.tsx` itself cannot be rendered in a test; this pure
// function is the extracted decision it delegates to, mirroring how
// `marker-scale.ts` splits pure math out of its consuming scene component
// for the same reason.
import { describe, it, expect } from 'vitest'
import { shouldTightFrameOnReady } from './camera-fit-origin'

describe('shouldTightFrameOnReady', () => {
  it('returns true for a manual dropdown pick — SampleSelect.tsx keeps the existing tight D-05 auto-frame (no regression)', () => {
    expect(shouldTightFrameOnReady('manual')).toBe(true)
  })

  it('returns false for a mode-switch auto-reselection — useCellModeSampleSync.ts defers to the wide Reset View framing instead', () => {
    expect(shouldTightFrameOnReady('mode-sync')).toBe(false)
  })
})
