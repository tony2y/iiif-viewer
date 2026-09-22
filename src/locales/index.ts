/**
 * 内置文案汇总与默认语言常量。
 */
import enUS from './en-US'
import zhCN from './zh-CN'

/** 内置支持的语言 */
export const BUILT_IN_LOCALES = ['zh-CN', 'en-US'] as const

/** 内置语言类型 */
export type BuiltInLocale = (typeof BUILT_IN_LOCALES)[number]

/** 默认语言 */
export const DEFAULT_LOCALE: BuiltInLocale = 'en-US'

/** 兜底语言：任意 key 在当前语言缺失时回退到它 */
export const FALLBACK_LOCALE: BuiltInLocale = 'en-US'

/** 全部内置文案 */
export const BUILT_IN_MESSAGES: Record<BuiltInLocale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

/**
 * 把任意语言标记归一化为内置语言。
 * 例如 `zh`、`zh-Hans-CN` → `zh-CN`；`en-GB` → `en-US`。
 */
export function normalizeLocale(locale: string | undefined | null): BuiltInLocale {
  if (!locale) return DEFAULT_LOCALE
  const lower = locale.toLowerCase()
  if (lower.startsWith('zh')) return 'zh-CN'
  if (lower.startsWith('en')) return 'en-US'
  return DEFAULT_LOCALE
}

/**
 * 推断运行环境语言。
 * SSR 环境（无 `navigator`）直接返回默认语言。
 */
export function detectLocale(): BuiltInLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const candidates = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean)
  const first = candidates.find((item) => /^(zh|en)/i.test(item))
  return normalizeLocale(first)
}

export { zhCN, enUS }
