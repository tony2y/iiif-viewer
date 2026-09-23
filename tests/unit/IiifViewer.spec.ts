import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import IiifViewer from '@/components/IiifViewer.vue'
import type { IiifViewerSource } from '@/types'
import { createOsdMock } from '../mocks/openseadragon'
import { jsonResponse } from '../helpers'

const holder = {
  mock: createOsdMock(),
  options: null as unknown,
}

vi.mock('openseadragon', () => ({
  default: (options: unknown) => {
    holder.options = options
    return holder.mock.viewer
  },
}))

const INFO_V3 = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: 'https://example.org/iiif/image-3',
  type: 'ImageService3',
  profile: 'level2',
  width: 6000,
  height: 4000,
}

const MANIFEST_V3 = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.org/manifest/3',
  type: 'Manifest',
  label: { en: ['Book'], zh: ['图册'] },
  items: [1, 2, 3].map((page) => ({
    id: `https://example.org/canvas/p${page}`,
    type: 'Canvas',
    label: { en: [`Page ${page}`] },
    items: [
      {
        items: [
          {
            body: {
              id: `https://example.org/iiif/image-${page}/full/max/0/default.jpg`,
              type: 'Image',
              service: [{ id: `https://example.org/iiif/image-${page}`, type: 'ImageService3' }],
            },
          },
        ],
      },
    ],
  })),
}

function mountViewer(props: Record<string, unknown> = {}) {
  return mount(IiifViewer, {
    props: {
      source: 'https://example.org/iiif/image-3' as IiifViewerSource,
      locale: 'zh-CN',
      // 显式注入假 OpenSeadragon，覆盖「使用方自带 OSD」的注入路径
      openseadragon: holder.mock.namespace as never,
      ...props,
    },
  })
}

beforeEach(() => {
  holder.mock = createOsdMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('IiifViewer', () => {
  it('加载中渲染加载覆盖层', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )

    const wrapper = mountViewer()

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('正在加载图像')
    // 工具栏层级低于覆盖层，加载中仍可操作
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
  })

  it('加载成功后覆盖层消失，状态栏展示缩放百分比', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer()
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(false))

    // 假 OSD 的 viewportToImageZoom 为 zoom / 2，初始 zoom = 1
    expect(wrapper.text()).toContain('缩放 50%')
  })

  it('加载失败渲染错误覆盖层并派发 load-error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 404)),
    )

    const wrapper = mountViewer()
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))

    expect(wrapper.find('[role="alert"]').text()).toContain('服务端返回错误')
    expect(wrapper.find('[role="alert"]').text()).toContain('HTTP_ERROR')

    const emitted = wrapper.emitted('load-error')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toMatchObject({ code: 'HTTP_ERROR' })
  })

  it('点击重试会重新发起请求', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    // 使用 info.json 地址，每次尝试只产生一次请求，便于断言重试次数
    const wrapper = mountViewer({ source: 'https://example.org/iiif/image-3/info.json' })
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await wrapper.find('button[aria-label="重试"]').trigger('click')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('成功加载后派发 load-success 与 ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer()
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.emitted('load-success')?.[0]?.[0]).toMatchObject({ kind: 'info' })
    expect(wrapper.emitted('load-start')).toBeTruthy()
    expect(wrapper.emitted('ready')?.[0]?.[0]).toBe(holder.mock.viewer)
  })

  it('toolbar 为 false 时不渲染工具栏，showStatusBar 为 false 时不渲染状态栏', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ toolbar: false, showStatusBar: false })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false)
    expect(wrapper.find('.iiif-status').exists()).toBe(false)
  })

  it('工具栏细项开关生效', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ toolbar: { rotate: false, flip: false } })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('button[aria-label="放大"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="向左旋转"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="水平翻转"]').exists()).toBe(false)
  })

  it('切换 locale 后界面文案随之更新', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer()
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())
    expect(wrapper.find('button[aria-label="放大"]').exists()).toBe(true)

    await wrapper.setProps({ locale: 'en-US' })

    expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="放大"]').exists()).toBe(false)
  })

  it('切换 locale 不会重新打开 OSD 资源，也不复位视口', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3' })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())
    expect(holder.mock.open).toHaveBeenCalledTimes(1)

    holder.mock.viewport.goHome.mockClear()
    await wrapper.setProps({ locale: 'en-US' })

    // 文案确实更新了……
    expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBe(true)
    // ……但图像没有重新加载，视口也没有被复位
    expect(holder.mock.open).toHaveBeenCalledTimes(1)
    expect(holder.mock.viewport.goHome).not.toHaveBeenCalled()
  })

  it('翻页与重试仍会重新打开 OSD 资源', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(MANIFEST_V3))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3' })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())
    expect(holder.mock.open).toHaveBeenCalledTimes(1)

    // 翻页：资源确实换了，必须重新 open
    await wrapper.find('button[aria-label="下一页"]').trigger('click')
    expect(holder.mock.open).toHaveBeenCalledTimes(2)

    // 重试：签名未变但加载轮次推进，同样必须重新 open
    const vm = wrapper.vm as unknown as { retry: () => void }
    vm.retry()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(holder.mock.open).toHaveBeenCalledTimes(3))
  })

  it('静态图片（同步加载分支）重试也会重新打开', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const wrapper = mountViewer({ source: 'https://example.org/photo.jpg' })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())
    expect(holder.mock.open).toHaveBeenCalledTimes(1)

    const vm = wrapper.vm as unknown as { retry: () => void }
    vm.retry()

    await vi.waitFor(() => expect(holder.mock.open).toHaveBeenCalledTimes(2))
  })

  it('翻页保留当前视口，换资源才重新适配', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(MANIFEST_V3))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3' })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    // 首个画面需要适配到舞台
    expect(holder.mock.viewport.goHome).toHaveBeenCalled()
    holder.mock.viewport.goHome.mockClear()

    await wrapper.find('button[aria-label="下一页"]').trigger('click')

    expect(holder.mock.open).toHaveBeenCalledTimes(2)
    // 同一份资源内翻页：页面几何一致，保留用户的缩放与平移
    expect(holder.mock.viewport.goHome).not.toHaveBeenCalled()

    // 换资源：版面整体改变，重新适配
    const vm = wrapper.vm as unknown as { open: (source: string) => void }
    vm.open('https://example.org/iiif/other')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(holder.mock.viewport.goHome).toHaveBeenCalled())
  })

  it('pageTransition 开启时渲染快照层并派发过渡事件', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({
      source: 'https://example.org/manifest/3',
      pageTransition: { preset: 'fade', duration: 10 },
    })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('.iiif-viewer').attributes('data-page-transition')).toBe('fade')
    // 第一个画面没有可淡出的旧内容，不应派发过渡事件
    expect(wrapper.emitted('page-transition-start')).toBeUndefined()

    const stage = wrapper.find('.iiif-viewer__stage').element
    await wrapper.find('button[aria-label="下一页"]').trigger('click')

    expect(wrapper.emitted('page-transition-start')?.[0]?.[0]).toEqual({
      from: 0,
      to: 1,
      preset: 'fade',
    })
    expect(stage.querySelector('.iiif-viewer__snapshot')).not.toBeNull()

    await vi.waitFor(() => expect(wrapper.emitted('page-transition-end')).toBeTruthy())
    expect(wrapper.emitted('page-transition-end')?.[0]?.[0]).toEqual({
      from: 0,
      to: 1,
      preset: 'fade',
    })
    expect(stage.querySelector('.iiif-viewer__snapshot')).toBeNull()
  })

  it('未开启 pageTransition 时不做过渡', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3' })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('.iiif-viewer').attributes('data-page-transition')).toBe('none')

    await wrapper.find('button[aria-label="下一页"]').trigger('click')

    expect(wrapper.emitted('page-transition-start')).toBeUndefined()
    expect(wrapper.find('.iiif-viewer__snapshot').exists()).toBe(false)
  })

  it('showNavigator 可在运行期开关右上角导航图', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ showNavigator: true })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(holder.mock.navigator.element.style.display).toBe('')

    await wrapper.setProps({ showNavigator: false })
    expect(holder.mock.navigator.element.style.display).toBe('none')

    await wrapper.setProps({ showNavigator: true })
    expect(holder.mock.navigator.element.style.display).toBe('')

    // 已经生成过导航图，显隐只是改容器样式，不该销毁重建
    expect(holder.mock.namespaceCalls).toHaveLength(1)
    expect(holder.mock.viewer.navigator).toBe(holder.mock.navigator)
  })

  it('创建时关闭导航图后，运行期开启会重建实例并保留开启状态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ showNavigator: false })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(holder.mock.viewer.navigator).toBeUndefined()

    await wrapper.setProps({ showNavigator: true })

    // OSD 不会为已创建的实例补建导航图，只能重建；重建必须以「期望状态」创建
    expect(holder.mock.namespaceCalls).toHaveLength(2)
    expect(holder.mock.namespaceCalls[1]).toMatchObject({ showNavigator: true })
    expect(holder.mock.viewer.navigator).toBe(holder.mock.navigator)
    expect(holder.mock.navigator.element.style.display).toBe('')

    // 回归：重建之后再开关不应再次重建，否则导航图会反复丢失
    await wrapper.setProps({ showNavigator: false })
    await wrapper.setProps({ showNavigator: true })
    expect(holder.mock.namespaceCalls).toHaveLength(2)
    expect(holder.mock.viewer.navigator).toBe(holder.mock.navigator)
  })

  it('暴露 setNavigatorVisible 命令式开关导航图', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer()
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    wrapper.vm.setNavigatorVisible(false)
    await wrapper.vm.$nextTick()
    expect(holder.mock.navigator.element.style.display).toBe('none')

    wrapper.vm.setNavigatorVisible(true)
    await wrapper.vm.$nextTick()
    expect(holder.mock.navigator.element.style.display).toBe('')
    expect(holder.mock.namespaceCalls).toHaveLength(1)
  })

  it('运行期修改 showThumbnails prop 会同步缩略图条展开状态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3', showThumbnails: false })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    await wrapper.setProps({ showThumbnails: true })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    await wrapper.setProps({ showThumbnails: false })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('theme 映射为 data-theme 属性', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ theme: 'light' })
    expect(wrapper.find('.iiif-viewer').attributes('data-theme')).toBe('light')

    await wrapper.setProps({ theme: 'dark' })
    expect(wrapper.find('.iiif-viewer').attributes('data-theme')).toBe('dark')
  })

  it('多画布时显示翻页与缩略图，并派发 page-change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3', showThumbnails: true })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('第 1 / 3 页')

    await wrapper.find('button[aria-label="下一页"]').trigger('click')

    expect(wrapper.emitted('page-change')?.at(-1)?.[0]).toEqual({ index: 1, total: 3 })
    expect(wrapper.text()).toContain('第 2 / 3 页')
  })

  it('单画布时不渲染缩略图与翻页按钮', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ showThumbnails: true })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="下一页"]').exists()).toBe(false)
  })

  it('舞台聚焦后键盘方向键可翻页，未聚焦时不响应', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({ source: 'https://example.org/manifest/3' })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    const stage = wrapper.find('.iiif-viewer__stage')
    await stage.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('page-change')?.at(-1)?.[0]).toEqual({ index: 1, total: 3 })
  })

  it('keyboardShortcuts 为 false 时忽略快捷键', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const wrapper = mountViewer({
      source: 'https://example.org/manifest/3',
      keyboardShortcuts: false,
    })
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    await wrapper.find('.iiif-viewer__stage').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('page-change')).toBeUndefined()
  })

  it('缩放边界与导航图配置会传入 OpenSeadragon', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    mountViewer({ minZoom: 0.3, maxZoom: 8, showNavigator: false })

    expect(holder.mock.namespaceCalls.at(-1)).toMatchObject({
      showNavigationControl: false,
      minZoomImageRatio: 0.3,
      maxZoomPixelRatio: 8,
      showNavigator: false,
    })
  })

  it('osdOptions 透传优先于内部推导', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    mountViewer({ osdOptions: { showNavigator: false, animationTime: 0.2 } })

    expect(holder.mock.namespaceCalls.at(-1)).toMatchObject({
      showNavigator: false,
      animationTime: 0.2,
    })
  })

  it('注入的 OpenSeadragon 不可用时展示 OSD_INIT_FAILED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const wrapper = mountViewer({ openseadragon: (() => undefined) as never })

    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[role="alert"]').text()).toContain('OSD_INIT_FAILED')
    expect(wrapper.emitted('ready')).toBeUndefined()
  })

  it('暴露命令式方法并可切换资源', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(INFO_V3))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountViewer()
    await vi.waitFor(() => expect(wrapper.emitted('load-success')).toBeTruthy())

    const vm = wrapper.vm as unknown as {
      viewer: unknown
      zoomIn: () => void
      getState: () => { zoomPercent: number; total: number }
      open: (source: string) => void
    }

    expect(vm.viewer).toBe(holder.mock.viewer)

    vm.zoomIn()
    expect(holder.mock.viewport.zoomBy).toHaveBeenCalledWith(1.5)

    expect(vm.getState().total).toBe(1)

    vm.open('https://example.org/iiif/other')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('卸载时销毁 OpenSeadragon 并派发 destroy', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )

    const wrapper = mountViewer()
    wrapper.unmount()

    expect(holder.mock.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('destroy')).toBeTruthy()
  })
})
