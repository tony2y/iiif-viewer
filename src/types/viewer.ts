/**
 * 组件对外暴露的公共类型：Props / Emits / Slots / 插件配置。
 */
import type OpenSeadragon from 'openseadragon'
import type { Options as OsdOptions, Viewer as OsdViewer } from 'openseadragon'

import type { IiifImageInfo, IiifManifest, IiifCanvas, IiifViewerTileSource } from './iiif'
import type { IiifViewerErrorCode } from './errors'

/**
 * OpenSeadragon 命名空间类型。
 * 其默认导出是一个可调用的工厂函数（`OpenSeadragon(options)`），同时挂载 `Viewer`、`TileSource` 等成员。
 */
export type OpenseadragonNamespace = typeof OpenSeadragon

/* -------------------------------------------------------------------------- */
/* 基础枚举型                                                                  */
/* -------------------------------------------------------------------------- */

/** 主题模式；`auto` 跟随系统 `prefers-color-scheme` */
export type IiifViewerTheme = 'dark' | 'light' | 'auto'

/** 输入类型；`auto` 由组件自动识别 */
export type IiifViewerSourceType = 'auto' | 'info' | 'manifest' | 'image'

/** 工具栏停靠位置 */
export type IiifViewerToolbarPosition = 'top' | 'bottom' | 'left' | 'right'

/** 初始适配方式 */
export type IiifViewerFitMode = 'contain' | 'width' | 'height'

/** 色彩调节维度 */
export type IiifColorAdjustmentKey = 'brightness' | 'contrast' | 'saturation'

/** 色彩调节值（均为百分比，100 表示不做改变） */
export interface IiifColorAdjustments {
  /** 亮度，范围 50–150 */
  brightness: number
  /** 对比度，范围 50–150 */
  contrast: number
  /** 饱和度，范围 0–200 */
  saturation: number
}

/** 可传入的 IIIF 地址、OSD tileSource，或它们的数组 */
export type IiifViewerSource = IiifViewerTileSource | IiifViewerTileSource[]

/** 工具栏可包含的动作 */
export type IiifViewerToolbarAction =
  | 'zoom-in'
  | 'zoom-out'
  | 'reset'
  | 'rotate-left'
  | 'rotate-right'
  | 'flip-horizontal'
  | 'fullscreen'
  | 'prev'
  | 'next'
  | 'thumbnails'
  | 'info'
  | 'double-page'
  | 'color-adjust'

/* -------------------------------------------------------------------------- */
/* 工具栏配置                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 工具栏细项配置。
 * 所有开关默认值均为 `true`；页码 / 缩略图 / 信息面板在单画布场景下会自动隐藏。
 */
export interface IiifViewerToolbarOptions {
  /** 停靠位置，默认 `'bottom'` */
  position?: IiifViewerToolbarPosition
  /** 放大 / 缩小，默认 `true` */
  zoom?: boolean
  /** 左旋 / 右旋，默认 `true` */
  rotate?: boolean
  /** 水平翻转，默认 `true` */
  flip?: boolean
  /** 复位（回到初始视图），默认 `true` */
  reset?: boolean
  /** 全屏切换，默认 `true` */
  fullscreen?: boolean
  /** 上一页 / 下一页（多画布时自动显示），默认 `true` */
  pageNav?: boolean
  /** 缩略图开关按钮（多画布时自动显示），默认 `true` */
  thumbnails?: boolean
  /** 元数据面板开关按钮，默认 `true` */
  info?: boolean
  /** 单页 / 双页切换按钮（多画布时自动显示），默认 `true` */
  doublePage?: boolean
}

/** 补齐默认值后的工具栏配置，供 `ViewerToolbar` 内部消费 */
export type ResolvedToolbarOptions = Required<IiifViewerToolbarOptions>

/** 工具栏配置的默认值 */
export const DEFAULT_TOOLBAR_OPTIONS: ResolvedToolbarOptions = {
  position: 'bottom',
  zoom: true,
  rotate: true,
  flip: true,
  reset: true,
  fullscreen: true,
  pageNav: true,
  thumbnails: true,
  info: true,
  doublePage: true,
}

/** 把 `boolean | IiifViewerToolbarOptions` 形式的入参解析为完整配置 */
export function resolveToolbarOptions(
  value: boolean | IiifViewerToolbarOptions | undefined,
): ResolvedToolbarOptions | null {
  if (value === false) return null
  if (value === true || value === undefined) return { ...DEFAULT_TOOLBAR_OPTIONS }
  return { ...DEFAULT_TOOLBAR_OPTIONS, ...value }
}

/* -------------------------------------------------------------------------- */
/* 运行时状态                                                                  */
/* -------------------------------------------------------------------------- */

/** 组件通过插槽 / 事件向外暴露的实时状态快照 */
export interface IiifViewerState {
  /** 相对图像原始像素的缩放百分比（100 表示 1:1） */
  zoomPercent: number
  /** 当前旋转角度（0–359） */
  rotation: number
  /** 是否水平翻转 */
  flipped: boolean
  /** 当前画布索引（从 0 开始） */
  page: number
  /** 画布总数 */
  total: number
  /** 是否全屏 */
  fullscreen: boolean
  /** 是否存在上一页 */
  canGoPrev: boolean
  /** 是否存在下一页 */
  canGoNext: boolean
  /** 瓦片加载进度 0–100 */
  progress: number
  /** 是否处于双页展开模式 */
  doublePage: boolean
  /** 当前生效的色彩调节值 */
  colors: IiifColorAdjustments
  /** 图像信息（`info.json` 场景下可用） */
  imageInfo?: IiifImageInfo
  /** manifest 信息（manifest 场景下可用） */
  manifest?: IiifManifest
  /** 当前画布 */
  canvas?: IiifCanvas
}

/** 组件通过 `defineExpose` 暴露的命令式方法集合 */
export interface IiifViewerActions {
  /** 打开新的资源地址（会替换当前 source） */
  open: (source: IiifViewerSource) => void
  zoomIn: (step?: number) => void
  zoomOut: (step?: number) => void
  zoomTo: (zoom: number) => void
  resetHome: () => void
  rotateBy: (degrees: number) => void
  rotateTo: (degrees: number, immediately?: boolean) => void
  flipHorizontal: () => void
  goToPage: (index: number) => void
  prevPage: () => void
  nextPage: () => void
  toggleFullscreen: () => void
  retry: () => void
  /** 设置双页展开模式 */
  setDoublePage: (enabled: boolean) => void
  /** 切换双页展开模式 */
  toggleDoublePage: () => void
  /** 设置色彩调节（部分字段即可） */
  setColors: (adjustments: Partial<IiifColorAdjustments>) => void
  /** 重置色彩调节为中性值 */
  resetColors: () => void
}

/** `defineExpose` 的完整导出 */
export interface IiifViewerExposed extends IiifViewerActions {
  /** 底层 OpenSeadragon 实例；未就绪时为 `null` */
  viewer: OsdViewer | null
  /** 获取当前状态快照 */
  getState: () => IiifViewerState
}

/* -------------------------------------------------------------------------- */
/* 事件与插槽                                                                  */
/* -------------------------------------------------------------------------- */

/** `load-success` 事件的负载 */
export interface IiifViewerLoadSuccessPayload {
  kind: 'info' | 'manifest' | 'image' | 'tile-source'
  imageInfo?: IiifImageInfo
  manifest?: IiifManifest
  canvases: IiifCanvas[]
}

/** 组件对外抛出的错误对象形状（实现见 `core/errors.ts`） */
export interface IiifViewerErrorLike extends Error {
  readonly code: IiifViewerErrorCode
  readonly i18nKey: string
  readonly details?: unknown
}

/** Emits 映射（采用 Vue 3.3+ 的元组语法） */
export interface IiifViewerEmits {
  /** OpenSeadragon 实例创建完成 */
  ready: [viewer: OsdViewer]
  /** 组件卸载、OSD 实例销毁 */
  destroy: []
  /** 开始加载资源 */
  'load-start': [source: IiifViewerSource]
  /** 资源加载成功 */
  'load-success': [payload: IiifViewerLoadSuccessPayload]
  /** 资源加载失败 */
  'load-error': [error: IiifViewerErrorLike]
  /** 缩放变化 */
  'zoom-change': [zoom: number]
  /** 旋转变化 */
  'rotation-change': [degrees: number]
  /** 翻转状态变化 */
  'flip-change': [flipped: boolean]
  /** 翻页 */
  'page-change': [payload: { index: number; total: number }]
  /** 双页展开模式变化 */
  'double-page-change': [value: boolean]
  /** 色彩调节变化 */
  'colors-change': [colors: IiifColorAdjustments]
  /** 色彩调节面板开合 */
  'color-toggle': [open: boolean]
  /** 全屏状态变化 */
  'fullscreen-change': [value: boolean]
  /** 瓦片加载进度变化（0–100） */
  'progress-change': [percent: number]
  /** 元数据面板开合 */
  'info-toggle': [open: boolean]
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `IiifViewer` 的完整 Props 定义。
 * 每个字段的默认值见 JSDoc 中的「默认」标注，组件内通过 `withDefaults` 落实。
 */
export interface IiifViewerProps {
  /**
   * IIIF 资源地址或 OSD tileSource。
   * 支持：Image API 服务基址、`info.json` 地址、Presentation `manifest.json` 地址、静态图片地址、OSD tileSource 对象/数组。
   */
  source: IiifViewerSource
  /** 强制指定输入类型。默认 `'auto'`（自动识别） */
  sourceType?: IiifViewerSourceType
  /** 界面语言。默认取插件配置，其次 `navigator.language`，最后 `'en-US'` */
  locale?: string
  /** 覆盖 / 扩展内置文案，key 形如 `toolbar.zoomIn` */
  messages?: Record<string, string>
  /** 主题。默认 `'dark'` */
  theme?: IiifViewerTheme
  /** 工具栏开关或细项配置。默认 `true` */
  toolbar?: boolean | IiifViewerToolbarOptions
  /** 是否显示导航图（OSD 内置）。默认 `true` */
  showNavigator?: boolean
  /** 是否显示底部状态栏。默认 `true` */
  showStatusBar?: boolean
  /** 缩略图条的初始展开状态；仅多画布生效。默认 `false` */
  showThumbnails?: boolean
  /** 元数据面板的初始展开状态。默认 `false` */
  showInfoPanel?: boolean
  /** 是否启用键盘快捷键（仅在舞台获得焦点时生效）。默认 `true` */
  keyboardShortcuts?: boolean
  /** 初始适配方式。默认 `'contain'` */
  fitMode?: IiifViewerFitMode
  /** 最小缩放倍数。默认 `0.5` */
  minZoom?: number
  /** 最大缩放倍数（映射为 OSD 的 `maxZoomPixelRatio`）。默认 `20` */
  maxZoom?: number
  /** 旋转步进角度。默认 `90` */
  rotateStep?: number
  /** 请求超时毫秒数。默认 `15000` */
  timeout?: number
  /** 舞台宽高比，如 `'4 / 3'`、`'16 / 9'` 或数字；设为 `'auto'` 时撑满父容器高度。默认 `'4 / 3'` */
  aspectRatio?: string | number
  /** 透传给 OpenSeadragon 的原生配置，优先级高于组件内部推导值 */
  osdOptions?: Partial<OsdOptions>
  /**
   * 初始是否以「双页展开」显示。
   *
   * 运行期修改该 Prop 也会同步切换，效果等价于调用 `setDoublePage()`。
   * 默认 `false`（单页）。
   */
  initialDoublePage?: boolean
  /**
   * 是否启用「亮度 / 对比度 / 饱和度」调节模块。
   *
   * 设为 `false` 时工具栏不显示色彩按钮，也不会渲染调节面板与画面滤镜。
   * 默认 `true`。
   */
  colorAdjust?: boolean
  /**
   * 由使用方显式提供的 OpenSeadragon 实例（命名空间）。
   *
   * 不传时使用 `peerDependencies` 中的 OpenSeadragon。仅在需要指定自编译版本、
   * 页面存在多份 OSD、或通过 CDN 全局变量引入时才需要传入。
   * 传入对象会先经过兼容性校验，详见 `verifyOpenSeadragon()`。
   */
  openseadragon?: OpenseadragonNamespace
}

/* -------------------------------------------------------------------------- */
/* 插件配置                                                                    */
/* -------------------------------------------------------------------------- */

/** `createIiifViewer()` 的配置项，作为全局默认值，可被组件 Props 覆盖 */
export interface IiifViewerPluginOptions {
  /** 全局默认语言 */
  locale?: string
  /** 全局默认文案覆盖 */
  messages?: Record<string, string>
  /** 全局默认主题 */
  theme?: IiifViewerTheme
  /** 全局默认工具栏配置 */
  toolbar?: boolean | IiifViewerToolbarOptions
  /** 全局默认 OpenSeadragon 配置 */
  osdOptions?: Partial<OsdOptions>
  /** 全局默认是否为双页展开 */
  initialDoublePage?: boolean
  /** 全局是否启用色彩调节模块 */
  colorAdjust?: boolean
  /** 全局指定 OpenSeadragon 实例 */
  openseadragon?: OpenseadragonNamespace
}
