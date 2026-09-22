/**
 * 错误码类型（独立于实现，避免 `types/` 反向依赖 `core/`）。
 */

/** 组件可能抛出的全部错误码 */
export type IiifViewerErrorCode =
  /** 传入的 source 无法识别 */
  | 'INVALID_SOURCE'
  /** sourceType 与内容实际类型不符 */
  | 'INVALID_SOURCE_TYPE'
  /** 网络异常（DNS / CORS / 断网） */
  | 'NETWORK_ERROR'
  /** 服务端返回非 2xx 状态码 */
  | 'HTTP_ERROR'
  /** 请求超时 */
  | 'TIMEOUT'
  /** IIIF 版本不被支持 */
  | 'UNSUPPORTED_VERSION'
  /** `info.json` 结构非法或缺少必要字段 */
  | 'INVALID_IIIF_INFO'
  /** `manifest.json` 结构非法 */
  | 'INVALID_MANIFEST'
  /** manifest 中没有任何可渲染画布 */
  | 'NO_CANVAS'
  /** OpenSeadragon 初始化失败 */
  | 'OSD_INIT_FAILED'

/** 全部错误码列表，便于遍历 / 校验 i18n 文案完整性 */
export const IIIF_VIEWER_ERROR_CODES: readonly IiifViewerErrorCode[] = [
  'INVALID_SOURCE',
  'INVALID_SOURCE_TYPE',
  'NETWORK_ERROR',
  'HTTP_ERROR',
  'TIMEOUT',
  'UNSUPPORTED_VERSION',
  'INVALID_IIIF_INFO',
  'INVALID_MANIFEST',
  'NO_CANVAS',
  'OSD_INIT_FAILED',
] as const
