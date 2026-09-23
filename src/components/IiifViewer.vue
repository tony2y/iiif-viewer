<script setup lang="ts">
/**
 * IIIF 阅读器主组件。
 *
 * 职责：
 * 1. 解析 Props 与插件级默认配置，推导主题 / 语言 / 工具栏 / OSD 配置；
 * 2. 通过 `useIiifSource` 加载并归一化 IIIF 资源，通过 `useOpenSeadragon` 渲染与交互；
 * 3. 对外派发事件、暴露命令式方法，并组合各子组件与插槽。
 *
 * 组件本身不重新实现渲染逻辑，所有能力都收敛在 `core/` 与 `composables/` 中，便于单测。
 */
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'

import { useIiifSource } from '@/composables/useIiifSource'
import { useOpenSeadragon } from '@/composables/useOpenSeadragon'
import { provideViewerI18n, useViewerI18n } from '@/composables/useViewerI18n'
import { useViewerConfig } from '@/composables/useViewerConfig'
import {
  DEFAULT_COLOR_ADJUSTMENTS,
  buildImageFilter,
  normalizeColorAdjustments,
} from '@/core/color'
import { createOsdOptions, prefersReducedMotion } from '@/core/iiif'
import { resolvePageTransitionOptions, resolveToolbarOptions } from '@/types/viewer'
import type {
  IiifColorAdjustments,
  IiifViewerEmits,
  IiifViewerProps,
  IiifViewerSource,
  IiifViewerState,
  IiifViewerToolbarAction,
} from '@/types/viewer'
import ViewerColorPanel from './ViewerColorPanel.vue'
import ViewerError from './ViewerError.vue'
import ViewerInfoPanel from './ViewerInfoPanel.vue'
import ViewerLoading from './ViewerLoading.vue'
import ViewerStatusBar from './ViewerStatusBar.vue'
import ViewerThumbnails from './ViewerThumbnails.vue'
import ViewerToolbar from './ViewerToolbar.vue'

defineOptions({ name: 'IiifViewer' })

const props = withDefaults(defineProps<IiifViewerProps>(), {
  sourceType: 'auto',
  locale: undefined,
  messages: undefined,
  theme: undefined,
  toolbar: undefined,
  showNavigator: true,
  showStatusBar: true,
  showThumbnails: false,
  showInfoPanel: false,
  keyboardShortcuts: true,
  fitMode: 'contain',
  minZoom: 0.5,
  maxZoom: 20,
  rotateStep: 90,
  timeout: 15000,
  aspectRatio: '4 / 3',
  osdOptions: undefined,
  initialDoublePage: false,
  colorAdjust: true,
  pageTransition: undefined,
  openseadragon: undefined,
})

const emit = defineEmits<IiifViewerEmits>()

const slots = defineSlots<{
  /** 自定义加载态 */
  loading?: () => unknown
  /** 自定义错误态 */
  error?: (props: { error: unknown; retry: () => void }) => unknown
  /** 工具栏右侧追加自定义动作 */
  'toolbar-extra'?: (props: { state: IiifViewerState }) => unknown
}>()

/* -------------------------------------------------------------------------- */
/* 配置与 i18n                                                                 */
/* -------------------------------------------------------------------------- */

const config = useViewerConfig()

const i18n = useViewerI18n({
  locale: toRef(props, 'locale'),
  fallbackLocale: computed(() => config.locale),
  messages: computed(() => props.messages ?? config.messages),
})
provideViewerI18n(i18n)
const { t } = i18n

/* -------------------------------------------------------------------------- */
/* 主题                                                                        */
/* -------------------------------------------------------------------------- */

/** 组件内处理的窄容器阈值（px），与 CSS 容器查询断点保持一致 */
const COMPACT_WIDTH = 480

const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const compact = ref(false)

const systemTheme = ref<'dark' | 'light'>('dark')
let colorSchemeQuery: MediaQueryList | null = null
let resizeObserver: ResizeObserver | null = null

function syncSystemTheme(): void {
  systemTheme.value = colorSchemeQuery?.matches ? 'light' : 'dark'
}

const resolvedTheme = computed<'dark' | 'light'>(() => {
  const theme = props.theme ?? config.theme ?? 'dark'
  return theme === 'auto' ? systemTheme.value : theme
})

/* -------------------------------------------------------------------------- */
/* 工具栏 / 面板状态                                                            */
/* -------------------------------------------------------------------------- */

const toolbarOptions = computed(() => resolveToolbarOptions(props.toolbar ?? config.toolbar))
const thumbnailsOpen = ref(props.showThumbnails)
const infoOpen = ref(props.showInfoPanel)
const colorPanelOpen = ref(false)

/** 色彩调节模块是否启用（Props 优先于插件配置） */
const colorAdjustEnabled = computed(() => props.colorAdjust ?? config.colorAdjust ?? true)

watch(
  () => props.showInfoPanel,
  (value) => {
    infoOpen.value = value
  },
)

// 与 showInfoPanel 对称：运行期修改 showThumbnails 也要同步到缩略图条的展开状态
watch(
  () => props.showThumbnails,
  (value) => {
    thumbnailsOpen.value = value
  },
)

/* -------------------------------------------------------------------------- */
/* 资源加载                                                                    */
/* -------------------------------------------------------------------------- */

/** `open()` 方法设置的覆盖源，优先级高于 Props；Props 变化时清除 */
const sourceOverride = ref<IiifViewerSource | null>(null)
const effectiveSource = computed<IiifViewerSource>(() => sourceOverride.value ?? props.source)

const source = useIiifSource({
  source: () => effectiveSource.value,
  sourceType: () => props.sourceType,
  locale: () => i18n.resolvedLocale.value,
  timeout: () => props.timeout,
  initialDoublePage: () => props.initialDoublePage ?? config.initialDoublePage ?? false,
  onLoaded: (payload) => emit('load-success', payload),
  onError: (error) => emit('load-error', error),
})

// 运行期修改 initialDoublePage 也会同步切换模式
watch(
  () => props.initialDoublePage,
  (value) => {
    if (value !== undefined) source.setDoublePage(value)
  },
)

/* -------------------------------------------------------------------------- */
/* OpenSeadragon                                                               */
/* -------------------------------------------------------------------------- */

function buildOsdOptions() {
  return createOsdOptions({
    showNavigator: props.showNavigator,
    minZoom: props.minZoom,
    maxZoom: props.maxZoom,
    reducedMotion: prefersReducedMotion(),
    // 组件 Props 优先于插件级默认配置
    osdOptions: { ...(config.osdOptions ?? {}), ...(props.osdOptions ?? {}) },
  })
}

const osd = useOpenSeadragon({
  containerRef: stageRef,
  // 全屏目标用组件根节点：工具栏 / 状态栏与画布同屏，全屏时不被藏掉
  fullscreenRef: rootRef,
  options: buildOsdOptions,
  fitMode: () => props.fitMode,
  openseadragon: () => props.openseadragon ?? config.openseadragon,
})

/* -------------------------------------------------------------------------- */
/* 翻页过渡                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 当前生效的过渡配置；`null` 表示本次不做过渡。
 *
 * 「减弱动效」由 `useOpenSeadragon` 统一订阅，这里直接复用它的状态，
 * 既避免重复监听 `matchMedia`，也保证过渡与 OSD 动效参数的判断完全一致。
 */
const resolvedTransition = computed(() =>
  resolvePageTransitionOptions(
    props.pageTransition ?? config.pageTransition,
    osd.reducedMotion.value,
  ),
)

/* -------------------------------------------------------------------------- */
/* 色彩调节                                                                    */
/* -------------------------------------------------------------------------- */

const colors = ref<IiifColorAdjustments>({ ...DEFAULT_COLOR_ADJUSTMENTS })
/** 当前图像滤镜；中性时为空串 */
const imageFilter = computed(() => (colorAdjustEnabled.value ? buildImageFilter(colors.value) : ''))

function setColors(adjustments: Partial<IiifColorAdjustments>): void {
  colors.value = normalizeColorAdjustments({ ...colors.value, ...adjustments })
}

function resetColors(): void {
  colors.value = { ...DEFAULT_COLOR_ADJUSTMENTS }
}

// 滤镜直接作用在 OSD 画布容器上；关闭模块时清除
watch(imageFilter, (filter) => osd.applyImageFilter(filter), { immediate: true })
// OSD 实例创建后才能拿到画布元素，因此实例就绪时补一次
watch(
  () => osd.isReady.value,
  (ready) => {
    if (ready) osd.applyImageFilter(imageFilter.value)
  },
)
watch(colors, (value) => emit('colors-change', value), { deep: true })

const displayError = computed(() => source.error.value ?? osd.error.value)
const isMultiCanvas = computed(() => source.total.value > 1)
const showThumbnailStrip = computed(() => thumbnailsOpen.value && isMultiCanvas.value)

const viewerState = computed<IiifViewerState>(() => ({
  zoomPercent: osd.zoomPercent.value,
  rotation: osd.rotation.value,
  flipped: osd.flipped.value,
  page: source.currentIndex.value,
  total: source.total.value,
  fullscreen: osd.isFullscreen.value,
  canGoPrev: source.canGoPrev.value,
  canGoNext: source.canGoNext.value,
  progress: osd.progress.value,
  doublePage: source.doublePage.value,
  colors: colors.value,
  ...(source.imageInfo.value ? { imageInfo: source.imageInfo.value } : {}),
  ...(source.manifest.value ? { manifest: source.manifest.value } : {}),
  ...(source.currentCanvas.value ? { canvas: source.currentCanvas.value } : {}),
}))

const bodyStyle = computed(() => {
  if (props.aspectRatio === 'auto') return { flex: '1 1 auto' }
  const ratio =
    typeof props.aspectRatio === 'number' ? String(props.aspectRatio) : props.aspectRatio
  return { aspectRatio: ratio, flex: 'none' }
})

const canvasTitle = computed(
  () => source.manifest.value?.label ?? source.currentCanvas.value?.label,
)

/* -------------------------------------------------------------------------- */
/* 交互                                                                        */
/* -------------------------------------------------------------------------- */

function handleToolbarAction(action: IiifViewerToolbarAction): void {
  switch (action) {
    case 'zoom-in':
      osd.zoomIn()
      break
    case 'zoom-out':
      osd.zoomOut()
      break
    case 'reset':
      osd.resetHome()
      break
    case 'rotate-left':
      osd.rotateBy(-props.rotateStep)
      break
    case 'rotate-right':
      osd.rotateBy(props.rotateStep)
      break
    case 'flip-horizontal':
      osd.flipHorizontal()
      break
    case 'fullscreen':
      osd.toggleFullscreen()
      break
    case 'prev':
      source.prev()
      break
    case 'next':
      source.next()
      break
    case 'thumbnails':
      thumbnailsOpen.value = !thumbnailsOpen.value
      break
    case 'info':
      toggleInfo()
      break
    case 'double-page':
      source.toggleDoublePage()
      break
    case 'color-adjust':
      toggleColorPanel()
      break
  }
}

function toggleInfo(): void {
  const next = !infoOpen.value
  infoOpen.value = next
  if (next) colorPanelOpen.value = false
  emit('info-toggle', next)
}

function closeInfo(): void {
  if (!infoOpen.value) return
  infoOpen.value = false
  emit('info-toggle', false)
}

/** 打开色彩面板时关闭信息面板，反之亦然：两者都是右侧抽屉，同时展开会互相遮挡 */
function toggleColorPanel(): void {
  const next = !colorPanelOpen.value
  colorPanelOpen.value = next
  if (next && infoOpen.value) {
    infoOpen.value = false
    emit('info-toggle', false)
  }
  emit('color-toggle', next)
}

function closeColorPanel(): void {
  if (!colorPanelOpen.value) return
  colorPanelOpen.value = false
  emit('color-toggle', false)
}

/** 键盘快捷键：仅在舞台（或其内部控件）获得焦点时生效，避免抢占宿主页面按键 */
function onStageKeydown(event: KeyboardEvent): void {
  if (!props.keyboardShortcuts) return
  if (event.ctrlKey || event.metaKey || event.altKey) return

  const target = event.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) {
    return
  }

  let handled = true
  switch (event.key) {
    case '+':
    case '=':
    case 'ArrowUp':
      osd.zoomIn()
      break
    case '-':
    case '_':
    case 'ArrowDown':
      osd.zoomOut()
      break
    case '0':
      osd.resetHome()
      break
    case 'r':
      osd.rotateBy(props.rotateStep)
      break
    case 'R':
      osd.rotateBy(-props.rotateStep)
      break
    case 'f':
      osd.toggleFullscreen()
      break
    case 'i':
    case 'I':
      toggleInfo()
      break
    case 'ArrowLeft':
      if (isMultiCanvas.value) source.prev()
      else handled = false
      break
    case 'ArrowRight':
      if (isMultiCanvas.value) source.next()
      else handled = false
      break
    default:
      handled = false
  }

  if (handled) event.preventDefault()
}

/** 打开新的资源地址（供 `defineExpose` 使用） */
function handleOpen(next: IiifViewerSource): void {
  sourceOverride.value = next
}

/* -------------------------------------------------------------------------- */
/* 响应式同步                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 最近一次交给 OSD 打开的画布信息。
 *
 * - `index`：用于过渡事件的 from / to；
 * - `count`：图像数量变化（如单页 ↔ 双页）意味着版面几何整体改变，应当重新适配；
 * - `epoch`：加载轮次变化意味着换了资源（或重新加载），同样应当重新适配。
 */
let lastOpenedIndex = 0
let lastOpenedCount = 0
let lastOpenedEpoch: number | null = null
/** 是否已经渲染过画面：第一个画面没有可过渡的旧内容 */
let hasRendered = false

// tileSources 就绪且 OSD 实例创建完成后渲染。
//
// 依赖「资源签名 + 加载轮次」而非数组本身：两种因素会让 `tileSources` 产生新引用，
// 但资源其实没变，重新 open 只会白白清空瓦片缓存并复位视口——
// 1. 语言切换：重新解析 manifest 标签，只换文案不换图像；
// 2. 双页排布等上层状态变化引发的重算。
// 反之，加载轮次变化意味着「同一份资源被重新加载」（例如 retry），必须重新 open。
watch(
  [source.tileSourcesKey, source.loadEpoch, osd.isReady],
  ([, epoch, ready]) => {
    if (!ready) return
    const tileSources = source.tileSources.value
    // 新一轮加载开始时清空上一轮的 OSD 错误，避免错误卡片残留
    osd.clearError()
    if (tileSources.length === 0) return

    const to = source.currentIndex.value
    const from = lastOpenedIndex
    /**
     * 只有「同一份资源、图像数量不变」的换页才保留视口——
     * 此时页面几何一致，用户当前的缩放与平移仍然有意义；
     * 换资源或切换单页 / 双页时版面整体改变，保留旧视口只会看到错位的内容。
     */
    const preserveViewport =
      epoch === lastOpenedEpoch && tileSources.length === lastOpenedCount && hasRendered

    lastOpenedIndex = to
    lastOpenedCount = tileSources.length
    lastOpenedEpoch = epoch

    // 首个画面无需过渡（没有可淡出的旧内容）
    const transition = hasRendered ? resolvedTransition.value : null
    hasRendered = true

    osd.open(tileSources, {
      // 双页展开：两页紧贴排布，形成跨页效果
      spread: source.doublePage.value && tileSources.length > 1,
      preserveViewport,
      ...(transition
        ? {
            transition: {
              ...transition,
              onStart: () => emit('page-transition-start', { from, to, preset: transition.preset }),
              onEnd: () => emit('page-transition-end', { from, to, preset: transition.preset }),
            },
          }
        : {}),
    })
  },
  { immediate: true },
)

watch(
  () => source.doublePage.value,
  (value) => emit('double-page-change', value),
)

// 资源切换时通知外部开始加载
watch(effectiveSource, (value) => emit('load-start', value), { immediate: true })

watch(
  () => props.source,
  () => {
    sourceOverride.value = null
  },
)

/**
 * 运行期开关右上角的导航图（小地图）。
 *
 * 创建实例时已按 `showNavigator` / `osdOptions.showNavigator` 决定过一次，
 * 这里只负责之后的切换：直接显隐导航图容器；若创建时就没生成，则重建实例再恢复画面。
 */
watch(
  () => props.showNavigator,
  (value) => osd.setNavigatorVisible(value ?? true),
)

watch(
  () => osd.viewer.value,
  (viewer) => {
    if (viewer) emit('ready', viewer)
  },
  { immediate: true },
)

watch(
  () => osd.zoomPercent.value,
  (value) => emit('zoom-change', value),
)
watch(
  () => osd.rotation.value,
  (value) => emit('rotation-change', value),
)
watch(
  () => osd.flipped.value,
  (value) => emit('flip-change', value),
)
watch(
  () => osd.isFullscreen.value,
  (value) => emit('fullscreen-change', value),
)
watch(
  () => osd.progress.value,
  (value) => emit('progress-change', value),
)
watch(
  () => source.currentIndex.value,
  (index) => emit('page-change', { index, total: source.total.value }),
)

/* -------------------------------------------------------------------------- */
/* 生命周期                                                                    */
/* -------------------------------------------------------------------------- */

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    colorSchemeQuery = window.matchMedia('(prefers-color-scheme: light)')
    syncSystemTheme()
    colorSchemeQuery.addEventListener('change', syncSystemTheme)
  }

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      compact.value = width > 0 && width < COMPACT_WIDTH
    })
    resizeObserver.observe(rootRef.value)
  }
})

onBeforeUnmount(() => {
  colorSchemeQuery?.removeEventListener('change', syncSystemTheme)
  colorSchemeQuery = null
  resizeObserver?.disconnect()
  resizeObserver = null
  emit('destroy')
})

/* -------------------------------------------------------------------------- */
/* 对外暴露                                                                    */
/* -------------------------------------------------------------------------- */

defineExpose({
  viewer: osd.viewer,
  open: handleOpen,
  zoomIn: osd.zoomIn,
  zoomOut: osd.zoomOut,
  zoomTo: osd.zoomTo,
  resetHome: osd.resetHome,
  rotateBy: osd.rotateBy,
  rotateTo: osd.rotateTo,
  flipHorizontal: osd.flipHorizontal,
  goToPage: source.goTo,
  prevPage: source.prev,
  nextPage: source.next,
  toggleFullscreen: osd.toggleFullscreen,
  retry: source.retry,
  setDoublePage: source.setDoublePage,
  toggleDoublePage: source.toggleDoublePage,
  setNavigatorVisible: osd.setNavigatorVisible,
  setColors,
  resetColors,
  getState: () => viewerState.value,
})
</script>

<template>
  <div
    ref="rootRef"
    class="iiif-viewer"
    :data-theme="resolvedTheme"
    :data-locale="i18n.resolvedLocale.value"
    :data-page-transition="resolvedTransition?.preset ?? 'none'"
  >
    <div class="iiif-viewer__body" :style="bodyStyle">
      <!-- OpenSeadragon 挂载点；聚焦后才响应快捷键 -->
      <div
        ref="stageRef"
        class="iiif-viewer__stage"
        role="region"
        tabindex="0"
        :aria-label="t('viewer.label')"
        :aria-describedby="'iiif-viewer-hint'"
        @keydown="onStageKeydown"
      />

      <!-- 加载态 -->
      <slot v-if="source.status.value === 'loading'" name="loading">
        <ViewerLoading :progress="osd.progress.value" />
      </slot>

      <!-- 错误态：资源加载失败优先于 OSD 初始化失败 -->
      <slot v-else-if="displayError" name="error" :error="displayError" :retry="source.retry">
        <ViewerError :error="displayError" @retry="source.retry" />
      </slot>

      <ViewerToolbar
        v-if="toolbarOptions"
        :options="toolbarOptions"
        :state="viewerState"
        :compact="compact"
        :thumbnails-open="thumbnailsOpen"
        :info-open="infoOpen"
        :color-open="colorPanelOpen"
        :color-adjust="colorAdjustEnabled"
        @action="handleToolbarAction"
      >
        <template v-if="slots['toolbar-extra']" #extra>
          <slot name="toolbar-extra" :state="viewerState" />
        </template>
      </ViewerToolbar>

      <ViewerInfoPanel
        :manifest="source.manifest.value"
        :open="infoOpen"
        :current-index="source.spreadStart.value"
        @close="closeInfo"
        @select-canvas="source.goTo"
      />

      <ViewerColorPanel
        v-if="colorAdjustEnabled"
        :open="colorPanelOpen"
        :colors="colors"
        @change="setColors"
        @reset="resetColors"
        @close="closeColorPanel"
      />
    </div>

    <ViewerThumbnails
      v-if="showThumbnailStrip"
      :canvases="source.canvases.value"
      :current="source.currentIndex.value"
      :secondary="source.secondaryIndex.value"
      :compact="compact"
      @select="source.goTo"
    />

    <ViewerStatusBar
      v-if="props.showStatusBar"
      :zoom-percent="viewerState.zoomPercent"
      :rotation="viewerState.rotation"
      :flipped="viewerState.flipped"
      :page="viewerState.page"
      :total="viewerState.total"
      :secondary-index="source.secondaryIndex.value"
      :double-page="viewerState.doublePage"
      :title="canvasTitle"
      :compact="compact"
    />

    <!-- 快捷键提示：仅在屏幕阅读器聚焦时朗读 -->
    <p id="iiif-viewer-hint" class="iiif-viewer__sr-only">{{ t('a11y.shortcutsHint') }}</p>
  </div>
</template>
