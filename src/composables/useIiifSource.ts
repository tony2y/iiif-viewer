/**
 * IIIF 资源加载状态机。
 *
 * 负责：识别输入类型 → 拉取并归一化资源 → 推导 OpenSeadragon 可用的 tileSources。
 * 组件侧只需监听 `tileSources` 并在变化时调用 `viewer.open()`。
 *
 * 双页展开：`doublePage` 为真时按「偶数下标起、连续两页」组织当前展开范围，
 * 翻页步进为 2，且 `currentIndex` 会被吸附到偶数下标，保证页码与状态始终一致。
 */
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { IiifViewerError } from '@/core/errors'
import {
  DEFAULT_TIMEOUT,
  detectResourceKind,
  getIiifDocument,
  isAbortError,
  parseManifest,
  toTileSource,
} from '@/core/iiif'
import { ensureInfoJsonUrl } from '@/core/url'
import type {
  IiifCanvas,
  IiifImageInfo,
  IiifManifest,
  IiifResourceKind,
  IiifViewerTileSource,
} from '@/types/iiif'
import type { IiifViewerSource, IiifViewerSourceType } from '@/types/viewer'

/** 加载状态 */
export type IiifLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/** 加载成功后的负载 */
export interface IiifSourceLoadedPayload {
  kind: IiifResourceKind
  imageInfo?: IiifImageInfo
  manifest?: IiifManifest
  canvases: IiifCanvas[]
}

export interface UseIiifSourceOptions {
  /** 资源地址 getter（响应式） */
  source: () => IiifViewerSource
  /** 强制指定的资源类型 getter */
  sourceType?: () => IiifViewerSourceType
  /** 当前语言 getter，用于提取 manifest 中的多语言标签 */
  locale?: () => string
  /** 请求超时毫秒数 getter */
  timeout?: () => number
  /** 初始是否双页展开 getter */
  initialDoublePage?: () => boolean
  /** 加载成功回调 */
  onLoaded?: (payload: IiifSourceLoadedPayload) => void
  /** 加载失败回调（主动取消不会触发） */
  onError?: (error: IiifViewerError) => void
}

export interface UseIiifSourceReturn {
  status: Ref<IiifLoadStatus>
  error: ShallowRef<IiifViewerError | null>
  kind: Ref<IiifResourceKind>
  imageInfo: ShallowRef<IiifImageInfo | null>
  manifest: ShallowRef<IiifManifest | null>
  canvases: Ref<IiifCanvas[]>
  /** 当前需要交给 OSD 渲染的 tileSources：单页为 1 个，双页为 1–2 个 */
  tileSources: ComputedRef<IiifViewerTileSource[]>
  currentIndex: Ref<number>
  /** 当前展开范围的起始下标（双页模式下为偶数） */
  spreadStart: ComputedRef<number>
  /** 当前展开范围内全部画布的下标 */
  visibleIndexes: ComputedRef<number[]>
  /** 双页模式下的第二页下标；单页时为 `undefined` */
  secondaryIndex: ComputedRef<number | undefined>
  doublePage: Ref<boolean>
  total: ComputedRef<number>
  currentCanvas: ComputedRef<IiifCanvas | undefined>
  canGoPrev: ComputedRef<boolean>
  canGoNext: ComputedRef<boolean>
  /** 重新加载当前 source（用于重试） */
  retry: () => void
  /** 跳转到指定画布 */
  goTo: (index: number) => void
  /** 上一画布 / 上一跨页 */
  prev: () => void
  /** 下一画布 / 下一跨页 */
  next: () => void
  /** 设置双页展开模式 */
  setDoublePage: (enabled: boolean) => void
  /** 切换双页展开模式 */
  toggleDoublePage: () => void
  /** 清空全部状态 */
  reset: () => void
}

export function useIiifSource(options: UseIiifSourceOptions): UseIiifSourceReturn {
  const status = ref<IiifLoadStatus>('idle')
  const error = shallowRef<IiifViewerError | null>(null)
  const kind = ref<IiifResourceKind>('info')
  const imageInfo = shallowRef<IiifImageInfo | null>(null)
  const manifest = shallowRef<IiifManifest | null>(null)
  const canvases = ref<IiifCanvas[]>([])
  /** 直接传入现成 tileSource 时的原始列表（不经画布模型） */
  const passthroughTileSources = shallowRef<IiifViewerTileSource[]>([])
  const currentIndex = ref(0)
  const doublePage = ref(options.initialDoublePage?.() ?? false)

  let controller: AbortController | null = null

  const total = computed(() => canvases.value.length)

  /** 当前展开范围的起始下标：双页下吸附到偶数 */
  const spreadStart = computed(() =>
    doublePage.value ? currentIndex.value - (currentIndex.value % 2) : currentIndex.value,
  )

  const visibleIndexes = computed<number[]>(() => {
    if (!doublePage.value) return [currentIndex.value]
    const start = spreadStart.value
    return [start, start + 1].filter((index) => index < canvases.value.length)
  })

  const secondaryIndex = computed(() =>
    visibleIndexes.value.length > 1 ? visibleIndexes.value[1] : undefined,
  )

  const currentCanvas = computed(() => canvases.value[currentIndex.value])

  const canGoPrev = computed(() => currentIndex.value > 0)
  const canGoNext = computed(() => {
    if (!doublePage.value) return currentIndex.value < total.value - 1
    // 双页模式下只有「还能再翻一个跨页」时才算有下一页
    return spreadStart.value + 2 < total.value
  })

  const tileSources = computed<IiifViewerTileSource[]>(() => {
    if (kind.value === 'tile-source') return passthroughTileSources.value
    return visibleIndexes.value
      .map((index) => canvases.value[index])
      .filter((canvas): canvas is IiifCanvas => canvas !== undefined)
      .map((canvas) => toTileSource(canvas))
  })

  /** 当前语言，未显式传入时按英文提取标签 */
  function currentLocale(): string {
    return options.locale?.() ?? 'en'
  }

  function abort(): void {
    controller?.abort()
    controller = null
  }

  function reset(): void {
    error.value = null
    imageInfo.value = null
    manifest.value = null
    canvases.value = []
    passthroughTileSources.value = []
    currentIndex.value = 0
  }

  function handleError(caught: unknown): void {
    // 主动取消（切换 source / 卸载）不视为错误
    if (isAbortError(caught)) return
    const normalized = IiifViewerError.from(caught)
    error.value = normalized
    status.value = 'error'
    options.onError?.(normalized)
  }

  async function load(): Promise<void> {
    abort()
    const current = new AbortController()
    controller = current

    reset()
    status.value = 'loading'

    const source = options.source()
    const timeout = options.timeout?.() ?? DEFAULT_TIMEOUT
    const locale = currentLocale()

    try {
      const resource = detectResourceKind(source, options.sourceType?.() ?? 'auto')
      kind.value = resource.kind
      const fetchOptions = { signal: current.signal, timeout }

      switch (resource.kind) {
        case 'tile-source': {
          const list = (Array.isArray(source) ? source : [source]) as IiifViewerTileSource[]
          passthroughTileSources.value = list
          canvases.value = [{ id: 'tile-source', label: 'Canvas 1' }]
          status.value = 'ready'
          options.onLoaded?.({ kind: 'tile-source', canvases: canvases.value })
          return
        }

        case 'image': {
          const canvas: IiifCanvas = { id: resource.url, label: 'Image', imageUrl: resource.url }
          passthroughTileSources.value = [{ type: 'image', url: resource.url }]
          canvases.value = [canvas]
          status.value = 'ready'
          options.onLoaded?.({ kind: 'image', canvases: canvases.value })
          return
        }

        case 'manifest': {
          const document = await getIiifDocument(resource.url, {
            ...fetchOptions,
            locale,
            kind: 'manifest',
          })
          if (current.signal.aborted) return
          const result = document.manifest!
          manifest.value = result
          canvases.value = result.canvases
          status.value = 'ready'
          options.onLoaded?.({ kind: 'manifest', manifest: result, canvases: result.canvases })
          return
        }

        default: {
          // 按内容自动识别 info.json / manifest，兼容「服务基址即 manifest」等非常规地址
          const document = await getIiifDocument(resource.url, { ...fetchOptions, locale })
          if (current.signal.aborted) return

          if (document.kind === 'manifest' && document.manifest) {
            manifest.value = document.manifest
            canvases.value = document.manifest.canvases
            kind.value = 'manifest'
            status.value = 'ready'
            options.onLoaded?.({
              kind: 'manifest',
              manifest: document.manifest,
              canvases: document.manifest.canvases,
            })
            return
          }

          const info = document.imageInfo!
          imageInfo.value = info
          canvases.value = [
            {
              id: info.id,
              label: 'Image',
              width: info.width,
              height: info.height,
              serviceId: info.id,
              infoJsonUrl: ensureInfoJsonUrl(resource.url),
            },
          ]
          status.value = 'ready'
          options.onLoaded?.({ kind: 'info', imageInfo: info, canvases: canvases.value })
        }
      }
    } catch (caught) {
      handleError(caught)
    }
  }

  function goTo(index: number): void {
    if (index < 0 || index >= canvases.value.length) return
    const next = doublePage.value ? index - (index % 2) : index
    if (next === currentIndex.value) return
    currentIndex.value = next
  }

  function setDoublePage(enabled: boolean): void {
    if (doublePage.value === enabled) return
    doublePage.value = enabled
    // 从单页切到双页时把当前页吸附到跨页起点，避免出现「半页」状态
    if (enabled) {
      const snapped = currentIndex.value - (currentIndex.value % 2)
      currentIndex.value = snapped
    }
  }

  /** source / sourceType 的稳定标识，避免对象引用变化导致的无效重载 */
  const sourceKey = computed(() => {
    const value = options.source()
    const type = options.sourceType?.() ?? 'auto'
    if (typeof value === 'string') return `${type}::${value}`
    try {
      return `${type}::${JSON.stringify(value)}`
    } catch {
      return `${type}::${String(value)}`
    }
  })

  watch(sourceKey, () => void load(), { immediate: true })

  // 语言切换时仅重新解析已缓存的 manifest，不重新发起网络请求
  if (options.locale) {
    watch(
      () => options.locale?.(),
      () => {
        const current = manifest.value
        if (kind.value !== 'manifest' || !current) return
        try {
          const reparsed = parseManifest(current.raw, current.id, currentLocale())
          const index = Math.min(currentIndex.value, reparsed.canvases.length - 1)
          manifest.value = reparsed
          canvases.value = reparsed.canvases
          currentIndex.value = index
        } catch {
          // 原始数据未变化，重新解析理论上不会失败；失败时保留原有文案
        }
      },
    )
  }

  onBeforeUnmount(abort)

  return {
    status,
    error,
    kind,
    imageInfo,
    manifest,
    canvases,
    tileSources,
    currentIndex,
    spreadStart,
    visibleIndexes,
    secondaryIndex,
    doublePage,
    total,
    currentCanvas,
    canGoPrev,
    canGoNext,
    retry: () => void load(),
    goTo,
    prev: () => goTo(currentIndex.value - (doublePage.value ? 2 : 1)),
    next: () => goTo(currentIndex.value + (doublePage.value ? 2 : 1)),
    setDoublePage,
    toggleDoublePage: () => setDoublePage(!doublePage.value),
    reset,
  }
}
