<script setup lang="ts">
/**
 * 轻量 Tooltip。
 *
 * 设计取舍：
 * - 不引入第三方依赖，只用 CSS 定位 + 少量 JS 状态；
 * - 默认 `aria-hidden`：可访问名称由触发元素自身的 `aria-label` 提供，
 *   避免屏幕阅读器把同一文案读两遍；
 * - 触屏设备（`hover: none`）完全不弹出：tap 会派发合成 `mouseenter`，
 *   手指离开后没有对应 `mouseleave`，提示会永久残留，索性不显示。
 */
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 提示文案 */
    content: string
    /** 出现位置，默认 `top` */
    placement?: 'top' | 'bottom' | 'left' | 'right'
    /** 出现延迟（ms），默认 400 */
    delay?: number
    /** 禁用提示 */
    disabled?: boolean
  }>(),
  { placement: 'top', delay: 400, disabled: false },
)

/** 仅在支持真实 hover 的指针设备上启用提示（外接鼠标的平板也会视为可 hover） */
const hoverCapable =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function show(immediate = false): void {
  if (!hoverCapable || props.disabled || !props.content) return
  clearTimer()
  if (immediate) {
    visible.value = true
    return
  }
  timer = setTimeout(() => {
    visible.value = true
  }, props.delay)
}

function hide(): void {
  clearTimer()
  visible.value = false
}

/** 键盘聚焦立即展示，避免键盘用户等待 */
function onFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.matches(':focus-visible')) show(true)
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <span
    class="iiif-viewer__tooltip-anchor"
    @mouseenter="show()"
    @mouseleave="hide()"
    @focusin="onFocusIn"
    @focusout="hide"
    @keydown.esc="hide"
  >
    <slot />
    <Transition name="iiif-tooltip">
      <span
        v-if="visible"
        class="iiif-viewer__tooltip"
        :data-placement="props.placement"
        role="presentation"
        aria-hidden="true"
      >
        {{ props.content }}
      </span>
    </Transition>
  </span>
</template>

<style scoped>
.iiif-viewer__tooltip-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.iiif-viewer__tooltip {
  position: absolute;
  z-index: var(--iiif-z-popup);
  padding: var(--iiif-space-1) var(--iiif-space-2);
  border-radius: var(--iiif-radius-sm);
  border: 1px solid var(--iiif-glass-border);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-md);
  color: var(--iiif-color-fg);
  font-size: var(--iiif-font-size-sm);
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
}

.iiif-viewer__tooltip[data-placement='top'] {
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
}

.iiif-viewer__tooltip[data-placement='bottom'] {
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
}

.iiif-viewer__tooltip[data-placement='left'] {
  right: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}

.iiif-viewer__tooltip[data-placement='right'] {
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}

.iiif-tooltip-enter-active,
.iiif-tooltip-leave-active {
  transition:
    opacity var(--iiif-duration-fast) var(--iiif-ease),
    transform var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-tooltip-enter-from,
.iiif-tooltip-leave-to {
  opacity: 0;
}
</style>
