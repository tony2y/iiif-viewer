import { afterEach, describe, expect, it, vi } from 'vitest'

import { useReducedMotion } from '../../src/composables/useReducedMotion'
import { stubMatchMedia, withSetup } from '../helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useReducedMotion', () => {
  it('读取初始值并跟随 change 事件更新', () => {
    const media = stubMatchMedia(true)
    const { result } = withSetup(() => useReducedMotion())

    expect(result.value).toBe(true)

    media.emit(false)
    expect(result.value).toBe(false)

    media.emit(true)
    expect(result.value).toBe(true)
  })

  it('卸载时移除监听，避免宿主页面残留回调', () => {
    const media = stubMatchMedia(false)
    const { app } = withSetup(() => useReducedMotion())

    expect(media.listeners.size).toBe(1)
    app.unmount()
    expect(media.listeners.size).toBe(0)
  })

  it('环境不支持 matchMedia 时恒为 false 且不抛错', () => {
    vi.stubGlobal('matchMedia', undefined)

    const { result } = withSetup(() => useReducedMotion())

    expect(result.value).toBe(false)
  })
})
