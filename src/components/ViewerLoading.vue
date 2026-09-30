<script setup lang="ts">
/**
 * 加载指示组件——全库唯一的 loading 动画：一本摊开的复古古籍在连续翻页
 * （皮革封面 + 烫金细框、旧纸纹理、翻页弯曲受光与随动投影）。
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
    /**
     * 加载进度 0–100。当前形态不展示百分比（保留 prop 以兼容既有调用），
     * 后续如需恢复可在 overlay 卡片内补回 `{{ progress }}%` 文字。
     */
    progress?: number
    /** 自定义文案，默认取 i18n 的 `status.loading` */
    label?: string
  }>(),
  { variant: 'overlay', progress: 0, label: undefined },
)

const { t } = useViewerI18nContext()

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
 * 落下后沉入页堆。层次自底向上：
 *   皮革封面（烫金细框 + 做旧颗粒）→ 右页堆投影 → 翻动页
 *   （旧纸纹理 + 弯曲受光高光 + 随翻动变化的投影）→ 书脊。
 * 配色由 tokens.css 的 `--iiif-loader-*` 令牌提供（默认为复古古籍色：
 * 泛黄纸页、棕褐页堆、暗红棕皮革封面，配暖褐色投影与做旧颗粒），
 * 调用方可在自己的样式里整体覆盖以匹配视觉风格。
 */
.iiif-page-loader {
  width: 64px;
  height: 42px;
  /* 纯视觉指示：不拦截舞台的拖拽 / 滚轮手势 */
  pointer-events: none;
  border: 1px solid var(--iiif-loader-cover-border); /* 封面烫金细框 */
  border-radius: 4px;
  /*
   * 自上而下：做旧颗粒 → 纸纤维横纹 → 左右纸页 → 皮革封面。
   * 颗粒为内联 SVG 噪声（颜色写在 feColorMatrix 里，无法引用 CSS 变量），
   * 是固定的暖褐质感层，与各令牌纸色均可叠加。
   */
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.45 0 0 0 0 0.33 0 0 0 0 0.16 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)'/%3E%3C/svg%3E"),
    repeating-linear-gradient(0deg, rgb(var(--iiif-loader-aging-rgb) / 7%) 0 1px, transparent 1px 3px),
    linear-gradient(90deg, var(--iiif-loader-stack) 0 50%, var(--iiif-loader-paper) 50% 100%),
    linear-gradient(135deg, var(--iiif-loader-cover), var(--iiif-loader-cover-deep));
  box-shadow:
    0 2px 6px rgb(var(--iiif-loader-shadow-rgb) / 38%),
    inset 0 0 0 1px rgb(var(--iiif-loader-glint-rgb) / 14%),
    inset 0 0 7px rgb(var(--iiif-loader-shadow-rgb) / 35%); /* 封面磨损暗角 */
  perspective: 260px;
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

/* 右页堆投影：每翻过一页，阴影自书脊向外掠过一次（与翻页周期同步） */
.iiif-page-loader::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  right: 0;
  z-index: 0;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(
    270deg,
    rgb(var(--iiif-loader-shadow-rgb) / 30%),
    rgb(var(--iiif-loader-shadow-rgb) / 10%) 55%,
    transparent 80%
  );
  animation: iiif-page-shade 1.6s ease-in-out infinite;
}

/* 书脊：暗红棕皮革渐变 + 中线高光，压在翻动页之上（页跨书脊时被脊覆盖） */
.iiif-page-loader::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 3px;
  z-index: 2;
  transform: translateX(-50%);
  background: linear-gradient(
    90deg,
    var(--iiif-loader-spine-deep),
    var(--iiif-loader-cover) 45%,
    var(--iiif-loader-spine-light) 55%,
    var(--iiif-loader-spine-deep)
  );
  box-shadow: 0 0 5px rgb(var(--iiif-loader-shadow-rgb) / 40%);
}

/* 翻动页：泛黄旧纸（颗粒纹理 + 纸芯亮缘 + 磨损暗缘），绕书脊（左缘）向左翻转 */
.iiif-page-loader span {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  right: 0;
  z-index: 1;
  border-radius: 0 3px 3px 0;
  /* 页缘亮、靠书脊暗，贴近旧纸页的受光 */
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.45 0 0 0 0 0.33 0 0 0 0 0.16 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)'/%3E%3C/svg%3E"),
    linear-gradient(270deg, var(--iiif-loader-paper-flip), var(--iiif-loader-paper-flip-deep));
  box-shadow:
    -2px 2px 5px rgb(var(--iiif-loader-shadow-rgb) / 30%),
    inset -1px 0 0 rgb(var(--iiif-loader-glint-rgb) / 50%),
    inset 0 -1px 2px rgb(var(--iiif-loader-aging-rgb) / 20%);
  transform-origin: left center;
  animation: iiif-page-flip 1.6s ease-in-out infinite;
  animation-delay: var(--flip-delay, 0s);
}

/* 弯曲受光：页掀起立起时纸面弯折，一道对角光带随之扫过页身 */
.iiif-page-loader span::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    105deg,
    transparent 30%,
    rgb(var(--iiif-loader-glint-rgb) / 55%) 48%,
    rgb(var(--iiif-loader-aging-rgb) / 25%) 58%,
    transparent 72%
  );
  opacity: 0;
  animation: iiif-page-curl 1.6s ease-in-out infinite;
  animation-delay: var(--flip-delay, 0s);
}

/*
 * 顶页先翻、底页殿后：delay 与 DOM 层叠顺序相反，
 * 保证任意时刻翻起的页都位于最上层，不会被未翻的页盖住。
 * 翻动页与其弯曲高光共用同一延迟变量，保持相位同步。
 */
.iiif-page-loader span:nth-child(1) {
  --flip-delay: 1.07s;
}

.iiif-page-loader span:nth-child(2) {
  --flip-delay: 0.53s;
}

.iiif-page-loader span:nth-child(3) {
  --flip-delay: 0s;
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
    box-shadow:
      -2px 2px 5px rgb(var(--iiif-loader-shadow-rgb) / 30%),
      inset -1px 0 0 rgb(var(--iiif-loader-glint-rgb) / 50%),
      inset 0 -1px 2px rgb(var(--iiif-loader-aging-rgb) / 20%);
  }

  /* 页立起：投影拉远加大，带出翻页的「重量感」 */
  45% {
    box-shadow:
      -7px 9px 12px rgb(var(--iiif-loader-shadow-rgb) / 30%),
      inset -1px 0 0 rgb(var(--iiif-loader-glint-rgb) / 50%),
      inset 0 -1px 2px rgb(var(--iiif-loader-aging-rgb) / 20%);
  }

  /* 翻到左侧贴平（背面朝上，与页堆叠合） */
  85% {
    transform: rotateY(-180deg);
    opacity: 1;
    box-shadow:
      -2px 1px 3px rgb(var(--iiif-loader-shadow-rgb) / 26%),
      inset -1px 0 0 rgb(var(--iiif-loader-glint-rgb) / 50%),
      inset 0 -1px 2px rgb(var(--iiif-loader-aging-rgb) / 20%);
  }

  /* 循环重启前在左侧淡出：页堆「沉降」，右侧与底色同色故无跳变感 */
  100% {
    transform: rotateY(-180deg);
    opacity: 0;
    box-shadow:
      -2px 1px 3px rgb(var(--iiif-loader-shadow-rgb) / 26%),
      inset -1px 0 0 rgb(var(--iiif-loader-glint-rgb) / 50%),
      inset 0 -1px 2px rgb(var(--iiif-loader-aging-rgb) / 20%);
  }
}

@keyframes iiif-page-curl {
  0% {
    opacity: 0;
  }

  /* 页掀起立起、纸面弯折时受光最强 */
  22% {
    opacity: 1;
  }

  55% {
    opacity: 0.35;
  }

  85%,
  100% {
    opacity: 0;
  }
}

@keyframes iiif-page-shade {
  0%,
  100% {
    opacity: 0.25;
  }

  /* 页翻过书脊时，右页堆被掠过的影子最深 */
  40% {
    opacity: 1;
  }
}

/* 窄容器下等比缩小，保持书页比例与层次可辨 */
@container iiif-viewer (max-width: 480px) {
  .iiif-page-loader {
    width: 56px;
    height: 36px;
  }
}

/* 减弱动效：停用全部翻页动画，保留一本摊开的静态古籍 */
@media (prefers-reduced-motion: reduce) {
  .iiif-page-loader span,
  .iiif-page-loader span::after,
  .iiif-page-loader::after {
    animation: none;
  }

  .iiif-page-loader span::after {
    opacity: 0;
  }

  .iiif-page-loader::after {
    opacity: 0.3;
  }
}
</style>
