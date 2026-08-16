// Quick 260816-qym, Task 1: the thin end-to-end tracer slice for the whole
// plan — typed text -> parse -> store commit -> gate -> read back ->
// displayed text, proven against the REAL `useCellStore` (Zustand runs fine
// under this project's `environment: 'node'` Vitest config — `cellStore.test.ts`
// already does this), before any UI component is touched.
//
// Every case asserts on BOTH the returned draft string AND the underlying
// store value, so a fix that satisfies one but not the other cannot pass.
import { describe, it, expect, beforeEach } from 'vitest'
import { commitNumberFieldDraft } from './number-field-commit'
import { manualJointDegrees, manualRailMillimetres } from './manual-pose-readback'
import { useCellStore } from '../store/cellStore'
import { useUiShellStore } from '../store/uiShellStore'
import { toRadians, millimetresToMetres } from './manual-jog'
import { RAIL_CENTER_X, UR3E_PARKED_POSE } from '../kinematics'

const JOINT_LABELS = ['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3'] as const

function resetStore() {
  useCellStore.setState({
    manualJog: null,
    manualJogError: null,
    trajectory: null,
    lastRailPos: RAIL_CENTER_X,
  })
  useUiShellStore.setState({ cellMode: 'printing' })
}

/** Builds the `onCommit`/`readCommitted` pair a real joint field would pass
 * to `commitNumberFieldDraft` — `onCommit` dispatches the real store action,
 * `readCommitted` re-derives the display value from the store's CURRENT
 * state via the same selector the reactive `value` prop uses. */
function jointFieldHandlers(jointIndex: number) {
  const onCommit = (parsedDegrees: number) =>
    useCellStore.getState().setManualJointAngle(jointIndex, toRadians(parsedDegrees))
  const readCommitted = () => manualJointDegrees(useCellStore.getState(), jointIndex)
  return { onCommit, readCommitted }
}

function railFieldHandlers() {
  const onCommit = (parsedMm: number) => useCellStore.getState().setManualRailPos(millimetresToMetres(parsedMm))
  const readCommitted = () => manualRailMillimetres(useCellStore.getState())
  return { onCommit, readCommitted }
}

describe('commitNumberFieldDraft — manual-input drift end-to-end (quick 260816-qym, U-1)', () => {
  beforeEach(resetStore)

  // Small, safety-gate-accepted nudges off UR3E_PARKED_POSE for every joint
  // (independently re-verified safe at RAIL_CENTER_X per 260816-nup-SUMMARY.md),
  // in the SAME degrees unit the Dashboard field displays. Each is far enough
  // from its parked value that a +/-1-degree drift bug would be caught, but
  // not near any joint's own singularity/collision boundary.
  const ACCEPTED_JOINT_DEGREES: Record<number, number> = {
    0: 200, // shoulder_pan — free rotation about its own mount axis
    1: -20, // shoulder_lift — small nudge off the parked bend
    2: 70, // elbow — small nudge off the parked bend (away from 0/180 singular band)
    3: -100, // wrist_1 — nudge, staying well clear of the shoulder-axis singular band
    4: -70, // wrist_2 — nudge, staying well clear of 0/+-180 (the wrist singular band)
    5: -70, // wrist_3 — rotates about its own tool axis, moves no frame origin
  }

  it.each(JOINT_LABELS.map((label, i) => [i, label] as const))(
    'joint %i (%s): commits exactly the typed value, returns "%s.0"-shaped text, and repeats idempotently',
    (jointIndex) => {
      const targetDegrees = ACCEPTED_JOINT_DEGREES[jointIndex]
      const { onCommit, readCommitted } = jointFieldHandlers(jointIndex)

      const firstDraft = commitNumberFieldDraft(String(targetDegrees), onCommit, readCommitted)

      expect(firstDraft).toBe(targetDegrees.toFixed(1))
      expect(useCellStore.getState().manualJogError).toBeNull()
      expect(useCellStore.getState().manualJog?.joints[jointIndex]).toBeCloseTo(toRadians(targetDegrees), 10)

      // Idempotence: repeating the EXACT same commit returns the same
      // string — a stale pre-edit closure cannot do this, because its
      // return value depends on whatever the PREVIOUS render's `value` prop
      // happened to be, not on the store's true current state.
      const secondDraft = commitNumberFieldDraft(String(targetDegrees), onCommit, readCommitted)
      expect(secondDraft).toBe(firstDraft)
      expect(useCellStore.getState().manualJog?.joints[jointIndex]).toBeCloseTo(toRadians(targetDegrees), 10)
    },
  )

  it('rail: committing "-1200" millimetres leaves the store at -1.2 metres and returns "-1200.0"', () => {
    const { onCommit, readCommitted } = railFieldHandlers()

    const draft = commitNumberFieldDraft('-1200', onCommit, readCommitted)

    expect(draft).toBe('-1200.0')
    expect(useCellStore.getState().manualJogError).toBeNull()
    expect(useCellStore.getState().manualJog?.railPos).toBeCloseTo(-1.2, 10)
  })

  it('rail: repeating the exact same commit twice in a row is idempotent', () => {
    const { onCommit, readCommitted } = railFieldHandlers()

    const first = commitNumberFieldDraft('-1200', onCommit, readCommitted)
    const second = commitNumberFieldDraft('-1200', onCommit, readCommitted)

    expect(second).toBe(first)
    expect(useCellStore.getState().manualJog?.railPos).toBeCloseTo(-1.2, 10)
  })

  it('a commit REFUSED by validateManualPose returns the draft string for the value the robot is still actually holding, and leaves manualJogError set', () => {
    // The elbow's own mechanical travel limit (+/-180deg) coincides exactly
    // with the elbow singularity threshold (260816-nup-SUMMARY.md) — driving
    // it there is refused by the safety gate, not silently allowed.
    const { onCommit, readCommitted } = jointFieldHandlers(2)

    const draft = commitNumberFieldDraft('180', onCommit, readCommitted)

    expect(useCellStore.getState().manualJog).toBeNull()
    expect(useCellStore.getState().manualJogError).not.toBeNull()
    // The robot is still holding the parked pose (manualJog is still null,
    // so the readback falls back to UR3E_PARKED_POSE) — the returned draft
    // must reflect THAT value, not the refused 180.
    const parkedElbowDegrees = manualJointDegrees(useCellStore.getState(), 2)
    expect(draft).toBe(parkedElbowDegrees.toFixed(1))
    expect(draft).not.toBe('180.0')
  })

  it('an unparseable draft ("") commits nothing and returns the draft string for the current committed value', () => {
    const { onCommit, readCommitted } = jointFieldHandlers(0)
    const before = manualJointDegrees(useCellStore.getState(), 0)

    const draft = commitNumberFieldDraft('', onCommit, readCommitted)

    expect(useCellStore.getState().manualJog).toBeNull()
    expect(draft).toBe(before.toFixed(1))
  })

  it('an unparseable draft ("-") commits nothing and returns the draft string for the current committed value', () => {
    const { onCommit, readCommitted } = jointFieldHandlers(0)
    const before = manualJointDegrees(useCellStore.getState(), 0)

    const draft = commitNumberFieldDraft('-', onCommit, readCommitted)

    expect(useCellStore.getState().manualJog).toBeNull()
    expect(draft).toBe(before.toFixed(1))
  })

  it('an unparseable draft ("abc") commits nothing and returns the draft string for the current committed value', () => {
    const { onCommit, readCommitted } = jointFieldHandlers(0)
    const before = manualJointDegrees(useCellStore.getState(), 0)

    const draft = commitNumberFieldDraft('abc', onCommit, readCommitted)

    expect(useCellStore.getState().manualJog).toBeNull()
    expect(draft).toBe(before.toFixed(1))
  })

  it('a value beyond the joint limit CLAMPS silently (no error) and the returned draft string is the clamped value, matching the store', () => {
    // Joint 0 (base) limit is +/-360deg (UR3E_JOINT_LIMITS[0] = +/-2*pi);
    // 600 clamps to 360 without triggering the safety gate at all (a clamped
    // pose identical to a joint at its own limit, well clear of any
    // singularity/collision boundary for this joint).
    const { onCommit, readCommitted } = jointFieldHandlers(0)

    const draft = commitNumberFieldDraft('600', onCommit, readCommitted)

    expect(useCellStore.getState().manualJogError).toBeNull()
    expect(draft).toBe('360.0')
    expect(useCellStore.getState().manualJog?.joints[0]).toBeCloseTo(toRadians(360), 10)
  })

  it('the rail readback falls back to UR3E_PARKED_POSE-consistent joints and RAIL_CENTER_X when nothing has been committed yet', () => {
    const state = useCellStore.getState()
    for (let i = 0; i < 6; i++) {
      expect(manualJointDegrees(state, i)).toBeCloseTo((UR3E_PARKED_POSE[i] * 180) / Math.PI, 10)
    }
    expect(manualRailMillimetres(state)).toBeCloseTo(RAIL_CENTER_X * 1000, 10)
  })
})
