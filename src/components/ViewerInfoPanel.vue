<script setup lang="ts">
/**
 * 侧边信息面板。
 *
 * - 当 manifest 提供目录（`structures`）时，展示「目录 / 作品信息」两个 Tab；
 *   未提供时退化为单视图，直接显示作品信息，不渲染 Tab 栏。
 * - 无障碍：`role="dialog"` + `aria-labelledby`（标题即 manifest 名称）；
 *   Tab 采用 `tablist` / `tab` / `tabpanel` 三件套 + roving tabindex，
 *   支持左右方向键与 Home / End 切换；
 * - 打开时把焦点移到关闭按钮，关闭时归还给打开前的元素，支持 Esc 关闭。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'
import type { IiifManifest } from '@/types/iiif'
import ViewerButton from './base/ViewerButton.vue'
import ViewerIcon from './base/ViewerIcon.vue'
import ViewerToc from './ViewerToc.vue'

type InfoTab = 'toc' | 'info'

const props = withDefaults(
  defineProps<{
    /** 归一化后的 manifest；为空时不渲染内容 */
    manifest?: IiifManifest | null
    /** 是否展开 */
    open: boolean
    /** 当前画布下标，用于目录高亮 */
    currentIndex?: number
  }>(),
  { manifest: null, currentIndex: 0 },
)

const emit = defineEmits<{
  /** 请求关闭面板 */
  close: []
  /** 目录跳转：请求切换到指定画布 */
  'select-canvas': [index: number]
}>()

const { t } = useViewerI18nContext()

const TITLE_ID = 'iiif-viewer-info-title'
const TAB_ID_PREFIX = 'iiif-viewer-info-tab'
const PANEL_ID_PREFIX = 'iiif-viewer-info-panel'

const closeButtonRef = ref<InstanceType<typeof ViewerButton> | null>(null)
const tabListRef = ref<HTMLElement | null>(null)

/** 打开前的焦点元素，关闭时归还 */
let previousActive: HTMLElement | null = null

const structures = computed(() => props.manifest?.structures ?? [])
/** 有目录才显示 Tab 栏 */
const hasToc = computed(() => structures.value.length > 0)

const activeTab = ref<InfoTab>('info')

const tabs = computed<{ key: InfoTab; labelKey: string }[]>(() => [
  { key: 'toc', labelKey: 'info.tabs.toc' },
  { key: 'info', labelKey: 'info.tabs.info' },
])

const heading = computed(() => props.manifest?.label || t('info.title'))
const metadata = computed(() => props.manifest?.metadata ?? [])

/** 目录变化时回到默认 Tab：有目录优先展示目录 */
watch(
  () => props.manifest,
  () => {
    activeTab.value = hasToc.value ? 'toc' : 'info'
  },
  { immediate: true },
)

function tabId(tab: InfoTab): string {
  return `${TAB_ID_PREFIX}-${tab}`
}

function panelId(tab: InfoTab): string {
  return `${PANEL_ID_PREFIX}-${tab}`
}

function activateTab(tab: InfoTab): void {
  activeTab.value = tab
}

function focusTab(tab: InfoTab): void {
  tabListRef.value?.querySelector<HTMLButtonElement>(`#${tabId(tab)}`)?.focus()
}

/** 自动激活模式：焦点移动即切换 */
function onTabKeydown(event: KeyboardEvent, index: number): void {
  const last = tabs.value.length - 1
  let next: number | undefined
  if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
  else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = last
  if (next === undefined) return

  event.preventDefault()
  const tab = tabs.value[next]!
  activateTab(tab.key)
  focusTab(tab.key)
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
      class="iiif-info"
      role="dialog"
      aria-modal="false"
      :aria-labelledby="TITLE_ID"
    >
      <header class="iiif-info__header">
        <h3 :id="TITLE_ID" class="iiif-info__heading" :title="heading">{{ heading }}</h3>
        <ViewerButton
          ref="closeButtonRef"
          size="sm"
          icon="close"
          :label="t('info.close')"
          @click="emit('close')"
        />
      </header>

      <div
        v-if="hasToc"
        ref="tabListRef"
        class="iiif-info__tabs"
        role="tablist"
        :aria-labelledby="TITLE_ID"
      >
        <button
          v-for="(tab, index) in tabs"
          :id="tabId(tab.key)"
          :key="tab.key"
          type="button"
          role="tab"
          class="iiif-info__tab"
          :class="{ 'iiif-info__tab--active': activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          :aria-controls="panelId(tab.key)"
          :tabindex="activeTab === tab.key ? 0 : -1"
          @click="activateTab(tab.key)"
          @keydown="onTabKeydown($event, index)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>

      <!-- 目录 -->
      <div
        v-if="hasToc && activeTab === 'toc'"
        :id="panelId('toc')"
        class="iiif-info__panel"
        role="tabpanel"
        :aria-labelledby="tabId('toc')"
        tabindex="0"
      >
        <ViewerToc
          :structures="structures"
          :current-index="props.currentIndex"
          @select="emit('select-canvas', $event)"
        />
      </div>

      <!-- 作品信息 -->
      <div
        v-if="!hasToc || activeTab === 'info'"
        :id="panelId('info')"
        class="iiif-info__panel iiif-viewer__scroll-y"
        role="tabpanel"
        :aria-labelledby="tabId('info')"
        :tabindex="hasToc ? 0 : undefined"
      >
        <p v-if="props.manifest?.provider" class="iiif-info__provider">
          <ViewerIcon name="info" :size="14" />
          <span>{{ props.manifest.provider }}</span>
        </p>

        <section v-if="props.manifest?.description" class="iiif-info__section">
          <h5 class="iiif-info__section-title">{{ t('info.description') }}</h5>
          <p class="iiif-info__text">{{ props.manifest.description }}</p>
        </section>

        <section v-if="metadata.length" class="iiif-info__section">
          <h5 class="iiif-info__section-title">{{ t('info.metadata') }}</h5>
          <dl class="iiif-info__meta">
            <template v-for="(entry, index) in metadata" :key="`${entry.label}-${index}`">
              <dt class="iiif-info__meta-key">{{ entry.label }}</dt>
              <dd class="iiif-info__meta-value">{{ entry.value }}</dd>
            </template>
          </dl>
        </section>

        <section v-if="props.manifest?.rights" class="iiif-info__section">
          <h5 class="iiif-info__section-title">{{ t('info.rights') }}</h5>
          <p class="iiif-info__text">{{ props.manifest.rights }}</p>
        </section>

        <a
          v-if="props.manifest?.id"
          class="iiif-info__link"
          :href="props.manifest.id"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ViewerIcon name="external-link" :size="14" />
          <span>{{ t('info.rawManifest') }}</span>
        </a>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.iiif-info {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--iiif-z-panel);
  display: flex;
  flex-direction: column;
  width: min(360px, 90%);
  border-left: 1px solid var(--iiif-glass-border);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-lg);
}

.iiif-info__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iiif-space-2);
  flex: none;
  padding: var(--iiif-space-2) var(--iiif-space-2) var(--iiif-space-2) var(--iiif-space-4);
  border-bottom: 1px solid var(--iiif-color-border);
}

.iiif-info__heading {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--iiif-color-fg);
  font-family: var(--iiif-font-display);
  font-size: var(--iiif-font-size-lg);
  font-weight: 600;
}

/* ---------- Tab 栏 ---------- */

.iiif-info__tabs {
  display: flex;
  gap: var(--iiif-space-1);
  flex: none;
  padding: var(--iiif-space-2) var(--iiif-space-3) 0;
  border-bottom: 1px solid var(--iiif-color-border);
}

.iiif-info__tab {
  position: relative;
  min-height: 34px;
  margin: 0;
  padding: 0 var(--iiif-space-3);
  border: 0;
  border-radius: var(--iiif-radius-sm) var(--iiif-radius-sm) 0 0;
  background-color: transparent;
  color: var(--iiif-color-fg-muted);
  font: inherit;
  font-size: var(--iiif-font-size-md);
  cursor: pointer;
  transition:
    color var(--iiif-duration-fast) var(--iiif-ease),
    background-color var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-info__tab:hover {
  background-color: var(--iiif-color-surface-2);
  color: var(--iiif-color-fg);
}

/* 选中态：用底部指示条表达，不改变尺寸 */
.iiif-info__tab--active {
  color: var(--iiif-color-fg);
  font-weight: 600;
}

.iiif-info__tab--active::after {
  content: '';
  position: absolute;
  left: var(--iiif-space-2);
  right: var(--iiif-space-2);
  bottom: -1px;
  height: 2px;
  border-radius: var(--iiif-radius-full);
  background-color: var(--iiif-color-accent-text);
}

.iiif-info__tab:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

/* ---------- 内容 ---------- */

.iiif-info__panel {
  display: flex;
  flex-direction: column;
  gap: var(--iiif-space-4);
  min-height: 0;
  flex: 1 1 auto;
  /* 底部预留工具栏高度，内容不会被悬浮工具栏遮住 */
  padding: var(--iiif-space-4) var(--iiif-space-4) var(--iiif-toolbar-clearance);
  overflow-y: auto;
}

.iiif-info__panel:focus-visible {
  outline: none;
  box-shadow: inset var(--iiif-focus-ring);
}

.iiif-info__provider {
  display: flex;
  align-items: center;
  gap: var(--iiif-space-1);
  margin: 0;
  color: var(--iiif-color-accent-text);
  font-size: var(--iiif-font-size-sm);
}

.iiif-info__section {
  display: flex;
  flex-direction: column;
  gap: var(--iiif-space-2);
}

.iiif-info__section-title {
  margin: 0;
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.iiif-info__text {
  margin: 0;
  color: var(--iiif-color-fg);
  font-size: var(--iiif-font-size-md);
}

.iiif-info__meta {
  display: grid;
  grid-template-columns: minmax(72px, auto) 1fr;
  gap: var(--iiif-space-2) var(--iiif-space-3);
  margin: 0;
}

.iiif-info__meta-key {
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-sm);
}

.iiif-info__meta-value {
  margin: 0;
  color: var(--iiif-color-fg);
  font-size: var(--iiif-font-size-md);
  word-break: break-word;
}

.iiif-info__link {
  display: inline-flex;
  align-items: center;
  gap: var(--iiif-space-1);
  align-self: flex-start;
  min-height: 32px;
  padding: 0 var(--iiif-space-2);
  border-radius: var(--iiif-radius-sm);
  color: var(--iiif-color-accent-text);
  font-size: var(--iiif-font-size-sm);
  text-decoration: none;
  transition: background-color var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-info__link:hover {
  background-color: var(--iiif-color-surface-2);
}

.iiif-info__link:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

/* 窄容器下改为底部抽屉，避免遮挡大面积画面 */
@container iiif-viewer (max-width: 480px) {
  .iiif-info {
    top: auto;
    left: 0;
    width: 100%;
    max-height: 68%;
    border-left: 0;
    border-top: 1px solid var(--iiif-glass-border);
  }

  .iiif-info__panel {
    padding: var(--iiif-space-3) var(--iiif-space-4) var(--iiif-space-5);
  }

  .iiif-info__tab {
    min-height: 44px;
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
