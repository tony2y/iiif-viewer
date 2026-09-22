import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useIiifSource } from '../../src/composables/useIiifSource'
import type { IiifViewerSource, IiifViewerSourceType } from '../../src/types/viewer'
import { jsonResponse, withSetup } from '../helpers'

const INFO_V3 = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: 'https://example.org/iiif/image-3',
  type: 'ImageService3',
  profile: 'level2',
  width: 6000,
  height: 4000,
}

/** 生成指定页数的 v3 manifest，用于验证单页 / 双页的翻页边界 */
function makeManifest(pageCount: number) {
  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: 'https://example.org/manifest/3',
    type: 'Manifest',
    label: { en: ['Book'] },
    items: Array.from({ length: pageCount }, (_, index) => {
      const page = index + 1
      return {
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
                  service: [
                    { id: `https://example.org/iiif/image-${page}`, type: 'ImageService3' },
                  ],
                },
              },
            ],
          },
        ],
      }
    }),
  }
}

const MANIFEST_V3 = makeManifest(3)

function mountSource(
  initial: IiifViewerSource,
  sourceType: IiifViewerSourceType = 'auto',
  options: { initialDoublePage?: boolean } = {},
) {
  const source = ref<IiifViewerSource>(initial)
  const type = ref<IiifViewerSourceType>(sourceType)
  const onLoaded = vi.fn()
  const onError = vi.fn()

  const { result, app } = withSetup(() =>
    useIiifSource({
      source: () => source.value,
      sourceType: () => type.value,
      locale: () => 'en-US',
      timeout: () => 1000,
      initialDoublePage: () => options.initialDoublePage ?? false,
      onLoaded,
      onError,
    }),
  )

  return { source, type, result, app, onLoaded, onError }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useIiifSource', () => {
  it('加载 info.json 后进入 ready，并推导出 iiif tileSource', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const { result, onLoaded } = mountSource('https://example.org/iiif/image-3')

    await vi.waitFor(() => expect(result.status.value).toBe('ready'))
    expect(result.kind.value).toBe('info')
    expect(result.imageInfo.value?.width).toBe(6000)
    expect(result.total.value).toBe(1)
    expect(result.tileSources.value).toEqual(['https://example.org/iiif/image-3/info.json'])
    expect(onLoaded).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }))
  })

  it('加载 manifest 后给出全部画布与首屏 tileSource', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const { result } = mountSource('https://example.org/manifest/3')

    await vi.waitFor(() => expect(result.status.value).toBe('ready'))
    expect(result.kind.value).toBe('manifest')
    expect(result.total.value).toBe(3)
    expect(result.currentIndex.value).toBe(0)
    expect(result.canGoPrev.value).toBe(false)
    expect(result.canGoNext.value).toBe(true)
    expect(result.currentCanvas.value?.label).toBe('Page 1')
    expect(result.tileSources.value).toEqual(['https://example.org/iiif/image-1/info.json'])
  })

  it('HTTP 404 进入 error 并回调 onError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 404)),
    )

    const { result, onError } = mountSource('https://example.org/iiif/missing')

    await vi.waitFor(() => expect(result.status.value).toBe('error'))
    expect(result.error.value?.code).toBe('HTTP_ERROR')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'HTTP_ERROR' }))
  })

  it('结构非法的 info.json 进入 error 且错误码为 INVALID_IIIF_INFO', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ hello: 'world' })),
    )

    const { result } = mountSource('https://example.org/iiif/broken')

    await vi.waitFor(() => expect(result.status.value).toBe('error'))
    expect(result.error.value?.code).toBe('UNSUPPORTED_VERSION')
  })

  it('传入现成的 tileSource 数组时不发起网络请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = mountSource(['https://example.org/i/info.json'])

    await vi.waitFor(() => expect(result.status.value).toBe('ready'))
    expect(result.kind.value).toBe('tile-source')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('静态图片地址直接生成 image tileSource', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const { result } = mountSource('https://example.org/photo.jpg')

    await vi.waitFor(() => expect(result.status.value).toBe('ready'))
    expect(result.tileSources.value).toEqual([
      { type: 'image', url: 'https://example.org/photo.jpg' },
    ])
  })

  it('goTo / prev / next 在边界处不越界', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const { result } = mountSource('https://example.org/manifest/3')
    await vi.waitFor(() => expect(result.status.value).toBe('ready'))

    result.goTo(2)
    expect(result.currentIndex.value).toBe(2)
    expect(result.canGoNext.value).toBe(false)
    expect(result.tileSources.value).toEqual(['https://example.org/iiif/image-3/info.json'])

    // 越界与重复跳转都不生效
    result.goTo(99)
    result.goTo(-1)
    expect(result.currentIndex.value).toBe(2)

    result.next()
    expect(result.currentIndex.value).toBe(2)

    result.prev()
    expect(result.currentIndex.value).toBe(1)
    expect(result.canGoPrev.value).toBe(true)
  })

  it('retry 会重新发起请求', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(INFO_V3))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = mountSource('https://example.org/iiif/image-3')
    await vi.waitFor(() => expect(result.status.value).toBe('ready'))

    result.retry()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('切换 source 时取消旧请求且不产生错误', async () => {
    const controllers: AbortController[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            const controller = { signal: init?.signal } as AbortController
            controllers.push(controller)
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
            // 首个请求永不主动完成，用于验证被取消
            if (controllers.length > 1) resolve(jsonResponse(INFO_V3))
          }),
      ),
    )

    const { source, result, onError } = mountSource('https://example.org/iiif/first')
    expect(result.status.value).toBe('loading')

    source.value = 'https://example.org/iiif/second'
    await vi.waitFor(() => expect(result.status.value).toBe('ready'))

    expect(controllers.length).toBe(2)
    expect(controllers[0]?.signal?.aborted).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('useIiifSource · 双页展开', () => {
  const MANIFEST_URL = 'https://example.org/manifest/3'

  async function mountLoadedManifest(initialDoublePage: boolean) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )
    const mounted = mountSource(MANIFEST_URL, 'auto', { initialDoublePage })
    await vi.waitFor(() => expect(mounted.result.status.value).toBe('ready'))
    return mounted
  }

  it('initialDoublePage 为 true 时从第一跨页开始，一次给出两个 tileSource', async () => {
    const { result } = await mountLoadedManifest(true)

    expect(result.doublePage.value).toBe(true)
    expect(result.spreadStart.value).toBe(0)
    expect(result.visibleIndexes.value).toEqual([0, 1])
    expect(result.secondaryIndex.value).toBe(1)
    expect(result.tileSources.value).toEqual([
      'https://example.org/iiif/image-1/info.json',
      'https://example.org/iiif/image-2/info.json',
    ])
  })

  it('默认单页，一次只给出一个 tileSource', async () => {
    const { result } = await mountLoadedManifest(false)

    expect(result.doublePage.value).toBe(false)
    expect(result.visibleIndexes.value).toEqual([0])
    expect(result.secondaryIndex.value).toBeUndefined()
    expect(result.tileSources.value).toEqual(['https://example.org/iiif/image-1/info.json'])
  })

  it('切换到双页时把当前页吸附到跨页起点', async () => {
    const { result } = await mountLoadedManifest(false)

    result.goTo(2)
    expect(result.currentIndex.value).toBe(2)

    // 翻到奇数页后再开启双页
    result.next()
    expect(result.currentIndex.value).toBe(2)

    result.goTo(1)
    result.setDoublePage(true)

    expect(result.currentIndex.value).toBe(0)
    expect(result.spreadStart.value).toBe(0)
  })

  it('双页模式下翻页步进为 2，并在最后一跨页后停止', async () => {
    const { result } = await mountLoadedManifest(true)

    result.next()
    expect(result.currentIndex.value).toBe(2)
    // 3 页文档：第 3 页单独构成最后一跨页，其后没有更多跨页
    expect(result.visibleIndexes.value).toEqual([2])
    expect(result.canGoNext.value).toBe(false)

    result.prev()
    expect(result.currentIndex.value).toBe(0)
    expect(result.canGoPrev.value).toBe(false)
  })

  it('页面足够多时双页模式可以继续向后翻', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(makeManifest(5))),
    )
    const { result } = mountSource(MANIFEST_URL, 'auto', { initialDoublePage: true })
    await vi.waitFor(() => expect(result.status.value).toBe('ready'))

    expect(result.canGoNext.value).toBe(true)
    result.next()
    expect(result.currentIndex.value).toBe(2)
    expect(result.visibleIndexes.value).toEqual([2, 3])
    expect(result.canGoNext.value).toBe(true)

    result.next()
    expect(result.currentIndex.value).toBe(4)
    expect(result.visibleIndexes.value).toEqual([4])
    expect(result.canGoNext.value).toBe(false)
  })

  it('双页模式下 goTo 会吸附到偶数下标', async () => {
    const { result } = await mountLoadedManifest(true)

    result.goTo(1)
    expect(result.currentIndex.value).toBe(0)

    result.goTo(2)
    expect(result.currentIndex.value).toBe(2)
  })

  it('关闭双页后回到单页展示', async () => {
    const { result } = await mountLoadedManifest(true)

    result.setDoublePage(false)

    expect(result.doublePage.value).toBe(false)
    expect(result.visibleIndexes.value).toEqual([0])
    expect(result.secondaryIndex.value).toBeUndefined()
  })

  it('单画布资源即使开启双页也只给一个 tileSource', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )
    const { result } = mountSource('https://example.org/iiif/image-3', 'auto', {
      initialDoublePage: true,
    })
    await vi.waitFor(() => expect(result.status.value).toBe('ready'))

    expect(result.doublePage.value).toBe(true)
    expect(result.visibleIndexes.value).toEqual([0])
    expect(result.tileSources.value).toHaveLength(1)
  })

  it('toggleDoublePage 在两种模式间切换', async () => {
    const { result } = await mountLoadedManifest(false)

    result.toggleDoublePage()
    expect(result.doublePage.value).toBe(true)

    result.toggleDoublePage()
    expect(result.doublePage.value).toBe(false)
  })
})
