// U-5 (quick 260816-nup): the shared left-offset derivation both `ModeBar`
// and `App.tsx`'s bottom-left overlay column consume, so the two can never
// drift apart from each other — the same single-source discipline
// `tab-registry.ts` already applies to the tab set. Data only, no JSX, no
// React import, so `shell-geometry.test.ts` can import it without a DOM.

/**
 * The left offset scene-overlay chrome (the mode bar, the bottom-left
 * control stack) must sit at: past the icon rail alone when the docked
 * panel is closed, or past the rail AND the docked panel when it is open.
 */
export function shellContentLeft(panelOpen: boolean): string {
  return panelOpen
    ? 'calc(var(--shell-rail-width) + var(--shell-panel-width) + var(--space-lg))'
    : 'calc(var(--shell-rail-width) + var(--space-lg))'
}
