<script setup lang="ts">
/**
 * 图标渲染组件。
 * 路径数据来自 `icons.ts` 中的静态常量，因此 `v-html` 不涉及外部输入。
 */
import { computed } from 'vue'

import { VIEWER_ICONS } from './icons'
import type { ViewerIconName } from './icons'

const props = withDefaults(
  defineProps<{
    /** 图标名称 */
    name: ViewerIconName
    /** 尺寸（px），默认 18 */
    size?: number
  }>(),
  { size: 18 },
)

const markup = computed(() => VIEWER_ICONS[props.name] ?? '')
</script>

<template>
  <!-- 装饰性图标：语义由使用方的按钮 / 文本承担，因此对无障碍树隐藏 -->
  <!-- eslint-disable vue/no-v-html -- 路径来自本模块内的静态常量，不接受外部输入 -->
  <svg
    class="iiif-viewer__icon"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="markup"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<style scoped>
.iiif-viewer__icon {
  display: block;
  flex: none;
}
</style>
