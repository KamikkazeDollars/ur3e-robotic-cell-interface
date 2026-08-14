import { describe, it, expect, vi, afterEach } from 'vitest'
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
