import type { App } from 'vue'
import { createApp } from 'vue'
import { vi } from 'vitest'

import { REDUCED_MOTION_QUERY } from '@/composables/useReducedMotion'

/**
 * 在真实的组件上下文中运行 composable。
 *
 * 直接调用 composable 会触发 Vue 的 "no active component instance" 警告，
 * 且 `onMounted` / `onBeforeUnmount` 不会执行，因此统一通过挂载一个空组件来提供上下文。
 */
export function withSetup<T>(composable: () => T): {
  result: T
  app: App
  host: HTMLElement
} {
  const host = document.createElement('div')
  let result!: T

  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.mount(host)

  return { result, app, host }
}

/** 构造 JSON 响应 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface MatchMediaStub {
  /** 触发 change 事件，模拟系统设置变化 */
  emit: (matches: boolean) => void
  /** 当前注册的监听器 */
  listeners: Set<(event: MediaQueryListEvent) => void>
  matches: boolean
}

/**
 * 安装 `window.matchMedia` 替身。
 *
 * jsdom 不实现 `matchMedia`，而库内多处依赖它（初始取值 + 运行期订阅），
 * 因此统一在这里提供可控实现。
 */
export function stubMatchMedia(initial = false): MatchMediaStub {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const state: MatchMediaStub = {
    matches: initial,
    listeners,
    emit(matches: boolean) {
      state.matches = matches
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent)
      }
    },
  }

  const query = {
    get matches() {
      return state.matches
    },
    media: REDUCED_MOTION_QUERY,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  )
  return state
}
