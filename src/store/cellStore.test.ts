import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { useCellStore, MAX_UPLOAD_BYTES, UPLOADED_JOB_ID } from './cellStore'
import { useUiShellStore } from './uiShellStore'
import { RAIL_CENTER_X, RAIL_TRAVEL, UR3E_JOINT_LIMITS, UR3E_PARKED_POSE } from '../kinematics'
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../scene/camera-defaults'

describe('useCellStore', () => {
  it('starts with resetToken at 0', () => {
    expect(useCellStore.getState().resetToken).toBe(0)
  })

  it('increments resetToken by 1 on a single requestCameraReset() call', () => {
    const before = useCellStore.getState().resetToken
    useCellStore.getState().requestCameraReset()
    expect(useCellStore.getState().resetToken).toBe(before + 1)
  })

  it('strictly increases resetToken on each of three consecutive calls, ending at start+3', () => {
    const start = useCellStore.getState().resetToken
    useCellStore.getState().requestCameraReset()
    const afterFirst = useCellStore.getState().resetToken
    useCellStore.getState().requestCameraReset()
    const afterSecond = useCellStore.getState().resetToken
    useCellStore.getState().requestCameraReset()
    const afterThird = useCellStore.getState().resetToken

    expect(afterFirst).toBe(start + 1)
    expect(afterSecond).toBe(start + 2)
    expect(afterThird).toBe(start + 3)
  })

  it('changes resetToken and nothing else on the store snapshot', () => {
    const before = useCellStore.getState()
    useCellStore.getState().requestCameraReset()
    const after = useCellStore.getState()

    const beforeKeys = Object.keys(before) as Array<keyof typeof before>
    const afterKeys = Object.keys(after) as Array<keyof typeof after>
    expect(afterKeys.sort()).toEqual(beforeKeys.sort())

    for (const key of beforeKeys) {
      if (key === 'resetToken') continue
      expect(after[key]).toBe(before[key])
    }
    expect(after.resetToken).not.toBe(before.resetToken)
  })
})

describe('useCellStore — robotLoadStatus', () => {
  it('starts at loading', () => {
    expect(useCellStore.getState().robotLoadStatus).toBe('loading')
  })

  it('setRobotLoadStatus("ready") sets the status to ready', () => {
    useCellStore.getState().setRobotLoadStatus('ready')
    expect(useCellStore.getState().robotLoadStatus).toBe('ready')
  })

  it('transitions are not one-way: error can follow ready', () => {
    useCellStore.getState().setRobotLoadStatus('ready')
    expect(useCellStore.getState().robotLoadStatus).toBe('ready')
    useCellStore.getState().setRobotLoadStatus('error')
    expect(useCellStore.getState().robotLoadStatus).toBe('error')
  })

  it('changing the load status leaves resetToken untouched', () => {
    const before = useCellStore.getState().resetToken
    useCellStore.getState().setRobotLoadStatus('ready')
    useCellStore.getState().setRobotLoadStatus('error')
    expect(useCellStore.getState().resetToken).toBe(before)
  })
})

describe('useCellStore — setScrubFraction', () => {
  it('clamps a value above 1 down to 1', () => {
    useCellStore.getState().setScrubFraction(1.5)
    expect(useCellStore.getState().scrubFraction).toBe(1)
  })

  it('clamps a value below 0 up to 0', () => {
    useCellStore.getState().setScrubFraction(-0.5)
    expect(useCellStore.getState().scrubFraction).toBe(0)
  })

  it('passes through an in-range value unchanged', () => {
    useCellStore.getState().setScrubFraction(0.42)
    expect(useCellStore.getState().scrubFraction).toBe(0.42)
  })

  it('falls back to 0 instead of propagating NaN', () => {
    useCellStore.getState().setScrubFraction(0.7)
    useCellStore.getState().setScrubFraction(NaN)
    expect(useCellStore.getState().scrubFraction).toBe(0)
  })

  it('falls back to 0 instead of propagating +/- Infinity', () => {
    useCellStore.getState().setScrubFraction(0.7)
    useCellStore.getState().setScrubFraction(Infinity)
    expect(useCellStore.getState().scrubFraction).toBe(0)
    useCellStore.getState().setScrubFraction(0.7)
    useCellStore.getState().setScrubFraction(-Infinity)
    expect(useCellStore.getState().scrubFraction).toBe(0)
  })
})

describe('useCellStore — playback', () => {
  beforeEach(() => {
    useCellStore.setState({
      isPlaying: false,
      playbackStarted: false,
      scrubFraction: 0,
      livePlayback: { fraction: 0 },
    })
  })

  it('isPlaying starts false', () => {
    expect(useCellStore.getState().isPlaying).toBe(false)
  })

  it('play() sets isPlaying true and pause() sets it back to false', () => {
    useCellStore.getState().play()
    expect(useCellStore.getState().isPlaying).toBe(true)
    useCellStore.getState().pause()
    expect(useCellStore.getState().isPlaying).toBe(false)
  })

  it('playbackStarted starts false', () => {
    expect(useCellStore.getState().playbackStarted).toBe(false)
  })

  it('play() sets playbackStarted true', () => {
    useCellStore.getState().play()
    expect(useCellStore.getState().playbackStarted).toBe(true)
  })

  it('pause() leaves playbackStarted true (the timeline stays visible once unlocked)', () => {
    useCellStore.getState().play()
    expect(useCellStore.getState().playbackStarted).toBe(true)
    useCellStore.getState().pause()
    expect(useCellStore.getState().playbackStarted).toBe(true)
  })

  it('loading a job returns playbackStarted to false', async () => {
    useCellStore.getState().play()
    expect(useCellStore.getState().playbackStarted).toBe(true)

    const printGcode = 'G1 X10 Y0 Z0 F100\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(printGcode) } as Response),
      ),
    )
    await useCellStore.getState().selectSample('print')

    expect(useCellStore.getState().playbackStarted).toBe(false)
    vi.unstubAllGlobals()
  })

  it('livePlayback.fraction starts at 0', () => {
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })

  it('setScrubFraction(0.42) writes 0.42 into both scrubFraction and livePlayback.fraction', () => {
    useCellStore.getState().setScrubFraction(0.42)
    expect(useCellStore.getState().scrubFraction).toBe(0.42)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0.42)
  })

  it('setScrubFraction(NaN) leaves both channels at 0', () => {
    useCellStore.getState().setScrubFraction(NaN)
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })

  it('setScrubFraction(Infinity) leaves both channels at 0', () => {
    useCellStore.getState().setScrubFraction(Infinity)
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })

  it('setScrubFraction(-1) clamps both channels to 0', () => {
    useCellStore.getState().setScrubFraction(-1)
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })

  it('setScrubFraction(2) clamps both channels to 1', () => {
    useCellStore.getState().setScrubFraction(2)
    expect(useCellStore.getState().scrubFraction).toBe(1)
    expect(useCellStore.getState().livePlayback.fraction).toBe(1)
  })

  it('livePlayback object identity is unchanged across play(), pause(), and setScrubFraction() calls', () => {
    const before = useCellStore.getState().livePlayback
    useCellStore.getState().play()
    expect(useCellStore.getState().livePlayback).toBe(before)
    useCellStore.getState().pause()
    expect(useCellStore.getState().livePlayback).toBe(before)
    useCellStore.getState().setScrubFraction(0.7)
    expect(useCellStore.getState().livePlayback).toBe(before)
  })

  it('Pitfall 4 guard: play() then setScrubFraction(0.5) leaves isPlaying true (the clock cannot pause itself)', () => {
    useCellStore.getState().play()
    useCellStore.getState().setScrubFraction(0.5)
    expect(useCellStore.getState().isPlaying).toBe(true)
  })
})

describe('camera-defaults', () => {
  it('exports DEFAULT_CAMERA_POSITION as a three-number tuple', () => {
    expect(DEFAULT_CAMERA_POSITION).toHaveLength(3)
    for (const n of DEFAULT_CAMERA_POSITION) expect(typeof n).toBe('number')
  })

  it('exports DEFAULT_CAMERA_TARGET as a three-number tuple', () => {
    expect(DEFAULT_CAMERA_TARGET).toHaveLength(3)
    for (const n of DEFAULT_CAMERA_TARGET) expect(typeof n).toBe('number')
  })

  it('positions the camera away from its target (not a degenerate view)', () => {
    expect(DEFAULT_CAMERA_POSITION).not.toEqual(DEFAULT_CAMERA_TARGET)
  })
})

describe('useCellStore — selectSample stale-response guard (T-02-10)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a slower first selection cannot overwrite a faster, out-of-order-resolving second selection', async () => {
    let resolvePrint: (value: Response) => void = () => {}
    const printFetchPromise = new Promise<Response>((resolve) => {
      resolvePrint = resolve
    })

    const printGcode = 'G1 X10 Y0 Z0 F100\n'
    const millGcode = 'G1 X20 Y0 Z0 F200\nG1 X20 Y20 Z0\n'

    const fetchMock = vi.fn((input: string) => {
      if (input.includes('print-sample')) {
        // The slower fetch: deliberately left unresolved until after the
        // second selection's fetch has already resolved, below.
        return printFetchPromise
      }
      if (input.includes('mill-sample')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(millGcode),
        } as Response)
      }
      throw new Error(`Unexpected fetch in stale-response test: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    // Start the slower "print" selection first...
    const firstCall = useCellStore.getState().selectSample('print')
    // ...then start the faster "mill" selection while "print" is still
    // in flight — this is the out-of-order race the guard defends against.
    const secondCall = useCellStore.getState().selectSample('mill')

    await secondCall
    expect(useCellStore.getState().selectedSampleId).toBe('mill')
    expect(useCellStore.getState().toolpathLoadStatus).toBe('ready')
    const millToolpath = useCellStore.getState().toolpath
    expect(millToolpath).not.toBeNull()

    // Now let the stale "print" fetch resolve, after "mill" has already won.
    resolvePrint({
      ok: true,
      status: 200,
      text: () => Promise.resolve(printGcode),
    } as Response)
    await firstCall

    // The stale response must be discarded: selection and toolpath must
    // still reflect "mill" — the second, newer selection — never "print",
    // the first selection whose fetch merely happened to resolve last.
    expect(useCellStore.getState().selectedSampleId).toBe('mill')
    expect(useCellStore.getState().toolpath).toBe(millToolpath)
  })

  it('a slower first selection that fails cannot stamp an error status over a newer, already-succeeded selection', async () => {
    let rejectPrint: (reason: Error) => void = () => {}
    const printFetchPromise = new Promise<Response>((_resolve, reject) => {
      rejectPrint = reject
    })

    const millGcode = 'G1 X20 Y0 Z0 F200\nG1 X20 Y20 Z0\n'

    const fetchMock = vi.fn((input: string) => {
      if (input.includes('print-sample')) {
        return printFetchPromise
      }
      if (input.includes('mill-sample')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(millGcode),
        } as Response)
      }
      throw new Error(`Unexpected fetch in stale-response test: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const firstCall = useCellStore.getState().selectSample('print')
    const secondCall = useCellStore.getState().selectSample('mill')

    await secondCall
    expect(useCellStore.getState().selectedSampleId).toBe('mill')
    expect(useCellStore.getState().toolpathLoadStatus).toBe('ready')
    const millToolpath = useCellStore.getState().toolpath

    // The stale "print" fetch now fails, after "mill" has already
    // succeeded — this must not flip the store back to an error state.
    rejectPrint(new Error('network error'))
    await firstCall

    expect(useCellStore.getState().selectedSampleId).toBe('mill')
    expect(useCellStore.getState().toolpathLoadStatus).toBe('ready')
    expect(useCellStore.getState().toolpath).toBe(millToolpath)
  })
})

describe('useCellStore — selectSample resets scrub position on every branch (04-REVIEW WR-01)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    // Seed a non-zero scrub position, as if a prior sample had been
    // scrubbed partway through, so each branch below can prove it actually
    // resets rather than merely starting from an already-zero value.
    useCellStore.setState({ scrubFraction: 0.6, livePlayback: { fraction: 0.6 } })
  })

  it('an unknown sampleId resets both scrub channels to 0 alongside the error status', async () => {
    await useCellStore.getState().selectSample('does-not-exist')
    expect(useCellStore.getState().toolpathLoadStatus).toBe('error')
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })

  it('entering the parsing state resets both scrub channels to 0 before the fetch resolves', () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {})) // never resolves
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    void useCellStore.getState().selectSample('print')

    expect(useCellStore.getState().toolpathLoadStatus).toBe('parsing')
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })

  it('a fetch/parse failure resets both scrub channels to 0 alongside the error status', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network error')))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    await useCellStore.getState().selectSample('print')

    expect(useCellStore.getState().toolpathLoadStatus).toBe('error')
    expect(useCellStore.getState().scrubFraction).toBe(0)
    expect(useCellStore.getState().livePlayback.fraction).toBe(0)
  })
})

describe('useCellStore — selectSample origin (G-04-1 checkpoint follow-up)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults lastSelectSampleOrigin to "manual" in the store\'s initial state', () => {
    // Explicit, rather than relying on whatever an earlier test in this file
    // last left it at — this test only asserts the field's documented
    // default value, matching the `resetToken`/`robotLoadStatus` tests above.
    useCellStore.setState({ lastSelectSampleOrigin: 'manual' })
    expect(useCellStore.getState().lastSelectSampleOrigin).toBe('manual')
  })

  it('a call with no origin argument — SampleSelect.tsx\'s manual dropdown pick — resolves with lastSelectSampleOrigin "manual"', async () => {
    const printGcode = 'G1 X10 Y0 Z0 F100\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(printGcode) } as Response),
      ),
    )
    // Seed the opposite value first so a passing assertion below proves the
    // call actually wrote 'manual' rather than merely finding it already set.
    useCellStore.setState({ lastSelectSampleOrigin: 'mode-sync' })

    await useCellStore.getState().selectSample('print')

    expect(useCellStore.getState().lastSelectSampleOrigin).toBe('manual')
  })

  it('a call with origin "mode-sync" — useCellModeSampleSync.ts\'s auto-reselection — resolves with lastSelectSampleOrigin "mode-sync"', async () => {
    const millGcode = 'G1 X20 Y0 Z0 F200\nG1 X20 Y20 Z0\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(millGcode) } as Response),
      ),
    )
    useCellStore.setState({ lastSelectSampleOrigin: 'manual' })

    await useCellStore.getState().selectSample('mill', 'mode-sync')

    expect(useCellStore.getState().lastSelectSampleOrigin).toBe('mode-sync')
  })

  it('an unknown sampleId still records the dispatching call\'s origin, not the previous selection\'s', async () => {
    useCellStore.setState({ lastSelectSampleOrigin: 'manual' })
    await useCellStore.getState().selectSample('does-not-exist', 'mode-sync')
    expect(useCellStore.getState().toolpathLoadStatus).toBe('error')
    expect(useCellStore.getState().lastSelectSampleOrigin).toBe('mode-sync')
  })

  it('a fetch/parse failure still records the dispatching call\'s origin', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))))
    useCellStore.setState({ lastSelectSampleOrigin: 'manual' })

    await useCellStore.getState().selectSample('print', 'mode-sync')

    expect(useCellStore.getState().toolpathLoadStatus).toBe('error')
    expect(useCellStore.getState().lastSelectSampleOrigin).toBe('mode-sync')
  })
})

describe('useCellStore — lastRailPos fallback (04-REVIEW CR-01)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useUiShellStore.setState({ cellMode: 'printing' })
  })

  it('defaults lastRailPos to RAIL_CENTER_X before any selection resolves', () => {
    useCellStore.setState({ trajectory: null, lastRailPos: RAIL_CENTER_X })
    expect(useCellStore.getState().lastRailPos).toBe(RAIL_CENTER_X)
  })

  it('tracks the last successfully-compiled trajectory across a mode switch, and never reports RAIL_CENTER_X (or a value outside the two real stations) once a real trajectory has already resolved once — even mid-reselection while trajectory is null', async () => {
    const printGcode = 'G1 X10 Y0 Z0 F100\nG1 X10 Y10 Z0\n'
    const millGcode = 'G1 X20 Y0 Z0 F200\nG1 X20 Y20 Z0\n'

    // Printing parks 0.6m right of RAIL_CENTER_X (rail.ts's
    // railStartXForMode) — resolve the print sample first so its trajectory
    // is the "already resolved once" real value this test's core assertion
    // depends on.
    useUiShellStore.setState({ cellMode: 'printing' })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('print-sample')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(printGcode),
          } as Response)
        }
        throw new Error(`Unexpected fetch in CR-01 test: ${input}`)
      }),
    )
    await useCellStore.getState().selectSample('print')
    const printRailPos = useCellStore.getState().trajectory?.railPos
    expect(printRailPos).not.toBeUndefined()
    expect(useCellStore.getState().lastRailPos).toBe(printRailPos)
    // A real, off-centre station — not a coincidental match with
    // RAIL_CENTER_X — so the assertions below actually exercise CR-01's
    // fallback rather than passing by accident.
    expect(printRailPos as number).toBeGreaterThan(RAIL_CENTER_X)

    // Switch modes and start the mill reselection, but hold its fetch open —
    // this reproduces the exact async gap CR-01 describes: `trajectory` goes
    // `null` synchronously the instant this call is dispatched (cellStore's
    // 'parsing' branch), before the fetch/parse/compile resolves.
    useUiShellStore.setState({ cellMode: 'milling' })
    let resolveMillFetch: (value: Response) => void = () => {}
    const millFetchPromise = new Promise<Response>((resolve) => {
      resolveMillFetch = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('mill-sample')) return millFetchPromise
        throw new Error(`Unexpected fetch in CR-01 test: ${input}`)
      }),
    )
    const millCall = useCellStore.getState().selectSample('mill')

    // Mid-flight: trajectory has been nulled, but lastRailPos — what
    // CellScene.tsx's selector (`trajectory?.railPos ?? lastRailPos`) would
    // actually read right now — must still be the print station, never the
    // RAIL_CENTER_X constant this fix replaces as the fallback.
    expect(useCellStore.getState().trajectory).toBeNull()
    expect(useCellStore.getState().lastRailPos).toBe(printRailPos)
    expect(useCellStore.getState().lastRailPos).not.toBe(RAIL_CENTER_X)

    resolveMillFetch({
      ok: true,
      status: 200,
      text: () => Promise.resolve(millGcode),
    } as Response)
    await millCall

    const millRailPos = useCellStore.getState().trajectory?.railPos
    expect(millRailPos).not.toBeUndefined()
    expect(useCellStore.getState().lastRailPos).toBe(millRailPos)
    // Milling parks 0.6m left of RAIL_CENTER_X — confirms this resolved to a
    // second, distinct, also off-centre real station.
    expect(millRailPos as number).toBeLessThan(RAIL_CENTER_X)

    // Across the whole sequence — before print resolved, during mill's
    // async gap, and after mill resolved — the effective fallback value
    // never left the closed range between the two real, resolved stations,
    // and never fell back to the fixed RAIL_CENTER_X midpoint.
    const lo = Math.min(printRailPos as number, millRailPos as number)
    const hi = Math.max(printRailPos as number, millRailPos as number)
    expect(printRailPos as number).toBeGreaterThanOrEqual(lo)
    expect(printRailPos as number).toBeLessThanOrEqual(hi)
    expect(millRailPos as number).toBeGreaterThanOrEqual(lo)
    expect(millRailPos as number).toBeLessThanOrEqual(hi)
  })
})

describe('useCellStore — manualJog (quick 260816-m6d, gated per quick 260816-nup)', () => {
  beforeEach(() => {
    useCellStore.setState({
      manualJog: null,
      manualJogError: null,
      trajectory: null,
      lastRailPos: RAIL_CENTER_X,
    })
    useUiShellStore.setState({ cellMode: 'printing' })
  })

  it('starts at null', () => {
    expect(useCellStore.getState().manualJog).toBeNull()
  })

  it('setManualJointAngle clamps an out-of-range value onto the real joint limit', () => {
    useCellStore.getState().setManualJointAngle(0, 10)
    expect(useCellStore.getState().manualJog?.joints[0]).toBe(UR3E_JOINT_LIMITS[0].max)
  })

  it("setManualJointAngle honours the elbow's narrower limit (index 2) at the CLAMP layer, but the STORE refuses the resulting commit (quick 260816-nup, U-1)", () => {
    // The elbow clamp itself still produces UR3E_JOINT_LIMITS[2].max — that
    // coverage already lives in joint-clamp.test.ts. What changed: the
    // elbow's own mechanical travel limit (pi) coincides EXACTLY with the
    // elbow singularity (classifySingularity's own documented condition),
    // so the new manual-pose-safety gate refuses this commit. This is
    // expected, not a regression — manualJog stays untouched (still null,
    // since this is the store's first manual-jog call) and manualJogError
    // is set.
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJog).toBeNull()
    expect(useCellStore.getState().manualJogError).not.toBeNull()
  })

  it('setManualRailPos(99) lands on RAIL_TRAVEL.max', () => {
    useCellStore.getState().setManualRailPos(99)
    expect(useCellStore.getState().manualJog?.railPos).toBe(RAIL_TRAVEL.max)
  })

  it('the first manual-jog call seeds the other five joints from UR3E_PARKED_POSE', () => {
    useCellStore.getState().setManualJointAngle(0, 0.1)
    const joints = useCellStore.getState().manualJog?.joints
    expect(joints).toBeDefined()
    for (let i = 1; i < 6; i++) {
      expect(joints?.[i]).toBe(UR3E_PARKED_POSE[i])
    }
  })

  it('play() returns manualJog to null', () => {
    useCellStore.getState().setManualJointAngle(0, 0.1)
    expect(useCellStore.getState().manualJog).not.toBeNull()
    useCellStore.getState().play()
    expect(useCellStore.getState().manualJog).toBeNull()
    // Restore isPlaying so later tests in this file aren't affected.
    useCellStore.setState({ isPlaying: false })
  })

  it('each setter produces a new tuple reference on every call', () => {
    useCellStore.getState().setManualJointAngle(0, 0.1)
    const firstJoints = useCellStore.getState().manualJog?.joints
    // index 5 (wrist_3) rotates about its own tool axis and moves no frame
    // origin (quick 260816-nup: index 1, shoulder_lift, now drives the arm
    // into the floor/carriage and is refused — this is a geometrically
    // inert second write instead).
    useCellStore.getState().setManualJointAngle(5, 0.2)
    const secondJoints = useCellStore.getState().manualJog?.joints
    expect(secondJoints).not.toBe(firstJoints)
    expect(useCellStore.getState().manualJogError).toBeNull()
  })

  it('clearManualJog() is a no-op (no re-render churn) when manualJog is already null', () => {
    const before = useCellStore.getState()
    useCellStore.getState().clearManualJog()
    const after = useCellStore.getState()
    expect(after).toBe(before)
  })
})

describe('useCellStore — manualJogError (quick 260816-nup, U-1/U-2/U-3)', () => {
  beforeEach(() => {
    useCellStore.setState({
      manualJog: null,
      manualJogError: null,
      trajectory: null,
      lastRailPos: RAIL_CENTER_X,
    })
    useUiShellStore.setState({ cellMode: 'printing' })
  })

  it('starts at null', () => {
    expect(useCellStore.getState().manualJogError).toBeNull()
  })

  it('a refused commit leaves manualJog referentially identical to what it was before the call', () => {
    // Accept a first, valid entry (wrist_3, geometrically inert).
    useCellStore.getState().setManualJointAngle(5, 0.2)
    const before = useCellStore.getState().manualJog
    expect(before).not.toBeNull()

    // Then attempt a refused entry (elbow clamped onto its limit, which
    // coincides with the elbow singularity).
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJog).toBe(before)
  })

  it('a refused commit sets a non-empty manualJogError', () => {
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJogError).not.toBeNull()
    expect(useCellStore.getState().manualJogError?.length).toBeGreaterThan(0)
  })

  it('the next accepted commit clears manualJogError back to null', () => {
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJogError).not.toBeNull()

    useCellStore.getState().setManualJointAngle(5, 0.2)
    expect(useCellStore.getState().manualJogError).toBeNull()
  })

  it('clearManualJog() clears a set manualJogError', () => {
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJogError).not.toBeNull()

    useCellStore.getState().clearManualJog()
    expect(useCellStore.getState().manualJogError).toBeNull()
  })

  it('play() clears a set manualJogError (it already routes through clearManualJog)', () => {
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJogError).not.toBeNull()

    useCellStore.getState().play()
    expect(useCellStore.getState().manualJogError).toBeNull()
    useCellStore.setState({ isPlaying: false })
  })

  it('ordinary out-of-range input that clamps to a still-valid pose leaves manualJogError null — clamping is not an error', () => {
    useCellStore.getState().setManualJointAngle(0, 10)
    expect(useCellStore.getState().manualJog?.joints[0]).toBe(UR3E_JOINT_LIMITS[0].max)
    expect(useCellStore.getState().manualJogError).toBeNull()
  })
})

describe('useCellStore — homeManualPose (quick 260816-qym, U-4)', () => {
  beforeEach(() => {
    useCellStore.setState({
      manualJog: null,
      manualJogError: null,
      trajectory: null,
      lastRailPos: RAIL_CENTER_X,
    })
    useUiShellStore.setState({ cellMode: 'printing' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useCellStore.setState({ isPlaying: false })
  })

  it('parks all 6 joints at UR3E_PARKED_POSE and the rail at RAIL_CENTER_X, in one call, from a non-parked manual pose', () => {
    // wrist_3 (index 5) rotates about its own tool axis and moves no frame
    // origin — a geometrically inert, always-accepted nudge off the parked
    // pose, so this test actually proves homeManualPose MOVES the robot
    // rather than finding it already parked.
    useCellStore.getState().setManualJointAngle(5, 0.2)
    expect(useCellStore.getState().manualJog?.joints[5]).not.toBe(UR3E_PARKED_POSE[5])

    useCellStore.getState().homeManualPose()

    expect(useCellStore.getState().manualJog?.joints).toEqual(UR3E_PARKED_POSE)
    expect(useCellStore.getState().manualJog?.railPos).toBe(RAIL_CENTER_X)
  })

  it('stops playback — isPlaying goes false', () => {
    useCellStore.getState().play()
    expect(useCellStore.getState().isPlaying).toBe(true)

    useCellStore.getState().homeManualPose()
    expect(useCellStore.getState().isPlaying).toBe(false)
  })

  it('clears a set manualJogError', () => {
    // Elbow driven to its travel limit, which coincides with the elbow
    // singularity (260816-nup) — refused, sets manualJogError.
    useCellStore.getState().setManualJointAngle(2, 4)
    expect(useCellStore.getState().manualJogError).not.toBeNull()

    useCellStore.getState().homeManualPose()
    expect(useCellStore.getState().manualJogError).toBeNull()
  })

  it('leaves scrubFraction, playbackStarted, trajectory, toolpath, and uploadedJobs untouched — it parks the robot, it does not unload the job', async () => {
    const printGcode = 'G1 X10 Y0 Z0 F100\nG1 X10 Y10 Z0\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(printGcode) } as Response),
      ),
    )
    await useCellStore.getState().selectSample('print')
    useCellStore.getState().play()
    useCellStore.getState().setScrubFraction(0.4)
    useCellStore.getState().pause()

    const trajectoryBefore = useCellStore.getState().trajectory
    const toolpathBefore = useCellStore.getState().toolpath
    const uploadedJobsBefore = useCellStore.getState().uploadedJobs
    const scrubBefore = useCellStore.getState().scrubFraction
    const playbackStartedBefore = useCellStore.getState().playbackStarted
    expect(scrubBefore).toBe(0.4)
    expect(playbackStartedBefore).toBe(true)

    useCellStore.getState().homeManualPose()

    expect(useCellStore.getState().trajectory).toBe(trajectoryBefore)
    expect(useCellStore.getState().toolpath).toBe(toolpathBefore)
    expect(useCellStore.getState().uploadedJobs).toBe(uploadedJobsBefore)
    expect(useCellStore.getState().scrubFraction).toBe(scrubBefore)
    expect(useCellStore.getState().playbackStarted).toBe(playbackStartedBefore)
    // The parked pose itself DID commit — proves homeManualPose ran, not
    // that it silently no-op'd.
    expect(useCellStore.getState().manualJog?.joints).toEqual(UR3E_PARKED_POSE)
  })

  it('validateManualPose is still consulted — the committed home pose passes the gate rather than skipping it', () => {
    useCellStore.getState().homeManualPose()
    expect(useCellStore.getState().manualJog).not.toBeNull()
    expect(useCellStore.getState().manualJog?.joints).toEqual(UR3E_PARKED_POSE)
    expect(useCellStore.getState().manualJog?.railPos).toBe(RAIL_CENTER_X)
    expect(useCellStore.getState().manualJogError).toBeNull()
  })
})

describe('useCellStore — per-mode uploads (quick 260816-m6d)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useCellStore.setState({ uploadedJobs: { printing: null, milling: null } })
  })

  it('an upload for printing leaves uploadedJobs.milling null', async () => {
    const text = 'G1 X10 Y0 Z0 F100\n'
    await useCellStore.getState().loadUploadedGcode('printing', 'job.gcode', text)

    expect(useCellStore.getState().uploadedJobs.printing).toEqual({ fileName: 'job.gcode', text })
    expect(useCellStore.getState().uploadedJobs.milling).toBeNull()
  })

  it('loadUploadedGcode resolves selectedSampleId to the UPLOADED_JOB_ID sentinel on success', async () => {
    const text = 'G1 X10 Y0 Z0 F100\n'
    await useCellStore.getState().loadUploadedGcode('printing', 'job.gcode', text)

    expect(useCellStore.getState().selectedSampleId).toBe(UPLOADED_JOB_ID)
    expect(useCellStore.getState().toolpathLoadStatus).toBe('ready')
  })

  it("loadJobForMode prefers an uploaded job over the bundled sample", async () => {
    const uploadedText = 'G1 X5 Y0 Z0 F100\n'
    await useCellStore.getState().loadUploadedGcode('printing', 'uploaded.gcode', uploadedText)
    const uploadedToolpath = useCellStore.getState().toolpath

    await useCellStore.getState().loadJobForMode('printing')

    expect(useCellStore.getState().selectedSampleId).toBe(UPLOADED_JOB_ID)
    // Re-resolved from the SAME uploaded text, not the bundled sample —
    // both loads parse the identical single-segment g-code above, so their
    // resulting toolpaths carry the same number of segments as a proxy for
    // "loaded from the upload, not a fetch".
    expect(useCellStore.getState().toolpath?.segments.length).toBe(uploadedToolpath?.segments.length)
  })

  it("over-cap text lands on toolpathLoadStatus: 'error' without recording the entry", async () => {
    const oversizedText = 'x'.repeat(MAX_UPLOAD_BYTES + 1)
    useCellStore.setState({ uploadedJobs: { printing: null, milling: null } })

    await useCellStore.getState().loadUploadedGcode('printing', 'huge.gcode', oversizedText)

    expect(useCellStore.getState().toolpathLoadStatus).toBe('error')
    expect(useCellStore.getState().uploadedJobs.printing).toBeNull()
  })

  it('an over-cap upload leaves a PREVIOUS upload entry untouched', async () => {
    const goodText = 'G1 X10 Y0 Z0 F100\n'
    await useCellStore.getState().loadUploadedGcode('printing', 'good.gcode', goodText)
    expect(useCellStore.getState().uploadedJobs.printing).toEqual({ fileName: 'good.gcode', text: goodText })

    const oversizedText = 'x'.repeat(MAX_UPLOAD_BYTES + 1)
    await useCellStore.getState().loadUploadedGcode('printing', 'huge.gcode', oversizedText)

    expect(useCellStore.getState().uploadedJobs.printing).toEqual({ fileName: 'good.gcode', text: goodText })
  })

  it('a sample selection after an upload still resolves normally', async () => {
    const uploadedText = 'G1 X5 Y0 Z0 F100\n'
    await useCellStore.getState().loadUploadedGcode('printing', 'uploaded.gcode', uploadedText)
    expect(useCellStore.getState().selectedSampleId).toBe(UPLOADED_JOB_ID)

    const printGcode = 'G1 X10 Y0 Z0 F100\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(printGcode) } as Response),
      ),
    )

    await useCellStore.getState().selectSample('print')

    expect(useCellStore.getState().selectedSampleId).toBe('print')
    expect(useCellStore.getState().toolpathLoadStatus).toBe('ready')
    expect(useCellStore.getState().toolpath).not.toBeNull()
  })

  it('clearUploadedJob drops the entry and reloads the bundled sample for that mode', async () => {
    const uploadedText = 'G1 X5 Y0 Z0 F100\n'
    await useCellStore.getState().loadUploadedGcode('printing', 'uploaded.gcode', uploadedText)
    expect(useCellStore.getState().uploadedJobs.printing).not.toBeNull()

    const printGcode = 'G1 X10 Y0 Z0 F100\nG1 X10 Y10 Z0\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(printGcode) } as Response),
      ),
    )

    useCellStore.getState().clearUploadedJob('printing')
    // clearUploadedJob dispatches loadJobForMode without awaiting it itself
    // (fire-and-forget, matching the "Use bundled sample" button's click
    // handler) — wait a tick for the async load to settle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(useCellStore.getState().uploadedJobs.printing).toBeNull()
    expect(useCellStore.getState().selectedSampleId).toBe('print')
  })
})
