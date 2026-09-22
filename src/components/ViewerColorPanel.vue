<script setup lang="ts">
/**
 * 色彩调节面板（亮度 / 对比度 / 饱和度）。
 *
 * 采用「单个工具栏按钮 → 右侧面板」的组织方式：三个滑杆集中在一处，比在工具栏上
 * 各挂一个弹出滑杆更省空间，也更容易看清三者的相对关系。
 *
 * 无障碍处理与元数据面板一致：`role="dialog"` + `aria-labelledby`，打开时聚焦关闭按钮、
 * 关闭时归还焦点，支持 Esc 关闭；每个滑杆都有 `<label>` 且实时播报百分比。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'
import {
  COLOR_ADJUSTMENT_RANGES,
  DEFAULT_COLOR_ADJUSTMENTS,
  isNeutralColorAdjustments,
  normalizeColorAdjustments,
} from '@/core/color'
import type { IiifColorAdjustmentKey, IiifColorAdjustments } from '@/types/viewer'
import ViewerButton from './base/ViewerButton.vue'

const props = withDefaults(
  defineProps<{
    /** 是否展开 */
    open: boolean
    /** 当前调节值 */
    colors?: IiifColorAdjustments
  }>(),
  { colors: () => ({ ...DEFAULT_COLOR_ADJUSTMENTS }) },
)

const emit = defineEmits<{
  /** 调节值变化（已归一化） */
  change: [colors: IiifColorAdjustments]
  /** 请求重置为默认值 */
  reset: []
  /** 请求关闭面板 */
  close: []
}>()

const { t } = useViewerI18nContext()

const titleId = 'iiif-viewer-color-title'
const closeButtonRef = ref<InstanceType<typeof ViewerButton> | null>(null)

/** 打开前的焦点元素，关闭时归还 */
let previousActive: HTMLElement | null = null

const SLIDERS: { key: IiifColorAdjustmentKey; labelKey: string }[] = [
  { key: 'brightness', labelKey: 'color.brightness' },
  { key: 'contrast', labelKey: 'color.contrast' },
  { key: 'saturation', labelKey: 'color.saturation' },
]

const isNeutral = computed(() => isNeutralColorAdjustments(props.colors))

function rangeOf(key: IiifColorAdjustmentKey) {
  return COLOR_ADJUSTMENT_RANGES[key]
}

function onInput(key: IiifColorAdjustmentKey, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  emit('change', normalizeColorAdjustments({ ...props.colors, [key]: value }))
}

/** 双击滑杆标签可快速回到该维度的中性值 */
function resetKey(key: IiifColorAdjustmentKey): void {
  emit('change', normalizeColorAdjustments({ ...props.colors, [key]: 100 }))
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (typeof document === 'undefined') return
    if (open) {
      previousActive = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onDocumentKeydown)
      await nextTick()
      // ViewerButton 根元素是 Tooltip 包裹层，需调用其暴露的 focus() 聚焦真实按钮
      closeButtonRef.value?.focus()
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
      previousActive?.focus?.()
      previousActive = null
    }
  },
  // 初始即展开时也要注册键盘监听并把焦点移入面板
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <Transition name="iiif-drawer">
    <aside
      v-if="props.open"
      class="iiif-color"
      role="dialog"
      aria-modal="false"
      :aria-labelledby="titleId"
    >
      <header class="iiif-color__header">
        <h3 :id="titleId" class="iiif-color__heading">{{ t('color.title') }}</h3>
        <ViewerButton
          ref="closeButtonRef"
          size="sm"
          icon="close"
          :label="t('color.close')"
          @click="emit('close')"
        />
      </header>

      <div class="iiif-color__body">
        <div v-for="slider in SLIDERS" :key="slider.key" class="iiif-color__field">
          <div class="iiif-color__field-head">
            <label class="iiif-color__label" :for="`iiif-color-${slider.key}`">
              {{ t(slider.labelKey) }}
            </label>
            <button
              type="button"
              class="iiif-color__value"
              :title="t('color.neutral')"
              @click="resetKey(slider.key)"
            >
              {{ props.colors[slider.key] }}%
            </button>
          </div>

          <input
            :id="`iiif-color-${slider.key}`"
            class="iiif-color__slider"
            type="range"
            :min="rangeOf(slider.key).min"
            :max="rangeOf(slider.key).max"
            :step="rangeOf(slider.key).step"
            :value="props.colors[slider.key]"
            :aria-valuetext="`${props.colors[slider.key]}%`"
            @input="onInput(slider.key, $event)"
          />
        </div>

        <div class="iiif-color__footer">
          <span v-if="isNeutral" class="iiif-color__badge">{{ t('color.neutral') }}</span>
          <ViewerButton
            variant="ghost"
            icon="refresh"
            :label="t('color.reset')"
            :disabled="isNeutral"
            @click="emit('reset')"
          />
        </div>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.iiif-color {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--iiif-z-panel);
  display: flex;
  flex-direction: column;
  width: min(300px, 88%);
  border-left: 1px solid var(--iiif-glass-border);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-lg);
}

.iiif-color__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iiif-space-2);
  flex: none;
  padding: var(--iiif-space-2) var(--iiif-space-2) var(--iiif-space-2) var(--iiif-space-4);
  border-bottom: 1px solid var(--iiif-color-border);
}

.iiif-color__heading {
  margin: 0;
  color: var(--iiif-color-fg);
  font-size: var(--iiif-font-size-lg);
  font-weight: 600;
}

.iiif-color__body {
  display: flex;
  flex-direction: column;
  gap: var(--iiif-space-4);
  /* 底部预留工具栏高度，内容不会被悬浮工具栏遮住 */
  padding: var(--iiif-space-4) var(--iiif-space-4) var(--iiif-toolbar-clearance);
  overflow-y: auto;
}

.iiif-color__field {
  display: flex;
  flex-direction: column;
  gap: var(--iiif-space-2);
}

.iiif-color__field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iiif-space-2);
}

.iiif-color__label {
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.iiif-color__value {
  min-width: 48px;
  margin: 0;
  padding: 2px var(--iiif-space-2);
  border: 1px solid transparent;
  border-radius: var(--iiif-radius-sm);
  background-color: var(--iiif-color-surface-2);
  color: var(--iiif-color-fg);
  font: inherit;
  font-size: var(--iiif-font-size-sm);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: border-color var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-color__value:hover {
  border-color: var(--iiif-color-accent);
}

.iiif-color__value:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

/* 滑杆：统一轨道与滑块配色，保证暗 / 亮主题下都清晰可辨 */
.iiif-color__slider {
  width: 100%;
  height: 24px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.iiif-color__slider:focus-visible {
  outline: none;
  border-radius: var(--iiif-radius-sm);
  box-shadow: var(--iiif-focus-ring);
}

.iiif-color__slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--iiif-radius-full);
  background-color: var(--iiif-color-border-strong);
}

.iiif-color__slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border: 2px solid var(--iiif-color-bg);
  border-radius: var(--iiif-radius-full);
  background-color: var(--iiif-color-accent-text);
  -webkit-appearance: none;
  appearance: none;
}

.iiif-color__slider::-moz-range-track {
  height: 4px;
  border-radius: var(--iiif-radius-full);
  background-color: var(--iiif-color-border-strong);
}

.iiif-color__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid var(--iiif-color-bg);
  border-radius: var(--iiif-radius-full);
  background-color: var(--iiif-color-accent-text);
}

.iiif-color__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iiif-space-2);
  padding-top: var(--iiif-space-2);
  border-top: 1px solid var(--iiif-color-border);
}

.iiif-color__badge {
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-sm);
}

/* 窄容器下改为底部抽屉，避免遮挡大面积画面 */
@container iiif-viewer (max-width: 480px) {
  .iiif-color {
    top: auto;
    left: 0;
    width: 100%;
    max-height: 70%;
    border-left: 0;
    border-top: 1px solid var(--iiif-glass-border);
  }
}

.iiif-drawer-enter-active,
.iiif-drawer-leave-active {
  transition:
    opacity var(--iiif-duration) var(--iiif-ease),
    transform var(--iiif-duration) var(--iiif-ease);
}

.iiif-drawer-enter-from,
.iiif-drawer-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

@container iiif-viewer (max-width: 480px) {
  .iiif-drawer-enter-from,
  .iiif-drawer-leave-to {
    transform: translateY(16px);
  }
}
</style>
