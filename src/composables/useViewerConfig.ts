/**
 * 插件级配置的 provide / inject。
 *
 * 由 `createIiifViewer()` 在 `app.use()` 时注入，`IiifViewer` 读取后作为 Props 的默认值。
 * 未安装插件时 `useViewerConfig()` 返回空对象，组件仍可独立工作。
 */
import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'

import type { IiifViewerPluginOptions } from '@/types/viewer'

/** 插件配置的注入 key */
export const IIIF_VIEWER_CONFIG_KEY: InjectionKey<Readonly<IiifViewerPluginOptions>> =
  Symbol('iiif-viewer-config')

/**
 * 在插件 `install()` 中调用，把配置注入到 App 级别。
 * 使用 `app.provide` 而非组件级 `provide`，因此可在 `install` 阶段直接调用。
 */
export function provideViewerConfig(app: App, options: IiifViewerPluginOptions): void {
  app.provide(IIIF_VIEWER_CONFIG_KEY, Object.freeze({ ...options }))
}

/** 在组件内读取全局默认配置；未安装插件时返回空对象 */
export function useViewerConfig(): Readonly<IiifViewerPluginOptions> {
  return inject(IIIF_VIEWER_CONFIG_KEY, {})
}
