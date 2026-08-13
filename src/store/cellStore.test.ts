import { describe, it, expect } from 'vitest'
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
