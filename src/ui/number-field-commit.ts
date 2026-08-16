// Quick 260816-qym (U-1): the drift-free manual-input commit primitive.
//
// This function is the ONLY place a manual-jog field's post-commit display
// text is produced. It closes the confirmed stale-closure defect in the
// previous `NumberField.commitDraft` body, where `setDraft(value.toFixed(1))`
// ran against the pre-edit `value` prop captured in the render that was
// current when the commit STARTED, not the value the store actually holds
// once the commit has been applied — rewriting the field with the OLD
// number even after a successful commit. The fix is the third argument:
// `readCommitted` is called AFTER `onCommit`, so the returned string is
// derived from the TRUE post-commit value read live from the store, never
// from a captured render-time prop.
//
// `readCommitted` is passed in rather than imported so this module stays
// pure and node-testable with no store import of its own — the caller
// supplies it (typically `() => manualJointDegrees(useCellStore.getState(), i)`
// or the rail equivalent). Zustand's `set()` is synchronous, so a
// `getState()`-backed `readCommitted` observes the committed outcome
// immediately, with no microtask delay to account for.
import { parseNumericInput } from './manual-jog'

/**
 * Parses `draft` via `parseNumericInput` (never reimplemented here); when it
 * parses, dispatches `onCommit(parsed)` — a store action, e.g.
 * `setManualJointAngle`/`setManualRailPos` — then, regardless of whether the
 * draft parsed, calls `readCommitted()` and returns its value formatted to
 * one decimal place. An unparseable draft therefore commits nothing and
 * simply returns the current committed value's display text; a REFUSED
 * commit (the safety gate leaves the store untouched) likewise returns the
 * value the robot is still actually holding, because `readCommitted` always
 * reads the store's real current state, not an assumption about what the
 * commit did.
 */
export function commitNumberFieldDraft(
  draft: string,
  onCommit: (parsed: number) => void,
  readCommitted: () => number,
): string {
  const parsed = parseNumericInput(draft)
  if (parsed !== null) onCommit(parsed)
  return readCommitted().toFixed(1)
}
