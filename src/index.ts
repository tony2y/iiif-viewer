/**
 * @tony2y/iiif-viewer 公共入口。
 *
 * 使用方式（二选一）：
 * ```ts
 * // 1. 全局注册（推荐配合插件配置）
 * import { createIiifViewer } from '@tony2y/iiif-viewer'
 * import '@tony2y/iiif-viewer/style.css'
 * app.use(createIiifViewer({ locale: 'zh-CN' }))
 *
 * // 2. 按需引入单个组件
 * import { IiifViewer } from '@tony2y/iiif-viewer'
 * import '@tony2y/iiif-viewer/style.css'
 * ```
 */
import type { App, Component, Plugin } from 'vue'

// 全局样式（tokens + 基础样式）：构建时会被抽取为 dist/iiif-viewer.css
import '@/styles/index.css'

import IiifViewer from '@/components/IiifViewer.vue'
import ViewerColorPanel from '@/components/ViewerColorPanel.vue'
import ViewerError from '@/components/ViewerError.vue'
import ViewerInfoPanel from '@/components/ViewerInfoPanel.vue'
import ViewerLoading from '@/components/ViewerLoading.vue'
import ViewerStatusBar from '@/components/ViewerStatusBar.vue'
import ViewerThumbnails from '@/components/ViewerThumbnails.vue'
import ViewerToc from '@/components/ViewerToc.vue'
import ViewerToolbar from '@/components/ViewerToolbar.vue'
import ViewerButton from '@/components/base/ViewerButton.vue'
import ViewerIcon from '@/components/base/ViewerIcon.vue'
import ViewerTooltip from '@/components/base/ViewerTooltip.vue'
import { provideViewerConfig } from '@/composables/useViewerConfig'
import type { IiifViewerPluginOptions } from '@/types/viewer'

/** 全局注册的组件清单 */
const GLOBAL_COMPONENTS: [string, Component][] = [
  ['IiifViewer', IiifViewer],
  ['ViewerToolbar', ViewerToolbar],
  ['ViewerStatusBar', ViewerStatusBar],
  ['ViewerThumbnails', ViewerThumbnails],
  ['ViewerInfoPanel', ViewerInfoPanel],
  ['ViewerColorPanel', ViewerColorPanel],
  ['ViewerToc', ViewerToc],
  ['ViewerLoading', ViewerLoading],
  ['ViewerError', ViewerError],
  ['ViewerButton', ViewerButton],
  ['ViewerIcon', ViewerIcon],
  ['ViewerTooltip', ViewerTooltip],
]

/**
 * 创建插件实例。
 * 传入的配置作为全局默认值，可被组件 Props 覆盖。
 */
export function createIiifViewer(options: IiifViewerPluginOptions = {}): Plugin {
  return {
    install(app: App) {
      provideViewerConfig(app, options)
      for (const [name, component] of GLOBAL_COMPONENTS) {
        app.component(name, component)
      }
    },
  }
}

export default createIiifViewer

/* -------------------------------------------------------------------------- */
/* 组件                                                                        */
/* -------------------------------------------------------------------------- */

export {
  IiifViewer,
  ViewerButton,
  ViewerColorPanel,
  ViewerError,
  ViewerIcon,
  ViewerInfoPanel,
  ViewerLoading,
  ViewerStatusBar,
  ViewerThumbnails,
  ViewerToc,
  ViewerToolbar,
  ViewerTooltip,
}

/* -------------------------------------------------------------------------- */
/* 组合式函数                                                                  */
/* -------------------------------------------------------------------------- */

export { useViewerConfig, IIIF_VIEWER_CONFIG_KEY } from '@/composables/useViewerConfig'
export {
  provideViewerI18n,
  useViewerI18n,
  useViewerI18nContext,
  IIIF_VIEWER_I18N_KEY,
} from '@/composables/useViewerI18n'
export type {
  IiifViewerTranslate,
  IiifViewerTranslateParams,
  UseViewerI18nOptions,
  UseViewerI18nReturn,
} from '@/composables/useViewerI18n'
export { ZOOM_STEP, ZOOM_SWAP_RATIO, useOpenSeadragon } from '@/composables/useOpenSeadragon'
export type {
  OpenTileSourcesOptions,
  OpenTransitionOptions,
  UseOpenSeadragonOptions,
  UseOpenSeadragonReturn,
} from '@/composables/useOpenSeadragon'
export { REDUCED_MOTION_QUERY, useReducedMotion } from '@/composables/useReducedMotion'
export { useIiifSource } from '@/composables/useIiifSource'
export type {
  IiifLoadStatus,
  IiifSourceLoadedPayload,
  UseIiifSourceOptions,
  UseIiifSourceReturn,
} from '@/composables/useIiifSource'

/* -------------------------------------------------------------------------- */
/* 核心能力（供高级用法与二次封装）                                            */
/* -------------------------------------------------------------------------- */

export { IiifViewerError, isIiifViewerError } from '@/core/errors'
export {
  DEFAULT_ANIMATION_TIME,
  DEFAULT_SPRING_STIFFNESS,
  DEFAULT_TIMEOUT,
  REDUCED_MOTION_SPRING_STIFFNESS,
  createOsdOptions,
  detectResourceKind,
  fetchJson,
  findFirstCanvasIndex,
  getIiifDocument,
  getImageInfo,
  getManifest,
  imageServiceToTileSource,
  isAbortError,
  isManifestPayload,
  normalizeContext,
  parseImageInfo,
  parseManifest,
  parseMetadata,
  parseStructures,
  pickImageUrl,
  pickLabel,
  prefersReducedMotion,
  resolveMotionSettings,
  tileSourceKey,
  toTileSource,
} from '@/core/iiif'
export type { FetchJsonOptions, IiifDocument, OsdOptionInput } from '@/core/iiif'
export {
  ensureInfoJsonUrl,
  isAbsoluteUrl,
  isImageFileUrl,
  isInfoJsonUrl,
  isLikelyManifestUrl,
  looksLikeJson,
  resolveUrl,
  stripQuery,
  stripTrailingSlash,
} from '@/core/url'

/* 颜色调节 */
export {
  COLOR_ADJUSTMENT_RANGES,
  DEFAULT_COLOR_ADJUSTMENTS,
  buildImageFilter,
  clampAdjustment,
  isNeutralColorAdjustments,
  normalizeColorAdjustments,
} from '@/core/color'
export type { IiifColorAdjustmentKey } from '@/core/color'

/* OpenSeadragon 注入与兼容性 */
export {
  MIN_SUPPORTED_OSD_MAJOR,
  TESTED_OSD_MAJOR,
  builtinOpenSeadragon,
  resolveOpenSeadragon,
  verifyOpenSeadragon,
} from '@/core/openseadragon'
export type { OpenseadragonNamespace, OsdCompatibilityReport } from '@/core/openseadragon'

/* -------------------------------------------------------------------------- */
/* 国际化                                                                      */
/* -------------------------------------------------------------------------- */

export {
  BUILT_IN_LOCALES,
  BUILT_IN_MESSAGES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  detectLocale,
  enUS,
  normalizeLocale,
  zhCN,
} from '@/locales'
export type { BuiltInLocale } from '@/locales'

/** 内置图标路径表 */
export { VIEWER_ICONS } from '@/components/base/icons'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export * from '@/types'
