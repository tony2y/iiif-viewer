/**
 * URL 处理工具。全部为纯函数，便于单元测试。
 */

/** 去掉查询串与 hash 片段 */
export function stripQuery(value: string): string {
  return value.split('#')[0]!.split('?')[0]!
}

/** 去掉路径末尾多余的斜杠 */
export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** 判断是否为绝对 URL（`http://`、`https://` 或协议相对 `//`） */
export function isAbsoluteUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value.trim())
}

/** 把相对路径解析为绝对 URL；`path` 已是绝对地址时原样返回 */
export function resolveUrl(base: string, path: string): string {
  if (!path) return base
  if (isAbsoluteUrl(path)) return path
  if (!base) return path
  return `${stripTrailingSlash(base)}/${path.replace(/^\/+/, '')}`
}

/** 判断 URL 是否以 `info.json` 结尾（忽略查询串与大小写） */
export function isInfoJsonUrl(value: string): boolean {
  return /\/info\.json$/i.test(stripTrailingSlash(stripQuery(value.trim())))
}

/** 判断 URL 是否直接指向图片文件 */
export function isImageFileUrl(value: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|tiff?|bmp|svg)$/i.test(stripQuery(value.trim()))
}

/**
 * 判断 URL 是否疑似 Presentation API manifest。
 *
 * 覆盖常见约定：
 * - 路径含 `manifest`（如 `/manifest.json`、`/iiif/manifest/123`）
 * - 路径含 `/collection/`
 * - 路径含 `/presentation/`（如 `https://iiif.wellcomecollection.org/presentation/b18035723`）
 *
 * 未命中时不要紧：`getIiifDocument()` 还会按响应内容二次判定。
 */
export function isLikelyManifestUrl(value: string): boolean {
  const path = stripQuery(value.trim()).toLowerCase()
  return (
    /manifest/.test(path) || /\/collection(\/|$)/.test(path) || /\/presentation(\/|$)/.test(path)
  )
}

/** 把任意 Image API 服务地址补全为 `info.json` 地址 */
export function ensureInfoJsonUrl(value: string): string {
  const trimmed = value.trim()
  if (isInfoJsonUrl(trimmed)) return trimmed
  return `${stripTrailingSlash(stripQuery(trimmed))}/info.json`
}

/** 判断字符串是否是 JSON 内容（用于兜底解析） */
export function looksLikeJson(value: string): boolean {
  const trimmed = value.trim()
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  )
}
