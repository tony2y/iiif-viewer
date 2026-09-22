<script setup lang="ts">
/**
 * 目录（Table of Contents）列表。
 *
 * 展示 manifest 的 `structures`（Range 树）。为了保持实现简单且无障碍语义可靠，
 * 这里把树**扁平化**后渲染为普通的列表（`ul` + `button`），用缩进表达层级，
 * 不做折叠展开 —— 目录通常规模有限，全部展开更利于快速跳转。
 *
 * 条目始终是真实的 `<button>`：既能用 Tab 逐项聚焦，也能被读屏正常识别。
 */
import { computed } from 'vue'

import { findFirstCanvasIndex } from '@/core/iiif'
import { useViewerI18nContext } from '@/composables/useViewerI18n'
import type { IiifStructure } from '@/types/iiif'

const props = defineProps<{
  /** 目录树（来自 `manifest.structures`） */
  structures: IiifStructure[]
  /** 当前画布下标，用于高亮 */
  currentIndex: number
}>()

const emit = defineEmits<{
  /** 请求跳转到某个画布 */
  select: [index: number]
}>()

const { t } = useViewerI18nContext()

interface FlatEntry {
  node: IiifStructure
  depth: number
  /** 该条目（含子孙）覆盖的第一个画布下标 */
  targetIndex?: number
}

/** 深度优先扁平化，保留层级信息 */
function flatten(nodes: IiifStructure[], depth = 0, out: FlatEntry[] = []): FlatEntry[] {
  for (const node of nodes) {
    out.push({ node, depth, targetIndex: findFirstCanvasIndex(node) })
    flatten(node.children, depth + 1, out)
  }
  return out
}

const entries = computed(() => flatten(props.structures))

/** 判断条目（含子孙）是否覆盖当前页 */
function coversCurrent(node: IiifStructure): boolean {
  if (node.canvasIndexes.includes(props.currentIndex)) return true
  return node.children.some(coversCurrent)
}

function onSelect(entry: FlatEntry): void {
  if (entry.targetIndex === undefined) return
  emit('select', entry.targetIndex)
}
</script>

<template>
  <div class="iiif-toc">
    <p v-if="entries.length === 0" class="iiif-toc__empty">{{ t('info.toc.empty') }}</p>

    <ul v-else class="iiif-toc__list iiif-viewer__scroll-y">
      <li v-for="entry in entries" :key="entry.node.id" class="iiif-toc__item">
        <button
          type="button"
          class="iiif-toc__entry"
          :class="{ 'iiif-toc__entry--active': coversCurrent(entry.node) }"
          :style="{ paddingInlineStart: `${12 + entry.depth * 14}px` }"
          :disabled="entry.targetIndex === undefined"
          :aria-current="coversCurrent(entry.node) ? 'true' : undefined"
          :title="entry.node.label"
          @click="onSelect(entry)"
        >
          <span class="iiif-toc__label">{{ entry.node.label }}</span>
          <span v-if="entry.targetIndex !== undefined" class="iiif-toc__page">
            {{ entry.targetIndex + 1 }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.iiif-toc {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

.iiif-toc__empty {
  margin: 0;
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-md);
}

.iiif-toc__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.iiif-toc__item {
  display: block;
}

.iiif-toc__entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iiif-space-2);
  width: 100%;
  min-height: 34px;
  margin: 0;
  padding: var(--iiif-space-1) var(--iiif-space-2);
  border: 1px solid transparent;
  border-radius: var(--iiif-radius-sm);
  background-color: transparent;
  color: var(--iiif-color-fg);
  font: inherit;
  font-size: var(--iiif-font-size-md);
  text-align: start;
  cursor: pointer;
  transition:
    background-color var(--iiif-duration-fast) var(--iiif-ease),
    color var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-toc__entry:hover:not(:disabled) {
  background-color: var(--iiif-color-surface-2);
}

/* 当前页所在的目录项：左侧强调条 + 强调色文字 */
.iiif-toc__entry--active {
  color: var(--iiif-color-accent-text);
  box-shadow: inset 2px 0 0 0 var(--iiif-color-accent-text);
}

.iiif-toc__entry:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

.iiif-toc__entry:disabled {
  cursor: default;
  opacity: 0.55;
}

.iiif-toc__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iiif-toc__page {
  flex: none;
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-xs);
  font-variant-numeric: tabular-nums;
}

@media (hover: none) {
  .iiif-toc__entry {
    min-height: 44px;
  }
}
</style>
