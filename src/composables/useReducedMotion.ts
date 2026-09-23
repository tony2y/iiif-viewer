/**
 * 响应系统「减弱动效」设置的组合式函数。
 *
 * 与 `core/iiif` 中的 `prefersReducedMotion()` 分工：
 * - 后者是一次性查询，用于创建 OpenSeadragon 实例时推导初始配置；
 * - 本函数负责订阅运行期变化，使已创建的实例也能实时切换动效强度。
 *
 * 非浏览器环境或不支持 `matchMedia` 时恒为 `false`，不报错。
 */
import type { Ref } from 'vue'
import { onBeforeUnmount, ref } from 'vue'

import { prefersReducedMotion } from '@/core/iiif'

/** `prefers-reduced-motion: reduce` 的媒体查询 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): Ref<boolean> {
  const reducedMotion = ref(prefersReducedMotion())
  let query: MediaQueryList | null = null
  let onChange: ((event: MediaQueryListEvent) => void) | null = null

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    query = window.matchMedia(REDUCED_MOTION_QUERY)
    reducedMotion.value = query.matches
    onChange = (event) => {
      reducedMotion.value = event.matches
    }
    query.addEventListener('change', onChange)
  }

  onBeforeUnmount(() => {
    if (query && onChange) query.removeEventListener('change', onChange)
    query = null
    onChange = null
  })

  return reducedMotion
}
