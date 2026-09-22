/**
 * Vitest 全局环境准备。
 *
 * jsdom 未实现部分浏览器 API，这里做最小可用的补齐，避免组件挂载时报错。
 * 只补齐能力，不改变行为语义。
 */
import { vi } from 'vitest'

/** jsdom 未实现 ResizeObserver */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

/** jsdom 未实现 matchMedia；默认返回「不匹配」，即偏好暗色 + 未开启减弱动效 */
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

/** jsdom 未实现 scrollIntoView（缩略图自动滚动会用到） */
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn()
}
