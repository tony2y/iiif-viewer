import { describe, expect, it } from 'vitest'

import {
  COLOR_ADJUSTMENT_RANGES,
  DEFAULT_COLOR_ADJUSTMENTS,
  buildImageFilter,
  clampAdjustment,
  isNeutralColorAdjustments,
  normalizeColorAdjustments,
} from '../../src/core/color'

describe('core/color', () => {
  it('默认值为中性（三项均为 100）', () => {
    expect(DEFAULT_COLOR_ADJUSTMENTS).toEqual({ brightness: 100, contrast: 100, saturation: 100 })
    expect(isNeutralColorAdjustments(DEFAULT_COLOR_ADJUSTMENTS)).toBe(true)
  })

  describe('clampAdjustment', () => {
    it('超出范围时夹到边界', () => {
      expect(clampAdjustment('brightness', 999)).toBe(COLOR_ADJUSTMENT_RANGES.brightness.max)
      expect(clampAdjustment('brightness', -10)).toBe(COLOR_ADJUSTMENT_RANGES.brightness.min)
      expect(clampAdjustment('saturation', -1)).toBe(0)
      expect(clampAdjustment('saturation', 500)).toBe(200)
    })

    it('取整并接受字符串数字', () => {
      expect(clampAdjustment('contrast', '112.6')).toBe(113)
    })

    it('非有限数回退为中性值', () => {
      expect(clampAdjustment('brightness', Number.NaN)).toBe(100)
      expect(clampAdjustment('contrast', 'abc')).toBe(100)
      expect(clampAdjustment('saturation', undefined)).toBe(100)
    })

    it('null 会被 Number() 转成 0，因此按 0 夹取（饱和度下限为 0）', () => {
      expect(clampAdjustment('saturation', null)).toBe(0)
      expect(clampAdjustment('contrast', null)).toBe(50)
    })
  })

  describe('normalizeColorAdjustments', () => {
    it('补全缺省字段并夹取范围', () => {
      expect(normalizeColorAdjustments({ brightness: 200 })).toEqual({
        brightness: 150,
        contrast: 100,
        saturation: 100,
      })
    })

    it('传空值返回默认值', () => {
      expect(normalizeColorAdjustments(undefined)).toEqual(DEFAULT_COLOR_ADJUSTMENTS)
      expect(normalizeColorAdjustments(null)).toEqual(DEFAULT_COLOR_ADJUSTMENTS)
    })
  })

  describe('buildImageFilter', () => {
    it('中性时返回空串（调用方据此清除滤镜）', () => {
      expect(buildImageFilter(DEFAULT_COLOR_ADJUSTMENTS)).toBe('')
    })

    it('非中性时输出标准 CSS filter 表达式', () => {
      expect(buildImageFilter({ brightness: 120, contrast: 90, saturation: 0 })).toBe(
        'brightness(120%) contrast(90%) saturate(0%)',
      )
    })

    it('单个维度变化也会输出完整表达式', () => {
      expect(buildImageFilter({ brightness: 100, contrast: 100, saturation: 150 })).toBe(
        'brightness(100%) contrast(100%) saturate(150%)',
      )
    })
  })

  it('isNeutralColorAdjustments 只在三项都为 100 时为真', () => {
    expect(isNeutralColorAdjustments({ brightness: 100, contrast: 100, saturation: 101 })).toBe(
      false,
    )
    expect(isNeutralColorAdjustments({ brightness: 99, contrast: 100, saturation: 100 })).toBe(
      false,
    )
  })
})
