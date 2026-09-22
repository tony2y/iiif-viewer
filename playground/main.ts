import { createApp } from 'vue'

import { createIiifViewer } from '@/index'
import App from './App.vue'
import './playground.css'

/**
 * playground 演示入口（不参与库构建）。
 *
 * 通过 `app.use(createIiifViewer())` 注册插件以演示「全局配置 + 全局组件」用法；
 * `App.vue` 内则采用按需导入单个组件的写法。
 */
const app = createApp(App)

app.use(
  createIiifViewer({
    locale: 'zh-CN',
    theme: 'dark',
  }),
)

app.mount('#app')
