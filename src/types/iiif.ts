/**
 * IIIF 相关类型定义。
 *
 * 这里区分两类结构：
 * 1. `Iiif*` —— 归一化后的内部结构，屏蔽 Image API 2.x / 3.x 与 Presentation API 2.1 / 3.0 的差异；
 * 2. `Raw*` —— 远端返回的原始 JSON（仅声明用到的字段，其余通过索引签名兜底）。
 */

/* -------------------------------------------------------------------------- */
/* 通用                                                                        */
/* -------------------------------------------------------------------------- */

/** IIIF 语言映射：`{ none: ['标题'], zh: ['标题'], en: ['Title'] }` */
export type IiifLanguageMap = Record<string, string[]>

/** Image API 的合规等级（3.x 为 `level2` 这类字符串，2.x 可能出现在 profile 数组中） */
export type IiifImageProfile = 'level0' | 'level1' | 'level2' | 'unknown'

/** 归一化后支持的 Image API 版本；0 表示未识别出版本 */
export type IiifImageApiVersion = 2 | 3

/** Presentation API 版本 */
export type IiifPresentationVersion = 2 | 3

/* -------------------------------------------------------------------------- */
/* Image API                                                                  */
/* -------------------------------------------------------------------------- */

/** 归一化后的 `info.json` */
export interface IiifImageInfo {
  /** 图像服务基址（v2 取 `@id`，v3 取 `id`） */
  id: string
  version: IiifImageApiVersion
  profile: IiifImageProfile
  width: number
  height: number
  /** 服务端预生成的尺寸列表 */
  sizes: { width: number; height: number }[]
  /** 分片信息 */
  tiles: { width: number; height: number; scaleFactors: number[] }[]
  /** 额外支持的图片格式，如 `['jpg', 'png']` */
  extraFormats: string[]
  /** 是否支持 `rotation` 参数（level2 一定支持） */
  supportsRotation: boolean
  /** 原始 JSON，便于使用方读取未归一化的字段 */
  raw: RawImageInfo
}

/** 原始 `info.json`（2.x / 3.x 混合声明） */
export interface RawImageInfo {
  '@context'?: string | (string | Record<string, unknown>)[]
  '@id'?: string
  id?: string
  type?: string
  protocol?: string
  profile?: string | (string | Record<string, unknown>)[]
  width?: number
  height?: number
  sizes?: { width: number; height: number }[]
  tiles?: { width?: number; height?: number; scaleFactors?: number[] }[]
  extraFormats?: string[]
  extraQualities?: string[]
  extraFeatures?: string[]
  [key: string]: unknown
}

/* -------------------------------------------------------------------------- */
/* Presentation API                                                           */
/* -------------------------------------------------------------------------- */

/** 归一化后的画布（即一个可渲染的"页"） */
export interface IiifCanvas {
  id: string
  /** 已按当前语言扁平化后的标签；取不到时回退为 `Canvas N` */
  label: string
  width?: number
  height?: number
  /** Image API 服务基址 */
  serviceId?: string
  /** 供 OpenSeadragon 使用的 `info.json` 地址 */
  infoJsonUrl?: string
  /** 无 Image API 服务时的静态图片地址 */
  imageUrl?: string
  /** 缩略图地址 */
  thumbnailUrl?: string
}

/** manifest 元数据条目 */
export interface IiifMetadataEntry {
  label: string
  value: string
}

/**
 * 归一化后的目录节点（IIIF 的 `structures` / Range）。
 *
 * v2 用 `ranges` + `canvases` 表达层级，v3 用嵌套的 `items`（内容可为 Range 或 Canvas），
 * 这里统一成同一棵树。
 */
export interface IiifStructure {
  id: string
  /** 已按语言扁平化后的标签 */
  label: string
  /** 本节点**直接**包含的画布在 manifest 画布列表中的下标（0 基） */
  canvasIndexes: number[]
  children: IiifStructure[]
}

/** 归一化后的 manifest */
export interface IiifManifest {
  id: string
  version: IiifPresentationVersion
  label: string
  description?: string
  metadata: IiifMetadataEntry[]
  /** 使用许可 / 权利声明 */
  rights?: string
  /** 提供机构名称 */
  provider?: string
  thumbnailUrl?: string
  canvases: IiifCanvas[]
  /** 目录（Table of Contents）；manifest 未提供 `structures` 时为空数组 */
  structures: IiifStructure[]
  raw: RawManifest
}

/** 原始 manifest（2.x / 3.x 混合声明，仅覆盖解析所需字段） */
export interface RawManifest {
  '@context'?: string | (string | Record<string, unknown>)[]
  '@id'?: string
  id?: string
  type?: string | string[]
  label?: string | IiifLanguageMap
  /** v3 的简介字段 */
  summary?: string | IiifLanguageMap
  /** v2 的简介字段 */
  description?: string | IiifLanguageMap
  metadata?: RawMetadataEntry[]
  thumbnail?: unknown
  license?: string
  rights?: string
  provider?: unknown
  attribution?: string
  sequences?: RawSequence[]
  items?: RawCanvas[]
  structures?: RawStructure[]
  [key: string]: unknown
}

/** 原始目录节点（`structures` 数组元素；v2 / v3 混合声明） */
export interface RawStructure {
  id?: string
  '@id'?: string
  type?: string
  '@type'?: string
  label?: string | IiifLanguageMap
  /** v2：子目录 id 列表 */
  ranges?: string[]
  /** v2：直接包含的画布 id 列表 */
  canvases?: string[]
  /** v3：子项（内容为 Range 或 Canvas，通过 id 关联） */
  items?: { id?: string; '@id'?: string; type?: string }[]
  [key: string]: unknown
}

/** v2 metadata 为字符串数组，v3 为 `{ label, value }` 对象 */
export interface RawMetadataEntry {
  label?: string | IiifLanguageMap
  value?: string | IiifLanguageMap | (string | IiifLanguageMap)[]
  [key: string]: unknown
}

export interface RawSequence {
  id?: string
  '@id'?: string
  canvases?: RawCanvas[]
  [key: string]: unknown
}

export interface RawCanvas {
  id?: string
  '@id'?: string
  type?: string
  label?: string | IiifLanguageMap
  width?: number
  height?: number
  thumbnail?: unknown
  images?: RawAnnotation[]
  items?: RawAnnotationPage[]
  [key: string]: unknown
}

export interface RawAnnotationPage {
  id?: string
  '@id'?: string
  type?: string
  items?: RawAnnotation[]
  [key: string]: unknown
}

export interface RawAnnotation {
  id?: string
  '@id'?: string
  type?: string
  motivation?: string
  body?: RawBody | RawBody[]
  resource?: RawBody
  target?: unknown
  [key: string]: unknown
}

export interface RawBody {
  id?: string
  '@id'?: string
  type?: string
  format?: string
  width?: number
  height?: number
  service?: RawService | RawService[]
  [key: string]: unknown
}

export interface RawService {
  id?: string
  '@id'?: string
  type?: string
  profile?: string
  '@type'?: string
  [key: string]: unknown
}

/* -------------------------------------------------------------------------- */
/* 输入识别                                                                    */
/* -------------------------------------------------------------------------- */

/** 输入资源的语义类型 */
export type IiifResourceKind = 'info' | 'manifest' | 'image' | 'tile-source'

/** 输入识别结果 */
export interface IiifResourceRef {
  kind: IiifResourceKind
  url: string
}

/**
 * OpenSeadragon 的 `{ type: 'image', url }` 配置对象。
 *
 * 注意：OpenSeadragon 只对 `type: 'image'` 做了内联配置支持；
 * IIIF 图像必须传 `info.json` 的**地址字符串**（OSD 会自行拉取并按内容识别），
 * 因此对外统一使用 {@link IiifViewerTileSource}。
 */
export interface IiifTileSource {
  type?: string
  url?: string
  tilesUrl?: string
  width?: number
  height?: number
  [key: string]: unknown
}

/** 可传给 OpenSeadragon `open()` 的 tileSource */
export type IiifViewerTileSource = string | IiifTileSource
