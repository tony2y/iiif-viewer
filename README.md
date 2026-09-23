# iiif-viewer

> 基于 **Vue 3 + Vite + TypeScript + OpenSeadragon** 的现代 IIIF 阅读器插件，可嵌入任意 Vue 3 应用。

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue)](https://www.npmjs.com/package/@tony2y/iiif-viewer)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![vue](https://img.shields.io/badge/vue-%5E3.5-42b883)](https://vuejs.org/)
[![openseadragon](https://img.shields.io/badge/openseadragon-%5E6.0-blue)](https://openseadragon.github.io/)

**简体中文** | [English](./README_EN.md) | [在线预览](https://tony2y.github.io/iiif-viewer/)

---

## 1. 项目概述与核心功能

`@tony2y/iiif-viewer` 是一个 Vue 3 组件库（同时提供插件形态），用于在网页中嵌入符合 [IIIF](https://iiif.io/) 标准的图像阅读器。渲染内核为 [OpenSeadragon](https://openseadragon.github.io/)，在深度缩放场景下以瓦片方式按需加载图像。

### 核心功能

| 分类            | 能力                                                                                                                                                                                                       |
|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **IIIF 标准**   | IIIF **Image API 2.x / 3.x**（`info.json`）；IIIF **Presentation API 2.1 / 3.0**（`manifest.json` 多画布翻阅）；标签语言映射、metadata / rights / provider / thumbnail 归一化                              |
| **输入识别**    | 自动识别「Image API 服务基址」「`info.json` 地址」「`manifest.json` 地址」「静态图片地址」「OSD tileSource」；URL 启发式识别失败时**按响应内容二次判定**（兼容 `/presentation/{id}` 等非常规地址）         |
| **图像交互**    | 缩放（滚轮 / 双击 / 按钮 / 键盘）、平移拖拽、任意角度旋转、水平翻转、复位、全屏、OSD 内置导航图                                                                                                            |
| **多画布**      | 上一页 / 下一页、页码状态、缩略图条（缩略图缺失时自动回退到 Image API 的 `full/!120,120/0/default.jpg`）；翻页保留当前缩放与平移，可选用 `fade` / `zoom-swap` 过渡                                         |
| **单页/双页**   | 单页 / 双页展开切换（工具栏按钮、`initialDoublePage` Prop 与 `setDoublePage()` / `toggleDoublePage()`）；双页下标吸附到偶数、翻页步进为 2，**两页等高且书脊处紧贴无缝**，最后一跨页只剩 1 页时单页满宽显示 |
| **色彩调节**    | 亮度 / 对比度 / 饱和度实时调节：工具栏单按钮 → 右侧滑出面板，合成一条 CSS `filter` 作用于画布（导航图不受影响，三种绘制器通用，不重拉瓦片）                                                                |
| **目录（TOC）** | 解析 IIIF `structures`（v2 `ranges` / v3 `items`）为统一目录树；信息面板「目录 / 作品信息」双 Tab，点击条目跳转并高亮当前页                                                                                |
| **界面**        | 暗色画廊主题（默认）/ 亮色主题 / 跟随系统；玻璃态悬浮工具栏，支持上下左右四种停靠位置；加载骨架与进度环；错误卡片（带错误码与重试）；元数据抽屉面板                                                        |
| **国际化**      | 内置 `zh-CN` / `en-US`，零额外运行时依赖；支持通过 `messages` 覆盖或扩展文案                                                                                                                               |
| **响应式**      | 基于 CSS 容器查询（`@container`），与视口宽度解耦；窄容器下工具栏自动精简并收进「更多」菜单                                                                                                                |
| **无障碍**      | 所有控件具备可访问名称与可见焦点环；图标为装饰性并对无障碍树隐藏；快捷键提示对屏幕阅读器可读；完整支持 `prefers-reduced-motion`                                                                            |
| **类型安全**    | 全量 TypeScript 类型定义（Props / Emits / Slots / Expose / 核心能力 / IIIF 结构），产物附带 `.d.ts`                                                                                                        |
| **工程化**      | Vite 库模式构建（ESM + UMD + 单一 CSS + d.ts）、ESLint 10 flat config、Prettier、Vitest 单元测试                                                                                                           |
| **依赖边界**    | `openseadragon` 为 peerDependency 且构建时声明为 external，**库产物不含 OSD 代码**；支持通过 `openseadragon` Prop / 插件配置注入自定义实例（含兼容性校验）                                                 |

---

## 2. 技术栈与版本

### 运行时依赖（peerDependencies）

| 包              | 版本范围 | 说明                                                              |
| --------------- | -------- | ----------------------------------------------------------------- |
| `vue`           | `^3.5.0` | 宿主框架，使用 Composition API + `<script setup>`                 |
| `openseadragon` | `^6.0.0` | 图像渲染内核（自带 TypeScript 类型，无需 `@types/openseadragon`） |

### OpenSeadragon 由使用方提供（依赖边界与注入）

`openseadragon` 在本库中是 **peerDependency**，并在构建时被声明为 **external**：

- **ESM 产物**保留 `import OpenSeadragon from "openseadragon"`，交由使用方的打包器解析；
- **UMD 产物**把 `OpenSeadragon` 当作全局变量（`window.OpenSeadragon`）。

因此**库产物不含 OpenSeadragon 代码**，使用方必须自行安装一次，以避免同一页面出现多份 OSD（多份实例会各自注册全局事件与样式，导致交互异常）。

```bash
pnpm add @tony2y/iiif-viewer openseadragon
```

少数场景下使用方需要**显式指定** OSD 来源，可通过组件 Prop `openseadragon`（或插件配置 `createIiifViewer({ openseadragon })`）传入，例如：CDN / `<script>` 引入只有一个 `window.OpenSeadragon`；使用自编译或被 patch 过的构建；页面同时存在多个 OSD 版本。

传入对象的形状需与 OSD 默认导出一致 —— **既可被调用**（`OpenSeadragon(options)`），也挂载了 `Viewer` / `Viewport` 等命名空间成员。

**版本兼容**：本库以 OSD **6.x** 为开发与测试基线（导出常量 `TESTED_OSD_MAJOR = 6`），最低支持主版本为 `MIN_SUPPORTED_OSD_MAJOR = 4`。注入对象会经过 `verifyOpenSeadragon(candidate)` 校验：

- 缺少必要 API（`Viewer.prototype.open` / `destroy` / `addHandler`，`Viewport.prototype.rotateTo` / `setFlip` / `viewportToImageZoom` / `fitHorizontally` / `fitVertically`）或主版本低于 4 → 判定不兼容，组件进入 `OSD_INIT_FAILED` 错误态（不抛异常）；
- 主版本高于已测试版本、或读不到版本号 → 仅 `console.warn`，仍继续运行。

相关导出：`resolveOpenSeadragon(provided?)`、`builtinOpenSeadragon`，以及类型 `OpenseadragonNamespace`、`OsdCompatibilityReport`。

> 附带优化：双页展开时缩放百分比改用首张 `TiledImage.viewportToImageZoom()` 换算，避免 OSD 在多图场景打印「is not accurate with multi-image」告警。

### 开发依赖（devDependencies）

| 包                              | 版本       | 用途                       |
| ------------------------------- | ---------- | -------------------------- |
| `vite`                          | `^8.3.0`   | 构建与开发服务器（库模式） |
| `@vitejs/plugin-vue`            | `^6.0.9`   | SFC 编译                   |
| `typescript`                    | `~5.9.3`   | 类型系统                   |
| `vue-tsc`                       | `^3.3.11`  | 类型检查                   |
| `vite-plugin-dts`               | `^5.1.1`   | 生成 `.d.ts`               |
| `@vue/language-core`            | `^3.3.11`  | d.ts 生成的 SFC 支持       |
| `vitest`                        | `^4.1.11`  | 单元测试                   |
| `@vitest/coverage-v8`           | `^4.1.11`  | 覆盖率                     |
| `jsdom`                         | `^27.4.0`  | 测试 DOM 环境              |
| `@vue/test-utils`               | `^2.5.1`   | 组件测试                   |
| `eslint`                        | `^10.11.0` | 代码规范（flat config）    |
| `eslint-plugin-vue`             | `^10.11.0` | Vue 规则                   |
| `@vue/eslint-config-typescript` | `^14.9.0`  | TS + Vue flat 预设         |
| `@vue/eslint-config-prettier`   | `^10.2.0`  | 关闭与 Prettier 冲突的规则 |
| `prettier`                      | `^3.9.8`   | 代码格式化                 |
| `globals`                       | `^17.12.0` | ESLint 全局变量定义        |
| `@types/node`                   | `^26.6.2`  | Node 类型                  |

### 浏览器兼容基线

| 浏览器        | 最低版本 |
| ------------- | -------- |
| Chrome / Edge | 105      |
| Safari        | 16       |
| Firefox       | 110      |

---

## 3. 本地开发环境搭建

### 3.1 前置要求

| 项       | 要求                               |
| -------- | ---------------------------------- |
| Node.js  | `>= 20.19.0`                       |
| 包管理器 | pnpm（推荐，`>= 9`）或 npm `>= 10` |
| 浏览器   | 见「浏览器兼容基线」               |

检查版本：

```bash
node -v     # 期望 v20.19.0 或更高
pnpm -v     # 期望 9.x / 10.x
```

### 3.2 安装与启动

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器（playground 演示页，默认 http://localhost:5173）
pnpm dev

# 如需自动打开浏览器
pnpm dev --open

# 3. 类型检查 / 代码规范 / 单元测试
pnpm typecheck
pnpm lint
pnpm test

# 4. 构建库产物
pnpm build
```

### 3.3 可用脚本

| 脚本                                | 说明                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                          | 启动 Vite 开发服务器，入口为 `index.html` → `playground/` |
| `pnpm build`                        | 库模式构建，产物输出到 `dist/`                            |
| `pnpm preview`                      | 预览构建后的产物                                          |
| `pnpm typecheck`                    | `vue-tsc --noEmit`，全量类型检查                          |
| `pnpm test`                         | `vitest run`，单次运行单元测试                            |
| `pnpm test:watch`                   | 测试监听模式                                              |
| `pnpm test:coverage`                | 生成覆盖率报告（`coverage/`）                             |
| `pnpm lint` / `pnpm lint:fix`       | ESLint 检查 / 自动修复                                    |
| `pnpm format` / `pnpm format:check` | Prettier 格式化 / 校验                                    |
| `pnpm prepublishOnly`               | 发布前钩子：lint → typecheck → test → build               |

### 3.4 目录结构

```
iiif-viewer/
├─ index.html                  # 开发/playground 入口（不参与库构建）
├─ vite.config.ts              # 库构建 + 开发服务器 + Vitest 配置
├─ vite.demo.config.ts         # 演示站构建配置（GitHub Pages，产物 demo-dist/）
├─ .github/workflows/          # deploy-demo.yml：演示站自动部署
├─ eslint.config.js            # ESLint 10 flat config
├─ tsconfig.json               # 基础配置（src + playground + tests）
├─ tsconfig.lib.json           # d.ts 生成专用配置
├─ playground/                 # 本地演示应用
├─ src/
│  ├─ index.ts                 # 公共入口（插件、组件、composables、类型）
│  ├─ core/                    # 纯函数能力层
│  │  ├─ iiif.ts               # 输入识别、info / manifest 归一化、structures 目录树
│  │  ├─ color.ts              # 色彩调节：范围夹取与 CSS filter 合成
│  │  └─ openseadragon.ts      # OSD 注入与兼容性校验（verifyOpenSeadragon）
│  ├─ types/                   # 全部对外类型
│  ├─ composables/             # useIiifSource / useOpenSeadragon / useViewerI18n 等
│  ├─ locales/                 # zh-CN / en-US 文案
│  ├─ components/              # 组件（含 base/ 基础原语）
│  │  ├─ ViewerColorPanel.vue  # 色彩调节面板（亮度 / 对比度 / 饱和度）
│  │  └─ ViewerToc.vue         # 目录（TOC）树
│  └─ styles/                  # 设计 token 与基础样式
└─ tests/                      # Vitest 单元测试
```

### 3.5 常见问题

| 现象                                                       | 原因与处理                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ERR_PNPM_UNSUPPORTED_ENGINE` 或 Vite 启动报 Node 版本错误 | Node 版本低于 20.19.0，请升级 Node                                                                          |
| `Port 5173 is already in use`                              | 换端口：`pnpm dev --port 5188 --strictPort`                                                                 |
| 安装时出现 peer 依赖警告                                   | 需同时安装 peer 依赖：`pnpm add vue openseadragon`（本仓库已作为 devDependencies 安装，供 playground 使用） |
| 页面样式错乱（无边框 / 无玻璃态）                          | 未引入样式文件，请确认代码中包含 `import '@tony2y/iiif-viewer/style.css'`                                   |
| 跨域瓦片在控制台出现 WebGL 纹理告警                        | 见 [6.3 常见问题与排查](#63-常见问题与排查)，推荐传入 `crossOriginPolicy: 'Anonymous'`                      |


## 4. 组件使用方法与示例代码

### 4.1 安装依赖

```bash
# pnpm
pnpm add @tony2y/iiif-viewer openseadragon

# npm
npm install @tony2y/iiif-viewer openseadragon
```

### 4.2 引入样式（必需）

样式未内联到 JS 中，必须显式引入一次：

```ts
import '@tony2y/iiif-viewer/style.css'
```

### 4.3 用法一：按需引入单个组件（推荐）

```vue
<!-- App.vue -->
<script setup lang="ts">
import { IiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const source =
  'https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json'
</script>

<template>
  <div style="height: 640px">
    <IiifViewer :source="source" locale="zh-CN" />
  </div>
</template>
```

### 4.4 用法二：插件全局注册（可设置全局默认值）

```ts
// main.ts
import { createApp } from 'vue'
import { createIiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'
import App from './App.vue'

createApp(App)
  .use(
    createIiifViewer({
      // 以下均为全局默认值，可被单个组件的 Props 覆盖
      locale: 'zh-CN',
      theme: 'dark',
      toolbar: { position: 'bottom' },
      osdOptions: { crossOriginPolicy: 'Anonymous' },
    }),
  )
  .mount('#app')
```

注册后会全局可用以下组件：`IiifViewer`、`ViewerToolbar`、`ViewerStatusBar`、`ViewerThumbnails`、`ViewerInfoPanel`、`ViewerColorPanel`、`ViewerToc`、`ViewerLoading`、`ViewerError`、`ViewerButton`、`ViewerIcon`、`ViewerTooltip`。

### 4.5 示例：manifest 多画布 + 缩略图 + 信息面板

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

// 该地址形如 /presentation/{id}，不含 "manifest" 字样：
// 组件会先尝试 <url>/info.json，失败后回退请求原始地址并按响应内容识别为 manifest
const source = 'https://iiif.wellcomecollection.org/presentation/b18035723'

const viewer = ref<IiifViewerExposed | null>(null)

function zoomIn() {
  viewer.value?.zoomIn(1.5)
}
</script>

<template>
  <div style="height: 720px">
    <IiifViewer
      ref="viewer"
      :source="source"
      :show-thumbnails="true"
      :show-info-panel="true"
      :toolbar="{ position: 'bottom' }"
      :osd-options="{ crossOriginPolicy: 'Anonymous' }"
      @load-success="(p) => console.log('已加载画布数：', p.canvases.length)"
      @page-change="(p) => console.log('当前页：', p.index + 1, '/', p.total)"
      @load-error="(e) => console.error('加载失败：', e.code, e.message)"
    />
  </div>
</template>
```

### 4.6 示例：多语言与主题

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const locale = ref<'zh-CN' | 'en-US'>('zh-CN')
const theme = ref<'dark' | 'light' | 'auto'>('dark')

// 覆盖 / 扩展内置文案（key 与内置一致，未覆盖的自动回退内置值）
const messages = {
  'toolbar.zoomIn': '放大一点',
  'viewer.label': '馆藏图像查看器',
}
</script>

<template>
  <input v-model="locale" />
  <select v-model="theme">
    <option value="dark">暗色</option>
    <option value="light">亮色</option>
    <option value="auto">跟随系统</option>
  </select>

  <div style="height: 560px">
    <IiifViewer
      source="https://example.org/iiif/id/info.json"
      :locale="locale"
      :theme="theme"
      :messages="messages"
    />
  </div>
</template>
```

### 4.7 示例：通过 ref 调用命令式方法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const viewer = ref<IiifViewerExposed | null>(null)

function actions() {
  viewer.value?.open('https://example.org/iiif/another/info.json') // 切换资源
  viewer.value?.rotateTo(90) // 旋转到 90°
  viewer.value?.goToPage(3) // 跳到第 4 个画布
  viewer.value?.toggleFullscreen()

  // 读取实时状态
  console.log(viewer.value?.getState())
  // 底层 OpenSeadragon 实例（高级用法）
  console.log(viewer.value?.viewer)
}
</script>

<template>
  <div style="height: 560px">
    <IiifViewer ref="viewer" source="https://example.org/manifest.json" />
  </div>
  <button type="button" @click="actions">执行</button>
</template>
```

### 4.8 示例：CDN / UMD 直接引入（无需打包器）

UMD 产物会暴露全局变量 `IiifViewer`，并把 `Vue`、`OpenSeadragon` 视为外部全局。

```html
<link rel="stylesheet" href="https://unpkg.com/@tony2y/iiif-viewer/dist/iiif-viewer.css" />
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/openseadragon@6/build/openseadragon/openseadragon.min.js"></script>
<script src="https://unpkg.com/@tony2y/iiif-viewer/dist/index.umd.cjs"></script>

<div id="app" style="height: 640px"></div>
<script>
  const { createApp, h } = Vue

  createApp({
    render() {
      return h(IiifViewer.IiifViewer, {
        source:
          'https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json',
        locale: 'zh-CN',
      })
    },
  }).mount('#app')
</script>
```

### 4.9 示例：自定义插槽

```vue
<IiifViewer :source="source">
  <!-- 自定义加载态 -->
  <template #loading>
    <div class="my-loading">正在打开馆藏图像…</div>
  </template>

  <!-- 自定义错误态（可用作用域参数拿到错误与重试方法） -->
  <template #error="{ error, retry }">
    <div class="my-error">
      <p>{{ error.code }}</p>
      <button type="button" @click="retry">再试一次</button>
    </div>
  </template>

  <!-- 在工具栏右侧追加自定义动作 -->
  <template #toolbar-extra="{ state }">
    <button type="button" @click="download(state)">下载</button>
  </template>
</IiifViewer>
```

### 4.10 示例：双页阅读

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const source = 'https://iiif.wellcomecollection.org/presentation/b18035723'
const viewer = ref<IiifViewerExposed | null>(null)

// 也可用 viewer.value?.toggleDoublePage() 命令式切换
function toSpread() {
  viewer.value?.setDoublePage(true)
}
</script>

<template>
  <div style="height: 720px">
    <IiifViewer
      ref="viewer"
      :source="source"
      :initial-double-page="true"
      :toolbar="{ position: 'bottom', doublePage: true }"
      @double-page-change="(v) => console.log('双页模式：', v)"
      @page-change="(p) => console.log('当前页：', p.index + 1, '/', p.total)"
    />
  </div>
  <button type="button" @click="toSpread">切换为双页</button>
</template>
```

> 双页模式下 `currentIndex` 会被吸附到**偶数下标**，一屏渲染 `[start, start + 1]`，**两页等高、书脊处紧贴无缝**（像一本摊开的书），翻页步进为 2；最后一跨页可能只剩 1 页（此时单页满宽显示）；画布总数为 1 时不产生跨页。工具栏仅在画布数 > 1 时渲染切换按钮，其图标 / 文案反映**当前**模式（单页 → 「单页显示」+ 书本图标；双页 → 「双页显示」+ 打开的书本图标），切换态用 `aria-pressed` 表达。

### 4.11 示例：色彩调节

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const viewer = ref<IiifViewerExposed | null>(null)

// 也可以只传部分字段，其余保持当前值
function dim() {
  viewer.value?.setColors({ brightness: 80 })
}
function reset() {
  viewer.value?.resetColors()
}
</script>

<template>
  <div style="height: 640px">
    <IiifViewer
      ref="viewer"
      source="https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json"
      :color-adjust="true"
      @colors-change="(c) => console.log('亮度 / 对比度 / 饱和度：', c)"
      @color-toggle="(open) => console.log('色彩面板：', open)"
    />
  </div>
  <button type="button" @click="dim">降低亮度</button>
  <button type="button" @click="reset">重置</button>
</template>
```

> 亮度、对比度取值范围为 `50–150`，饱和度为 `0–200`，**中性值均为 100**。三项均在 100 时 `filter` 会被清空，避免无谓的合成层。设为 `colorAdjust: false` 时工具栏不显示色彩按钮、不渲染面板，且画面滤镜被清除。

### 4.12 示例：注入自定义 OpenSeadragon

```vue
<script setup lang="ts">
import { IiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

// 页面已通过 <script> 引入了某个 OSD 构建，显式指定其来源
const osd = window.OpenSeadragon as typeof import('openseadragon')
</script>

<template>
  <div style="height: 640px">
    <IiifViewer :source="source" :openseadragon="osd" />
  </div>
</template>
```

> 不传 `openseadragon` 时使用 `peerDependencies` 中的实例。仅在需要指定自编译版本、页面存在多份 OSD、或经 CDN 全局变量引入时才需要注入；传入对象会先经过 `verifyOpenSeadragon()` 校验，详见 [2. 技术栈与版本](#2-技术栈与版本)。

---

## 5. 完整参数配置说明

### 5.1 Props

| 参数                | 类型                                        | 默认值                                      | 可选值 / 说明                                                                                                 |
| ------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `source`            | `string \| IiifTileSource \| Array`         | **必填**                                    | Image API 服务基址、`info.json` 地址、`manifest.json` 地址、静态图片地址，或现成的 OSD tileSource（支持数组） |
| `sourceType`        | `'auto' \| 'info' \| 'manifest' \| 'image'` | `'auto'`                                    | 强制指定输入类型；`auto` 为启发式识别 + 按响应内容二次判定                                                    |
| `locale`            | `string`                                    | 插件配置 → `navigator.language` → `'en-US'` | 界面语言，内置 `zh-CN` / `en-US`；其他值会按 `zh*` / `en*` 归一化，未知则回退 `en-US`                         |
| `messages`          | `Record<string, string>`                    | `undefined`                                 | 覆盖 / 扩展内置文案，key 见 [5.6 文案 key](#56-文案-key)                                                      |
| `theme`             | `'dark' \| 'light' \| 'auto'`               | 插件配置 → `'dark'`                         | `auto` 表示跟随系统 `prefers-color-scheme`                                                                    |
| `toolbar`           | `boolean \| IiifViewerToolbarOptions`       | `true`                                      | `false` 隐藏工具栏；传对象可逐项开关，见 [5.2 工具栏配置](#52-工具栏配置)                                     |
| `showNavigator`     | `boolean`                                   | `true`                                      | 是否显示右上角的导航图（小地图）；运行期修改即时生效（初始为 `false` 时改为 `true` 会重建实例）               |
| `showStatusBar`     | `boolean`                                   | `true`                                      | 是否显示底部状态栏                                                                                            |
| `showThumbnails`    | `boolean`                                   | `false`                                     | 缩略图条的**初始**展开状态；仅多画布生效，单画布自动不渲染                                                    |
| `showInfoPanel`     | `boolean`                                   | `false`                                     | 元数据面板的**初始**展开状态                                                                                  |
| `keyboardShortcuts` | `boolean`                                   | `true`                                      | 是否启用键盘快捷键（仅在舞台获得焦点时生效）                                                                  |
| `fitMode`           | `'contain' \| 'width' \| 'height'`          | `'contain'`                                 | 初始适配方式：完整显示 / 宽度铺满 / 高度铺满                                                                  |
| `minZoom`           | `number`                                    | `0.5`                                       | 最小缩放倍数，映射为 OSD `minZoomImageRatio`                                                                  |
| `maxZoom`           | `number`                                    | `20`                                        | 最大缩放倍数，映射为 OSD `maxZoomPixelRatio`                                                                  |
| `rotateStep`        | `number`                                    | `90`                                        | 旋转步进角度（度）                                                                                            |
| `timeout`           | `number`                                    | `15000`                                     | 拉取 `info.json` / `manifest.json` 的超时毫秒数                                                               |
| `aspectRatio`       | `string \| number`                          | `'4 / 3'`                                   | 舞台宽高比，如 `'16 / 9'`、`1`；设为 `'auto'` 时撑满父容器高度（此时**父容器必须有确定高度**）                |
| `osdOptions`        | `Partial<OpenSeadragon.Options>`            | `undefined`                                 | 透传 / 覆盖 OpenSeadragon 原生配置，**优先级最高**                                                            |
| `initialDoublePage` | `boolean`                                   | `false`                                     | 初始是否以「双页展开」显示；运行期修改该 Prop 也会同步切换，等价于调用 `setDoublePage()`                      |
| `colorAdjust`       | `boolean`                                   | `true`                                      | 是否启用「亮度 / 对比度 / 饱和度」调节；`false` 时隐藏按钮、不渲染面板并清除画面滤镜                          |
| `pageTransition`    | `IiifViewerPageTransition`                  | `false`                                     | 翻页 / 换资源过渡：`false` 关闭，或传 `'fade'` / `'zoom-swap'` 预设名与细项配置；减弱动效时自动降级           |
| `openseadragon`     | `OpenseadragonNamespace`                    | `undefined`                                 | 显式指定 OpenSeadragon 来源（不传则用 peerDependency）；传入对象会经 `verifyOpenSeadragon()` 校验             |

#### 与 OSD 的默认配置差异

组件内部会关闭 OpenSeadragon 自带的导航控件，改由自有工具栏驱动，默认值如下（均可被 `osdOptions` 覆盖）：

```ts
{
  showNavigationControl: false,
  showZoomControl: false,
  showHomeControl: false,
  showFullPageControl: false,
  showRotationControl: false,
  keyboardNavEnabled: false,        // 键盘交互由组件在舞台层统一处理
  navigatorPosition: 'TOP_RIGHT',
  navigatorSizeRatio: 0.16,
  navigatorAutoFade: false,
  visibilityRatio: 0.6,
  constrainDuringPan: false,
  preserveViewport: true,           // 由组件决定何时重新适配，翻页因此不会整幅复位
  wrapHorizontal: false,
  wrapVertical: false,
  animationTime: 0.8,               // prefers-reduced-motion 时为 0
  springStiffness: 10,              // prefers-reduced-motion 时为 100
  gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true, pinchToZoom: true, flickEnabled: true, flickMomentum: 0.18, pinchRotate: false },
  gestureSettingsTouch: { pinchToZoom: true, dblClickToZoom: true, flickEnabled: true, flickMomentum: 0.18, pinchRotate: false },
}
```

> 导航图与显示区域的颜色使用 `var(--iiif-navigator-*)` 表达，因此切换主题时无需重建 OSD 实例即可自动跟随。

### 5.2 工具栏配置

```ts
interface IiifViewerToolbarOptions {
  position?: 'top' | 'bottom' | 'left' | 'right' // 停靠位置，默认 'bottom'
  zoom?: boolean // 放大 / 缩小，默认 true
  rotate?: boolean // 左旋 / 右旋，默认 true
  flip?: boolean // 水平翻转，默认 true
  reset?: boolean // 复位视图，默认 true
  fullscreen?: boolean // 全屏切换，默认 true
  pageNav?: boolean // 上一页 / 下一页，默认 true（仅多画布渲染）
  thumbnails?: boolean // 缩略图开关，默认 true（仅多画布渲染）
  info?: boolean // 元数据面板开关，默认 true
  doublePage?: boolean // 单页 / 双页切换，默认 true（仅画布数 > 1 时渲染）
}
```

用法示例：

```vue
<IiifViewer :source="source" :toolbar="{ position: 'right', rotate: false, flip: false }" />
<IiifViewer :source="source" :toolbar="false" />
```

窄容器（宽度 < 480px）下，工具栏只保留 `缩小 / 放大 / 复位 / 向左旋转 / 向右旋转 / 全屏`，其余动作自动收进「更多」弹出菜单。

### 5.3 Events

| 事件                    | 载荷                                        | 触发时机                                                               |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `ready`                 | `viewer: OpenSeadragon.Viewer`              | OpenSeadragon 实例创建完成                                             |
| `destroy`               | —                                           | 组件卸载、实例销毁                                                     |
| `load-start`            | `source: IiifViewerSource`                  | 开始加载资源                                                           |
| `load-success`          | `{ kind, imageInfo?, manifest?, canvases }` | 资源加载成功（`kind` ∈ `info` / `manifest` / `image` / `tile-source`） |
| `load-error`            | `error: IiifViewerErrorLike`                | 资源加载失败（含 `code` 与 `i18nKey`）                                 |
| `zoom-change`           | `zoom: number`                              | 缩放百分比变化（100 表示 1:1）                                         |
| `rotation-change`       | `degrees: number`                           | 旋转角度变化（0–359）                                                  |
| `flip-change`           | `flipped: boolean`                          | 翻转状态变化                                                           |
| `page-change`           | `{ index: number; total: number }`          | 画布切换（`index` 从 0 开始）                                          |
| `double-page-change`    | `value: boolean`                            | 单页 / 双页模式切换                                                    |
| `colors-change`         | `colors: IiifColorAdjustments`              | 色彩调节值变化（已归一化）                                             |
| `color-toggle`          | `open: boolean`                             | 色彩调节面板开合                                                       |
| `fullscreen-change`     | `value: boolean`                            | 全屏状态变化                                                           |
| `progress-change`       | `percent: number`                           | 瓦片加载进度变化（0–100）                                              |
| `info-toggle`           | `open: boolean`                             | 元数据面板开合                                                         |
| `page-transition-start` | `IiifViewerPageTransitionPayload`           | 翻页过渡开始（未启用 `pageTransition` 时不派发）                       |
| `page-transition-end`   | `IiifViewerPageTransitionPayload`           | 翻页过渡结束；被新的过渡中断时同样派发                                 |

### 5.4 Slots

| 插槽            | 作用域参数                                          | 说明                       |
| --------------- | --------------------------------------------------- | -------------------------- |
| `loading`       | —                                                   | 替换内置加载覆盖层         |
| `error`         | `{ error: IiifViewerErrorLike; retry: () => void }` | 替换内置错误覆盖层         |
| `toolbar-extra` | `{ state: IiifViewerState }`                        | 在工具栏右侧追加自定义动作 |

### 5.5 暴露的方法（`defineExpose`）

| 方法 / 属性                       | 签名                                               | 说明                                                          |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `viewer`                          | `OpenSeadragon.Viewer \| null`                     | 底层 OSD 实例；未就绪时为 `null`                              |
| `getState()`                      | `() => IiifViewerState`                            | 获取实时状态快照                                              |
| `open(source)`                    | `(source: IiifViewerSource) => void`               | 切换资源（优先级高于 `source` Prop，`source` 变化后自动清除） |
| `zoomIn(step?)`                   | `(step?: number) => void`                          | 放大，默认步进 1.5                                            |
| `zoomOut(step?)`                  | `(step?: number) => void`                          | 缩小，默认步进 1.5                                            |
| `zoomTo(zoom)`                    | `(zoom: number) => void`                           | 缩放到 OSD 视口缩放值                                         |
| `resetHome()`                     | `() => void`                                       | 复位翻转 / 旋转并回到初始视图                                 |
| `rotateBy(degrees)`               | `(degrees: number) => void`                        | 在当前角度上累加旋转                                          |
| `rotateTo(degrees, immediately?)` | `(degrees: number, immediately?: boolean) => void` | 旋转到指定角度                                                |
| `flipHorizontal()`                | `() => void`                                       | 切换水平翻转                                                  |
| `goToPage(index)`                 | `(index: number) => void`                          | 跳转到指定画布                                                |
| `prevPage()` / `nextPage()`       | `() => void`                                       | 上一 / 下一画布                                               |
| `setDoublePage(enabled)`          | `(enabled: boolean) => void`                       | 设置双页展开模式（切到双页时把当前页吸附到跨页起点）          |
| `toggleDoublePage()`              | `() => void`                                       | 切换双页展开模式                                              |
| `setNavigatorVisible(v)`          | `(visible: boolean) => void`                       | 显示 / 隐藏右上角导航图，等价于 `showNavigator` Prop          |
| `setColors(partial)`              | `(partial: Partial<IiifColorAdjustments>) => void` | 设置色彩调节（可只传部分字段，其余保持当前值）                |
| `resetColors()`                   | `() => void`                                       | 重置色彩调节为中性值（100 / 100 / 100）                       |
| `toggleFullscreen()`              | `() => void`                                       | 切换全屏                                                      |
| `retry()`                         | `() => void`                                       | 重新加载当前资源                                              |

`IiifViewerState` 结构：

```ts
{
  zoomPercent: number       // 缩放百分比，100 表示图像原始像素 1:1
  rotation: number          // 0–359
  flipped: boolean
  page: number              // 当前画布索引，从 0 开始
  total: number
  fullscreen: boolean
  canGoPrev: boolean
  canGoNext: boolean
  progress: number          // 0–100
  doublePage: boolean       // 是否处于双页展开模式
  colors: IiifColorAdjustments // 当前生效的色彩调节值
  imageInfo?: IiifImageInfo
  manifest?: IiifManifest
  canvas?: IiifCanvas
}
```

### 5.6 文案 key

通过 `messages` 覆盖时使用以下 key（未覆盖的自动回退内置值）：

| 分组     | key                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 组件     | `viewer.label`                                                                                                                                                                                                                                                                                                                                        |
| 工具栏   | `toolbar.label`、`toolbar.zoomIn`、`toolbar.zoomOut`、`toolbar.reset`、`toolbar.rotateLeft`、`toolbar.rotateRight`、`toolbar.flipHorizontal`、`toolbar.fullscreen`、`toolbar.exitFullscreen`、`toolbar.prev`、`toolbar.next`、`toolbar.thumbnails`、`toolbar.info`、`toolbar.more`、`toolbar.doublePage`、`toolbar.singlePage`、`toolbar.colorAdjust` |
| 状态栏   | `status.loading`、`status.page`、`status.pageRange`、`status.spread`、`status.zoom`、`status.rotated`、`status.flipped`                                                                                                                                                                                                                               |
| 空状态   | `empty.noCanvas`                                                                                                                                                                                                                                                                                                                                      |
| 信息面板 | `info.title`、`info.description`、`info.metadata`、`info.rights`、`info.provider`、`info.rawManifest`、`info.close`、`info.tabs.toc`、`info.tabs.info`、`info.toc.empty`                                                                                                                                                                              |
| 色彩调节 | `color.title`、`color.brightness`、`color.contrast`、`color.saturation`、`color.neutral`、`color.reset`、`color.close`                                                                                                                                                                                                                                |
| 无障碍   | `a11y.shortcutsHint`、`a11y.thumbnails`、`a11y.retry`                                                                                                                                                                                                                                                                                                 |
| 错误     | `errors.<CODE>.title`、`errors.<CODE>.desc`（`<CODE>` 见 [5.7 错误码](#57-错误码)）                                                                                                                                                                                                                                                                   |

`status.page` / `status.pageRange` / `status.zoom` / `status.rotated` 支持 `{name}` 形式插值：`status.page` 的模板为 `第 {current} / {total} 页`，`status.pageRange` 的模板为 `第 {from}–{to} / {total} 页`（双页展开时显示页码范围）。

### 5.7 错误码

`IiifViewerError` 携带稳定的 `code`，可通过 `error.code` 做程序化分支，或通过 `error.i18nKey`（形如 `errors.TIMEOUT`）查表取文案。

| 错误码                | 含义                                                  |
| --------------------- | ----------------------------------------------------- |
| `INVALID_SOURCE`      | 传入的 `source` 为空或无法识别                        |
| `INVALID_SOURCE_TYPE` | `sourceType` 与实际内容不符                           |
| `NETWORK_ERROR`       | 网络异常（DNS / CORS / 断网）                         |
| `HTTP_ERROR`          | 服务端返回非 2xx 状态码                               |
| `TIMEOUT`             | 请求超时（见 `timeout` Prop）                         |
| `UNSUPPORTED_VERSION` | IIIF 版本不受支持，或传入的是 IIIF Collection         |
| `INVALID_IIIF_INFO`   | `info.json` 结构非法或缺字段（如 `width` / `height`） |
| `INVALID_MANIFEST`    | `manifest` 结构非法                                   |
| `NO_CANVAS`           | manifest 中没有任何可渲染的画布                       |
| `OSD_INIT_FAILED`     | OpenSeadragon 初始化失败或瓦片源无法打开              |

### 5.8 插件配置（`createIiifViewer`）

| 参数                | 类型                                  | 默认值      | 说明                        |
| ------------------- | ------------------------------------- | ----------- | --------------------------- |
| `locale`            | `string`                              | `undefined` | 全局默认语言                |
| `messages`          | `Record<string, string>`              | `undefined` | 全局默认文案覆盖            |
| `theme`             | `'dark' \| 'light' \| 'auto'`         | `undefined` | 全局默认主题                |
| `toolbar`           | `boolean \| IiifViewerToolbarOptions` | `undefined` | 全局默认工具栏配置          |
| `osdOptions`        | `Partial<OpenSeadragon.Options>`      | `undefined` | 全局默认 OSD 配置           |
| `initialDoublePage` | `boolean`                             | `undefined` | 全局默认是否为双页展开      |
| `colorAdjust`       | `boolean`                             | `undefined` | 全局是否启用色彩调节模块    |
| `pageTransition`    | `IiifViewerPageTransition`            | `undefined` | 全局默认翻页过渡效果        |
| `openseadragon`     | `OpenseadragonNamespace`              | `undefined` | 全局指定 OpenSeadragon 实例 |

优先顺序：**组件 Props > 插件配置 > 内置默认值**。

### 5.9 CSS 变量（设计 token）

所有变量作用域限定在 `.iiif-viewer` 内，不会污染宿主页面。通过在外部覆盖同名变量即可定制主题：

```css
.my-page .iiif-viewer {
  --iiif-color-accent: #b45309;
  --iiif-radius-md: 4px;
  --iiif-font-ui: 'Noto Sans SC', system-ui, sans-serif;
}
```

| 分组   | 变量                                                                | 暗色默认值                        | 亮色值                  |
| ------ | ------------------------------------------------------------------- | --------------------------------- | ----------------------- |
| 基础   | `--iiif-color-bg`                                                   | `#0b0c0e`                         | `#fafafa`               |
|        | `--iiif-color-surface`                                              | `#141619`                         | `#ffffff`               |
|        | `--iiif-color-surface-2`                                            | `#1c1f24`                         | `#f1f3f5`               |
|        | `--iiif-color-fg`                                                   | `#f4f5f7`                         | `#09090b`               |
|        | `--iiif-color-fg-muted`                                             | `#9ba1a9`                         | `#475569`               |
|        | `--iiif-color-border`                                               | `rgba(255,255,255,.10)`           | `#e4e4e7`               |
|        | `--iiif-color-border-strong`                                        | `rgba(255,255,255,.18)`           | `#d4d4d8`               |
| 强调   | `--iiif-color-accent`                                               | `#0e7490`                         | `#0e7490`               |
|        | `--iiif-color-accent-hover`                                         | `#0891b2`                         | `#155e75`               |
|        | `--iiif-color-accent-fg`                                            | `#ffffff`                         | `#ffffff`               |
|        | `--iiif-color-accent-text`                                          | `#22d3ee`                         | `#0e7490`               |
|        | `--iiif-color-danger`                                               | `#ef4444`                         | `#dc2626`               |
|        | `--iiif-color-danger-fg`                                            | `#ffffff`                         | `#ffffff`               |
|        | `--iiif-color-danger-soft`                                          | `rgba(239,68,68,.16)`             | `rgba(220,38,38,.12)`   |
|        | `--iiif-color-ring`                                                 | `#22d3ee`                         | `#0e7490`               |
| 玻璃态 | `--iiif-glass-bg`                                                   | `rgba(20,22,25,.72)`              | `rgba(255,255,255,.74)` |
|        | `--iiif-popup-bg`                                                   | `rgba(20,22,25,.94)`              | `rgba(255,255,255,.96)` |
|        | `--iiif-glass-border`                                               | `rgba(255,255,255,.14)`           | `rgba(9,9,11,.1)`       |
|        | `--iiif-glass-blur`                                                 | `14px`                            | 同                      |
|        | `--iiif-overlay-scrim`                                              | `rgba(6,7,9,.72)`                 | `rgba(250,250,250,.76)` |
| 导航图 | `--iiif-navigator-bg`                                               | `#0b0c0e`                         | `#ffffff`               |
|        | `--iiif-navigator-border`                                           | `rgba(255,255,255,.18)`           | `rgba(9,9,11,.16)`      |
|        | `--iiif-navigator-region`                                           | `#22d3ee`                         | `#0e7490`               |
| 间距   | `--iiif-space-1` … `--iiif-space-6`                                 | `4 / 8 / 12 / 16 / 24 / 32 px`    | 同                      |
| 圆角   | `--iiif-radius-sm` / `md` / `lg` / `full`                           | `6px` / `10px` / `14px` / `999px` | 同                      |
| 阴影   | `--iiif-shadow-sm` / `md` / `lg`                                    | 见 `src/styles/tokens.css`        | 更浅                    |
| 排印   | `--iiif-font-ui`                                                    | 系统无衬线字体栈                  | 同                      |
|        | `--iiif-font-display`                                               | 系统衬线字体栈                    | 同                      |
|        | `--iiif-font-mono`                                                  | 系统等宽字体栈                    | 同                      |
|        | `--iiif-font-size-xs` … `xl`                                        | `11 / 12 / 13 / 15 / 18 px`       | 同                      |
|        | `--iiif-line-height`                                                | `1.5`                             | 同                      |
| 动效   | `--iiif-duration-fast` / `--iiif-duration` / `--iiif-duration-slow` | `150ms` / `200ms` / `300ms`       | 同                      |
|        | `--iiif-ease`                                                       | `cubic-bezier(.22,.61,.36,1)`     | 同                      |
| 层级   | `--iiif-z-stage` / `overlay` / `panel` / `toolbar` / `popup`        | `1 / 5 / 15 / 20 / 30`            | 同                      |
|        | `--iiif-toolbar-clearance`                                          | `64px`                            | 同                      |
| 焦点   | `--iiif-focus-ring`                                                 | 双层 `box-shadow` 焦点环          | 同                      |

> 侧边面板（`--iiif-z-panel: 15`）刻意低于悬浮工具栏（`--iiif-z-toolbar: 20`），避免抽屉盖住工具栏导致按钮点不到；面板内容底部另留 `--iiif-toolbar-clearance`（`64px`）的空隙，使内容不被工具栏遮挡。
>
> 系统开启「减弱动态效果」时，`--iiif-duration-*` 会自动降为 `0.01ms`。

### 5.10 键盘快捷键

仅在舞台（`.iiif-viewer__stage`）获得焦点时生效；`keyboardShortcuts` 设为 `false` 可整体关闭。

| 按键            | 行为                        |
| --------------- | --------------------------- |
| `+` / `=` / `↑` | 放大                        |
| `-` / `_` / `↓` | 缩小                        |
| `0`             | 复位视图                    |
| `R`             | 顺时针旋转 `rotateStep`     |
| `Shift + R`     | 逆时针旋转 `rotateStep`     |
| `F`             | 切换全屏                    |
| `←` / `→`       | 上一 / 下一画布（多画布时） |
| `I`             | 切换元数据面板              |
| `Esc`           | 关闭信息面板 / 色彩调节面板 |

### 5.11 高级用法：直接使用核心能力

适合二次封装或与自有状态管理集成：

```ts
import {
  IiifViewerError,
  detectResourceKind,
  getIiifDocument,
  getImageInfo,
  getManifest,
  parseManifest,
  parseImageInfo,
  parseStructures,
  findFirstCanvasIndex,
  buildImageFilter,
  verifyOpenSeadragon,
  toTileSource,
  tileSourceKey,
  createOsdOptions,
  resolveUrl,
  useIiifSource,
  useOpenSeadragon,
  useViewerI18n,
} from '@tony2y/iiif-viewer'

try {
  // 一次调用同时兼容 info.json 与 manifest（含内容二次判定与失败回退）
  const doc = await getIiifDocument('https://example.org/presentation/123', { locale: 'zh-CN' })
  if (doc.kind === 'manifest') {
    console.log(doc.manifest?.canvases.length)
  } else {
    console.log(doc.imageInfo?.width, doc.imageInfo?.height)
  }
} catch (error) {
  if (error instanceof IiifViewerError) {
    console.error(error.code, error.i18nKey)
  }
}
```

---

## 6. 附录

### 6.1 无障碍与交互设计约束

- 所有可点击元素均提供 hover / active / `:focus-visible` 反馈，过渡时长 150–300ms
- 图标全部为内联矢量 SVG，统一 `stroke-width: 1.75`，不使用 emoji 作为结构性图标
- 装饰性图标设置 `aria-hidden="true"`；图标按钮具备 `aria-label` 与 Tooltip，切换态通过 `aria-pressed` 表达
- 元数据面板与色彩调节面板使用 `role="dialog"` + `aria-labelledby`，打开时聚焦关闭按钮、关闭时归还焦点，支持 `Esc`；色彩滑杆带 `<label for>` 与 `aria-valuetext`
- 信息面板的「目录 / 作品信息」Tab 使用 `role="tablist" / "tab" / "tabpanel"` + roving `tabindex`，支持 `←` `→` `Home` `End` 切换（焦点移动即激活）
- 触摸设备下按钮命中区自动放大到 44×44px
- 完整支持 `prefers-reduced-motion: reduce`：运行期切换即时生效，翻页过渡同时自动降级为无动画

### 6.2 响应式行为

| 容器宽度 | 行为                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≥ 480px  | 完整工具栏、状态栏显示标题与旋转/翻转信息、缩略图 60×60                                                                                                            |
| < 480px  | 工具栏精简为「缩小 / 放大 / 复位 / 向左旋转 / 向右旋转 / 全屏 / ⋯更多」；左右停靠自动降级为贴底；状态栏精简为「页码 + 缩放」；缩略图 48×48；元数据面板改为底部抽屉 |

判断依据是**组件容器的实际宽度**（CSS 容器查询 + `ResizeObserver`），与浏览器视口宽度解耦，因此在任意布局中都能正确响应。

### 6.3 常见问题与排查

**Q：跨域图像在控制台出现 WebGL 纹理创建失败的告警，画面仍能显示但性能一般？**

这是 OpenSeadragon 的 WebGL 绘制器在无法读取跨域像素时会自动回退到 Canvas 绘制器，功能不受影响。若图像服务已正确配置 CORS（IIIF Image API 规范要求如此），推荐显式开启跨域策略以获得 WebGL 加速并支持 `canvas` 导出：

```vue
<IiifViewer :source="source" :osd-options="{ crossOriginPolicy: 'Anonymous' }" />
```

或全局设置：

```ts
app.use(createIiifViewer({ osdOptions: { crossOriginPolicy: 'Anonymous' } }))
```

> 注意：若某些图像未配置 CORS 响应头，开启后会导致加载失败，因此组件默认**不**强制开启。

**Q：传入的地址不含 `manifest` 字样，能识别吗？**

可以。识别顺序为：URL 启发式（含 `manifest` / `/collection/` / `/presentation/`）→ 请求 `{url}/info.json` → 若响应体其实是 manifest 则改按 manifest 解析 → 若 `info.json` 请求失败则回退请求原始地址并按内容判定。

**Q：为什么 IIIF 图像的 tileSource 传的是地址字符串，而不是 `{ type: 'iiif', url }`？**

OpenSeadragon 的 `IIIFTileSource.supports()` 只依据 `info.json` 的**内容特征**（`protocol` / `@context` 等）判断，并不识别 `{ type: 'iiif', url }` 这种写法；只有 `{ type: 'image', url }` 是 OSD 明确支持的内联配置。组件已按此约定自动生成对应的 tileSource，使用者无需关心。

**Q：`aspectRatio` 设为 `'auto'` 后查看器高度塌陷？**

`'auto'` 表示撑满父容器高度，此时**父容器必须有确定高度**（如 `height: 640px` 或 flex 布局下的具体高度）。若希望组件自行决定高度，请使用 `'4 / 3'`、`'16 / 9'` 等具体比值。

**Q：单画布资源下看不到缩略图条和翻页按钮？**

这是预期行为：`pageNav` 与 `thumbnails` 仅在 `canvases.length > 1` 时渲染。

**Q：右侧面板打开后，悬浮工具栏还能点到吗？**

能。侧边面板的层级（`--iiif-z-panel: 15`）**刻意低于**悬浮工具栏（`--iiif-z-toolbar: 20`），因此抽屉不会盖住工具栏、按钮始终可点；面板内容底部另留 `--iiif-toolbar-clearance`（`64px`）的空隙，避免底部内容被工具栏遮挡。

**Q：如何关闭色彩调节模块？滤镜会影响导航图吗？**

把 `colorAdjust` 设为 `false` 即可：工具栏不显示色彩按钮、不渲染面板，画面滤镜也会被清除（也可全局设置 `createIiifViewer({ colorAdjust: false })`）。滤镜只内联在 OSD 的 `.openseadragon-canvas` 容器上，**导航图是独立元素，不会被一起染色**；且对 Canvas / WebGL / HTML 三种绘制器都生效。

**Q：如何注入通过 CDN `<script>` 引入的 OpenSeadragon？**

若页面只有全局变量 `window.OpenSeadragon`（而没有走打包器解析），把它传给 `openseadragon` Prop 或插件配置即可：

```ts
app.use(createIiifViewer({ openseadragon: window.OpenSeadragon }))
```

传入对象需与 OSD 默认导出同构（既可调用，也挂载 `Viewer` / `Viewport` 等成员），并会经 `verifyOpenSeadragon()` 校验，详见 [2. 技术栈与版本](#2-技术栈与版本)。

### 6.4 本地验证过的公开 IIIF 资源

playground 预设了以下资源用于端到端验证：

| 资源                                                                    | 类型                     | 说明                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `https://iiif.wellcomecollection.org/presentation/b18035723`            | Presentation 3 · 36 画布 | 多语言标签、metadata、rights、provider、画布缩略图；含目录结构（Front Cover / Title Page / Back Cover） |
| `https://iiif.harvardartmuseums.org/manifests/object/299843`            | Presentation 2 · 单画布  | v2 manifest 与 8 项元数据                                                                               |
| `https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json`         | Presentation 3 · 5 画布  | IIIF Cookbook 官方示例，画布无标签（回退为 `Canvas N`）                                                 |
| `https://iiif.io/api/image/3.0/example/reference/…-gottingen/info.json` | Image API 3.0            | IIIF 官方示例图                                                                                         |
| `https://iiif.io/api/image/2.1/example/reference/…-gottingen/info.json` | Image API 2.1            | IIIF 官方示例图                                                                                         |

### 6.5 许可

[MIT](./LICENSE)

### 6.6 致谢

- [IIIF](https://iiif.io/) —— 图像互操作框架规范
- [OpenSeadragon](https://openseadragon.github.io/) —— 深度缩放渲染内核
