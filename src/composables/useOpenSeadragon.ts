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
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { IiifViewerError } from '@/core/errors'
import {
  DEFAULT_ANIMATION_TIME,
  DEFAULT_SPRING_STIFFNESS,
  REDUCED_MOTION_SPRING_STIFFNESS,
} from '@/core/iiif'
import {
  resolveOpenSeadragon,
  verifyOpenSeadragon,
  type OpenseadragonNamespace,
} from '@/core/openseadragon'
import type { IiifViewerTileSource } from '@/types/iiif'
import type { IiifViewerFitMode, ResolvedPageTransitionPreset } from '@/types/viewer'
import { useReducedMotion } from './useReducedMotion'

/** 每次缩放按钮操作的倍数 */
export const ZOOM_STEP = 1.5

/**
 * 跨页展开时每页在世界坐标下的统一高度。
 * 仅用于排版（世界坐标是相对量），与图像原始像素、瓦片层级无关。
 */
export const SPREAD_PAGE_HEIGHT = 1000

/** `zoom-swap` 过渡中旧画面缩小的比例（1 表示不缩放） */
export const ZOOM_SWAP_RATIO = 0.88

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
  /**
   * 全屏目标元素（组件根节点）。
   *
   * 提供后全屏走原生 Fullscreen API：工具栏、状态栏、缩略图条与画布同处一个
   * 全屏元素内，全屏时依旧可见可交互。不提供时回退到 OSD 自带的
   * `setFullScreen()`——它只会把 OSD 容器本身送进全屏，组件的 UI 会全部留在屏外。
   */
  fullscreenRef?: Ref<HTMLElement | null>
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
  /**
   * 是否保留当前视口（缩放 / 平移），不在 `open()` 之后重新适配。
   *
   * 同一份资源内翻页应设为 `true`：否则每次翻页都会被 `goHome()` 拉回初始视图，
   * 用户当前看到的局部细节会丢失。换资源时保持默认（`false`），让新资源以适配视图呈现。
   */
  preserveViewport?: boolean
  /** 翻页过渡；不传表示直接切换 */
  transition?: OpenTransitionOptions
}

/** 运行期的过渡描述：由 `resolvePageTransitionOptions()` 解析后传入 */
export interface OpenTransitionOptions {
  preset: ResolvedPageTransitionPreset
  /** 过渡时长（毫秒） */
  duration: number
  /** `fade` 使用的 CSS 缓动函数 */
  easing: string
  /** 过渡开始（此时旧画面仍然可见） */
  onStart?: () => void
  /**
   * 过渡结束。被新的过渡中断时同样会触发，且保证只触发一次，
   * 便于宿主在这样的回调里可靠地恢复自身状态。
   */
  onEnd?: () => void
}

/**
 * 运行期需要改写的 OpenSeadragon 成员。
 *
 * `animationTime` / `springStiffness` 并未声明在 OSD 的 `Viewer` / `Viewport` 类上
 * （只存在于 `Options`），但运行期确实可写且会立即生效，因此用结构化类型描述，
 * 缺字段时静默跳过。
 */
interface OsdSpringLike {
  animationTime?: number
  springStiffness?: number
}

interface OsdMotionTarget extends OsdSpringLike {
  viewport?: OsdSpringLike & {
    centerSpringX?: OsdSpringLike
    centerSpringY?: OsdSpringLike
    zoomSpring?: OsdSpringLike
    degreesSpring?: OsdSpringLike
  }
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
  /** 是否正在播放翻页过渡 */
  transitioning: Ref<boolean>
  /** 右上角导航图（小地图）是否可见 */
  navigatorVisible: Ref<boolean>
  /** 显示 / 隐藏导航图（小地图） */
  setNavigatorVisible: (visible: boolean) => void
  /**
   * 当前是否处于「减弱动效」。
   * 由本模块统一订阅系统设置，宿主复用它即可，无需重复监听 `matchMedia`。
   */
  reducedMotion: Ref<boolean>
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

/* -------------------------------------------------------------------------- */
/* 原生全屏（带 webkit 前缀回退）                                              */
/* -------------------------------------------------------------------------- */

/**
 * 标准全屏 API 已在 `Document` / `HTMLElement` 的 lib 定义里，
 * 这里只补充 Safari 旧版仍在使用的 webkit 前缀成员。
 */
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

type FullscreenTarget = HTMLElement & {
  requestFullscreen?: () => Promise<void>
  webkitRequestFullscreen?: () => void
}

function fullscreenElementOf(doc: FullscreenDocument): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

function requestFullscreenOn(target: FullscreenTarget): void {
  if (typeof target.requestFullscreen === 'function') {
    void target.requestFullscreen().catch(() => {
      /* 用户拒绝（如未授权）或浏览器阻止时静默忽略，状态仍以事件同步为准 */
    })
  } else if (typeof target.webkitRequestFullscreen === 'function') {
    target.webkitRequestFullscreen()
  }
}

function exitNativeFullscreen(doc: FullscreenDocument): void {
  if (typeof doc.exitFullscreen === 'function') {
    void doc.exitFullscreen().catch(() => {
      /* 同上：失败时以 fullscreenchange 事件同步的真实状态为准 */
    })
  } else if (typeof doc.webkitExitFullscreen === 'function') {
    doc.webkitExitFullscreen()
  }
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
  /** 是否正在播放翻页过渡 */
  const transitioning = ref(false)
  /** 右上角导航图（小地图）的期望显示状态；创建实例与重建时都以它为准 */
  const navigatorVisible = ref(options.options().showNavigator !== false)
  /** 系统「减弱动效」设置，运行期可变 */
  const reducedMotion = useReducedMotion()

  /** 已加载瓦片计数，用于估算进度 */
  let loadedTiles = 0
  /** 最近一次 open() 的入参：重建 OSD 实例后用于恢复画面 */
  let lastOpened: { tileSources: ViewerTileSources; options: OpenTileSourcesOptions } | null = null
  /** 缓存的适配方式，供 open 之后应用 */
  let currentFitMode: IiifViewerFitMode = 'contain'
  /** 当前是否处于跨页展开模式，由最近一次 open() 决定 */
  let spreadMode = false
  /** 本轮 open 是否保留视口，由最近一次 open() 决定 */
  let preserveViewportForOpen = false
  /** 新页面就位后的收尾动作（`zoom-swap` 的回弹），一次性 */
  let settleAfterOpen: (() => void) | null = null
  /** 进行中的过渡，用于重入时立即收尾 */
  let activeTransition: { end: () => void; onOpened?: () => void } | null = null
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
   * 按当前「减弱动效」设置改写动效参数。
   *
   * OpenSeadragon 只在创建时读取 `animationTime` / `springStiffness`，并把它们复制进
   * Viewport 的各条弹簧，因此运行期切换需要逐个写入；缺字段时静默跳过，
   * 最坏情况退化为「仅创建时生效」，不影响功能。
   */
  function applyMotionSettings(): void {
    const instance = viewer.value
    if (!instance) return

    const base = options.options()
    const settings = reducedMotion.value
      ? { animationTime: 0, springStiffness: REDUCED_MOTION_SPRING_STIFFNESS }
      : {
          // 尊重使用方通过 osdOptions 覆盖的取值
          animationTime:
            typeof base.animationTime === 'number' ? base.animationTime : DEFAULT_ANIMATION_TIME,
          springStiffness:
            typeof base.springStiffness === 'number'
              ? base.springStiffness
              : DEFAULT_SPRING_STIFFNESS,
        }

    const target = instance as unknown as OsdMotionTarget
    target.animationTime = settings.animationTime
    target.springStiffness = settings.springStiffness

    const viewport = target.viewport
    if (!viewport) return
    viewport.animationTime = settings.animationTime
    viewport.springStiffness = settings.springStiffness
    for (const spring of [
      viewport.centerSpringX,
      viewport.centerSpringY,
      viewport.zoomSpring,
      viewport.degreesSpring,
    ]) {
      if (!spring) continue
      spring.animationTime = settings.animationTime
      spring.springStiffness = settings.springStiffness
    }
  }

  /**
   * 同步导航图（小地图）的可见性。
   *
   * OpenSeadragon 只在创建实例时按 `showNavigator` 生成导航图，且没有提供显隐开关，
   * 因此这里直接控制它的容器元素——比销毁重建便宜，也不会丢失视图状态。
   */
  function applyNavigatorVisibility(): void {
    const navigator = (viewer.value as { navigator?: { element?: unknown } } | null)?.navigator
    const element = navigator?.element as { style?: { display?: string } } | undefined
    if (!element?.style) return
    element.style.display = navigatorVisible.value ? '' : 'none'
  }

  /**
   * 显示 / 隐藏右上角的导航图（小地图）。
   *
   * 注意：实例若按 `showNavigator: false` 创建，OSD 根本没有生成导航图，
   * 此时只能重建实例才能显示——这是 OSD 的限制，重建会回到适配视图。
   */
  function setNavigatorVisible(visible: boolean): void {
    if (navigatorVisible.value === visible) return
    navigatorVisible.value = visible

    const hasNavigator = Boolean((viewer.value as { navigator?: unknown } | null)?.navigator)
    if (!hasNavigator && visible) {
      recreate()
      return
    }
    applyNavigatorVisibility()
  }

  /**
   * 重建 OSD 实例并恢复当前画面。
   *
   * 仅用于「创建时未启用、之后又要启用」的导航图这类 OSD 自身无法热切换的场景。
   */
  function recreate(): void {
    const pending = lastOpened
    destroy()
    create()
    if (pending) open(pending.tileSources, pending.options)
  }

  /**
   * 判断是否为可绘制的画布。
   *
   * 用鸭子类型而不是 `instanceof HTMLCanvasElement`：库需要能在无 DOM 的环境
   * （SSR / 预渲染）中安全降级，直接引用未声明的全局会抛 `ReferenceError`。
   */
  function isDrawableCanvas(value: unknown): value is HTMLCanvasElement {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Partial<HTMLCanvasElement>
    return typeof candidate.getContext === 'function' && typeof candidate.width === 'number'
  }

  /**
   * 取当前真正承载图像像素的画布。
   *
   * 注意 `viewer.canvas` 是 OpenSeadragon 的容器元素（`.openseadragon-canvas`，一个 div），
   * 并不是可绘制源；真正的画布由 drawer 创建在它内部，因此这里从 DOM 中查找。
   * HTML 绘制器下不存在画布，返回 `null` 由调用方降级。
   */
  function resolveRenderedCanvas(): HTMLCanvasElement | null {
    const container = options.containerRef.value
    if (!container || typeof container.querySelector !== 'function') return null

    const found = container.querySelector('canvas')
    if (!isDrawableCanvas(found)) return null
    return found.width > 0 && found.height > 0 ? found : null
  }

  /**
   * 把当前画面固化为覆盖层，供 `fade` 过渡使用。
   *
   * 用 `drawImage` 复制像素而不是 `toDataURL()`：后者要求画布未被跨域污染，
   * 而 `drawImage` 即使在来源被污染时也能正常绘制（本模块从不回读像素）。
   */
  function createSnapshot(): HTMLCanvasElement | null {
    const container = options.containerRef.value
    const source = resolveRenderedCanvas()
    if (!container || !source || typeof document === 'undefined') return null

    const overlay = document.createElement('canvas')
    overlay.className = 'iiif-viewer__snapshot'
    overlay.width = source.width
    overlay.height = source.height
    overlay.setAttribute('aria-hidden', 'true')

    try {
      const context = overlay.getContext('2d')
      if (!context) return null
      context.drawImage(source, 0, 0)
    } catch {
      // 无法取得 2D 上下文时降级为无过渡，不影响换页
      return null
    }

    container.appendChild(overlay)
    return overlay
  }

  /** 结束进行中的过渡（幂等）：清定时器、移出快照、派发结束回调 */
  function finishTransition(): void {
    activeTransition?.end()
  }

  /**
   * 播放一次翻页过渡。
   *
   * 设计约束：
   * 1. 尽力而为——拿不到画布、缺少视口时直接执行 `run()`，绝不阻断换页；
   * 2. 任何路径都必须收尾：定时器、快照元素与结束回调都不能泄漏，
   *    否则会留下残影，或让宿主的过渡态卡住；
   * 3. 重入即中断——连续翻页时上一轮立即收尾，不排队。
   */
  function startTransition(transition: OpenTransitionOptions, run: () => void): void {
    finishTransition()

    const timers = new Set<ReturnType<typeof setTimeout>>()
    let overlay: HTMLCanvasElement | null = null
    let ended = false
    let onOpened: (() => void) | null = null

    const schedule = (delay: number, callback: () => void): void => {
      const handle = setTimeout(() => {
        timers.delete(handle)
        callback()
      }, delay)
      timers.add(handle)
    }

    const end = (): void => {
      if (ended) return
      ended = true
      for (const handle of timers) clearTimeout(handle)
      timers.clear()
      overlay?.remove()
      overlay = null
      if (activeTransition?.end === end) activeTransition = null
      transitioning.value = false
      transition.onEnd?.()
    }

    transitioning.value = true
    transition.onStart?.()
    /**
     * 在 `run()` 之前注册好：`run()` 内部会同步触发 OSD 的 `open` 事件，
     * 过渡的推进依赖那一刻回调到 `onOpened`。
     */
    activeTransition = { end, onOpened: () => onOpened?.() }

    if (transition.preset === 'fade') {
      overlay = createSnapshot()
      /**
       * 新页面就位即开始淡出：快照的不透明度由 1 降到 0，
       * 因此即便新页面的瓦片还在路上，观感也是「旧页缓缓退场」而非硬切。
       */
      const fade = (): void => {
        const element = overlay
        if (!element) {
          // 拿不到画布（如 HTML 绘制器）或画布尚无像素：降级为直接切换
          end()
          return
        }
        /**
         * 注意这里不解除 `overlay` 的引用：淡出期间若发生新的过渡（连续翻页），
         * `end()` 仍需要立即摘掉这一层，否则两层快照会短暂叠加。
         * 元素在淡出结束时被移除，`end()` 的重复移除是安全的空操作。
         */
        element.style.transition = `opacity ${transition.duration}ms ${transition.easing}`
        // 读一次布局属性，确认初始 opacity 已生效，过渡才会真正发生
        void element.offsetWidth
        element.style.opacity = '0'
        schedule(transition.duration + 40, () => {
          element.remove()
          end()
        })
      }
      onOpened = fade
      // 兜底：瓦片源失败时不会触发 open，超时后仍需收尾
      schedule(transition.duration + 800, fade)
      run()
      return
    }

    // zoom-swap：旧页先轻微缩小，内容交换后回弹
    const viewport = viewer.value?.viewport
    const zoom = viewport?.getZoom?.() ?? null
    onOpened = () => schedule(transition.duration, end)
    schedule(transition.duration + 800, end)

    if (!viewport || zoom === null) {
      run()
      return
    }

    settleAfterOpen = () => {
      // 翻页沿用用户当前的缩放；换资源则回到适配视图
      if (preserveViewportForOpen) viewport.zoomTo(zoom)
      else applyFitMode()
    }
    viewport.zoomTo(zoom * ZOOM_SWAP_RATIO)
    schedule(transition.duration, run)
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
    // 保留视口时只同步缩放读数，不再把视图拉回初始位置
    if (preserveViewportForOpen) syncZoom()
    else applyFitMode()
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
      // 过渡的收尾（回弹）优先于常规适配，二者只能生效一个
      const settle = settleAfterOpen
      settleAfterOpen = null
      if (settle) settle()
      else if (preserveViewportForOpen) syncZoom()
      else applyFitMode()

      // 通知进行中的过渡：新画面已就位（`fade` 据此开始淡出快照）
      activeTransition?.onOpened?.()
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
      /**
       * showNavigator 以「期望状态」为准：首次按配置的 showNavigator 取值，
       * 重建时按用户运行期的最新选择，否则重建出来的实例会再次丢失导航图。
       */
      const instance = osd({
        ...options.options(),
        showNavigator: navigatorVisible.value,
        element: container,
      })
      viewer.value = instance
      currentFitMode = options.fitMode?.() ?? 'contain'
      bindEvents(instance)
      // 兜底：某些 OSD 构建可能忽略 showNavigator，这里按期望状态再同步一次
      applyNavigatorVisibility()
      // 以响应式的「减弱动效」状态为准写一次，避免与 options() 取值漂移
      applyMotionSettings()
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
    settleAfterOpen = null
    // 过渡的快照与定时器必须先收回，否则会在宿主容器里留下残影
    finishTransition()
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

    // 新的过渡会立即结束上一轮，避免快照叠加与定时器泄漏
    finishTransition()

    progress.value = 0
    loadedTiles = 0
    clearError()
    // 跨页模式在图片加入 world 之前确定，add-item 回调据此决定是否重新排布
    spreadMode = openOptions.spread === true
    // 同上：'open' 事件里据此决定是否重新适配视口
    preserveViewportForOpen = openOptions.preserveViewport === true
    settleAfterOpen = null
    // 记录入参：重建实例（例如按需启用导航图）后据此恢复画面，且不重放过渡
    lastOpened = {
      tileSources,
      options: {
        spread: openOptions.spread,
        preserveViewport: openOptions.preserveViewport,
      },
    }

    const transition = openOptions.transition
    if (transition && instance.viewport) {
      startTransition(transition, () => doOpen(instance, tileSources))
      return
    }
    doOpen(instance, tileSources)
  }

  function doOpen(instance: OsdViewer, tileSources: ViewerTileSources): void {
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
    /**
     * 全屏目标以组件根元素为准（原生 Fullscreen API）。
     *
     * OSD 自带的 `setFullScreen()` 只把 OSD 容器送进全屏，工具栏 / 状态栏 /
     * 缩略图条都在它的外面——全屏后整套 UI 消失，既无法操作也无法退出。
     */
    const target = options.fullscreenRef?.value as FullscreenTarget | null | undefined
    if (target) {
      const doc = document as FullscreenDocument
      if (fullscreenElementOf(doc) === target) {
        exitNativeFullscreen(doc)
      } else {
        requestFullscreenOn(target)
      }
      return
    }

    // 回退：未提供全屏目标时沿用 OSD 自带全屏（仅 OSD 容器本身）
    const instance = viewer.value
    if (!instance) return
    instance.setFullScreen(!instance.isFullScreen())
  }

  /** 按文档的当前全屏元素回写状态：与目标一致才算全屏（避免多实例互相串状态） */
  function syncFullscreenFromDocument(): void {
    if (typeof document === 'undefined') return
    isFullscreen.value = fullscreenElementOf(document as FullscreenDocument) === options.fullscreenRef?.value
  }

  // 系统「减弱动效」变化时立即改写已创建实例的动效参数
  watch(reducedMotion, applyMotionSettings)

  onMounted(() => {
    // 全屏状态以浏览器事件为准：覆盖工具栏按钮、Esc、F11 等所有退出途径
    document.addEventListener('fullscreenchange', syncFullscreenFromDocument)
    document.addEventListener('webkitfullscreenchange', syncFullscreenFromDocument)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenFromDocument)
    document.removeEventListener('webkitfullscreenchange', syncFullscreenFromDocument)
    // 卸载时若仍停在全屏，主动退出，避免宿主页面留在孤立的全屏状态
    const doc = document as FullscreenDocument
    if (fullscreenElementOf(doc) === options.fullscreenRef?.value) {
      exitNativeFullscreen(doc)
    }
  })

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
    transitioning,
    navigatorVisible,
    setNavigatorVisible,
    reducedMotion,
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
