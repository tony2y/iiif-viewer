/**
 * 图像色彩调节（亮度 / 对比度 / 饱和度）。
 *
 * 实现方式：把三个百分比合成一条 CSS `filter`，作用在 OpenSeadragon 的
 * `.openseadragon-canvas` 容器上。相比改写瓦片像素，这种做法：
 * 1. 与 OSD 的 Canvas / WebGL / HTML 三种绘制器都兼容；
 * 2. 不需要重新拉取瓦片，调节是即时的；
 * 3. 只影响主画布（导航图是独立元素，不会被一起染色）。
 *
 * 三个维度均以 **100 为中性值**（即 `brightness(100%) contrast(100%) saturate(100%)`）。
 */
import type { IiifColorAdjustmentKey, IiifColorAdjustments } from '@/types/viewer'

/** 中性值（等价于不应用任何滤镜） */
export const DEFAULT_COLOR_ADJUSTMENTS: IiifColorAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
}

/** 各维度的取值范围，供 UI 生成滑杆并与 `clampAdjustment` 共用 */
export const COLOR_ADJUSTMENT_RANGES: Record<
  IiifColorAdjustmentKey,
  { min: number; max: number; step: number }
> = {
  brightness: { min: 50, max: 150, step: 1 },
  contrast: { min: 50, max: 150, step: 1 },
  saturation: { min: 0, max: 200, step: 1 },
}

/** 把某个维度的取值夹到合法区间；非有限数时回退为中性值 */
export function clampAdjustment(key: IiifColorAdjustmentKey, value: unknown): number {
  const { min, max } = COLOR_ADJUSTMENT_RANGES[key]
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_COLOR_ADJUSTMENTS[key]
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

/** 把部分配置补全为完整的调节值 */
export function normalizeColorAdjustments(
  partial?: Partial<IiifColorAdjustments> | null,
): IiifColorAdjustments {
  if (!partial) return { ...DEFAULT_COLOR_ADJUSTMENTS }
  return {
    brightness: clampAdjustment(
      'brightness',
      partial.brightness ?? DEFAULT_COLOR_ADJUSTMENTS.brightness,
    ),
    contrast: clampAdjustment('contrast', partial.contrast ?? DEFAULT_COLOR_ADJUSTMENTS.contrast),
    saturation: clampAdjustment(
      'saturation',
      partial.saturation ?? DEFAULT_COLOR_ADJUSTMENTS.saturation,
    ),
  }
}

/** 是否为中性值（三项都是 100） */
export function isNeutralColorAdjustments(adjustments: IiifColorAdjustments): boolean {
  return (
    adjustments.brightness === 100 && adjustments.contrast === 100 && adjustments.saturation === 100
  )
}

/**
 * 生成 CSS `filter` 值。
 * 中性时返回空字符串 —— 由调用方据此清空滤镜，避免无谓的合成层开销。
 */
export function buildImageFilter(adjustments: IiifColorAdjustments): string {
  const normalized = normalizeColorAdjustments(adjustments)
  if (isNeutralColorAdjustments(normalized)) return ''
  return [
    `brightness(${normalized.brightness}%)`,
    `contrast(${normalized.contrast}%)`,
    `saturate(${normalized.saturation}%)`,
  ].join(' ')
}

export type { IiifColorAdjustmentKey, IiifColorAdjustments }
