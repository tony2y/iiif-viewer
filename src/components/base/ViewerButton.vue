<script setup lang="ts">
/**
 * 图标按钮原语。
 *
 * 统一处理：可访问名称、Tooltip、hover / active / focus-visible / disabled 状态与触摸命中区，
 * 供工具栏、缩略图、信息面板等复用，保证交互反馈与视觉节奏一致。
 */
import { ref } from 'vue'

import ViewerIcon from './ViewerIcon.vue'
import type { ViewerIconName } from './icons'
import ViewerTooltip from './ViewerTooltip.vue'

const props = withDefaults(
  defineProps<{
    /** 可访问名称（必填），用于 `aria-label` */
    label: string
    /** 图标名；不传时使用默认插槽内容 */
    icon?: ViewerIconName
    /** Tooltip 文案，默认与 `label` 相同 */
    hint?: string
    /** 视觉变体，默认 `ghost` */
    variant?: 'ghost' | 'solid' | 'danger'
    /** 尺寸，默认 `md` */
    size?: 'sm' | 'md'
    /** 是否为切换按钮；传值后会输出 `aria-pressed` */
    active?: boolean
    /** 是否展开联动面板；传值后会输出 `aria-expanded` */
    expanded?: boolean
    /** Tooltip 出现位置 */
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'
    /** 是否禁用 */
    disabled?: boolean
  }>(),
  {
    icon: undefined,
    hint: undefined,
    variant: 'ghost',
    size: 'md',
    active: undefined,
    expanded: undefined,
    tooltipPlacement: 'top',
    disabled: false,
  },
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonRef = ref<HTMLButtonElement | null>(null)

/**
 * 把焦点移到内部真实的 `<button>` 上。
 *
 * 组件根元素是 Tooltip 的包裹容器（`<span>`），直接 focus 根元素不会生效，
 * 因此对外暴露 `focus()` 供面板等调用方做焦点管理。
 */
function focus(): void {
  buttonRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <ViewerTooltip
    :content="props.hint ?? props.label"
    :placement="props.tooltipPlacement"
    :disabled="props.disabled"
  >
    <button
      ref="buttonRef"
      type="button"
      class="iiif-viewer__btn"
      :class="[`iiif-viewer__btn--${props.variant}`, `iiif-viewer__btn--${props.size}`]"
      :aria-label="props.label"
      :aria-pressed="props.active"
      :aria-expanded="props.expanded"
      :disabled="props.disabled"
      @click="emit('click', $event)"
    >
      <ViewerIcon v-if="props.icon" :name="props.icon" :size="props.size === 'sm' ? 16 : 18" />
      <slot />
    </button>
  </ViewerTooltip>
</template>

<style scoped>
.iiif-viewer__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iiif-space-1);
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--iiif-radius-sm);
  background-color: transparent;
  color: var(--iiif-color-fg);
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--iiif-duration-fast) var(--iiif-ease),
    color var(--iiif-duration-fast) var(--iiif-ease),
    border-color var(--iiif-duration-fast) var(--iiif-ease),
    opacity var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-viewer__btn--md {
  width: 36px;
  height: 36px;
}

.iiif-viewer__btn--sm {
  width: 30px;
  height: 30px;
}

/* 触摸设备放大命中区 */
@media (hover: none) {
  .iiif-viewer__btn--md,
  .iiif-viewer__btn--sm {
    width: 44px;
    height: 44px;
  }
}

.iiif-viewer__btn--ghost:hover:not(:disabled) {
  background-color: var(--iiif-color-surface-2);
}

.iiif-viewer__btn--ghost:active:not(:disabled) {
  background-color: var(--iiif-color-border);
}

.iiif-viewer__btn--solid {
  background-color: var(--iiif-color-accent);
  color: var(--iiif-color-accent-fg);
}

.iiif-viewer__btn--solid:hover:not(:disabled) {
  background-color: var(--iiif-color-accent-hover);
}

.iiif-viewer__btn--danger {
  color: var(--iiif-color-danger);
}

.iiif-viewer__btn--danger:hover:not(:disabled) {
  background-color: var(--iiif-color-danger);
  color: var(--iiif-color-danger-fg);
}

/* 激活态：用描边与强调色表达，不改变尺寸，避免布局抖动 */
.iiif-viewer__btn[aria-pressed='true'] {
  background-color: var(--iiif-color-accent);
  color: var(--iiif-color-accent-fg);
}

.iiif-viewer__btn[aria-pressed='true']:hover:not(:disabled) {
  background-color: var(--iiif-color-accent-hover);
}

.iiif-viewer__btn[aria-expanded='true'] {
  background-color: var(--iiif-color-surface-2);
  border-color: var(--iiif-color-border-strong);
}

.iiif-viewer__btn:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

.iiif-viewer__btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
