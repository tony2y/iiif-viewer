import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import {
  DEFAULT_ANIMATION_TIME,
  DEFAULT_SPRING_STIFFNESS,
  REDUCED_MOTION_SPRING_STIFFNESS,
} from '@/core/iiif'
import { ZOOM_SWAP_RATIO, useOpenSeadragon } from '@/composables/useOpenSeadragon'
import type { OpenseadragonNamespace } from '@/types'
import { createOsdMock } from '../mocks/openseadragon'
import { stubMatchMedia, withSetup } from '../helpers'

/**
 * 共享的可变持有者：`vi.mock` 工厂是提升到模块顶部的，
 * 因此不能在工厂内直接读取测试中创建的实例，改为延迟到调用时读取。
 *
 * 注意：被测代码默认会走「注入的 OpenSeadragon」，只有在未注入时才会落到这里的假默认导出；
 * 后者不具备 OSD 的 API 形状，正好用于验证兼容性校验的失败分支。
 */
const holder = {
  mock: createOsdMock(),
}

vi.mock('openseadragon', () => ({
  default: () => holder.mock.viewer,
}))

/** 构造一个不可用的命名空间，用于触发兼容性校验失败 */
function createBrokenNamespace(): OpenseadragonNamespace {
  return ((_options: unknown) => undefined) as unknown as OpenseadragonNamespace
}

function mountOsd(
  fitMode: 'contain' | 'width' | 'height' = 'contain',
  inject = true,
  fullscreenRoot?: HTMLElement,
) {
  const container = document.createElement('div')
  const options = vi.fn(() => ({ showNavigator: true }))

  const { result, app } = withSetup(() =>
    useOpenSeadragon({
      containerRef: ref(container),
      options,
      fitMode: () => fitMode,
      // 提供全屏目标时走原生 Fullscreen API（组件根元素），否则回退 OSD 自带全屏
      ...(fullscreenRoot ? { fullscreenRef: ref(fullscreenRoot) } : {}),
      // 显式注入假命名空间，覆盖「OpenSeadragon 由使用方提供」的主路径
      ...(inject
        ? {
            openseadragon: () => holder.mock.namespace as unknown as OpenseadragonNamespace,
          }
        : {}),
    }),
  )

  return { result, app, options, container, osd: holder.mock }
}

beforeEach(() => {
  holder.mock = createOsdMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useOpenSeadragon', () => {
  it('使用注入的 OpenSeadragon 创建实例并绑定关键事件', () => {
    const { result, options, osd } = mountOsd()

    expect(options).toHaveBeenCalled()
    expect(result.isReady.value).toBe(true)
    expect(result.viewer.value).toBe(osd.viewer)
    expect(result.osdVersion.value).toBe('6.1.1')

    const events = osd.registeredEvents()
    for (const name of [
      'open',
      'open-failed',
      'animation',
      'animation-finish',
      'rotate',
      'flip',
      'full-screen',
      'tile-loaded',
      'fully-loaded-change',
    ]) {
      expect(events, `缺少事件 ${name}`).toContain(name)
    }
  })

  it('注入的命名空间不兼容时写入 OSD_INIT_FAILED，而不是抛异常', () => {
    const container = document.createElement('div')
    const { result } = withSetup(() =>
      useOpenSeadragon({
        containerRef: ref(container),
        options: () => ({}),
        openseadragon: () => createBrokenNamespace(),
      }),
    )

    expect(result.error.value?.code).toBe('OSD_INIT_FAILED')
    expect(result.isReady.value).toBe(false)
    expect(result.viewer.value).toBeNull()
    expect(
      (result.error.value?.details as { missing?: string[] })?.missing?.length,
    ).toBeGreaterThan(0)
  })

  it('open 透传 tileSources 并重置进度', () => {
    const { result, osd } = mountOsd()

    osd.emit('tile-loaded')
    expect(result.progress.value).toBeGreaterThan(0)

    result.open(['https://a.com/info.json'])
    expect(osd.open).toHaveBeenCalledWith(['https://a.com/info.json'])
    expect(result.progress.value).toBe(0)
  })

  it('跨页展开时两页紧贴排布（书脊处无缝隙）', async () => {
    const { result, osd } = mountOsd()

    result.open(['https://a.com/left.json', 'https://a.com/right.json'], { spread: true })
    // 排布被延后一个宏任务执行，等它跑完再断言
    await new Promise((resolve) => setTimeout(resolve, 0))

    const [left, right] = osd.items
    const leftBox = left.getBoundsNoRotate()
    const rightBox = right.getBoundsNoRotate()
    // 两页等高，右页紧贴左页右边缘
    expect(leftBox.height).toBe(rightBox.height)
    expect(right.position.x).toBeCloseTo(left.position.x + leftBox.width)
    expect(osd.viewport.goHome).toHaveBeenCalled()
  })

  it('单页模式不改动图片位置', async () => {
    const { result, osd } = mountOsd()

    result.open(['https://a.com/info.json'])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(osd.items[0].setPosition).not.toHaveBeenCalled()
  })

  it('applyImageFilter 把滤镜写到 OSD 画布容器上，空串表示清除', () => {
    const { result, osd } = mountOsd()
    const canvas = osd.viewer.canvas as HTMLElement

    result.applyImageFilter('brightness(120%) contrast(90%)')
    expect(canvas.style.filter).toBe('brightness(120%) contrast(90%)')

    result.applyImageFilter('')
    expect(canvas.style.filter).toBe('')
  })

  it('clearError 可清除上一轮的错误', () => {
    const { result, osd } = mountOsd()

    osd.emit('open-failed', { message: 'boom' })
    expect(result.error.value).not.toBeNull()

    result.clearError()
    expect(result.error.value).toBeNull()
  })

  it('缩放控制走 viewport 接口', () => {
    const { result, osd } = mountOsd()

    result.zoomIn()
    expect(osd.viewport.zoomBy).toHaveBeenCalledWith(1.5)

    result.zoomOut()
    expect(osd.viewport.zoomBy).toHaveBeenCalledWith(1 / 1.5)

    result.zoomTo(2)
    expect(osd.viewport.zoomTo).toHaveBeenCalledWith(2)
  })

  it('rotate 与 animation-finish 事件回写状态', () => {
    const { result, osd } = mountOsd()

    osd.emit('rotate', { degrees: 450 })
    expect(result.rotation.value).toBe(90)

    osd.emit('rotate', { degrees: -90 })
    expect(result.rotation.value).toBe(270)

    // 假实现的 viewportToImageZoom 为 zoom / 2，zoom 初始为 1
    expect(result.zoomPercent.value).toBe(100)
    osd.emit('animation-finish')
    expect(result.zoomPercent.value).toBe(50)
  })

  it('多图场景改用首张 TiledImage 换算缩放，避免 OSD 的多图告警', () => {
    const { result, osd } = mountOsd()

    const itemZoom = vi.fn((zoom: number) => zoom / 4)
    ;(osd.viewer.world as { getItemAt: unknown }).getItemAt = vi.fn(() => ({
      viewportToImageZoom: itemZoom,
    }))

    osd.emit('animation-finish')

    expect(itemZoom).toHaveBeenCalledWith(1)
    expect(result.zoomPercent.value).toBe(25)
    // 不应回退到 viewport 的换算
    expect(osd.viewport.viewportToImageZoom).not.toHaveBeenCalled()
  })

  it('rotateBy 基于当前角度累加', () => {
    const { result, osd } = mountOsd()

    result.rotateBy(90)
    expect(osd.viewport.rotateTo).toHaveBeenCalledWith(90)

    osd.emit('rotate', { degrees: 90 })
    result.rotateBy(90)
    expect(osd.viewport.rotateTo).toHaveBeenLastCalledWith(180)
  })

  it('flip 与全屏状态随事件同步', () => {
    const { result, osd } = mountOsd()

    result.flipHorizontal()
    expect(osd.viewport.setFlip).toHaveBeenCalledWith(true)
    osd.emit('flip', { flipped: true })
    expect(result.flipped.value).toBe(true)

    result.toggleFullscreen()
    expect(osd.setFullScreen).toHaveBeenCalledWith(true)
    osd.emit('full-screen', { fullScreen: true })
    expect(result.isFullscreen.value).toBe(true)
  })

  it('提供 fullscreenRef 时全屏走原生 API，目标是组件根元素', async () => {
    const root = document.createElement('div')
    const requestFullscreen = vi.fn(() => Promise.resolve())
    const exitFullscreen = vi.fn(() => Promise.resolve())
    ;(root as HTMLElement & { requestFullscreen?: unknown }).requestFullscreen = requestFullscreen
    const doc = document as Document & { fullscreenElement?: Element | null }
    ;(doc as { exitFullscreen?: unknown }).exitFullscreen = exitFullscreen

    const { result, osd } = mountOsd('contain', true, root)

    // 未处于全屏：toggle 应请求进入全屏，而不是调 OSD 的 setFullScreen
    expect(result.isFullscreen.value).toBe(false)
    result.toggleFullscreen()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(osd.setFullScreen).not.toHaveBeenCalled()

    // 浏览器派发 fullscreenchange 后状态同步（工具栏按钮图标据此切换）
    Object.defineProperty(doc, 'fullscreenElement', { configurable: true, value: root })
    doc.dispatchEvent(new Event('fullscreenchange'))
    expect(result.isFullscreen.value).toBe(true)

    // 再次点击退出：应调用 document.exitFullscreen
    result.toggleFullscreen()
    expect(exitFullscreen).toHaveBeenCalledTimes(1)

    Object.defineProperty(doc, 'fullscreenElement', { configurable: true, value: null })
    doc.dispatchEvent(new Event('fullscreenchange'))
    expect(result.isFullscreen.value).toBe(false)
  })

  it('resetHome 复位翻转与旋转并回到初始视图', () => {
    const { result, osd } = mountOsd()

    result.resetHome()

    expect(osd.viewport.setFlip).toHaveBeenCalledWith(false)
    expect(osd.viewport.rotateTo).toHaveBeenCalledWith(0, undefined, true)
    expect(osd.viewport.goHome).toHaveBeenCalled()
  })

  it('fitMode 决定 open 之后的适配方式', () => {
    const width = mountOsd('width')
    width.osd.emit('open')
    expect(width.osd.viewport.fitHorizontally).toHaveBeenCalled()

    const height = mountOsd('height')
    height.osd.emit('open')
    expect(height.osd.viewport.fitVertically).toHaveBeenCalled()
  })

  it('open-failed 写入 HTTP_ERROR 并保留原始信息', () => {
    const { result, osd } = mountOsd()

    osd.emit('open-failed', { message: 'tile source load failed' })

    expect(result.error.value?.code).toBe('HTTP_ERROR')
    expect(result.error.value?.message).toBe('tile source load failed')
  })

  it('fully-loaded-change 把进度置为 100', () => {
    const { result, osd } = mountOsd()

    osd.emit('tile-loaded')
    osd.emit('fully-loaded-change', { fullyLoaded: true })

    expect(result.progress.value).toBe(100)
  })

  it('卸载时销毁实例', () => {
    const { app, osd } = mountOsd()

    app.unmount()

    expect(osd.destroy).toHaveBeenCalledTimes(1)
  })
})

describe('useOpenSeadragon · 视口保留与翻页过渡', () => {
  /** `getContext` 在 jsdom 中不可用，测试里替换为只记录 drawImage 的替身 */
  function stubCanvasContext(): ReturnType<typeof vi.fn> {
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    return drawImage
  }

  function transition(overrides: Record<string, unknown> = {}) {
    return { preset: 'fade' as const, duration: 20, easing: 'linear', ...overrides }
  }

  it('preserveViewport 为 true 时 open 之后不重新适配', () => {
    const { result, osd } = mountOsd()
    osd.viewport.goHome.mockClear()

    result.open(['https://a.com/next.json'], { preserveViewport: true })
    osd.emit('open')

    expect(osd.viewport.goHome).not.toHaveBeenCalled()
  })

  it('默认（换资源）仍在 open 之后重新适配', () => {
    const { result, osd } = mountOsd()
    osd.viewport.goHome.mockClear()

    result.open(['https://a.com/next.json'])
    osd.emit('open')

    expect(osd.viewport.goHome).toHaveBeenCalled()
  })

  it('preserveViewport 与跨页展开同时生效时不改变视口', async () => {
    const { result, osd } = mountOsd('width')
    osd.viewport.fitHorizontally.mockClear()

    result.open(['https://a.com/left.json', 'https://a.com/right.json'], {
      spread: true,
      preserveViewport: true,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 跨页排布仍需重排图片位置，但不应把视图拉回初始状态
    expect(osd.items[1].setPosition).toHaveBeenCalled()
    expect(osd.viewport.fitHorizontally).not.toHaveBeenCalled()
    expect(osd.viewport.goHome).not.toHaveBeenCalled()
  })

  it('fade 过渡：先插入快照层，新画面就位后淡出并移除', async () => {
    const drawImage = stubCanvasContext()
    const { result, osd, container } = mountOsd()
    const onStart = vi.fn()
    const onEnd = vi.fn()

    result.open(['https://a.com/next.json'], {
      transition: transition({ onStart, onEnd }),
    })

    // 快照先于换页插入，因此切换瞬间旧画面仍然可见
    const snapshot = container.querySelector('.iiif-viewer__snapshot') as HTMLCanvasElement
    expect(snapshot).toBeInstanceOf(HTMLCanvasElement)
    expect(drawImage).toHaveBeenCalledWith(osd.tileCanvas, 0, 0)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(result.transitioning.value).toBe(true)

    // 假 OSD 的 open() 会同步派发 open 事件，快照随即开始淡出
    expect(snapshot.style.opacity).toBe('0')

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.iiif-viewer__snapshot')).toBeNull()
    expect(result.transitioning.value).toBe(false)
  })

  it('画布尚无像素时 fade 降级为直接切换，不阻断换页', () => {
    const { result, osd, container } = mountOsd()
    // 宽高为 0 表示画面还没渲染出可复制的像素
    osd.tileCanvas.width = 0
    osd.tileCanvas.height = 0
    const onEnd = vi.fn()

    result.open(['https://a.com/next.json'], { transition: transition({ onEnd }) })

    expect(container.querySelector('.iiif-viewer__snapshot')).toBeNull()
    expect(osd.open).toHaveBeenCalledTimes(1)
    // 降级路径同样必须收尾，否则宿主的过渡态会一直卡住
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('zoom-swap 过渡：旧页先缩小，交换后回弹到原缩放', async () => {
    const { result, osd } = mountOsd()
    osd.viewport.zoomTo.mockClear()
    const onEnd = vi.fn()

    result.open(['https://a.com/next.json'], {
      preserveViewport: true,
      transition: { preset: 'zoom-swap', duration: 10, easing: 'linear', onEnd },
    })

    // 阶段一：按比例缩小（假实现初始 zoom 为 1），此时尚未交换内容
    expect(osd.viewport.zoomTo).toHaveBeenCalledWith(ZOOM_SWAP_RATIO)
    expect(osd.open).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 40))

    // 阶段二：内容交换后回弹到用户原来的缩放
    expect(osd.open).toHaveBeenCalledTimes(1)
    expect(osd.viewport.zoomTo).toHaveBeenLastCalledWith(1)
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
  })

  it('zoom-swap 换资源时回弹到适配视图', async () => {
    const { result, osd } = mountOsd()
    osd.viewport.goHome.mockClear()

    result.open(['https://a.com/other.json'], {
      transition: { preset: 'zoom-swap', duration: 10, easing: 'linear' },
    })
    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(osd.viewport.goHome).toHaveBeenCalled()
  })

  it('连续翻页时上一轮过渡立即收尾，只保留当前快照', async () => {
    stubCanvasContext()
    const { result, container } = mountOsd()
    const firstEnd = vi.fn()
    const secondEnd = vi.fn()

    result.open(['https://a.com/1.json'], { transition: transition({ onEnd: firstEnd }) })
    result.open(['https://a.com/2.json'], { transition: transition({ onEnd: secondEnd }) })

    expect(firstEnd).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('.iiif-viewer__snapshot')).toHaveLength(1)
    expect(result.transitioning.value).toBe(true)

    await vi.waitFor(() => expect(secondEnd).toHaveBeenCalledTimes(1))
    expect(container.querySelectorAll('.iiif-viewer__snapshot')).toHaveLength(0)
    expect(result.transitioning.value).toBe(false)
  })

  it('卸载时清理进行中的过渡与快照', () => {
    stubCanvasContext()
    const { result, app, container } = mountOsd()
    const onEnd = vi.fn()

    result.open(['https://a.com/next.json'], {
      transition: transition({ duration: 500, onEnd }),
    })
    expect(container.querySelector('.iiif-viewer__snapshot')).not.toBeNull()

    app.unmount()

    expect(container.querySelector('.iiif-viewer__snapshot')).toBeNull()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(result.transitioning.value).toBe(false)
  })

  it('运行期切换「减弱动效」会改写已创建实例的动效参数', async () => {
    const media = stubMatchMedia(false)
    const { result, osd } = mountOsd()
    const viewer = osd.viewer as { animationTime?: number; springStiffness?: number }

    // 创建时按 options() 推导：测试用的 options 未声明动效参数，落到库默认值
    expect(viewer.animationTime).toBe(DEFAULT_ANIMATION_TIME)
    expect(viewer.springStiffness).toBe(DEFAULT_SPRING_STIFFNESS)

    media.emit(true)
    await nextTick()

    expect(result.reducedMotion.value).toBe(true)
    expect(viewer.animationTime).toBe(0)
    expect(viewer.springStiffness).toBe(REDUCED_MOTION_SPRING_STIFFNESS)

    // 关闭减弱动效后恢复默认，而不是保留 0
    media.emit(false)
    await nextTick()

    expect(result.reducedMotion.value).toBe(false)
    expect(viewer.animationTime).toBe(DEFAULT_ANIMATION_TIME)
    expect(viewer.springStiffness).toBe(DEFAULT_SPRING_STIFFNESS)
  })
})

describe('useOpenSeadragon · 导航图（小地图）', () => {
  it('隐藏时只置 display: none，不销毁实例', () => {
    const { result, osd } = mountOsd()

    expect(result.navigatorVisible.value).toBe(true)

    result.setNavigatorVisible(false)

    expect(result.navigatorVisible.value).toBe(false)
    expect(osd.navigator.element.style.display).toBe('none')
    // 直接显隐元素：视图状态与已加载瓦片都不会丢失
    expect(osd.destroy).not.toHaveBeenCalled()
  })

  it('再次显示时恢复元素，且不重建实例', () => {
    const { result, osd } = mountOsd()

    result.setNavigatorVisible(false)
    result.setNavigatorVisible(true)

    expect(osd.navigator.element.style.display).toBe('')
    // 实例仍是创建时的那一个
    expect(osd.namespaceCalls).toHaveLength(1)
  })

  it('创建时未启用、之后再开启：重建实例并恢复画面', () => {
    const container = document.createElement('div')
    const osd = createOsdMock()
    const { result } = withSetup(() =>
      useOpenSeadragon({
        containerRef: ref(container),
        options: () => ({ showNavigator: false }),
        openseadragon: () => osd.namespace as unknown as OpenseadragonNamespace,
      }),
    )

    // OSD 没有生成导航图
    expect(result.navigatorVisible.value).toBe(false)
    result.open(['https://a.com/info.json'])

    result.setNavigatorVisible(true)

    // 应重建实例（OSD 自身无法在实例创建后再生成导航图）
    expect(osd.namespaceCalls).toHaveLength(2)
    expect(result.navigatorVisible.value).toBe(true)
    // 重建后恢复之前的画面
    expect(osd.open).toHaveBeenLastCalledWith(['https://a.com/info.json'])
    expect(osd.destroy).toHaveBeenCalledTimes(1)
  })
})
