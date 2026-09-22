import { describe, expect, it } from 'vitest'

import { useViewerI18n } from '../../src/composables/useViewerI18n'
import { BUILT_IN_MESSAGES, detectLocale, normalizeLocale } from '../../src/locales'

describe('locales', () => {
  it('normalizeLocale 把语言标记归一化为内置语言', () => {
    expect(normalizeLocale('zh')).toBe('zh-CN')
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh-CN')
    expect(normalizeLocale('en-GB')).toBe('en-US')
    // 非内置语言回退到默认语言
    expect(normalizeLocale('fr-FR')).toBe('en-US')
    expect(normalizeLocale(undefined)).toBe('en-US')
  })

  it('detectLocale 在 jsdom 环境下返回内置语言', () => {
    expect(['zh-CN', 'en-US']).toContain(detectLocale())
  })

  it('中英文案 key 集合完全一致', () => {
    const zhKeys = Object.keys(BUILT_IN_MESSAGES['zh-CN']).sort()
    const enKeys = Object.keys(BUILT_IN_MESSAGES['en-US']).sort()

    expect(zhKeys).toEqual(enKeys)
    expect(zhKeys.length).toBeGreaterThan(30)
  })

  it('不存在空文案', () => {
    for (const [locale, messages] of Object.entries(BUILT_IN_MESSAGES)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), `${locale} · ${key}`).not.toBe('')
      }
    }
  })
})

describe('useViewerI18n', () => {
  it('locale 优先级：Prop → fallbackLocale → 环境语言', () => {
    expect(useViewerI18n({ locale: 'zh-CN', fallbackLocale: 'en-US' }).resolvedLocale.value).toBe(
      'zh-CN',
    )
    expect(useViewerI18n({ fallbackLocale: 'zh-CN' }).resolvedLocale.value).toBe('zh-CN')
    expect(useViewerI18n({}).resolvedLocale.value).toBe(detectLocale())
  })

  it('按当前语言返回文案', () => {
    expect(useViewerI18n({ locale: 'zh-CN' }).t('toolbar.zoomIn')).toBe('放大')
    expect(useViewerI18n({ locale: 'en-US' }).t('toolbar.zoomIn')).toBe('Zoom in')
  })

  it('支持 {name} 形式的插值', () => {
    const { t } = useViewerI18n({ locale: 'zh-CN' })
    expect(t('status.page', { current: 3, total: 12 })).toBe('第 3 / 12 页')
  })

  it('未提供插值参数时保留占位符原文', () => {
    const { t } = useViewerI18n({ locale: 'en-US' })
    expect(t('status.zoom')).toBe('Zoom {percent}%')
  })

  it('messages 覆盖内置文案', () => {
    const { t } = useViewerI18n({ locale: 'zh-CN', messages: { 'toolbar.zoomIn': '放大一点' } })
    expect(t('toolbar.zoomIn')).toBe('放大一点')
  })

  it('缺失 key 时返回 key 本身，便于排查', () => {
    expect(useViewerI18n({ locale: 'zh-CN' }).t('nope.missing')).toBe('nope.missing')
  })
})
