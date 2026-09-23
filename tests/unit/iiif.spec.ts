import { afterEach, describe, expect, it, vi } from 'vitest'

import { IiifViewerError } from '@/core/errors'
import {
  DEFAULT_ANIMATION_TIME,
  DEFAULT_SPRING_STIFFNESS,
  REDUCED_MOTION_SPRING_STIFFNESS,
  createOsdOptions,
  detectResourceKind,
  fetchJson,
  getIiifDocument,
  getImageInfo,
  getManifest,
  imageServiceToTileSource,
  isManifestPayload,
  parseImageInfo,
  parseManifest,
  parseMetadata,
  pickImageUrl,
  pickLabel,
  resolveMotionSettings,
  tileSourceKey,
  toTileSource,
} from '@/core/iiif'
import { resolvePageTransitionOptions } from '@/types'
import { jsonResponse } from '../helpers'

/** Image API 3.0 的 info.json 片段 */
const INFO_V3 = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: 'https://example.org/iiif/image-3',
  type: 'ImageService3',
  protocol: 'http://iiif.io/api/image',
  profile: 'level2',
  width: 6000,
  height: 4000,
  tiles: [{ width: 512, scaleFactors: [1, 2, 4] }],
  extraFormats: ['jpg', 'png'],
}

/** Image API 2.1 的 info.json 片段 */
const INFO_V2 = {
  '@context': 'http://iiif.io/api/image/2/context.json',
  '@id': 'https://example.org/iiif/image-2',
  protocol: 'http://iiif.io/api/image',
  profile: ['http://iiif.io/api/image/2/level1.json', { formats: ['jpg'] }],
  width: 1200,
  height: 800,
  sizes: [{ width: 600, height: 400 }],
}

/** Presentation API 3.0 的 manifest 片段（含 2 个画布） */
const MANIFEST_V3 = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.org/manifest/3',
  type: 'Manifest',
  label: { en: ['An example book'], zh: ['示例图册'] },
  summary: { en: ['A short description'] },
  rights: 'http://creativecommons.org/licenses/by/4.0/',
  provider: [{ id: 'https://example.org', type: 'Agent', label: { en: ['Example Library'] } }],
  metadata: [{ label: { en: ['Date'] }, value: { none: ['1888'] } }],
  thumbnail: [{ id: 'https://example.org/thumb.jpg', type: 'Image' }],
  items: [
    {
      id: 'https://example.org/canvas/p1',
      type: 'Canvas',
      label: { none: ['Front cover'] },
      width: 1200,
      height: 800,
      thumbnail: [{ id: 'https://example.org/canvas/p1/thumb.jpg', type: 'Image' }],
      items: [
        {
          id: 'https://example.org/canvas/p1/1',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/canvas/p1/1/1',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.org/iiif/image-3/full/max/0/default.jpg',
                type: 'Image',
                service: [
                  {
                    id: 'https://example.org/iiif/image-3',
                    type: 'ImageService3',
                    profile: 'level2',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'https://example.org/canvas/p2',
      type: 'Canvas',
      width: 1200,
      height: 800,
      items: [
        {
          items: [
            {
              body: {
                id: 'https://example.org/iiif/image-4/full/max/0/default.jpg',
                type: 'Image',
                service: [{ id: 'https://example.org/iiif/image-4', type: 'ImageService3' }],
              },
            },
          ],
        },
      ],
    },
  ],
}

/** Presentation API 2.1 的 manifest 片段 */
const MANIFEST_V2 = {
  '@context': 'http://iiif.io/api/presentation/2/context.json',
  '@id': 'https://example.org/manifest/2',
  '@type': 'sc:Manifest',
  label: 'Self-Portrait',
  metadata: [
    { label: 'Date', value: '1888' },
    { label: 'Medium', value: ['Oil on canvas'] },
  ],
  thumbnail: {
    '@id': 'https://example.org/thumb2.jpg',
    service: {
      '@id': 'https://example.org/iiif/image-2',
      profile: 'http://iiif.io/api/image/2/level2.json',
    },
  },
  sequences: [
    {
      '@type': 'sc:Sequence',
      canvases: [
        {
          '@id': 'https://example.org/canvas/v2-1',
          '@type': 'sc:Canvas',
          label: 'Page 1',
          width: 1200,
          height: 800,
          images: [
            {
              '@type': 'oa:Annotation',
              resource: {
                '@id': 'https://example.org/iiif/image-2/full/full/0/default.jpg',
                '@type': 'dctypes:Image',
                service: {
                  '@id': 'https://example.org/iiif/image-2',
                  profile: 'http://iiif.io/api/image/2/level1.json',
                },
              },
            },
          ],
        },
      ],
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('core/iiif · detectResourceKind', () => {
  it('识别 info.json 地址', () => {
    expect(detectResourceKind('https://a.com/iiif/id/info.json')).toEqual({
      kind: 'info',
      url: 'https://a.com/iiif/id/info.json',
    })
  })

  it('识别 manifest 地址', () => {
    expect(detectResourceKind('https://a.com/x/manifest.json').kind).toBe('manifest')
  })

  it('识别静态图片地址', () => {
    expect(detectResourceKind('https://a.com/a.jpg').kind).toBe('image')
  })

  it('无法判断时按 Image API 服务基址处理', () => {
    expect(detectResourceKind('https://a.com/iiif/id').kind).toBe('info')
  })

  it('显式 sourceType 覆盖启发式判断', () => {
    expect(detectResourceKind('https://a.com/thing', 'manifest').kind).toBe('manifest')
  })

  it('对象或非空数组视为 tile-source', () => {
    expect(detectResourceKind({ type: 'iiif', url: 'x' }).kind).toBe('tile-source')
    expect(detectResourceKind([{ type: 'iiif', url: 'x' }]).kind).toBe('tile-source')
  })

  it('空字符串与空数组抛出 INVALID_SOURCE', () => {
    expect(() => detectResourceKind('  ')).toThrow(IiifViewerError)
    expect(() => detectResourceKind([])).toThrow(/source is an empty array/)
  })
})

describe('core/iiif · 语言映射工具', () => {
  it('pickLabel 按 locale → none → en 顺序取值', () => {
    const map = { none: ['无语言'], en: ['English'], zh: ['中文'] }
    expect(pickLabel(map, 'zh-CN')).toBe('中文')
    expect(pickLabel(map, 'fr-FR')).toBe('无语言')
    expect(pickLabel('plain', 'zh-CN')).toBe('plain')
  })

  it('pickLabel 对字符串数组做连接', () => {
    expect(pickLabel(['a', 'b'])).toBe('a, b')
  })

  it('pickLabel 对不可识别输入返回空串', () => {
    expect(pickLabel(null)).toBe('')
    expect(pickLabel(42)).toBe('')
  })

  it('parseMetadata 兼容 v2 字符串与 v3 语言映射', () => {
    expect(
      parseMetadata(
        [
          { label: 'Date', value: ['1888', '1889'] },
          { label: { en: ['Medium'] }, value: { none: ['Oil on canvas'] } },
        ],
        'en-US',
      ),
    ).toEqual([
      { label: 'Date', value: '1888; 1889' },
      { label: 'Medium', value: 'Oil on canvas' },
    ])
  })

  it('pickImageUrl 支持字符串 / 数组 / 对象三种形态', () => {
    expect(pickImageUrl('https://a.com/t.jpg')).toBe('https://a.com/t.jpg')
    expect(pickImageUrl([{ id: 'https://a.com/t2.jpg' }])).toBe('https://a.com/t2.jpg')
    expect(pickImageUrl({ '@id': 'https://a.com/t3.jpg' })).toBe('https://a.com/t3.jpg')
    expect(pickImageUrl(undefined)).toBeUndefined()
  })
})

describe('core/iiif · parseImageInfo', () => {
  it('解析 Image API 3 并归一化 profile', () => {
    const info = parseImageInfo(INFO_V3, 'https://example.org/iiif/image-3/info.json')

    expect(info.version).toBe(3)
    expect(info.profile).toBe('level2')
    expect(info.id).toBe('https://example.org/iiif/image-3')
    expect(info.width).toBe(6000)
    expect(info.supportsRotation).toBe(true)
    // 分片 height 缺省时与 width 相同
    expect(info.tiles[0]).toEqual({ width: 512, height: 512, scaleFactors: [1, 2, 4] })
    expect(info.extraFormats).toEqual(['jpg', 'png'])
  })

  it('解析 Image API 2 并从 profile 数组中提取等级', () => {
    const info = parseImageInfo(INFO_V2, 'https://example.org/iiif/image-2/info.json')

    expect(info.version).toBe(2)
    expect(info.profile).toBe('level1')
    expect(info.id).toBe('https://example.org/iiif/image-2')
    expect(info.sizes).toEqual([{ width: 600, height: 400 }])
    // 无 tiles 字段时归一化为空数组
    expect(info.tiles).toEqual([])
  })

  it('level0 标记为不支持旋转', () => {
    const info = parseImageInfo(
      { ...INFO_V3, profile: 'level0' },
      'https://example.org/iiif/image-3/info.json',
    )
    expect(info.supportsRotation).toBe(false)
  })

  it('缺少 width / height 时抛出 INVALID_IIIF_INFO', () => {
    expect(() => parseImageInfo({ ...INFO_V3, width: undefined }, 'x')).toThrow(
      /missing a valid width\/height/,
    )
  })

  it('无法识别版本时抛出 UNSUPPORTED_VERSION', () => {
    expect(() => parseImageInfo({ foo: 'bar' }, 'x')).toThrow(/Unable to determine/)
  })

  it('非对象入参抛出 INVALID_IIIF_INFO', () => {
    expect(() => parseImageInfo('nope', 'x')).toThrow(/not an object/)
  })
})

describe('core/iiif · parseManifest', () => {
  it('解析 Presentation 3 并归一化画布', () => {
    const manifest = parseManifest(MANIFEST_V3, 'https://example.org/manifest/3', 'zh-CN')

    expect(manifest.version).toBe(3)
    expect(manifest.label).toBe('示例图册')
    // v3 的简介来自 `summary`
    expect(manifest.description).toBe('A short description')
    expect(manifest.rights).toContain('creativecommons')
    expect(manifest.provider).toBe('Example Library')
    expect(manifest.thumbnailUrl).toBe('https://example.org/thumb.jpg')
    expect(manifest.metadata).toEqual([{ label: 'Date', value: '1888' }])
    expect(manifest.canvases).toHaveLength(2)

    const [first, second] = manifest.canvases
    expect(first?.label).toBe('Front cover')
    expect(first?.serviceId).toBe('https://example.org/iiif/image-3')
    expect(first?.infoJsonUrl).toBe('https://example.org/iiif/image-3/info.json')
    expect(first?.thumbnailUrl).toBe('https://example.org/canvas/p1/thumb.jpg')
    // 无 label 的画布回退为 Canvas N
    expect(second?.label).toBe('Canvas 2')
  })

  it('解析 Presentation 2 并归一化画布', () => {
    const manifest = parseManifest(MANIFEST_V2, 'https://example.org/manifest/2', 'en-US')

    expect(manifest.version).toBe(2)
    expect(manifest.label).toBe('Self-Portrait')
    expect(manifest.canvases).toHaveLength(1)
    expect(manifest.canvases[0]?.serviceId).toBe('https://example.org/iiif/image-2')
    expect(manifest.metadata).toEqual([
      { label: 'Date', value: '1888' },
      { label: 'Medium', value: 'Oil on canvas' },
    ])
  })

  it('@context 同时含 search 与 presentation 时仍识别为 v3', () => {
    const manifest = parseManifest(
      {
        ...MANIFEST_V3,
        '@context': [
          'http://iiif.io/api/search/1/context.json',
          'http://iiif.io/api/presentation/3/context.json',
        ],
      },
      'https://example.org/manifest/3',
    )
    expect(manifest.version).toBe(3)
  })

  it('无可渲染画布时抛出 NO_CANVAS', () => {
    expect(() => parseManifest({ ...MANIFEST_V3, items: [] }, 'x')).toThrow(/no renderable canvas/)
  })

  it('Collection 明确拒绝而非渲染出错误结果', () => {
    expect(() =>
      parseManifest(
        {
          '@context': 'http://iiif.io/api/presentation/3/context.json',
          id: 'https://example.org/collection/1',
          type: 'Collection',
          items: [{ id: 'https://example.org/manifest/1', type: 'Manifest' }],
        },
        'x',
      ),
    ).toThrow(/Collection is not supported/)
  })

  it('非对象入参抛出 INVALID_MANIFEST', () => {
    expect(() => parseManifest(null, 'x')).toThrow(/not an object/)
  })
})

describe('core/iiif · isManifestPayload', () => {
  it.each([
    [MANIFEST_V3, true],
    [MANIFEST_V2, true],
    [INFO_V3, false],
    [INFO_V2, false],
    [null, false],
    ['str', false],
  ])('按内容判定 %#', (payload, expected) => {
    expect(isManifestPayload(payload)).toBe(expected)
  })

  it('仅凭 v3 @context 即可判定', () => {
    expect(
      isManifestPayload({ '@context': 'http://iiif.io/api/presentation/3/context.json' }),
    ).toBe(true)
  })
})

describe('core/iiif · getIiifDocument', () => {
  it('info.json 返回 image 载荷时判定为 info', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(INFO_V3)),
    )

    const document = await getIiifDocument('https://example.org/iiif/image-3')

    expect(document.kind).toBe('info')
    expect(document.url).toBe('https://example.org/iiif/image-3/info.json')
    expect(document.imageInfo?.width).toBe(6000)
  })

  it('info.json 地址实际返回 manifest 时改按 manifest 解析', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(MANIFEST_V3)),
    )

    const document = await getIiifDocument('https://example.org/iiif/thing')

    expect(document.kind).toBe('manifest')
    expect(document.manifest?.canvases).toHaveLength(2)
  })

  it('service 基址的 info.json 为 404 时，回退请求原始地址并按内容判定', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/info.json') ? jsonResponse({}, 404) : jsonResponse(MANIFEST_V3),
    )
    vi.stubGlobal('fetch', fetchMock)

    // 形如部分机构的 /presentation/{id}，URL 中不含 manifest 字样
    const document = await getIiifDocument('https://example.org/presentation/b18035723')

    expect(document.kind).toBe('manifest')
    expect(document.url).toBe('https://example.org/presentation/b18035723')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('显式声明 kind 为 manifest 时只请求一次', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(MANIFEST_V3))
    vi.stubGlobal('fetch', fetchMock)

    const document = await getIiifDocument('https://example.org/x', { kind: 'manifest' })

    expect(document.kind).toBe('manifest')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://example.org/x', expect.anything())
  })

  it('原地址已是 info.json 时不重复回退', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getIiifDocument('https://example.org/iiif/id/info.json')).rejects.toMatchObject({
      code: 'HTTP_ERROR',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('主动取消时不再回退，直接抛出 AbortError', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = getIiifDocument('https://example.org/iiif/thing', { signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('core/iiif · tileSource 转换', () => {
  // OpenSeadragon 不识别 { type: 'iiif', url }，IIIF 必须传 info.json 地址字符串
  it('有 Image API 服务时返回 info.json 地址字符串', () => {
    expect(
      toTileSource({
        id: 'c1',
        label: 'c1',
        serviceId: 's',
        infoJsonUrl: 'https://a.com/i/info.json',
      }),
    ).toBe('https://a.com/i/info.json')
  })

  it('仅有静态图时生成 OSD 支持的 image 内联配置', () => {
    expect(toTileSource({ id: 'c1', label: 'c1', imageUrl: 'https://a.com/a.jpg' })).toEqual({
      type: 'image',
      url: 'https://a.com/a.jpg',
    })
  })

  it('两者都没有时抛出 NO_CANVAS', () => {
    expect(() => toTileSource({ id: 'c1', label: 'c1' })).toThrow(/no renderable image/)
  })

  it('imageServiceToTileSource 返回补全后的 info.json 地址字符串', () => {
    expect(imageServiceToTileSource('https://a.com/iiif/id')).toBe(
      'https://a.com/iiif/id/info.json',
    )
  })
})

describe('core/iiif · tileSourceKey', () => {
  it('内容相同的不同数组得到相同签名', () => {
    const first = ['https://a.com/1/info.json', 'https://a.com/2/info.json']
    const second = [...first]

    expect(second).not.toBe(first)
    expect(tileSourceKey(second)).toBe(tileSourceKey(first))
  })

  it('换页后签名随之变化', () => {
    expect(tileSourceKey(['https://a.com/2/info.json'])).not.toBe(
      tileSourceKey(['https://a.com/1/info.json']),
    )
  })

  it('空列表得到空签名', () => {
    expect(tileSourceKey([])).toBe('')
  })

  it('顺序参与签名，双页左右互换视为不同资源', () => {
    expect(tileSourceKey(['a', 'b'])).not.toBe(tileSourceKey(['b', 'a']))
  })

  it('内联 tileSource 按配置快照比较', () => {
    const key = tileSourceKey([{ type: 'image', url: 'https://a.com/a.jpg' }])

    expect(tileSourceKey([{ type: 'image', url: 'https://a.com/a.jpg' }])).toBe(key)
    // 地址相同但配置不同 → 必须视为新资源，不能跳过 open
    expect(
      tileSourceKey([{ type: 'image', url: 'https://a.com/a.jpg', buildPyramid: true }]),
    ).not.toBe(key)
  })

  it('无法序列化的内联对象回退为字符串描述且不抛错', () => {
    const circular: Record<string, unknown> = { type: 'image', url: 'https://a.com/a.jpg' }
    circular.self = circular

    expect(() => tileSourceKey([circular as never])).not.toThrow()
    expect(tileSourceKey([circular as never])).toContain('tile-source:')
  })
})

describe('core/iiif · fetchJson', () => {
  it('非 2xx 抛出 HTTP_ERROR 并携带状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' })),
    )

    await expect(fetchJson('https://a.com/x')).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      details: { status: 404 },
    })
  })

  it('网络异常抛出 NETWORK_ERROR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(fetchJson('https://a.com/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('超时抛出 TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )

    await expect(fetchJson('https://a.com/x', { timeout: 5 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    })
  })

  it('外部取消时原样抛出 AbortError，便于调用方静默忽略', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )

    const promise = fetchJson('https://a.com/x', { signal: controller.signal, timeout: 1000 })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('成功时返回解析后的 JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: 1 })),
    )

    await expect(fetchJson('https://a.com/x')).resolves.toEqual({ ok: 1 })
  })
})

describe('core/iiif · getImageInfo / getManifest', () => {
  it('getImageInfo 会自动补全 info.json', async () => {
    const fetchMock = vi.fn(async () => Response.json(INFO_V2))
    vi.stubGlobal('fetch', fetchMock)

    const info = await getImageInfo('https://example.org/iiif/image-2')

    expect(info.version).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.org/iiif/image-2/info.json',
      expect.anything(),
    )
  })

  it('getManifest 透传 locale 并归一化标签', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(MANIFEST_V3)),
    )

    const manifest = await getManifest('https://example.org/manifest/3', { locale: 'zh-CN' })

    expect(manifest.label).toBe('示例图册')
  })
})

describe('core/iiif · createOsdOptions', () => {
  it('关闭 OSD 自带控件并映射缩放边界', () => {
    const options = createOsdOptions({ minZoom: 0.4, maxZoom: 12, showNavigator: false })

    expect(options.showNavigationControl).toBe(false)
    expect(options.showZoomControl).toBe(false)
    expect(options.showFullPageControl).toBe(false)
    expect(options.keyboardNavEnabled).toBe(false)
    expect(options.minZoomImageRatio).toBe(0.4)
    expect(options.maxZoomPixelRatio).toBe(12)
    expect(options.showNavigator).toBe(false)
  })

  it('用户配置优先级最高，且嵌套对象做一层深合并', () => {
    const options = createOsdOptions({
      showNavigator: true,
      osdOptions: {
        showNavigationControl: true,
        gestureSettingsMouse: { clickToZoom: true },
      },
    })

    expect(options.showNavigationControl).toBe(true)
    // 用户只覆盖 clickToZoom，其余鼠标手势配置应保留
    expect(options.gestureSettingsMouse?.clickToZoom).toBe(true)
    expect(options.gestureSettingsMouse?.scrollToZoom).toBe(true)
  })

  it('默认保留视口，翻页不会被 OSD 拉回初始视图', () => {
    expect(createOsdOptions().preserveViewport).toBe(true)
  })

  it('默认动效参数比 OSD 原生更跟手，减弱动效时归零', () => {
    const normal = createOsdOptions({ reducedMotion: false })
    expect(normal.animationTime).toBe(DEFAULT_ANIMATION_TIME)
    expect(normal.springStiffness).toBe(DEFAULT_SPRING_STIFFNESS)

    const reduced = createOsdOptions({ reducedMotion: true })
    expect(reduced.animationTime).toBe(0)
    expect(reduced.springStiffness).toBe(REDUCED_MOTION_SPRING_STIFFNESS)
  })

  it('resolveMotionSettings 与 createOsdOptions 取值一致', () => {
    expect(resolveMotionSettings(false)).toEqual({
      animationTime: DEFAULT_ANIMATION_TIME,
      springStiffness: DEFAULT_SPRING_STIFFNESS,
    })
    expect(resolveMotionSettings(true)).toEqual({
      animationTime: 0,
      springStiffness: REDUCED_MOTION_SPRING_STIFFNESS,
    })

    const options = createOsdOptions({ reducedMotion: true })
    expect(options.animationTime).toBe(resolveMotionSettings(true).animationTime)
    expect(options.springStiffness).toBe(resolveMotionSettings(true).springStiffness)
  })
})

describe('types/viewer · resolvePageTransitionOptions', () => {
  it('默认不启用过渡', () => {
    expect(resolvePageTransitionOptions(undefined)).toBeNull()
    expect(resolvePageTransitionOptions(false)).toBeNull()
    expect(resolvePageTransitionOptions('none')).toBeNull()
  })

  it('true 等价于默认预设，字符串按预设名解析', () => {
    expect(resolvePageTransitionOptions(true)).toMatchObject({ preset: 'fade' })
    expect(resolvePageTransitionOptions('zoom-swap')).toMatchObject({
      preset: 'zoom-swap',
      duration: 260,
    })
  })

  it('细项配置与默认值合并，duration 取非负整数', () => {
    expect(
      resolvePageTransitionOptions({ preset: 'fade', duration: 120, easing: 'linear' }),
    ).toEqual({
      preset: 'fade',
      duration: 120,
      easing: 'linear',
    })
    // 非法 duration 回退默认值
    expect(resolvePageTransitionOptions({ preset: 'fade', duration: Number.NaN })?.duration).toBe(
      260,
    )
    // 负数按 0 处理，0 表示不做过渡
    expect(resolvePageTransitionOptions({ preset: 'fade', duration: -100 })).toBeNull()
  })

  it('减弱动效时自动降级，可用 respectReducedMotion 覆盖', () => {
    expect(resolvePageTransitionOptions('fade', true)).toBeNull()
    expect(
      resolvePageTransitionOptions({ preset: 'fade', respectReducedMotion: false }, true),
    ).toMatchObject({ preset: 'fade' })
    // 未开启减弱动效时不受影响
    expect(resolvePageTransitionOptions('fade', false)).toMatchObject({ preset: 'fade' })
  })
})
