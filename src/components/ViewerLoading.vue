<script setup lang="ts">
/**
 * 加载指示组件——全库唯一的 loading 动画：一本复古古籍在连续翻页。
 *
 * - `overlay`（默认）：资源加载的全屏覆盖层，翻书 + 文案 + 百分比；
 *   内容直接呈现在遮罩上，无卡片背景；层级低于工具栏，
 *   加载过程中用户仍可切换语言 / 主题等；
 * - `page`：翻页时的轻量指示，仅翻书本体，无遮罩、不拦截手势，
 *   供 `IiifViewer` 在「翻页后等待新画面首块瓦片」的窗口期使用。
 */
import { computed } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'

const props = withDefaults(
  defineProps<{
    /** 展现形态：`overlay` 全屏加载层（默认）；`page` 翻页轻量指示 */
    variant?: 'overlay' | 'page'
    /** 加载进度 0–100；大于 0 时在 overlay 形态下显示百分比 */
    progress?: number
    /** 自定义文案，默认取 i18n 的 `status.loading` */
    label?: string
  }>(),
  { variant: 'overlay', progress: 0, label: undefined },
)

const { t } = useViewerI18nContext()

const isDeterminate = computed(() => props.progress > 0)
const text = computed(() => props.label ?? t('status.loading'))
</script>

<template>
  <!-- 翻页轻量指示：摊开的书页连续翻动，纯装饰、不拦截舞台手势 -->
  <div
    v-if="variant === 'page'"
    class="iiif-page-loader iiif-page-loader--floating"
    aria-hidden="true"
  >
    <span /><span /><span />
  </div>

  <div v-else class="iiif-loading" role="status" aria-live="polite">
    <div class="iiif-loading__card">
      <div class="iiif-page-loader" aria-hidden="true">
        <span /><span /><span />
      </div>

      <p class="iiif-loading__text">{{ text }}</p>
      <p v-if="isDeterminate" class="iiif-loading__progress">{{ progress }}%</p>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 全屏覆盖层（variant="overlay"） ---------- */

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

/* 纯排版容器：不设背景 / 边框 / 阴影，内容直接呈现在遮罩上 */
.iiif-loading__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--iiif-space-3);
}

.iiif-loading__text {
  margin: 0;
  color: var(--iiif-color-fg);
  font-size: var(--iiif-font-size-md);
  letter-spacing: 0.01em;
}

.iiif-loading__progress {
  margin: calc(-1 * var(--iiif-space-2)) 0 0;
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-sm);
  font-variant-numeric: tabular-nums;
}

/* ---------- 翻书动画（两种形态共用） ---------- */

/*
 * 形态是一本摊开的古籍在连续翻页：右页绕中缝书脊掀起、翻向左侧，
 * 落下后沉入页堆。配色刻意脱离主题令牌、采用固定的复古古籍色：
 * 泛黄纸页、棕褐页堆、暗红棕书脊，配暖褐色投影，营造年代感。
 */
.iiif-page-loader {
  width: 56px;
  height: 36px;
  /* 纯视觉指示：不拦截舞台的拖拽 / 滚轮手势 */
  pointer-events: none;
  /* 左半为陈旧的页堆（棕褐），右半为泛黄的待翻纸页，中缝即书脊 */
  background: linear-gradient(90deg, #c7a266 0 50%, #f1e3c2 50% 100%);
  border-radius: 3px;
  box-shadow: 0 1px 5px rgb(61 42 26 / 35%);
  perspective: 220px;
  animation: iiif-page-loader-in var(--iiif-duration) var(--iiif-ease);
}

/* 舞台居中定位：仅 `page` 变体使用，overlay 内的书随卡片排版 */
.iiif-page-loader--floating {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: var(--iiif-z-loader);
  transform: translate(-50%, -50%);
}

/* 书脊：暗红棕皮革质感，压在两半书页之上、翻动页之下 */
.iiif-page-loader::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: #8a4b32;
  opacity: 0.9;
}

/* 翻动页：泛黄旧纸，只占右半，绕书脊（左缘）向左翻转 */
.iiif-page-loader span {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  right: 0;
  border-radius: 0 3px 3px 0;
  /* 页缘亮、靠书脊暗，贴近旧纸页的受光 */
  background: linear-gradient(270deg, #f4e6c4, #d9bd8a);
  box-shadow: -2px 2px 5px rgb(61 42 26 / 30%);
  transform-origin: left center;
  animation: iiif-page-flip 1.6s ease-in-out infinite;
}

/*
 * 顶页先翻、底页殿后：delay 与 DOM 层叠顺序相反，
 * 保证任意时刻翻起的页都位于最上层，不会被未翻的页盖住。
 */
.iiif-page-loader span:nth-child(1) {
  animation-delay: 1.07s;
}

.iiif-page-loader span:nth-child(2) {
  animation-delay: 0.53s;
}

.iiif-page-loader span:nth-child(3) {
  animation-delay: 0s;
}

@keyframes iiif-page-loader-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes iiif-page-flip {
  0% {
    transform: rotateY(0deg);
    opacity: 1;
  }

  /* 翻到左侧贴平（背面朝上，与页堆叠合） */
  85% {
    transform: rotateY(-180deg);
    opacity: 1;
  }

  /* 循环重启前在左侧淡出：页堆「沉降」，右侧与底色同色故无跳变感 */
  100% {
    transform: rotateY(-180deg);
    opacity: 0;
  }
}

/* 减弱动效：停用翻页动画，保留一本摊开的静态书 */
@media (prefers-reduced-motion: reduce) {
  .iiif-page-loader span {
    animation: none;
  }
}
</style>
