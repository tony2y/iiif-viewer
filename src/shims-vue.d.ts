/**
 * *.vue 单文件组件的模块声明，供 TS 识别 SFC 的默认导出。
 * vue-tsc 依赖此声明为 SFC 提供类型；`vite-plugin-dts` 生成 d.ts 时同样需要。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** 允许副作用式导入 CSS（构建时由 Vite 抽取为独立样式文件） */
declare module '*.css'
