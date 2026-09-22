import type { App } from 'vue'
import { createApp } from 'vue'

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
