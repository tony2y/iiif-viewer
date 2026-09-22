import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useOpenSeadragon } from '../../src/composables/useOpenSeadragon'
import type { OpenseadragonNamespace } from '../../src/types/viewer'
import { createOsdMock } from '../mocks/openseadragon'
import { withSetup } from '../helpers'

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

function mountOsd(fitMode: 'contain' | 'width' | 'height' = 'contain', inject = true) {
  const container = document.createElement('div')
  const options = vi.fn(() => ({ showNavigator: true }))

  const { result, app } = withSetup(() =>
    useOpenSeadragon({
      containerRef: ref(container),
      options,
      fitMode: () => fitMode,
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
