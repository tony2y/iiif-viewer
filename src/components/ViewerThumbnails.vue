<script setup lang="ts">
/**
 * 画布缩略图条（仅多画布场景显示）。
 *
 * 缩略图地址优先取 manifest 中的 `thumbnail`；缺失时回退到 Image API 的通用
 * 尺寸请求 `{service}/full/!120,120/0/default.jpg`（v2 / v3 均适用）。
 */
import { nextTick, ref, watch } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'
import type { IiifCanvas } from '@/types/iiif'

const props = withDefaults(
  defineProps<{
    /** 全部画布 */
    canvases: IiifCanvas[]
    /** 当前画布索引 */
    current: number
    /** 双页模式下当前跨页的第二页索引 */
    secondary?: number
    /** 窄容器模式 */
    compact?: boolean
  }>(),
  { secondary: undefined, compact: false },
)

const emit = defineEmits<{
  /** 选择某个画布 */
  select: [index: number]
}>()

const { t } = useViewerI18nContext()

const listRef = ref<HTMLElement | null>(null)

/** 推导缩略图地址 */
function thumbnailSrc(canvas: IiifCanvas): string | undefined {
  if (canvas.thumbnailUrl) return canvas.thumbnailUrl
  if (canvas.serviceId) {
    return `${canvas.serviceId.replace(/\/+$/, '')}/full/!120,120/0/default.jpg`
  }
  return canvas.imageUrl
}

/** 是否属于当前展示范围（双页模式下有两项同时处于选中态） */
function isActive(index: number): boolean {
  return index === props.current || (props.secondary !== undefined && index === props.secondary)
}

/** 键盘左右键在缩略图之间移动焦点 */
function onKeydown(event: KeyboardEvent, index: number): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const delta = event.key === 'ArrowLeft' ? -1 : 1
  const next = index + delta
  if (next < 0 || next >= props.canvases.length) return
  event.preventDefault()
  const buttons = listRef.value?.querySelectorAll<HTMLButtonElement>('[data-thumb]')
  buttons?.[next]?.focus()
}

// 页码变化时把选中项滚动到可视区
watch(
  () => props.current,
  async (index) => {
    await nextTick()
    const buttons = listRef.value?.querySelectorAll<HTMLButtonElement>('[data-thumb]')
    const target = buttons?.[index]
    // jsdom 未实现 scrollIntoView，需做能力检测
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  },
)
</script>

<template>
  <div
    ref="listRef"
    class="iiif-thumbs iiif-viewer__scroll-x"
    role="listbox"
    :aria-label="t('a11y.thumbnails')"
    :aria-orientation="'horizontal'"
  >
    <button
      v-for="(canvas, index) in props.canvases"
      :key="canvas.id"
      data-thumb
      type="button"
      role="option"
      class="iiif-thumbs__item"
      :class="{ 'iiif-thumbs__item--active': isActive(index) }"
      :aria-selected="isActive(index)"
      :aria-current="isActive(index) ? 'true' : undefined"
      :aria-label="t('status.page', { current: index + 1, total: props.canvases.length })"
      :title="canvas.label"
      @click="emit('select', index)"
      @keydown="onKeydown($event, index)"
    >
      <img
        v-if="thumbnailSrc(canvas)"
        class="iiif-thumbs__image"
        :src="thumbnailSrc(canvas)"
        :alt="canvas.label"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <span v-else class="iiif-thumbs__placeholder" aria-hidden="true">{{ index + 1 }}</span>

      <span class="iiif-thumbs__index" aria-hidden="true">{{ index + 1 }}</span>
      <span class="iiif-thumbs__bar" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.iiif-thumbs {
  position: relative;
  z-index: var(--iiif-z-panel);
  display: flex;
  align-items: center;
  gap: var(--iiif-space-2);
  flex: none;
  padding: var(--iiif-space-2) var(--iiif-space-3);
  border-top: 1px solid var(--iiif-color-border);
  background-color: var(--iiif-color-surface);
  animation: iiif-slide-up var(--iiif-duration) var(--iiif-ease);
}

.iiif-thumbs__item {
  position: relative;
  display: block;
  flex: none;
  width: 60px;
  height: 60px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--iiif-color-border);
  border-radius: var(--iiif-radius-sm);
  background-color: var(--iiif-color-surface-2);
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color var(--iiif-duration-fast) var(--iiif-ease),
    transform var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-thumbs__item:hover {
  border-color: var(--iiif-color-accent);
  transform: translateY(-1px);
}

.iiif-thumbs__item:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

.iiif-thumbs__item--active {
  border-color: var(--iiif-color-accent);
}

.iiif-thumbs__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.iiif-thumbs__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-lg);
}

.iiif-thumbs__index {
  position: absolute;
  left: 2px;
  bottom: 2px;
  min-width: 16px;
  padding: 0 3px;
  border-radius: var(--iiif-radius-sm);
  background-color: rgba(0, 0, 0, 0.62);
  color: #ffffff;
  font-size: var(--iiif-font-size-xs);
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 当前项用底部强调条表达（用不透明度过渡，不改变布局尺寸） */
.iiif-thumbs__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background-color: var(--iiif-color-accent-text);
  opacity: 0;
  transition: opacity var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-thumbs__item--active .iiif-thumbs__bar {
  opacity: 1;
}

@container iiif-viewer (max-width: 480px) {
  .iiif-thumbs {
    padding: var(--iiif-space-1) var(--iiif-space-2);
  }

  .iiif-thumbs__item {
    width: 48px;
    height: 48px;
  }
}
</style>
