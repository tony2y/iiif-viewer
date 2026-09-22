/**
 * 统一错误类型。
 *
 * 设计要点：
 * 1. 携带稳定的 `code`，便于调用方做程序化分支；
 * 2. 携带 `i18nKey`，便于 UI 层查表拿到本地化文案；
 * 3. 保留 `details`（原始响应 / 底层异常），便于排查。
 */
import type { IiifViewerErrorCode } from '@/types/errors'

/** 未提供本地化文案时的英文兜底描述 */
const FALLBACK_MESSAGES: Record<IiifViewerErrorCode, string> = {
  INVALID_SOURCE: 'The provided source is not a valid IIIF resource.',
  INVALID_SOURCE_TYPE: 'The declared sourceType does not match the actual resource.',
  NETWORK_ERROR: 'Network request failed. Please check your connection or CORS settings.',
  HTTP_ERROR: 'The server returned an unexpected status code.',
  TIMEOUT: 'The request timed out.',
  UNSUPPORTED_VERSION: 'This IIIF version is not supported.',
  INVALID_IIIF_INFO: 'The info.json payload is invalid or incomplete.',
  INVALID_MANIFEST: 'The manifest payload is invalid.',
  NO_CANVAS: 'The manifest contains no renderable canvas.',
  OSD_INIT_FAILED: 'OpenSeadragon failed to initialize.',
}

/** iiif-viewer 抛出的标准错误 */
export class IiifViewerError extends Error {
  /** 稳定错误码 */
  readonly code: IiifViewerErrorCode
  /** 附加信息，通常是原始响应体或底层异常 */
  readonly details?: unknown

  constructor(code: IiifViewerErrorCode, message?: string, details?: unknown) {
    super(message ?? FALLBACK_MESSAGES[code])
    this.name = 'IiifViewerError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
    // 兼容向下编译时 instanceof 失效的问题
    Object.setPrototypeOf(this, IiifViewerError.prototype)
  }

  /** 供 i18n 查表使用的 key，形如 `errors.TIMEOUT` */
  get i18nKey(): string {
    return `errors.${this.code}`
  }

  /** 把任意异常规整为 `IiifViewerError`；已是本类型时原样返回 */
  static from(error: unknown, fallback: IiifViewerErrorCode = 'NETWORK_ERROR'): IiifViewerError {
    if (error instanceof IiifViewerError) return error
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new IiifViewerError('TIMEOUT', undefined, error)
    }
    const message = error instanceof Error ? error.message : String(error)
    return new IiifViewerError(fallback, message, error)
  }
}

/** 类型守卫 */
export function isIiifViewerError(value: unknown): value is IiifViewerError {
  return value instanceof IiifViewerError
}
