<script setup lang="ts">
/**
 * 悬浮工具栏（玻璃态覆盖层）。
 *
 * - 支持 top / bottom / left / right 四种停靠位置；
 * - `compact` 为真（窄容器）时只保留核心动作，其余收进「更多」弹出菜单；
 * - 每个按钮都带可访问名称与 Tooltip，切换态通过 `aria-pressed` 表达。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'
import type {
  IiifViewerState,
  IiifViewerToolbarAction,
  IiifViewerToolbarPosition,
  ResolvedToolbarOptions,
} from '@/types/viewer'
import ViewerButton from './base/ViewerButton.vue'
import ViewerIcon from './base/ViewerIcon.vue'
import type { ViewerIconName } from './base/icons'

const props = withDefaults(
  defineProps<{
    /** 已解析的工具栏配置 */
    options: ResolvedToolbarOptions
    /** 当前视图状态 */
    state: IiifViewerState
    /** 窄容器模式 */
    compact?: boolean
    /** 缩略图条是否展开 */
    thumbnailsOpen?: boolean
    /** 信息面板是否展开 */
    infoOpen?: boolean
    /** 色彩调节面板是否展开 */
    colorOpen?: boolean
    /** 是否启用色彩调节模块（关闭时连按钮一起隐藏） */
    colorAdjust?: boolean
  }>(),
  { compact: false, thumbnailsOpen: false, infoOpen: false, colorOpen: false, colorAdjust: true },
)

const emit = defineEmits<{
  /** 触发某个工具栏动作 */
  action: [action: IiifViewerToolbarAction]
}>()

const { t } = useViewerI18nContext()

/** 窄容器下始终保留在工具栏上的动作 */
const PRIMARY_ACTIONS: readonly IiifViewerToolbarAction[] = [
  'zoom-out',
  'zoom-in',
  'reset',
  'fullscreen',
]

interface ToolbarItem {
  action: IiifViewerToolbarAction
  icon: ViewerIconName
  label: string
  /** 切换态；有值时会输出 `aria-pressed` */
  active?: boolean
  disabled?: boolean
}

const isMultiCanvas = computed(() => props.state.total > 1)

const items = computed<ToolbarItem[]>(() => {
  const { options, state } = props
  const list: ToolbarItem[] = []

  if (options.zoom) {
    list.push({ action: 'zoom-out', icon: 'zoom-out', label: t('toolbar.zoomOut') })
    list.push({ action: 'zoom-in', icon: 'zoom-in', label: t('toolbar.zoomIn') })
  }
  if (options.reset) {
    list.push({ action: 'reset', icon: 'home', label: t('toolbar.reset') })
  }
  if (options.rotate) {
    list.push({ action: 'rotate-left', icon: 'rotate-ccw', label: t('toolbar.rotateLeft') })
    list.push({ action: 'rotate-right', icon: 'rotate-cw', label: t('toolbar.rotateRight') })
  }
  if (options.flip) {
    list.push({
      action: 'flip-horizontal',
      icon: 'flip-horizontal',
      label: t('toolbar.flipHorizontal'),
      active: state.flipped,
    })
  }
  if (options.pageNav && isMultiCanvas.value) {
    list.push({
      action: 'prev',
      icon: 'chevron-left',
      label: t('toolbar.prev'),
      disabled: !state.canGoPrev,
    })
    list.push({
      action: 'next',
      icon: 'chevron-right',
      label: t('toolbar.next'),
      disabled: !state.canGoNext,
    })
  }
  if (options.thumbnails && isMultiCanvas.value) {
    list.push({
      action: 'thumbnails',
      icon: 'grid',
      label: t('toolbar.thumbnails'),
      active: props.thumbnailsOpen,
    })
  }
  if (options.doublePage && isMultiCanvas.value) {
    // 图标与文案反映**当前**模式，切换态由 aria-pressed 表达
    list.push({
      action: 'double-page',
      icon: state.doublePage ? 'book-open' : 'book',
      label: state.doublePage ? t('toolbar.doublePage') : t('toolbar.singlePage'),
      active: state.doublePage,
    })
  }
  if (options.info) {
    list.push({ action: 'info', icon: 'info', label: t('toolbar.info'), active: props.infoOpen })
  }
  if (props.colorAdjust) {
    list.push({
      action: 'color-adjust',
      icon: 'sliders',
      label: t('toolbar.colorAdjust'),
      active: props.colorOpen,
    })
  }
  if (options.fullscreen) {
    list.push({
      action: 'fullscreen',
      icon: state.fullscreen ? 'minimize' : 'maximize',
      label: state.fullscreen ? t('toolbar.exitFullscreen') : t('toolbar.fullscreen'),
      active: state.fullscreen,
    })
  }

  return list
})

const visibleItems = computed(() =>
  props.compact ? items.value.filter((item) => PRIMARY_ACTIONS.includes(item.action)) : items.value,
)

const overflowItems = computed(() =>
  props.compact ? items.value.filter((item) => !PRIMARY_ACTIONS.includes(item.action)) : [],
)

/** Tooltip 位置与工具栏停靠位置相反，避免被裁切 */
const tooltipPlacement = computed(() => {
  const map: Record<IiifViewerToolbarPosition, 'top' | 'bottom' | 'left' | 'right'> = {
    bottom: 'top',
    top: 'bottom',
    left: 'right',
    right: 'left',
  }
  return map[props.options.position]
})

/* -------------------------------------------------------------------------- */
/* 「更多」弹出菜单                                                            */
/* -------------------------------------------------------------------------- */

const menuOpen = ref(false)
const menuWrapRef = ref<HTMLElement | null>(null)

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

function closeMenu(): void {
  menuOpen.value = false
}

function selectFromMenu(action: IiifViewerToolbarAction, disabled?: boolean): void {
  closeMenu()
  if (!disabled) emit('action', action)
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!menuWrapRef.value?.contains(event.target as Node)) closeMenu()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu()
}

watch(menuOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('keydown', onDocumentKeydown)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    document.removeEventListener('keydown', onDocumentKeydown)
  }
})

// 从窄容器切回宽容器时收起菜单，避免残留浮层
watch(
  () => props.compact,
  () => closeMenu(),
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div
    class="iiif-toolbar"
    :class="[`iiif-toolbar--${props.options.position}`, { 'iiif-toolbar--compact': props.compact }]"
    role="toolbar"
    :aria-label="t('toolbar.label')"
  >
    <ViewerButton
      v-for="item in visibleItems"
      :key="item.action"
      :icon="item.icon"
      :label="item.label"
      :active="item.active"
      :disabled="item.disabled"
      :tooltip-placement="tooltipPlacement"
      @click="emit('action', item.action)"
    />

    <slot name="extra" />

    <!-- 窄容器下的「更多」菜单 -->
    <div v-if="overflowItems.length" ref="menuWrapRef" class="iiif-toolbar__more">
      <ViewerButton
        icon="more"
        :label="t('toolbar.more')"
        :expanded="menuOpen"
        :tooltip-placement="tooltipPlacement"
        @click="toggleMenu"
      />

      <Transition name="iiif-pop">
        <ul v-if="menuOpen" class="iiif-toolbar__menu" role="menu">
          <li v-for="item in overflowItems" :key="item.action" role="none">
            <button
              type="button"
              role="menuitem"
              class="iiif-toolbar__menu-item"
              :disabled="item.disabled"
              :aria-pressed="item.active"
              @click="selectFromMenu(item.action, item.disabled)"
            >
              <ViewerIcon :name="item.icon" :size="16" />
              <span>{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.iiif-toolbar {
  position: absolute;
  z-index: var(--iiif-z-toolbar);
  display: flex;
  align-items: center;
  gap: var(--iiif-space-1);
  padding: var(--iiif-space-1);
  border: 1px solid var(--iiif-glass-border);
  border-radius: var(--iiif-radius-lg);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-md);
  animation: iiif-slide-up var(--iiif-duration-slow) var(--iiif-ease);
}

.iiif-toolbar--bottom {
  bottom: var(--iiif-space-3);
  left: 50%;
  transform: translateX(-50%);
}

.iiif-toolbar--top {
  top: var(--iiif-space-3);
  left: 50%;
  transform: translateX(-50%);
}

.iiif-toolbar--left {
  left: var(--iiif-space-3);
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
}

.iiif-toolbar--right {
  right: var(--iiif-space-3);
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
}

/* 窄容器下的紧凑形态：贴底居中、去掉多余留白 */
@container iiif-viewer (max-width: 480px) {
  .iiif-toolbar {
    gap: 2px;
    padding: 3px;
  }

  .iiif-toolbar--bottom {
    bottom: var(--iiif-space-2);
  }

  .iiif-toolbar--left,
  .iiif-toolbar--right {
    /* 窄容器下左右停靠容易遮挡画面，降级为贴底 */
    left: 50%;
    right: auto;
    top: auto;
    bottom: var(--iiif-space-2);
    transform: translateX(-50%);
    flex-direction: row;
  }
}

.iiif-toolbar__more {
  position: relative;
  display: inline-flex;
}

.iiif-toolbar__menu {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  z-index: var(--iiif-z-popup);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
  margin: 0;
  padding: var(--iiif-space-1);
  list-style: none;
  border: 1px solid var(--iiif-glass-border);
  border-radius: var(--iiif-radius-md);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-lg);
}

/* 工具栏停靠在顶部 / 左侧时，菜单向下或向右展开 */
.iiif-toolbar--top .iiif-toolbar__menu,
.iiif-toolbar--left .iiif-toolbar__menu {
  top: calc(100% + 6px);
  bottom: auto;
}

.iiif-toolbar__menu-item {
  display: flex;
  align-items: center;
  gap: var(--iiif-space-2);
  width: 100%;
  min-height: 36px;
  margin: 0;
  padding: var(--iiif-space-1) var(--iiif-space-2);
  border: 1px solid transparent;
  border-radius: var(--iiif-radius-sm);
  background-color: transparent;
  color: var(--iiif-color-fg);
  font: inherit;
  font-size: var(--iiif-font-size-md);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--iiif-duration-fast) var(--iiif-ease);
}

.iiif-toolbar__menu-item:hover:not(:disabled) {
  background-color: var(--iiif-color-surface-2);
}

.iiif-toolbar__menu-item[aria-pressed='true'] {
  color: var(--iiif-color-accent-text);
}

.iiif-toolbar__menu-item:focus-visible {
  outline: none;
  box-shadow: var(--iiif-focus-ring);
}

.iiif-toolbar__menu-item:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@container iiif-viewer (max-width: 480px) {
  .iiif-toolbar__menu-item {
    min-height: 44px;
  }
}

.iiif-pop-enter-active,
.iiif-pop-leave-active {
  transition:
    opacity var(--iiif-duration-fast) var(--iiif-ease),
    transform var(--iiif-duration-fast) var(--iiif-ease);
  transform-origin: bottom right;
}

.iiif-pop-enter-from,
.iiif-pop-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}
</style>
