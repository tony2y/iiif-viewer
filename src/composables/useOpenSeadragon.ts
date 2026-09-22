/**
 * OpenSeadragon 实例的生命周期封装与控制 API。
 *
 * 职责边界：
 * - 创建 / 销毁实例，绑定事件并回写响应式状态；
 * - 对外暴露命令式控制方法（缩放 / 旋转 / 翻转 / 全屏），供工具栏与快捷键复用。
 *
 * 注意：本模块不负责资源加载，`open()` 的入参由 `useIiifSource` 推导。
 */
import type { Options as OsdOptions, Viewer as OsdViewer } from 'openseadragon'
import type { Ref, ShallowRef } from 'vue'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import { IiifViewerError } from '@/core/errors'
import {
  resolveOpenSeadragon,
  verifyOpenSeadragon,
  type OpenseadragonNamespace,
} from '@/core/openseadragon'
import type { IiifViewerTileSource } from '@/types/iiif'
import type { IiifViewerFitMode } from '@/types/viewer'

/** 每次缩放按钮操作的倍数 */
export const ZOOM_STEP = 1.5

/**
 * 跨页展开时每页在世界坐标下的统一高度。
 * 仅用于排版（世界坐标是相对量），与图像原始像素、瓦片层级无关。
 */
export const SPREAD_PAGE_HEIGHT = 1000

/**
 * OSD `open()` 可接受的入参。
 *
 * OpenSeadragon 自带类型把入参收窄为 `TileSourceSpecifier`（要求显式提供 `tileSource` 字段），
 * 但运行时实际同时接受「地址字符串」「内联配置对象」与它们的数组，因此这里放宽类型，
 * 并在调用处做一次收窄转换。
 */
export type ViewerTileSources = IiifViewerTileSource | IiifViewerTileSource[]

export interface UseOpenSeadragonOptions {
  /** OSD 的挂载容器 */
  containerRef: Ref<HTMLElement | null>
  /** OSD 配置的 getter，创建实例时读取一次 */
  options: () => OsdOptions
  /** 初始适配方式的 getter */
  fitMode?: () => IiifViewerFitMode
  /**
   * 使用方显式注入的 OpenSeadragon 命名空间 getter。
   * 不提供或返回 `undefined` 时回退到 peerDependency 中的实例。
   */
  openseadragon?: () => OpenseadragonNamespace | undefined
}

/** `open()` 的附加选项 */
export interface OpenTileSourcesOptions {
  /**
   * 是否按「跨页展开」排布多张图像。
   * 为真时相邻页面在书脊处紧贴显示；为假时按常规方式铺满视口。
   */
  spread?: boolean
}

export interface UseOpenSeadragonReturn {
  /** 底层 OSD 实例 */
  viewer: ShallowRef<OsdViewer | null>
  /** 实例是否创建完成 */
  isReady: Ref<boolean>
  /** 是否处于全屏 */
  isFullscreen: Ref<boolean>
  /** 相对图像原始像素的缩放百分比（100 表示 1:1） */
  zoomPercent: Ref<number>
  /** 当前旋转角度（0–359） */
  rotation: Ref<number>
  /** 是否水平翻转 */
  flipped: Ref<boolean>
  /** 瓦片加载进度 0–100 */
  progress: Ref<number>
  /** 实例创建失败或瓦片源打开失败时的错误 */
  error: ShallowRef<IiifViewerError | null>
  /** 实际使用的 OpenSeadragon 版本号 */
  osdVersion: Ref<string | undefined>
  /** 清空错误（开始加载新资源时调用） */
  clearError: () => void
  /** 打开资源 */
  open: (tileSources: ViewerTileSources, openOptions?: OpenTileSourcesOptions) => void
  /** 应用 CSS 图像滤镜（亮度 / 对比度 / 饱和度）；空串表示清除滤镜 */
  applyImageFilter: (filter: string) => void
  zoomIn: (factor?: number) => void
  zoomOut: (factor?: number) => void
  zoomTo: (zoom: number) => void
  resetHome: () => void
  rotateBy: (degrees: number) => void
  rotateTo: (degrees: number, immediately?: boolean) => void
  flipHorizontal: () => void
  toggleFullscreen: () => void
  destroy: () => void
}

/** 把任意角度归一化到 [0, 360) */
function normalizeDegrees(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360
}

export function useOpenSeadragon(options: UseOpenSeadragonOptions): UseOpenSeadragonReturn {
  const viewer = shallowRef<OsdViewer | null>(null)
  const isReady = ref(false)
  const isFullscreen = ref(false)
  const zoomPercent = ref(100)
  const rotation = ref(0)
  const flipped = ref(false)
  const progress = ref(0)
  const error = shallowRef<IiifViewerError | null>(null)
  const osdVersion = ref<string | undefined>(undefined)

  /** 已加载瓦片计数，用于估算进度 */
  let loadedTiles = 0
  /** 缓存的适配方式，供 open 之后应用 */
  let currentFitMode: IiifViewerFitMode = 'contain'
  /** 当前是否处于跨页展开模式，由最近一次 open() 决定 */
  let spreadMode = false
  /** 跨页排布的延迟任务句柄 */
  let spreadTimer: ReturnType<typeof setTimeout> | null = null

  function syncZoom(): void {
    const instance = viewer.value
    const viewport = instance?.viewport
    if (!instance || !viewport) return

    const zoom = viewport.getZoom()
    // 多图（双页展开）时 OSD 的 viewportToImageZoom 会打印告警且结果不准确，
    // 因此统一优先用第一张 TiledImage 换算；单图场景两者等价。
    const item = instance.world?.getItemAt?.(0)
    const imageZoom = item ? item.viewportToImageZoom(zoom) : viewport.viewportToImageZoom(zoom)
    zoomPercent.value = Math.round(imageZoom * 100)
  }

  /**
   * 应用 / 清除图像滤镜。
   *
   * 直接作用在 OSD 的 `.openseadragon-canvas` 容器上：导航图是独立元素，
   * 不会被一起染色；同时对 Canvas / WebGL / HTML 三种绘制器都生效。
   */
  function applyImageFilter(filter: string): void {
    const canvas = viewer.value?.canvas
    if (!canvas) return
    canvas.style.filter = filter || ''
  }

  function applyFitMode(): void {
    const viewport = viewer.value?.viewport
    if (!viewport) return
    if (currentFitMode === 'width') viewport.fitHorizontally()
    else if (currentFitMode === 'height') viewport.fitVertically()
    else viewport.goHome()
    syncZoom()
  }

  /**
   * 跨页展开排布：相邻页面在书脊处紧贴，看起来像一本摊开的书。
   *
   * 这里不用 OSD 的 `collectionMode`：它把每页**居中**放进 `collectionTileSize` 见方的格子里，
   * 竖版页面之间必然空出 `tileSize - 页宽` 的间距（默认还有 80 的 `collectionTileMargin`），
   * 两页相距甚远、不像书。改为「统一页高 + 各自宽高比推导页宽 + 依次紧贴」。
   */
  function applySpreadLayout(): void {
    const instance = viewer.value
    const world = instance?.world
    if (!instance || !world || world.getItemCount() < 2) return

    const items = Array.from({ length: world.getItemCount() }, (_, index) => world.getItemAt(index))
    const boxes = items.map((item) => item.getBoundsNoRotate())
    // info.json 尚未返回时拿不到宽高比，跳过；下一张图加入时还会再排一次
    if (boxes.some((box) => !box.width || !box.height)) return

    // 批量改尺寸期间关闭自动重算，最后统一刷新 home bounds
    world.setAutoRefigureSizes(false)
    let x = 0
    items.forEach((item, index) => {
      const box = boxes[index]
      const width = SPREAD_PAGE_HEIGHT * (box.width / box.height)
      const position = box.getTopLeft()
      position.x = x
      position.y = 0
      item.setPosition(position, true)
      item.setWidth(width, true)
      x += width
    })
    world.setAutoRefigureSizes(true)
    applyFitMode()
  }

  /**
   * 图片是在 OSD 内部「加入 world」的同一轮任务里完成排布的，
   * 因此延后一个宏任务，确保此时 world 中的图片已齐备。
   */
  function scheduleSpreadLayout(): void {
    if (spreadTimer !== null) clearTimeout(spreadTimer)
    spreadTimer = setTimeout(() => {
      spreadTimer = null
      applySpreadLayout()
    }, 0)
  }

  function bindEvents(instance: OsdViewer): void {
    instance.addHandler('open', () => {
      applyFitMode()
    })

    // 每加入一张图（跨页展开时是两张）就重新排一次，保证书脊紧贴
    instance.world.addHandler('add-item', () => {
      if (spreadMode) scheduleSpreadLayout()
    })

    instance.addHandler('open-failed', (event) => {
      error.value = new IiifViewerError('HTTP_ERROR', event.message, event.source)
    })

    // 弹簧动画期间持续同步缩放，保证状态栏数值平滑跟随
    instance.addHandler('animation', syncZoom)
    instance.addHandler('animation-finish', syncZoom)

    instance.addHandler('rotate', (event) => {
      rotation.value = normalizeDegrees(event.degrees)
    })

    instance.addHandler('flip', (event) => {
      flipped.value = event.flipped
    })

    instance.addHandler('full-screen', (event) => {
      isFullscreen.value = event.fullScreen
    })

    instance.addHandler('tile-loaded', () => {
      loadedTiles += 1
      progress.value = Math.min(99, 5 + loadedTiles * 8)
    })

    instance.addHandler('fully-loaded-change', (event) => {
      progress.value = event.fullyLoaded ? 100 : progress.value
    })
  }

  function create(): void {
    const container = options.containerRef.value
    if (!container || viewer.value) return

    // 先解析使用方注入的 OpenSeadragon（未注入时回退到 peer 实例）并做兼容性校验
    const osd = resolveOpenSeadragon(options.openseadragon?.())
    const report = verifyOpenSeadragon(osd)
    osdVersion.value = report.version

    if (!report.ok) {
      error.value = new IiifViewerError(
        'OSD_INIT_FAILED',
        `OpenSeadragon 不兼容，缺少必要能力：${report.missing.join('、')}`,
        report,
      )
      return
    }
    for (const warning of report.warnings) {
      console.warn('[iiif-viewer]', warning)
    }

    try {
      const instance = osd({ ...options.options(), element: container })
      viewer.value = instance
      currentFitMode = options.fitMode?.() ?? 'contain'
      bindEvents(instance)
      isReady.value = true
    } catch (cause) {
      error.value = new IiifViewerError('OSD_INIT_FAILED', undefined, cause)
    }
  }

  function destroy(): void {
    const instance = viewer.value
    viewer.value = null
    isReady.value = false
    isFullscreen.value = false
    if (spreadTimer !== null) {
      clearTimeout(spreadTimer)
      spreadTimer = null
    }
    if (!instance) return
    try {
      instance.destroy()
    } catch {
      // 销毁阶段的异常无需向上传播
    }
  }

  /** 清空错误：开始加载新资源时调用，避免上一轮的错误残留 */
  function clearError(): void {
    error.value = null
  }

  function open(tileSources: ViewerTileSources, openOptions: OpenTileSourcesOptions = {}): void {
    const instance = viewer.value
    if (!instance) return
    progress.value = 0
    loadedTiles = 0
    clearError()
    // 跨页模式在图片加入 world 之前确定，add-item 回调据此决定是否重新排布
    spreadMode = openOptions.spread === true
    instance.open(tileSources as unknown as Parameters<OsdViewer['open']>[0])
  }

  function zoomIn(factor = ZOOM_STEP): void {
    viewer.value?.viewport.zoomBy(factor)
  }

  function zoomOut(factor = ZOOM_STEP): void {
    viewer.value?.viewport.zoomBy(1 / factor)
  }

  function zoomTo(zoom: number): void {
    viewer.value?.viewport.zoomTo(zoom)
  }

  function resetHome(): void {
    const instance = viewer.value
    if (!instance) return
    instance.viewport.setFlip(false)
    instance.viewport.rotateTo(0, undefined, true)
    applyFitMode()
  }

  function rotateBy(degrees: number): void {
    const viewport = viewer.value?.viewport
    if (!viewport) return
    viewport.rotateTo(viewport.getRotation() + degrees)
  }

  function rotateTo(degrees: number, immediately = false): void {
    viewer.value?.viewport.rotateTo(degrees, undefined, immediately)
  }

  function flipHorizontal(): void {
    const viewport = viewer.value?.viewport
    if (!viewport) return
    viewport.setFlip(!viewport.getFlip())
  }

  function toggleFullscreen(): void {
    const instance = viewer.value
    if (!instance) return
    instance.setFullScreen(!instance.isFullScreen())
  }

  onMounted(create)
  onBeforeUnmount(destroy)

  return {
    viewer,
    isReady,
    isFullscreen,
    zoomPercent,
    rotation,
    flipped,
    progress,
    error,
    osdVersion,
    clearError,
    open,
    applyImageFilter,
    zoomIn,
    zoomOut,
    zoomTo,
    resetHome,
    rotateBy,
    rotateTo,
    flipHorizontal,
    toggleFullscreen,
    destroy,
  }
}
