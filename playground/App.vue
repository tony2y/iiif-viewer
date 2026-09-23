<template>
  <div class="demo" :data-theme="theme === 'auto' ? undefined : theme">
    <!-- 图标路径来自模块级静态常量，不接受外部输入 -->
    <!-- eslint-disable vue/no-v-html -->
    <header class="demo__bar">
      <span class="demo__brand" :title="BRAND_TITLE">
        <svg class="demo__brand-mark" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS.mark" />
        <span class="demo__brand-text">iiif-viewer</span>
      </span>

      <div class="demo__bar-controls">
        <select
          class="demo__select demo__select--compact"
          aria-label="IIIF 资源"
          :title="activePreset.note"
          :value="presetIndex"
          @change="selectPreset(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="(preset, index) in PRESETS" :key="preset.label" :value="index">
            {{ preset.label }}
          </option>
        </select>

        <div class="demo__segmented" role="group" aria-label="主题">
          <button
            v-for="item in THEMES"
            :key="item.value"
            type="button"
            class="demo__icon-button"
            :class="{ 'demo__icon-button--active': theme === item.value }"
            :aria-pressed="theme === item.value"
            :title="`主题：${item.label}`"
            @click="theme = item.value"
          >
            <svg
              class="demo__icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              v-html="ICONS[item.icon]"
            />
          </button>
        </div>

        <button
          type="button"
          class="demo__icon-button demo__icon-button--label"
          :title="`界面语言：${currentLocale.label}（点击切换）`"
          @click="toggleLocale"
        >
          <svg class="demo__icon" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS.languages" />
          <span class="demo__icon-label">{{ currentLocale.short }}</span>
        </button>

        <button
          ref="moreButtonRef"
          type="button"
          class="demo__icon-button"
          :class="{ 'demo__icon-button--active': moreOpen }"
          aria-controls="demo-more"
          :aria-expanded="moreOpen"
          title="更多设置"
          @click="toggleMore"
        >
          <svg class="demo__icon" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS.sliders" />
        </button>
      </div>

      <div
        v-if="moreOpen"
        id="demo-more"
        ref="moreRef"
        class="demo__popover"
        role="group"
        aria-label="更多设置"
      >
        <div class="demo__popover-head">
          <span class="demo__popover-title">更多设置</span>
          <button
            type="button"
            class="demo__icon-button demo__icon-button--small"
            title="关闭"
            aria-label="关闭更多设置"
            @click="closeMore(true)"
          >
            <svg class="demo__icon" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS.close" />
          </button>
        </div>

        <div class="demo__field">
          <span class="demo__label">自定义地址（命令式 open）</span>
          <input
            v-model="customUrl"
            class="demo__input"
            type="url"
            placeholder="https://…/manifest.json"
            @keydown.enter="openCustomUrl"
          />
          <div class="demo__row">
            <button class="demo__button" type="button" @click="openCustomUrl">打开</button>
            <button class="demo__button" type="button" @click="resetView">复位</button>
          </div>
        </div>

        <div class="demo__field">
          <span class="demo__label">工具栏位置</span>
          <select v-model="position" class="demo__select">
            <option v-for="item in POSITIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </div>

        <div class="demo__field">
          <span class="demo__label">舞台宽高比</span>
          <select v-model="aspectRatio" class="demo__select">
            <option v-for="ratio in RATIOS" :key="ratio" :value="ratio">
              {{ ratio === 'auto' ? 'auto（撑满父容器高度）' : ratio }}
            </option>
          </select>
        </div>

        <div class="demo__field">
          <span class="demo__label">翻页动画</span>
          <select v-model="pageTransition" class="demo__select">
            <option v-for="item in TRANSITIONS" :key="item.label" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </div>

        <div class="demo__field">
          <span class="demo__label">显示</span>
          <div class="demo__row">
            <button
              type="button"
              class="demo__button"
              :class="{ 'demo__button--active': showNavigator }"
              :aria-pressed="showNavigator"
              title="右上角的小地图"
              @click="showNavigator = !showNavigator"
            >
              导航图（小地图）
            </button>
          </div>
        </div>

        <div class="demo__field">
          <span class="demo__label">面板</span>
          <div class="demo__row">
            <button
              type="button"
              class="demo__button"
              :class="{ 'demo__button--active': showThumbnails }"
              @click="showThumbnails = !showThumbnails"
            >
              缩略图条
            </button>
            <button
              type="button"
              class="demo__button"
              :class="{ 'demo__button--active': showInfoPanel }"
              @click="showInfoPanel = !showInfoPanel"
            >
              信息面板
            </button>
          </div>
        </div>

        <div class="demo__note">
          <p class="demo__hint">{{ activePreset.note }}</p>
          <p class="demo__hint">
            聚焦查看器后可用键盘：+/- 缩放 · 0 复位 · R 旋转 · F 全屏 · ←/→ 翻页 · I 信息
          </p>
        </div>
      </div>
    </header>
    <!-- eslint-enable vue/no-v-html -->

    <section class="demo__stage">
      <!-- 可横向拖拽右下角改变宽度，用于验证窄容器下的紧凑工具栏 -->
      <div class="demo__resize">
        <IiifViewer
          ref="viewerRef"
          :source="activeSource"
          :source-type="activeSourceType"
          :locale="locale"
          :theme="theme"
          :aspect-ratio="aspectRatio"
          :show-thumbnails="showThumbnails"
          :show-info-panel="showInfoPanel"
          :show-navigator="showNavigator"
          :initial-double-page="initialDoublePage"
          :color-adjust="colorAdjustEnabled"
          :page-transition="pageTransition"
          :toolbar="{ position }"
          :osd-options="{ crossOriginPolicy: 'Anonymous' }"
          @load-success="onLoadSuccess"
          @load-error="onLoadError"
          @page-change="onPageChange"
        />
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
/**
 * 演示页：覆盖 Image API 2/3、Presentation API 2/3、多画布翻阅、
 * 语言切换、主题切换、工具栏位置、响应式（可拖拽改变容器宽度）以及命令式 API 调用。
 *
 * 顶部为单行紧凑控制条：资源下拉与主题 / 语言图标常驻，其余设置收进「更多」弹层，
 * 把纵向空间让给查看器；查看器按可视高度做整页适配，打开即完整可见、无需手动缩放。
 *
 * @author Zhu Yong
 * @date 2026-09-22
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { IiifViewer, VIEWER_ICONS } from '@/index'
import type {
  IiifViewerExposed,
  IiifViewerLoadSuccessPayload,
  IiifViewerPageTransition,
  IiifViewerSource,
  IiifViewerSourceType,
  IiifViewerTheme,
  IiifViewerToolbarPosition,
} from '@/types'

interface Preset {
  label: string
  value: IiifViewerSource
  sourceType: IiifViewerSourceType
  note: string
}

const PRESETS: Preset[] = [
  {
    label: 'Presentation 3 · 多画布（36 页）',
    value: 'https://iiif.wellcomecollection.org/presentation/b18035723',
    sourceType: 'manifest',
    note: 'Wellcome Collection，含多语言标签、元数据、权利声明与缩略图',
  },
  {
    label: 'Presentation 2 · 单画布 + 元数据',
    value: 'https://iiif.harvardartmuseums.org/manifests/object/299843',
    sourceType: 'manifest',
    note: 'Harvard Art Museums，v2 manifest 与 8 项元数据',
  },
  {
    label: 'Presentation 3 · 5 页图册',
    value: 'https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json',
    sourceType: 'manifest',
    note: 'IIIF Cookbook 官方示例，画布无标签（回退为 Canvas N）',
  },
  {
    label: 'Image API 3.0 · info.json',
    value:
      'https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json',
    sourceType: 'info',
    note: 'IIIF 官方示例图，自动识别为 Image API 3',
  },
  {
    label: 'Image API 2.1 · info.json',
    value:
      'https://iiif.io/api/image/2.1/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json',
    sourceType: 'info',
    note: 'IIIF 官方示例图，自动识别为 Image API 2',
  },
]

const LOCALES = [
  { label: '中文', short: '中', value: 'zh-CN' },
  { label: 'English', short: 'EN', value: 'en-US' },
] as const

/** 主题三态：图标按钮直接展示当前状态，避免循环切换的不可预期 */
const THEMES: { label: string; value: IiifViewerTheme; icon: 'moon' | 'sun' | 'monitor' }[] = [
  { label: '暗色', value: 'dark', icon: 'moon' },
  { label: '亮色', value: 'light', icon: 'sun' },
  // { label: '跟随系统', value: 'auto', icon: 'monitor' },
]

const POSITIONS: { label: string; value: IiifViewerToolbarPosition }[] = [
  { label: '底部', value: 'bottom' },
  { label: '顶部', value: 'top' },
  { label: '左侧', value: 'left' },
  { label: '右侧', value: 'right' },
]

const RATIOS = ['4 / 3', '16 / 9', '1', 'auto'] as const

/** 翻页动画预设：`false` 即关闭，便于对比有无过渡的观感差异 */
const TRANSITIONS: { label: string; value: IiifViewerPageTransition }[] = [
  { label: '关闭', value: false },
  { label: '淡出快照（fade）', value: 'fade' },
  { label: '缩放交换（zoom-swap）', value: 'zoom-swap' },
]

/**
 * 顶部控制条用到的图标路径。
 *
 * 能复用的直接取自库内置图标表（`VIEWER_ICONS`），缺失的主题 / 语言图标在本页按同样风格补齐：
 * 24×24 viewBox、`stroke-width: 1.75`，描边与颜色由 `.demo__icon` 统一设置。
 */
const ICONS = {
  mark: VIEWER_ICONS['book-open'],
  sliders: VIEWER_ICONS.sliders,
  close: VIEWER_ICONS.close,
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  languages:
    '<path d="M2 5h12"/><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
} as const

/** 品牌标识的悬停提示：原副标题文案降级为 title，不再占用版面 */
const BRAND_TITLE =
  'Vue 3 + Vite + TypeScript + OpenSeadragon · IIIF Image API 2/3 · Presentation API 2/3'

const presetIndex = ref(0)
const customUrl = ref('')
const locale = ref<string>('zh-CN')
const theme = ref<IiifViewerTheme>('light')
const position = ref<IiifViewerToolbarPosition>('top')
/** 默认撑满父容器高度：查看器按可视高度适配，整页才能一次性完整展示 */
const aspectRatio = ref<(typeof RATIOS)[number]>('auto')
const showThumbnails = ref(true)
// 默认收起：信息面板是覆盖在舞台上的抽屉，展开会遮住右侧页面，打开页面时先给完整内容让位
const showInfoPanel = ref(false)
const initialDoublePage = ref(true)
const colorAdjustEnabled = ref(true)
/** 右上角小地图；关闭后仍可在运行期重新开启 */
const showNavigator = ref(true)
/** 翻页动画：默认开启淡出快照，便于直观比较「整幅复位」与「保留视口」的差异 */
const pageTransition = ref<IiifViewerPageTransition>('fade')

/** 当前生效的资源与类型：选择预设时用预设声明，手动打开地址时交回自动识别 */
const activeSource = ref<IiifViewerSource>(PRESETS[0]!.value)
const activeSourceType = ref<IiifViewerSourceType>(PRESETS[0]!.sourceType)

const viewerRef = ref<IiifViewerExposed | null>(null)
const lastEvent = ref('等待加载…')

const activePreset = computed(() => PRESETS[presetIndex.value]!)

function selectPreset(index: number): void {
  const preset = PRESETS[index]!
  presetIndex.value = index
  activeSource.value = preset.value
  activeSourceType.value = preset.sourceType
  lastEvent.value = '等待加载…'
}

function openCustomUrl(): void {
  const url = customUrl.value.trim()
  if (!url) return
  lastEvent.value = '等待加载…'
  // 交回自动识别（含按响应内容二次判定）
  activeSourceType.value = 'auto'
  activeSource.value = url
}

function onLoadSuccess(payload: IiifViewerLoadSuccessPayload): void {
  const canvasCount = payload.canvases.length
  const dims = payload.imageInfo ? `${payload.imageInfo.width}×${payload.imageInfo.height}` : '—'
  lastEvent.value = `load-success · kind=${payload.kind} · canvases=${canvasCount} · size=${dims}`
}

function onLoadError(error: { code: string }): void {
  lastEvent.value = `load-error · ${error.code}`
}

function onPageChange(payload: { index: number; total: number }): void {
  lastEvent.value = `page-change · ${payload.index + 1} / ${payload.total}`
}

function resetView(): void {
  viewerRef.value?.resetHome()
  viewerRef.value?.goToPage(0)
}

/** 当前语言：顶栏只放一个图标按钮，用它展示当前值 */
const currentLocale = computed(
  () => LOCALES.find((item) => item.value === locale.value) ?? LOCALES[0],
)

/** 「更多」弹层：开关状态、面板元素与触发按钮（用于点击外部关闭与焦点归还） */
const moreOpen = ref(false)
const moreRef = ref<HTMLElement | null>(null)
const moreButtonRef = ref<HTMLElement | null>(null)

/** 关闭弹层；由 Esc 或关闭按钮触发时把焦点交回触发按钮 */
function closeMore(restoreFocus = false): void {
  if (!moreOpen.value) return
  moreOpen.value = false
  if (restoreFocus) moreButtonRef.value?.focus()
}

function toggleMore(): void {
  moreOpen.value = !moreOpen.value
}

/** 在两种内置语言间切换 */
function toggleLocale(): void {
  const index = LOCALES.findIndex((item) => item.value === locale.value)
  locale.value = LOCALES[(index + 1) % LOCALES.length]!.value
}

/** 点击弹层与触发按钮之外的区域即收起弹层 */
function onDocumentPointerDown(event: PointerEvent): void {
  if (!moreOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (moreRef.value?.contains(target) || moreButtonRef.value?.contains(target)) return
  closeMore()
}

/** Esc 收起弹层 */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMore(true)
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>
