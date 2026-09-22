/**
 * OpenSeadragon 的注入与兼容性校验。
 *
 * ## 为什么 OpenSeadragon 由使用方提供
 *
 * `openseadragon` 在本库中是 **peerDependency**，并且被声明为构建 external：
 * - ESM 产物保留 `import OpenSeadragon from "openseadragon"`，由使用方的打包器解析；
 * - UMD 产物把 `OpenSeadragon` 视为全局变量（`window.OpenSeadragon`）。
 *
 * 因此库本身**不包含** OpenSeadragon 代码，使用方必须自行安装一次，避免同一页面
 * 出现多份 OSD 实例（会各自注册全局事件与样式，导致交互异常）。
 *
 * ## 为什么还需要「注入」
 *
 * 少数场景下使用方希望显式指定 OSD 来源，例如：
 * - CDN / `<script>` 引入，只有 `window.OpenSeadragon` 可用；
 * - 使用自编译或被 patch 过的 OSD 构建；
 * - 页面上同时存在多个 OSD 版本，需要显式指定使用哪一个。
 *
 * 此时可通过插件配置或组件 Prop 传入 `openseadragon`。传入的对象必须与 OSD 的
 * 默认导出同构：**既可被调用**（`OpenSeadragon(options)`），也挂载了
 * `Viewer` / `TileSource` / `Viewport` 等命名空间成员。
 *
 * ## 版本兼容
 *
 * 本库按 OSD **6.x** 的类型与 API 开发（{@link TESTED_OSD_MAJOR}）。
 * 注入的对象会经过 {@link verifyOpenSeadragon} 检查：
 * - 缺少必要 API → 判定不兼容，抛 `OSD_INIT_FAILED`；
 * - 主版本低于 {@link MIN_SUPPORTED_OSD_MAJOR} 或高于已测试版本 → 仅告警，仍可尝试运行。
 */
import OpenSeadragon from 'openseadragon'

import type { OpenseadragonNamespace } from '@/types/viewer'

/** 本库内置的 OpenSeadragon（来自 peerDependency，由使用方的打包器提供） */
export const builtinOpenSeadragon: OpenseadragonNamespace = OpenSeadragon

/** 能够运行的最低主版本 */
export const MIN_SUPPORTED_OSD_MAJOR = 4

/** 本库实际开发与测试所依据的主版本 */
export const TESTED_OSD_MAJOR = 6

/** 兼容性检查结果 */
export interface OsdCompatibilityReport {
  /** 是否通过「必要 API 存在性」检查 */
  ok: boolean
  /** 检测到的版本号字符串（取不到时为 `undefined`） */
  version?: string
  /** 缺失的必要能力，非空即表示不可用 */
  missing: string[]
  /** 非阻断性提示（版本偏低 / 偏高） */
  warnings: string[]
}

/** 运行期必须存在的原型方法：`类名.方法名` */
const REQUIRED_METHODS: readonly [keyof OpenseadragonNamespace & string, string][] = [
  ['Viewer', 'open'],
  ['Viewer', 'destroy'],
  ['Viewer', 'addHandler'],
  ['Viewport', 'rotateTo'],
  ['Viewport', 'setFlip'],
  ['Viewport', 'viewportToImageZoom'],
  ['Viewport', 'fitHorizontally'],
  ['Viewport', 'fitVertically'],
]

/** OpenSeadragon 默认导出本身是可调用的工厂函数 */
function isCallable(value: unknown): value is OpenseadragonNamespace {
  return typeof value === 'function'
}

/**
 * 校验注入的 OpenSeadragon 是否满足本库的 API 依赖。
 * 不会修改对象，也不抛异常，便于使用方自行决定如何处理。
 */
export function verifyOpenSeadragon(candidate: unknown): OsdCompatibilityReport {
  const warnings: string[] = []
  const missing: string[] = []

  if (!isCallable(candidate)) {
    return {
      ok: false,
      missing: ['OpenSeadragon 默认导出（应为可调用的工厂函数）'],
      warnings,
    }
  }

  const osd = candidate
  const version = osd.version?.versionStr
  const major = osd.version?.major

  if (typeof major === 'number') {
    if (major < MIN_SUPPORTED_OSD_MAJOR) {
      missing.push(`OpenSeadragon 主版本 >= ${MIN_SUPPORTED_OSD_MAJOR}（当前 ${version ?? major}）`)
    } else if (major !== TESTED_OSD_MAJOR) {
      warnings.push(
        `当前 OpenSeadragon 主版本为 ${major}，本库以 ${TESTED_OSD_MAJOR}.x 为开发与测试基线，行为可能存在差异。`,
      )
    }
  } else {
    warnings.push('无法读取 OpenSeadragon 版本号，已跳过版本兼容性检查。')
  }

  for (const [className, methodName] of REQUIRED_METHODS) {
    const ctor = osd[className] as { prototype?: Record<string, unknown> } | undefined
    if (!ctor?.prototype || typeof ctor.prototype[methodName] !== 'function') {
      missing.push(`${className}.prototype.${methodName}`)
    }
  }

  return { ok: missing.length === 0, version, missing, warnings }
}

/**
 * 解析实际使用的 OpenSeadragon：优先使用注入对象，否则回退到内置（peer）实例。
 */
export function resolveOpenSeadragon(
  provided?: OpenseadragonNamespace | null,
): OpenseadragonNamespace {
  return provided ?? builtinOpenSeadragon
}

export type { OpenseadragonNamespace }
