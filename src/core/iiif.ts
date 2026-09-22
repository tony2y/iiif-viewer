/**
 * IIIF 能力层：输入识别、资源拉取、结构归一化与 OpenSeadragon 配置推导。
 *
 * 设计原则：
 * 1. 全部为可独立测试的纯函数（网络请求通过 `fetchJson` 收口，便于 mock）；
 * 2. 同时兼容 Image API 2.x / 3.x 与 Presentation API 2.1 / 3.0；
 * 3. 所有失败路径抛出带稳定错误码的 `IiifViewerError`。
 */
import type { Options as OsdOptions } from 'openseadragon'

import type {
  IiifCanvas,
  IiifImageApiVersion,
  IiifImageInfo,
  IiifImageProfile,
  IiifLanguageMap,
  IiifManifest,
  IiifMetadataEntry,
  IiifResourceRef,
  IiifStructure,
  IiifViewerTileSource,
  RawAnnotation,
  RawBody,
  RawCanvas,
  RawImageInfo,
  RawManifest,
  RawMetadataEntry,
  RawService,
  RawStructure,
} from '@/types/iiif'
import type { IiifViewerSource, IiifViewerSourceType } from '@/types/viewer'
import { IiifViewerError } from './errors'
import {
  ensureInfoJsonUrl,
  isImageFileUrl,
  isInfoJsonUrl,
  isLikelyManifestUrl,
  stripTrailingSlash,
} from './url'

/** 默认请求超时（毫秒） */
export const DEFAULT_TIMEOUT = 15_000

/** 一次 JSON 请求的配置 */
export interface FetchJsonOptions {
  /** 外部取消信号；触发后本次请求的异常会被原样抛出，由调用方静默忽略 */
  signal?: AbortSignal
  /** 超时毫秒数，默认 {@link DEFAULT_TIMEOUT} */
  timeout?: number
}

/** 判断异常是否来自请求取消 */
export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/* -------------------------------------------------------------------------- */
/* 输入识别                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 识别输入资源的语义类型。
 *
 * @param source 用户传入的 source
 * @param explicitType 用户显式指定的类型，`'auto'` 时走启发式判断
 */
export function detectResourceKind(
  source: IiifViewerSource,
  explicitType: IiifViewerSourceType = 'auto',
): IiifResourceRef {
  // 对象 / 数组：直接交给 OpenSeadragon 作为 tileSource 使用
  if (typeof source !== 'string') {
    if (Array.isArray(source) && source.length === 0) {
      throw new IiifViewerError('INVALID_SOURCE', 'source is an empty array', source)
    }
    return { kind: 'tile-source', url: '' }
  }

  const url = source.trim()
  if (!url) {
    throw new IiifViewerError('INVALID_SOURCE', 'source is an empty string', source)
  }

  if (explicitType !== 'auto') {
    return { kind: explicitType, url }
  }
  if (isInfoJsonUrl(url)) return { kind: 'info', url }
  if (isLikelyManifestUrl(url)) return { kind: 'manifest', url }
  if (isImageFileUrl(url)) return { kind: 'image', url }
  // 兜底：按 Image API 服务基址处理，后续自动补 `/info.json`
  return { kind: 'info', url }
}

/* -------------------------------------------------------------------------- */
/* 网络请求                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 拉取并解析 JSON。
 * 把超时 / 非 2xx / 网络异常统一映射为 `IiifViewerError`。
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { signal, timeout = DEFAULT_TIMEOUT } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, */*;q=0.8' },
      credentials: 'same-origin',
    })
    if (!response.ok) {
      throw new IiifViewerError(
        'HTTP_ERROR',
        `Request failed with status ${response.status} for ${url}`,
        { status: response.status, statusText: response.statusText, url },
      )
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof IiifViewerError) throw error
    if (isAbortError(error)) {
      // 外部主动取消：原样抛出，让调用方静默忽略
      if (signal?.aborted) throw error
      throw new IiifViewerError('TIMEOUT', `Request timed out after ${timeout}ms: ${url}`, {
        url,
        timeout,
      })
    }
    throw new IiifViewerError('NETWORK_ERROR', `Failed to fetch ${url}`, { url, cause: error })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

/* -------------------------------------------------------------------------- */
/* 语言映射工具                                                                */
/* -------------------------------------------------------------------------- */

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** 把 `@context` 规整为字符串数组 */
export function normalizeContext(context: RawManifest['@context']): string[] {
  return toArray(context).map((item) =>
    typeof item === 'string'
      ? item
      : typeof item === 'object' && item !== null
        ? JSON.stringify(item)
        : String(item),
  )
}

/**
 * 从语言映射中取值。
 * 优先级：locale → `none` → `en` → `zh` → 首个非空值。
 */
export function pickLabel(value: unknown, locale = 'en'): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return (value as string[]).join(', ')
  }
  if (!isPlainObject(value)) return ''

  const map = value as IiifLanguageMap
  const candidates = [locale, locale.split('-')[0]!, 'none', 'en', 'zh']
  for (const key of candidates) {
    const entry = map[key]
    if (entry?.length) return entry.join(', ')
  }
  for (const entry of Object.values(map)) {
    if (entry?.length) return entry.join(', ')
  }
  return ''
}

/** 归一化 metadata 为 `{ label, value }[]`（兼容 v2 字符串数组与 v3 语言映射） */
export function parseMetadata(
  entries: RawMetadataEntry[] | undefined,
  locale = 'en',
): IiifMetadataEntry[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => ({
      label: pickLabel(entry.label, locale),
      value: toArray(entry.value)
        .map((item) => pickLabel(item, locale))
        .filter(Boolean)
        .join('; '),
    }))
    .filter((entry) => entry.label || entry.value)
}

/** 从 thumbnail 字段（v3 数组 / v2 对象 / 字符串）中提取图片地址 */
export function pickImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = pickImageUrl(item)
      if (url) return url
    }
    return undefined
  }
  if (isPlainObject(value)) {
    const candidate = value.id ?? value['@id']
    if (typeof candidate === 'string') return candidate
  }
  return undefined
}

/* -------------------------------------------------------------------------- */
/* Image API                                                                   */
/* -------------------------------------------------------------------------- */

/** 从 profile 字符串 / 数组中解析合规等级 */
function parseProfile(profile: RawImageInfo['profile']): IiifImageProfile {
  const raw = Array.isArray(profile)
    ? profile.map((item) => String(item)).join(' ')
    : String(profile ?? '')
  const match = /level(\d)/i.exec(raw)
  if (!match) return 'unknown'
  const level = Number(match[1])
  return level === 0 || level === 1 || level === 2
    ? (`level${level}` as IiifImageProfile)
    : 'unknown'
}

/** 判定 Image API 版本；无法识别时返回 `0` */
function detectImageApiVersion(info: RawImageInfo, context: string[]): IiifImageApiVersion | 0 {
  const haystack = `${context.join(' ')} ${info.type ?? ''} ${typeof info.profile === 'string' ? info.profile : ''}`
  if (/image\/3\/context\.json|ImageService3/i.test(haystack)) return 3
  if (
    /image\/2\/context\.json|image\/2\/(level\d)|ImageService2/i.test(haystack) ||
    info.protocol === 'http://iiif.io/api/image'
  ) {
    return 2
  }
  return 0
}

/**
 * 归一化 `info.json`。
 *
 * @throws IiifViewerError `INVALID_IIIF_INFO` / `UNSUPPORTED_VERSION`
 */
export function parseImageInfo(raw: unknown, sourceUrl: string): IiifImageInfo {
  if (!isPlainObject(raw)) {
    throw new IiifViewerError('INVALID_IIIF_INFO', 'info.json payload is not an object', raw)
  }
  const info = raw as RawImageInfo
  const context = normalizeContext(info['@context'])
  const version = detectImageApiVersion(info, context)
  if (!version) {
    throw new IiifViewerError(
      'UNSUPPORTED_VERSION',
      'Unable to determine the IIIF Image API version of this resource.',
      { url: sourceUrl, context },
    )
  }

  const width = Number(info.width)
  const height = Number(info.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new IiifViewerError('INVALID_IIIF_INFO', 'info.json is missing a valid width/height', {
      url: sourceUrl,
      width: info.width,
      height: info.height,
    })
  }

  const id = info['@id'] ?? info.id ?? stripTrailingSlash(sourceUrl.replace(/\/info\.json$/i, ''))
  const profile = parseProfile(info.profile)

  return {
    id,
    version,
    profile,
    width,
    height,
    sizes: Array.isArray(info.sizes)
      ? info.sizes
          .filter(
            (size) => Number.isFinite(Number(size?.width)) && Number.isFinite(Number(size?.height)),
          )
          .map((size) => ({ width: Number(size.width), height: Number(size.height) }))
      : [],
    tiles: Array.isArray(info.tiles)
      ? info.tiles
          .filter((tile) => Number.isFinite(Number(tile?.width)))
          .map((tile) => {
            const tileWidth = Number(tile.width)
            return {
              width: tileWidth,
              // IIIF 分片默认为正方形，height 缺省时与 width 相同
              height: Number.isFinite(Number(tile.height)) ? Number(tile.height) : tileWidth,
              scaleFactors: Array.isArray(tile.scaleFactors)
                ? tile.scaleFactors.map(Number).filter((value) => value > 0)
                : [1],
            }
          })
      : [],
    extraFormats: Array.isArray(info.extraFormats) ? info.extraFormats.map(String) : [],
    supportsRotation: profile === 'unknown' ? true : profile !== 'level0',
    raw: info,
  }
}

/** 拉取并归一化 `info.json` */
export async function getImageInfo(
  url: string,
  options: FetchJsonOptions = {},
): Promise<IiifImageInfo> {
  const infoUrl = ensureInfoJsonUrl(url)
  const raw = await fetchJson(infoUrl, options)
  return parseImageInfo(raw, infoUrl)
}

/* -------------------------------------------------------------------------- */
/* Presentation API                                                           */
/* -------------------------------------------------------------------------- */

/** 从 canvas 的 body 中解析 Image API service 基址 */
function pickServiceId(body: RawBody | undefined): string | undefined {
  const services = toArray(body?.service) as RawService[]
  for (const service of services) {
    const id = service?.id ?? service?.['@id']
    if (typeof id === 'string' && id) return id
  }
  return undefined
}

function buildCanvas(canvas: RawCanvas, index: number, locale: string): IiifCanvas {
  const id = String(canvas.id ?? canvas['@id'] ?? `canvas-${index + 1}`)
  const label = pickLabel(canvas.label, locale) || `Canvas ${index + 1}`

  // v3：canvas.items[0].items[0].body；v2：canvas.images[0].resource
  const v3Annotation: RawAnnotation | undefined = canvas.items?.[0]?.items?.[0]
  const v2Annotation: RawAnnotation | undefined = canvas.images?.[0]
  const body = v3Annotation?.body ?? v2Annotation?.resource ?? v2Annotation?.body
  const singleBody = Array.isArray(body) ? body[0] : body

  const serviceId = pickServiceId(singleBody)
  const imageUrl = singleBody?.id ?? singleBody?.['@id']

  return {
    id,
    label,
    width: Number.isFinite(Number(canvas.width)) ? Number(canvas.width) : undefined,
    height: Number.isFinite(Number(canvas.height)) ? Number(canvas.height) : undefined,
    serviceId,
    infoJsonUrl: serviceId ? ensureInfoJsonUrl(serviceId) : undefined,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    thumbnailUrl: pickImageUrl(canvas.thumbnail),
  }
}

/** 判定 Presentation API 版本 */
function detectPresentationVersion(manifest: RawManifest, context: string[]): 2 | 3 | 0 {
  const haystack = `${context.join(' ')} ${toArray(manifest.type).join(' ')}`
  if (/presentation\/3|Manifest/i.test(haystack) && !manifest.sequences) return 3
  if (/presentation\/2/i.test(haystack) || manifest.sequences) return 2
  if (Array.isArray(manifest.items)) return 3
  return 0
}

/** 提取 manifests 中的 canvases（兼容 v2 `sequences` 与 v3 `items`） */
function extractCanvasList(manifest: RawManifest, version: 2 | 3): RawCanvas[] {
  if (version === 3) {
    return toArray(manifest.items).filter(isPlainObject) as RawCanvas[]
  }
  const sequence = manifest.sequences?.[0]
  return toArray(sequence?.canvases).filter(isPlainObject) as RawCanvas[]
}

/** 提取 provider / 提供机构名称 */
function pickProvider(manifest: RawManifest, locale: string): string | undefined {
  const provider = toArray(manifest.provider)[0]
  if (isPlainObject(provider)) {
    const label = pickLabel(provider.label, locale)
    if (label) return label
  }
  const attribution = pickLabel(manifest.attribution, locale)
  return attribution || undefined
}

/* -------------------------------------------------------------------------- */
/* 目录（structures / Range）                                                  */
/* -------------------------------------------------------------------------- */

/** 解析过程中的中间节点：先把 id 引用记录下来，再组装成树 */
interface StructureDraft {
  id: string
  label: string
  canvasIds: string[]
  childIds: string[]
}

/** 从 `items` 中拆出子 Range 与子 Canvas（v3）；入参保持宽松，逐项做类型收窄 */
function splitV3Items(items: unknown): { ranges: string[]; canvases: string[] } {
  const ranges: string[] = []
  const canvases: string[] = []
  for (const item of toArray(items)) {
    if (!isPlainObject(item)) continue
    const id = item.id ?? item['@id']
    if (typeof id !== 'string' || !id) continue
    const type = typeof item.type === 'string' ? item.type : ''
    if (/canvas/i.test(type)) canvases.push(id)
    else ranges.push(id)
  }
  return { ranges, canvases }
}

/**
 * 归一化 `structures` 为目录树。
 *
 * - v3：`structures` 是扁平数组，层级通过 `items` 中的 id 引用表达；
 * - v2：`structures` 同样是扁平数组，层级通过 `ranges` / `canvases` 的 id 列表表达。
 *
 * 未被任何父节点引用的节点作为根节点，保持原始顺序。
 *
 * @param structures 原始 `structures`
 * @param canvases 归一化后的画布列表，用于把画布 id 映射为下标
 * @param locale 语言标记，用于提取标签
 */
export function parseStructures(
  structures: RawStructure[] | undefined,
  canvases: IiifCanvas[],
  locale = 'en',
): IiifStructure[] {
  const list = (toArray(structures) as RawStructure[]).filter(isPlainObject)
  if (list.length === 0) return []

  const canvasIdToIndex = new Map<string, number>()
  canvases.forEach((canvas, index) => canvasIdToIndex.set(canvas.id, index))

  const drafts = new Map<string, StructureDraft>()
  for (const raw of list) {
    const id = String(raw.id ?? raw['@id'] ?? '')
    if (!id) continue
    const v3 = splitV3Items(raw.items)
    drafts.set(id, {
      id,
      label: pickLabel(raw.label, locale),
      canvasIds: [...toArray(raw.canvases).map(String), ...v3.canvases],
      childIds: [...toArray(raw.ranges).map(String), ...v3.ranges],
    })
  }
  if (drafts.size === 0) return []

  /** 递归组装，同时用 visiting 集合防止环形引用导致死循环 */
  const build = (id: string, visiting: Set<string>): IiifStructure | undefined => {
    const draft = drafts.get(id)
    if (!draft || visiting.has(id)) return undefined
    const nextVisiting = new Set(visiting).add(id)

    const canvasIndexes = draft.canvasIds
      .map((canvasId) => canvasIdToIndex.get(canvasId))
      .filter((index): index is number => index !== undefined)
      .sort((a, b) => a - b)

    const children = draft.childIds
      .map((childId) => build(childId, nextVisiting))
      .filter((child): child is IiifStructure => child !== undefined)

    return {
      id: draft.id,
      label: draft.label || `Range ${draft.id}`,
      canvasIndexes,
      children,
    }
  }

  const referenced = new Set<string>()
  for (const draft of drafts.values()) {
    for (const childId of draft.childIds) referenced.add(childId)
  }

  const roots = [...drafts.keys()].filter((id) => !referenced.has(id))
  return roots
    .map((id) => build(id, new Set<string>()))
    .filter((node): node is IiifStructure => node !== undefined)
}

/**
 * 取目录节点（含子孙）覆盖的第一个画布下标，用于点击目录项时定位。
 * 无任何画布时返回 `undefined`。
 */
export function findFirstCanvasIndex(structure: IiifStructure): number | undefined {
  if (structure.canvasIndexes.length > 0) return structure.canvasIndexes[0]
  for (const child of structure.children) {
    const index = findFirstCanvasIndex(child)
    if (index !== undefined) return index
  }
  return undefined
}

/**
 * 归一化 `manifest.json`。
 *
 * 说明：完全没有图像资源的画布（既无 Image API service 也无图片 id）会被过滤掉，
 * 以免后续生成 tileSource 时抛错；过滤后再参与 `structures` 的下标映射，二者始终一致。
 *
 * @throws IiifViewerError `INVALID_MANIFEST` / `NO_CANVAS` / `UNSUPPORTED_VERSION`
 */
export function parseManifest(raw: unknown, sourceUrl: string, locale = 'en'): IiifManifest {
  if (!isPlainObject(raw)) {
    throw new IiifViewerError('INVALID_MANIFEST', 'manifest payload is not an object', raw)
  }
  const manifest = raw as RawManifest

  // Collection 的 items 是子 manifest 而非画布，直接渲染会得到错误结果，这里明确拒绝
  if (toArray(manifest.type).some((type) => typeof type === 'string' && /collection/i.test(type))) {
    throw new IiifViewerError(
      'UNSUPPORTED_VERSION',
      'IIIF Collection is not supported. Please pass a Manifest URL instead.',
      { url: sourceUrl, type: manifest.type },
    )
  }

  const context = normalizeContext(manifest['@context'])
  const version = detectPresentationVersion(manifest, context)
  if (!version) {
    throw new IiifViewerError(
      'UNSUPPORTED_VERSION',
      'Unable to determine the IIIF Presentation API version of this manifest.',
      { url: sourceUrl, context },
    )
  }

  const canvases = extractCanvasList(manifest, version)
    .map((canvas, index) => buildCanvas(canvas, index, locale))
    .filter((canvas) => Boolean(canvas.infoJsonUrl || canvas.imageUrl))
  if (canvases.length === 0) {
    throw new IiifViewerError('NO_CANVAS', 'The manifest contains no renderable canvas.', {
      url: sourceUrl,
      version,
    })
  }

  return {
    id: String(manifest.id ?? manifest['@id'] ?? sourceUrl),
    version,
    label: pickLabel(manifest.label, locale) || 'IIIF Manifest',
    // v3 用 `summary` 表达简介，v2 用 `description`
    description: pickLabel(manifest.summary ?? manifest.description, locale) || undefined,
    metadata: parseMetadata(manifest.metadata, locale),
    rights: manifest.rights ?? manifest.license ?? undefined,
    provider: pickProvider(manifest, locale),
    thumbnailUrl: pickImageUrl(manifest.thumbnail),
    canvases,
    structures: parseStructures(manifest.structures, canvases, locale),
    raw: manifest,
  }
}

/** 拉取并归一化 `manifest.json` */
export async function getManifest(
  url: string,
  options: FetchJsonOptions & { locale?: string } = {},
): Promise<IiifManifest> {
  const { locale = 'en', ...fetchOptions } = options
  const raw = await fetchJson(url, fetchOptions)
  return parseManifest(raw, url, locale)
}

/* -------------------------------------------------------------------------- */
/* 资源文档自动识别                                                             */
/* -------------------------------------------------------------------------- */

/** 一些机构把 manifest 挂在无 `manifest` 字样的地址上（如 `/presentation/{id}`），需要按内容判定 */
export function isManifestPayload(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false
  const context = normalizeContext(raw['@context'] as RawManifest['@context'])
  if (/presentation\/\d/i.test(context.join(' '))) return true
  if (typeof raw.type === 'string' && /manifest|collection/i.test(raw.type)) return true
  // v2 `sequences` / v3 `items` 都是 manifest 独有的顶层字段
  return Array.isArray(raw.sequences) || Array.isArray(raw.items)
}

/** `getIiifDocument` 的返回结果 */
export interface IiifDocument {
  kind: 'info' | 'manifest'
  /** 实际请求成功的地址 */
  url: string
  imageInfo?: IiifImageInfo
  manifest?: IiifManifest
}

/**
 * 拉取 `info.json` 或 `manifest.json`，并按内容自动识别类型。
 *
 * 判定顺序：
 * 1. 调用方显式声明 `kind: 'manifest'` 时直接按 manifest 解析；
 * 2. 否则先请求 `{url}/info.json`，若响应体其实是 manifest（部分机构把 manifest 放在服务基址上）则改按 manifest 解析；
 * 3. 若 `info.json` 返回 404，再回退到请求原始地址一次并按内容判定。
 *
 * 这样即使 URL 形态不在启发式规则内（例如 `…/presentation/{id}`），也依然能正确加载。
 */
export async function getIiifDocument(
  url: string,
  options: FetchJsonOptions & { locale?: string; kind?: 'info' | 'manifest' } = {},
): Promise<IiifDocument> {
  const { locale = 'en', kind, ...fetchOptions } = options

  if (kind === 'manifest') {
    const manifest = await getManifest(url, { ...fetchOptions, locale })
    return { kind: 'manifest', url, manifest }
  }

  const infoUrl = ensureInfoJsonUrl(url)

  try {
    const raw = await fetchJson(infoUrl, fetchOptions)
    if (isManifestPayload(raw)) {
      return { kind: 'manifest', url: infoUrl, manifest: parseManifest(raw, infoUrl, locale) }
    }
    return { kind: 'info', url: infoUrl, imageInfo: parseImageInfo(raw, infoUrl) }
  } catch (error) {
    // 仅在「地址本身不是 info.json」且请求失败时才做回退，避免无谓的重复请求
    const canFallback = infoUrl !== url && !isAbortError(error) && error instanceof IiifViewerError
    if (!canFallback) throw error

    try {
      const raw = await fetchJson(url, fetchOptions)
      if (isManifestPayload(raw)) {
        return { kind: 'manifest', url, manifest: parseManifest(raw, url, locale) }
      }
      return { kind: 'info', url, imageInfo: parseImageInfo(raw, url) }
    } catch (fallbackError) {
      if (isAbortError(fallbackError)) throw fallbackError
      // 回退也失败时抛首次错误：错误信息指向 `<base>/info.json`，更利于排查
      throw error
    }
  }
}

/* -------------------------------------------------------------------------- */
/* 转换为 OpenSeadragon tileSources                                            */
/* -------------------------------------------------------------------------- */

/**
 * 把归一化画布转换为 OSD 可消费的 tileSource。
 *
 * 关键约束：OpenSeadragon 的 `IIIFTileSource.supports()` 只认 `info.json` 的**内容特征**
 * （`protocol` / `@context` 等），并不识别 `{ type: 'iiif', url }` 这种写法。
 * 因此 IIIF 图像统一返回 `info.json` 地址字符串，交由 OSD 自行拉取并识别；
 * 静态图片则使用 OSD 明确支持的内联配置 `{ type: 'image', url }`。
 */
export function toTileSource(canvas: IiifCanvas): IiifViewerTileSource {
  if (canvas.infoJsonUrl) {
    return canvas.infoJsonUrl
  }
  if (canvas.imageUrl) {
    return { type: 'image', url: canvas.imageUrl }
  }
  throw new IiifViewerError(
    'NO_CANVAS',
    `Canvas "${canvas.label}" has no renderable image.`,
    canvas,
  )
}

/** 把 Image API 服务地址转换为 OSD 的 IIIF tileSource（`info.json` 地址字符串） */
export function imageServiceToTileSource(url: string): string {
  return ensureInfoJsonUrl(url)
}

/* -------------------------------------------------------------------------- */
/* OpenSeadragon 配置推导                                                      */
/* -------------------------------------------------------------------------- */

/** 推导 OSD 配置所需的输入 */
export interface OsdOptionInput {
  /** 是否显示导航图 */
  showNavigator?: boolean
  /** 最小缩放倍数 */
  minZoom?: number
  /** 最大缩放倍数 */
  maxZoom?: number
  /** 用户显式传入的 OSD 配置，优先级最高 */
  osdOptions?: Partial<OsdOptions>
  /** 是否降低动效（跟随 `prefers-reduced-motion`） */
  reducedMotion?: boolean
}

/** 一层深度合并，避免用户传入的嵌套对象被整体覆盖 */
function mergeOptions<T extends Record<string, unknown>>(base: T, override?: Partial<T>): T {
  if (!override) return base
  const result = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const current = result[key]
    result[key] =
      isPlainObject(value) && isPlainObject(current) ? { ...current, ...(value as object) } : value
  }
  return result as T
}

/**
 * 把组件 Props 推导为 OpenSeadragon 配置。
 * 关闭 OSD 自带的导航控件与旋转控件，全部交给我们自己的工具栏，保证 UI 与 i18n 一致。
 *
 * 导航图的外观使用 CSS 变量（`var(--iiif-*)`）表达：OSD 会把它们写成内联样式，
 * 而 CSS 变量在元素上继承，因此主题切换时无需重建 OSD 实例即可自动跟随。
 */
export function createOsdOptions(input: OsdOptionInput = {}): OsdOptions {
  const { showNavigator = true, minZoom = 0.5, maxZoom = 20, reducedMotion = false } = input

  const base = {
    showNavigator,
    showNavigationControl: false,
    showRotationControl: false,
    showHomeControl: false,
    showFullPageControl: false,
    showZoomControl: false,
    minZoomImageRatio: minZoom,
    maxZoomPixelRatio: maxZoom,
    visibilityRatio: 0.6,
    constrainDuringPan: false,
    preserveViewport: false,
    wrapHorizontal: false,
    wrapVertical: false,
    animationTime: reducedMotion ? 0 : 1.2,
    springStiffness: reducedMotion ? 100 : 6.5,
    immediateRender: false,
    // 键盘交互统一由组件在舞台层处理，关闭 OSD 自带的键盘平移
    keyboardNavEnabled: false,
    // 导航图：位置与尺寸固定，颜色跟随主题变量
    navigatorPosition: 'TOP_RIGHT' as const,
    navigatorSizeRatio: 0.16,
    navigatorAutoFade: false,
    navigatorBackground: 'var(--iiif-navigator-bg, #0b0c0e)',
    navigatorBorderColor: 'var(--iiif-navigator-border, rgba(255, 255, 255, 0.18))',
    navigatorDisplayRegionColor: 'var(--iiif-navigator-region, #22d3ee)',
    // 默认不强制跨域，避免部分未配置 CORS 的服务加载失败；可按需透传覆盖
    gestureSettingsMouse: {
      scrollToZoom: true,
      clickToZoom: false,
      dblClickToZoom: true,
      pinchToZoom: true,
      flickEnabled: true,
      flickMomentum: 0.18,
      pinchRotate: false,
    },
    gestureSettingsTouch: {
      pinchToZoom: true,
      dblClickToZoom: true,
      flickEnabled: true,
      flickMomentum: 0.18,
      pinchRotate: false,
    },
  } satisfies Partial<OsdOptions>

  return mergeOptions(
    base as Record<string, unknown>,
    input.osdOptions as Record<string, unknown>,
  ) as OsdOptions
}

/** 判断当前环境是否偏好减弱动效 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
