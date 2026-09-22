<script setup lang="ts">
/**
 * 状态栏：展示当前画布标题与视图状态（缩放 / 旋转 / 翻转 / 页码）。
 *
 * 窄容器下自动精简为「页码 + 缩放」，长标题使用省略号并保留 `title` 提示。
 */
import { computed } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'

const props = withDefaults(
  defineProps<{
    /** 相对图像原始像素的缩放百分比 */
    zoomPercent: number
    /** 当前旋转角度（0–359） */
    rotation: number
    /** 是否水平翻转 */
    flipped: boolean
    /** 当前画布索引（从 0 开始） */
    page: number
    /** 画布总数 */
    total: number
    /** 双页模式下当前跨页的第二页下标 */
    secondaryIndex?: number
    /** 是否处于双页展开模式 */
    doublePage?: boolean
    /** 当前画布标题 */
    title?: string
    /** 窄容器模式：精简展示 */
    compact?: boolean
  }>(),
  { secondaryIndex: undefined, doublePage: false, title: undefined, compact: false },
)

const { t } = useViewerI18nContext()

const isMultiCanvas = computed(() => props.total > 1)
const isSpread = computed(() => props.doublePage && props.secondaryIndex !== undefined)

const pageLabel = computed(() => {
  if (isSpread.value && props.secondaryIndex !== undefined) {
    return t('status.pageRange', {
      from: props.page + 1,
      to: props.secondaryIndex + 1,
      total: props.total,
    })
  }
  return t('status.page', { current: props.page + 1, total: props.total })
})
const zoomLabel = computed(() => t('status.zoom', { percent: props.zoomPercent }))
const rotationLabel = computed(() => t('status.rotated', { degrees: props.rotation }))
</script>

<template>
  <div class="iiif-status">
    <span v-if="props.title && !props.compact" class="iiif-status__title" :title="props.title">
      {{ props.title }}
    </span>

    <span class="iiif-status__group">
      <span v-if="isMultiCanvas" class="iiif-status__item iiif-status__item--page">
        {{ pageLabel }}
      </span>

      <span
        v-if="props.doublePage && isMultiCanvas && !props.compact"
        class="iiif-status__item iiif-status__item--spread"
      >
        {{ t('status.spread') }}
      </span>

      <span v-if="!props.compact && props.rotation !== 0" class="iiif-status__item">
        {{ rotationLabel }}
      </span>

      <span v-if="!props.compact && props.flipped" class="iiif-status__item">
        {{ t('status.flipped') }}
      </span>

      <span class="iiif-status__item iiif-status__item--zoom">{{ zoomLabel }}</span>
    </span>
  </div>
</template>

<style scoped>
.iiif-status {
  position: relative;
  z-index: var(--iiif-z-toolbar);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iiif-space-3);
  padding: var(--iiif-space-1) var(--iiif-space-3);
  border-top: 1px solid var(--iiif-color-border);
  background-color: var(--iiif-color-surface);
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-sm);
  min-height: 30px;
}

.iiif-status__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--iiif-color-fg);
}

.iiif-status__group {
  display: flex;
  align-items: center;
  gap: var(--iiif-space-3);
  margin-left: auto;
  flex: none;
}

.iiif-status__item {
  white-space: nowrap;
  /* 数字等宽，避免缩放时数字宽度变化导致抖动 */
  font-variant-numeric: tabular-nums;
}

.iiif-status__item--zoom {
  color: var(--iiif-color-fg);
}

/* 双页模式标记：用强调色小标签表达当前处于跨页 */
.iiif-status__item--spread {
  padding: 0 var(--iiif-space-1);
  border-radius: var(--iiif-radius-sm);
  background-color: var(--iiif-color-surface-2);
  color: var(--iiif-color-accent-text);
  font-size: var(--iiif-font-size-xs);
}

@container iiif-viewer (max-width: 480px) {
  .iiif-status {
    padding: var(--iiif-space-1) var(--iiif-space-2);
  }
}
</style>
