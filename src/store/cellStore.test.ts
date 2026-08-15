import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { useCellStore } from './cellStore'
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
    useCellStore.setState({ isPlaying: false, scrubFraction: 0, livePlayback: { fraction: 0 } })
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
