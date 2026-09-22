/**
 * 轻量 i18n。
 *
 * 不依赖 `vue-i18n`，理由：
 * 1. 库需要保持零运行时依赖；
 * 2. `vue-i18n` 当前主版本要求 Node ≥ 22，会抬高使用方的环境门槛。
 *
 * 文案查找顺序：`messages`（调用方覆盖） → 当前语言内置文案 → 兜底语言内置文案 → 原样返回 key。
 */
import type { ComputedRef, InjectionKey, MaybeRef } from 'vue'
import { computed, inject, provide, unref } from 'vue'

import { BUILT_IN_MESSAGES, FALLBACK_LOCALE, detectLocale, normalizeLocale } from '@/locales'

/** 插值参数 */
export type IiifViewerTranslateParams = Record<string, string | number>

/** 翻译函数 */
export type IiifViewerTranslate = (key: string, params?: IiifViewerTranslateParams) => string

export interface UseViewerI18nOptions {
  /** 组件 Prop 传入的语言（优先级最高） */
  locale?: MaybeRef<string | undefined>
  /** 插件级默认语言 */
  fallbackLocale?: MaybeRef<string | undefined>
  /** 文案覆盖 / 扩展 */
  messages?: MaybeRef<Record<string, string> | undefined>
}

export interface UseViewerI18nReturn {
  /** 翻译函数 */
  t: IiifViewerTranslate
  /** 归一化后的实际生效语言 */
  resolvedLocale: ComputedRef<string>
}

/** `{name}` 形式的占位符替换 */
function interpolate(template: string, params?: IiifViewerTranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function useViewerI18n(options: UseViewerI18nOptions = {}): UseViewerI18nReturn {
  const resolvedLocale = computed<string>(() => {
    const locale = unref(options.locale) ?? unref(options.fallbackLocale)
    return locale ? normalizeLocale(locale) : detectLocale()
  })

  const t: IiifViewerTranslate = (key, params) => {
    const override = unref(options.messages)
    const template =
      override?.[key] ??
      BUILT_IN_MESSAGES[resolvedLocale.value as keyof typeof BUILT_IN_MESSAGES]?.[key] ??
      BUILT_IN_MESSAGES[FALLBACK_LOCALE][key] ??
      key
    return interpolate(template, params)
  }

  return { t, resolvedLocale }
}

/** i18n 上下文的注入 key，由 `IiifViewer` 提供给子组件 */
export const IIIF_VIEWER_I18N_KEY: InjectionKey<UseViewerI18nReturn> = Symbol('iiif-viewer-i18n')

/** 在 `IiifViewer` 中提供 i18n 上下文 */
export function provideViewerI18n(context: UseViewerI18nReturn): void {
  provide(IIIF_VIEWER_I18N_KEY, context)
}

/**
 * 子组件读取 i18n 上下文。
 * 脱离 `IiifViewer` 单独使用子组件时，回退到内置默认文案，不会报错。
 */
export function useViewerI18nContext(): UseViewerI18nReturn {
  return inject(IIIF_VIEWER_I18N_KEY, null) ?? useViewerI18n()
}
