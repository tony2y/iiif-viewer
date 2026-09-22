/**
 * 可控的 OpenSeadragon 假实现。
 *
 * 使用方式：
 * ```ts
 * import { createOsdMock } from '../mocks/openseadragon'
 * const holder = { mock: createOsdMock() }
 * vi.mock('openseadragon', () => ({ default: () => holder.mock.viewer }))
 * ```
 *
 * 由于本库支持「OpenSeadragon 由使用方提供」，测试通常把
 * `holder.mock.namespace` 通过 `openseadragon` Prop / 注入项传入，
 * 这样既能覆盖注入主路径，也能用 `namespaceCalls` 断言传给 OSD 的配置。
 */
import { vi } from 'vitest'

type EventHandler = (event: Record<string, unknown>) => void

export interface OsdMockViewport {
  zoomBy: ReturnType<typeof vi.fn>
  zoomTo: ReturnType<typeof vi.fn>
  getZoom: ReturnType<typeof vi.fn>
  viewportToImageZoom: ReturnType<typeof vi.fn>
  getRotation: ReturnType<typeof vi.fn>
  rotateTo: ReturnType<typeof vi.fn>
  setFlip: ReturnType<typeof vi.fn>
  getFlip: ReturnType<typeof vi.fn>
  goHome: ReturnType<typeof vi.fn>
  fitHorizontally: ReturnType<typeof vi.fn>
  fitVertically: ReturnType<typeof vi.fn>
  applyConstraints: ReturnType<typeof vi.fn>
}

/** 假 TiledImage：只保留跨页排布用到的接口 */
export interface OsdMockItem {
  /** 世界坐标下的宽度 */
  width: number
  /** 世界坐标下的高度 */
  height: number
  /** 最近一次 setPosition 设置的位置 */
  position: { x: number; y: number }
  setPosition: ReturnType<typeof vi.fn>
  setWidth: ReturnType<typeof vi.fn>
  /** 世界坐标下的包围盒（含左上角坐标） */
  getBoundsNoRotate: () => {
    width: number
    height: number
    getTopLeft: () => { x: number; y: number }
  }
  viewportToImageZoom: ReturnType<typeof vi.fn>
}

export interface OsdMock {
  /** 传给被测代码的假 Viewer 实例 */
  viewer: Record<string, unknown>
  /**
   * 满足 `verifyOpenSeadragon()` 校验的假 OpenSeadragon 命名空间。
   * 测试通过 `openseadragon` Prop / 注入项传入，用于覆盖「使用方自带 OSD」的场景。
   */
  namespace: Record<string, unknown>
  /** 每次调用命名空间（即创建 Viewer）时传入的 options 记录 */
  namespaceCalls: unknown[]
  /** 手动触发 OSD 事件 */
  emit: (event: string, payload?: Record<string, unknown>) => void
  /** 已注册的事件名 */
  registeredEvents: () => string[]
  /** 当前 world 中的假图片 */
  items: OsdMockItem[]
  open: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  setFullScreen: ReturnType<typeof vi.fn>
  viewport: OsdMockViewport
}

export interface OsdMockOptions {
  /** `open()` 时加入 world 的假图片尺寸（世界坐标，默认 700×1000 的竖版书页） */
  pageSize?: { width: number; height: number }
}

/**
 * 构造一个仅保留「被兼容性校验检查的 API 形状」的 OSD 命名空间：
 * 默认导出可被调用，并挂载 `version` / `Viewer` / `Viewport` 及其原型方法。
 */
function buildNamespace(
  getViewer: () => unknown,
  onCall?: (options: unknown) => void,
): Record<string, unknown> {
  const noop = () => undefined

  const Viewer = function ViewerStub() {} as unknown as { prototype: Record<string, unknown> }
  Viewer.prototype = { open: noop, destroy: noop, addHandler: noop }

  const Viewport = function ViewportStub() {} as unknown as { prototype: Record<string, unknown> }
  Viewport.prototype = {
    rotateTo: noop,
    setFlip: noop,
    viewportToImageZoom: noop,
    fitHorizontally: noop,
    fitVertically: noop,
  }

  const namespace = ((options: unknown) => {
    onCall?.(options)
    return getViewer()
  }) as unknown as Record<string, unknown>

  namespace.version = { versionStr: '6.1.1', major: 6, minor: 1, revision: 1 }
  namespace.Viewer = Viewer
  namespace.Viewport = Viewport
  return namespace
}

export function createOsdMock(mockOptions: OsdMockOptions = {}): OsdMock {
  const handlers = new Map<string, EventHandler[]>()
  const worldHandlers = new Map<string, EventHandler[]>()
  const state = { zoom: 1, rotation: 0, flip: false, fullScreen: false }
  const namespaceCalls: unknown[] = []
  const items: OsdMockItem[] = []
  const pageSize = mockOptions.pageSize ?? { width: 700, height: 1000 }
  /** 高 / 宽，setWidth 时用它保持宽高比（与真实 TiledImage 一致） */
  const pageRatio = pageSize.height / pageSize.width

  function createItem(): OsdMockItem {
    const item = {
      width: pageSize.width,
      height: pageSize.height,
      position: { x: 0, y: 0 },
      setPosition: vi.fn((position: { x: number; y: number }) => {
        item.position = { x: position.x, y: position.y }
      }),
      setWidth: vi.fn((width: number) => {
        item.width = width
        item.height = width * pageRatio
      }),
      getBoundsNoRotate: vi.fn(() => ({
        width: item.width,
        height: item.height,
        getTopLeft: () => ({ ...item.position }),
      })),
      // 与 viewport 的换算保持一致：视口缩放与图像像素比 1:2
      viewportToImageZoom: vi.fn((zoom: number) => zoom / 2),
    } as OsdMockItem
    return item
  }

  const viewport = {
    zoomBy: vi.fn((factor: number) => {
      state.zoom *= factor
      return viewport
    }),
    zoomTo: vi.fn((zoom: number) => {
      state.zoom = zoom
      return viewport
    }),
    getZoom: vi.fn(() => state.zoom),
    // 视口缩放与图像像素比按 1:2 换算，便于断言缩放百分比
    viewportToImageZoom: vi.fn((zoom: number) => zoom / 2),
    getRotation: vi.fn(() => state.rotation),
    rotateTo: vi.fn((degrees: number) => {
      state.rotation = degrees
      return viewport
    }),
    setFlip: vi.fn((value: boolean) => {
      state.flip = value
      return viewport
    }),
    getFlip: vi.fn(() => state.flip),
    goHome: vi.fn(() => viewport),
    fitHorizontally: vi.fn(() => viewport),
    fitVertically: vi.fn(() => viewport),
    applyConstraints: vi.fn(() => viewport),
  } as unknown as OsdMockViewport

  /**
   * 真实 OSD 会在瓦片源就绪后异步把图片加入 world 并派发 world 的 `add-item`，
   * 这里同步模拟「逐张加入 + 派发 open」，便于断言 open 之后的适配与排布行为。
   */
  const open = vi.fn((tileSources?: unknown) => {
    const count = Array.isArray(tileSources) ? tileSources.length : 1
    items.length = 0
    for (let index = 0; index < count; index += 1) {
      const item = createItem()
      items.push(item)
      emitWorld('add-item', { item })
    }
    emit('open')
    return viewer
  })
  const destroy = vi.fn()
  const setFullScreen = vi.fn((value: boolean) => {
    state.fullScreen = value
    return viewer
  })

  const world: Record<string, unknown> = {
    getItemCount: vi.fn(() => items.length),
    getItemAt: vi.fn((index: number) => items[index]),
    setAutoRefigureSizes: vi.fn(),
    addHandler: vi.fn((event: string, handler: EventHandler) => {
      const list = worldHandlers.get(event) ?? []
      list.push(handler)
      worldHandlers.set(event, list)
      return true
    }),
  }

  const viewer: Record<string, unknown> = {
    viewport,
    // OSD 会把 .openseadragon-canvas 容器暴露为 viewer.canvas，色彩滤镜就作用在它上面
    canvas: document.createElement('div'),
    open,
    destroy,
    setFullScreen,
    isFullScreen: vi.fn(() => state.fullScreen),
    addHandler: vi.fn((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
      return true
    }),
    forceRedraw: vi.fn(() => viewer),
    world,
  }

  function emit(event: string, payload: Record<string, unknown> = {}): void {
    for (const handler of handlers.get(event) ?? []) {
      handler({ eventSource: viewer, ...payload })
    }
  }

  function emitWorld(event: string, payload: Record<string, unknown> = {}): void {
    for (const handler of worldHandlers.get(event) ?? []) {
      handler({ eventSource: world, ...payload })
    }
  }

  return {
    viewer,
    namespace: buildNamespace(
      () => viewer,
      (options) => namespaceCalls.push(options),
    ),
    namespaceCalls,
    emit,
    registeredEvents: () => [...handlers.keys()],
    items,
    open,
    destroy,
    setFullScreen,
    viewport,
  }
}
