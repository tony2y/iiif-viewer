<script setup lang="ts">
/**
 * 加载覆盖层：骨架 shimmer + 环形进度 + 文案。
 *
 * 层级低于工具栏，加载过程中用户仍可切换语言 / 主题等。
 */
import { computed } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'
import ViewerIcon from './base/ViewerIcon.vue'

const props = withDefaults(
  defineProps<{
    /** 加载进度 0–100；为 0 时退化为不确定态（旋转图标） */
    progress?: number
    /** 自定义文案，默认取 i18n 的 `status.loading` */
    label?: string
  }>(),
  { progress: 0, label: undefined },
)

const { t } = useViewerI18nContext()

const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const isDeterminate = computed(() => props.progress > 0)
const dashOffset = computed(
  () => CIRCUMFERENCE * (1 - Math.min(Math.max(props.progress, 0), 100) / 100),
)
const text = computed(() => props.label ?? t('status.loading'))
</script>

<template>
  <div class="iiif-loading" role="status" aria-live="polite">
    <!-- 顶部 shimmer 提示「正在取瓦片」 -->
    <span class="iiif-loading__shimmer" aria-hidden="true" />

    <div class="iiif-loading__card">
      <div class="iiif-loading__indicator">
        <svg
          v-if="isDeterminate"
          class="iiif-loading__ring"
          viewBox="0 0 48 48"
          width="48"
          height="48"
          aria-hidden="true"
          focusable="false"
        >
          <circle class="iiif-loading__track" cx="24" cy="24" :r="RADIUS" />
          <circle
            class="iiif-loading__value"
            cx="24"
            cy="24"
            :r="RADIUS"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 24 24)"
          />
        </svg>
        <ViewerIcon v-else class="iiif-loading__spinner" name="loader" :size="24" />
      </div>

      <p class="iiif-loading__text">{{ text }}</p>
    </div>
  </div>
</template>

<style scoped>
.iiif-loading {
  position: absolute;
  inset: 0;
  z-index: var(--iiif-z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: var(--iiif-overlay-scrim);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  animation: iiif-fade-in var(--iiif-duration) var(--iiif-ease);
}

.iiif-loading__shimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    var(--iiif-color-accent-text) 50%,
    transparent 100%
  );
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: iiif-shimmer 1.4s linear infinite;
}

.iiif-loading__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--iiif-space-3);
  padding: var(--iiif-space-5) var(--iiif-space-6);
  border-radius: var(--iiif-radius-lg);
  border: 1px solid var(--iiif-glass-border);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-lg);
}

.iiif-loading__indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: var(--iiif-color-accent-text);
}

.iiif-loading__ring {
  display: block;
}

.iiif-loading__track {
  fill: none;
  stroke: var(--iiif-color-border);
  stroke-width: 3;
}

.iiif-loading__value {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset var(--iiif-duration) var(--iiif-ease);
}

.iiif-loading__spinner {
  animation: iiif-spin 1s linear infinite;
}

.iiif-loading__text {
  margin: 0;
  color: var(--iiif-color-fg);
  font-size: var(--iiif-font-size-md);
  letter-spacing: 0.01em;
}

/* 窄容器下收紧卡片内边距 */
@container iiif-viewer (max-width: 480px) {
  .iiif-loading__card {
    padding: var(--iiif-space-4) var(--iiif-space-5);
  }
}
</style>
