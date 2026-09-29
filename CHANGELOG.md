# Changelog

## [Unreleased]

## [0.1.2] - 2026-09-29
### Added

- **`pageTransition`：翻页与换资源的过渡效果**（Props / 插件配置，默认关闭）。内置三个预设：
  - `fade`：把当前画面固化为快照层盖在画布之上，新页面就位后淡出。用 `drawImage` 复制像素，因此不要求画布可读（跨域图像同样可用）；
  - `book-flip`：旧页快照绕「书脊」做 3D 翻转并渐隐，露出下方的新页面，观感如掀过一页书；前进（下一页）书脊在左、后退（上一页）书脊在右，方向由页码变化自动推导；
  - `zoom-swap`：旧页先轻微缩小，内容交换后回弹到原缩放（纯 OpenSeadragon 能力，不丢缩放位置）。
    另支持 `'none'` / `false` 关闭与细项配置（`duration` / `easing` / `respectReducedMotion`）；系统「减弱动效」时自动降级为无过渡。
- **翻书加载指示**：全库统一的 loading 动画——一本复古古籍持续翻页（`ViewerLoading` 新增 `variant="page"` 轻量形态）。同资源翻页后、新画面首块瓦片绘出前在舞台中央显示（8 秒兜底超时）；缓存命中时翻页几乎瞬时完成，指示器延迟 180ms 仍未完成才展示，避免「闪一下」的残影；一旦展示至少保持 320ms，避免出现即消失的抖动。资源加载的全屏覆盖层同步换用翻书动画并移除卡片背景（移除 shimmer / 环形进度与 spinner，进度改以百分比文字表达）；`prefers-reduced-motion` 时退化为静态书本
- `page-transition-start` / `page-transition-end` 事件，载荷 `{ from, to, preset }`；过渡被新的翻页中断时同样会派发结束事件
- `useReducedMotion()` 组合式函数（响应 `prefers-reduced-motion` 变化）；`core/iiif` 新增 `DEFAULT_ANIMATION_TIME`、`DEFAULT_SPRING_STIFFNESS`、`REDUCED_MOTION_SPRING_STIFFNESS`、`resolveMotionSettings()`
- `tileSourceKey()`（`core/iiif`）：生成 tileSources 列表的稳定签名，供调用方自行判断资源是否发生变化
- **`showNavigator`：右上角导航图（小地图）开关**（Props，默认 `true`）。运行期修改即时生效——已经生成过导航图时只做显隐，不重建实例、不丢失缩放与平移；只有「创建时关闭、之后又要打开」才需要重建（OpenSeadragon 不提供热创建导航图的能力），此时视图会回到适配状态。也可用 `osdOptions.showNavigator` 或命令式的 `setNavigatorVisible()` 控制
- `useOpenSeadragon()` 新增 `navigatorVisible` 与 `setNavigatorVisible()`；`IiifViewer` 通过 `defineExpose` 一并导出 `setNavigatorVisible()`
- `useIiifSource()` 新增 `tileSourcesKey`（当前资源的稳定签名）与 `loadEpoch`（加载轮次，用于识别 `retry()` 等同资源重新加载的场景）
- `useOpenSeadragon()` 新增 `transitioning`（是否正在播放过渡）与 `reducedMotion`（响应式动效偏好）；`open()` 新增 `preserveViewport`、`transition` 选项

### Changed

- **翻页不再整幅复位**：OpenSeadragon 默认在每次 `open()` 之后把视口拉回初始视图，「翻一页就丢失当前缩放与平移」。现在默认 `preserveViewport: true`，由组件决定何时重新适配——同一份资源内换页保留视口，换资源或切换单页 / 双页时重新适配
- **动效参数更跟手**：`animationTime` 由 1.2s 调整为 0.8s、`springStiffness` 由 6.5 调整为 10（仍可通过 `osdOptions` 覆盖）
- **`prefers-reduced-motion` 运行期即时生效**：此前只在创建 OpenSeadragon 实例时求值一次，现在订阅系统设置变化并改写已创建实例的动效参数
- **移动端工具栏：向左 / 向右旋转外置**：窄容器下的常驻动作扩为「缩小 / 放大 / 复位 / 向左旋转 / 向右旋转 / 全屏」，旋转不再需要点开二级菜单

### Fixed

- **全屏时工具栏消失**：此前全屏走 OpenSeadragon 自带的 `viewer.setFullScreen()`，全屏目标只有 OSD 容器本身，工具栏 / 状态栏 / 缩略图条都在它的外面——进入全屏后整套 UI 消失，既无法操作也只能靠 Esc 盲退。现在全屏目标改为**组件根元素**（原生 Fullscreen API，带 webkit 前缀回退），全屏时整套 UI 保持可见可交互，Esc 与工具栏按钮均可退出；`aspectRatio` 产生的定宽高在全屏下自动放开，画面撑满视口。`useOpenSeadragon()` 新增 `fullscreenRef` 选项，不提供时保留旧的 OSD 行为
- **重试按钮宽度不足**：`ViewerButton` 的根元素是 Tooltip 包裹层，外部传入的 class 与样式覆盖都落在包裹层上，真正的 `<button>` 仍保持 36×36 的图标按钮尺寸，图标 + 文字横向溢出。错误卡片的覆盖样式改用 `:deep()` 命中按钮本体
- **`showThumbnails` 运行期修改无效**：`infoOpen` 有 prop 同步而 `thumbnailsOpen` 没有，运行期改 `show-thumbnails` prop（如演示页「更多设置」里的缩略图条开关）没有任何效果；现已与 `showInfoPanel` 对称同步
- **「更多」弹出菜单过透**：新增 `--iiif-popup-bg` token（暗色 `rgba(20,22,25,.94)` / 亮色 `rgba(255,255,255,.96)`），弹层浮在图像上时菜单文字始终可读；此前沿用工具栏的 0.72 / 0.74 玻璃底，移动端强对比图像下几乎看不清

- **切换界面语言不再重新加载图像**：语言变化会重新解析 manifest 标签，使 `tileSources` 产生新引用并触发 `OpenSeadragon.open()`，而 OSD 的 `open()` 会先 `close()`——清空瓦片缓存并把视口复位，表现为「切个语言，图重新加载了一遍、缩放归零」。现在组件按「资源签名 + 加载轮次」判断是否真正需要重新打开，语言切换只更新文案；翻页、切换资源、`retry()` 等资源确实变化的场景行为不变。

## [0.1.0] - 2026-09-22

首个版本，目标：可直接运行的源码 + 完整文档 + 可发布到 npm 的库产物。

### Added

**IIIF 能力**

- IIIF **Image API 2.x / 3.x**（`info.json`）与 **Presentation API 2.1 / 3.0**（`manifest.json`）解析；标签语言映射、metadata / rights / provider / thumbnail 归一化
- 输入自动识别：Image API 服务基址、`info.json` 地址、`manifest.json` 地址、静态图片地址、OSD tileSource；URL 启发式识别失败时按响应内容二次判定（兼容 `/presentation/{id}` 等非常规地址）
- 目录（TOC）：解析 `structures`（v2 `ranges` / v3 `items`）为统一目录树，支持点击跳转与当前页高亮

**查看器**

- 基于 OpenSeadragon 的缩放（滚轮 / 双击 / 按钮 / 键盘）、平移、任意角度旋转、水平翻转、复位、全屏、内置导航图
- 多画布翻阅、页码状态、缩略图条（缩略图缺失时回退到 Image API 的 `full/!120,120/0/default.jpg`）
- 单页 / 双页展开：`initialDoublePage` Prop、工具栏切换按钮、`setDoublePage()` / `toggleDoublePage()`；双页下标吸附到偶数、翻页步进为 2，两页等高且书脊处紧贴
- 色彩调节：亮度 / 对比度 / 饱和度（工具栏单按钮 → 右侧滑出面板），合成一条 CSS `filter` 作用于画布
- 信息面板「目录 / 作品信息」双 Tab（`role="tablist"` + roving `tabindex`），面板标题显示 manifest 名称

**界面与可访问性**

- 暗色画廊主题（默认）/ 亮色主题 / 跟随系统；玻璃态悬浮工具栏支持上下左右四种停靠位置
- 加载骨架、进度环、错误卡片（含错误码与重试）、元数据抽屉面板
- 基于 CSS 容器查询的响应式布局（与浏览器视口解耦），窄容器自动精简工具栏并收进「更多」菜单
- 可访问名称、可见焦点环、装饰性图标对无障碍树隐藏、完整支持 `prefers-reduced-motion`、触摸命中区放大到 44×44px

**国际化与类型**

- 内置 `zh-CN` / `en-US`，零额外运行时依赖；支持通过 `messages` 覆盖或扩展文案；切换语言时即时重新解析 manifest 标签（不重新发请求）
- 全量 TypeScript 类型（Props / Emits / Slots / Expose / 核心能力 / IIIF 结构），产物附带 `.d.ts`

**工程化**

- Vite 库模式构建：ESM（`dist/index.mjs`）+ UMD（`dist/index.umd.cjs`）+ 单一 CSS（`dist/iiif-viewer.css`）+ `dist/types/**`；**不产出 sourcemap**（`build.sourcemap: false`，发布体积约 102 kB）
- `vue` 与 `openseadragon` 声明为 peerDependency 且构建 external，库产物不含二者代码；支持通过 `openseadragon` Prop 或 `createIiifViewer({ openseadragon })` 注入自定义实例，并做 `verifyOpenSeadragon()` 兼容性校验
- ESLint 10 flat config + Prettier + Vitest（225 个单元测试 / 13 个测试文件）
- `@/` 路径别名（映射到 `src/`），产物 d.ts 中已还原为相对路径

**文档**

- `README.md`（简体中文）与 `README_EN.md`（English）：核心功能、技术栈版本、本地开发、使用示例、完整参数配置、附录
- `ROADMAP.md`：后续任务清单（优先级 / 工作量 / 依赖 / 已知限制）
- `PUBLISHING.md`：维护者专用的发布流程（不随包发布）

#### 关键实现取舍

以下取舍为有意为之，后续改动时请勿无意回退：

- **双页排布不使用 OSD 的 `collectionMode`**：它把每页居中放进 `collectionTileSize` 见方的格子，竖版页面之间必然空出间距；改为自行排版（统一页高 + 按宽高比推导页宽 + 依次紧贴），并在 `add-item` 后延迟一个宏任务执行
- **IIIF 图像的 tileSource 传 `info.json` 地址字符串**：OSD 的 `IIIFTileSource.supports()` 只依据内容特征判断，不识别 `{ type: 'iiif', url }`
- **多图场景的缩放百分比**用首张 `TiledImage.viewportToImageZoom()` 换算，避免 `Viewport.viewportToImageZoom()` 在多图下的告警与偏差
- **侧边面板层级低于悬浮工具栏**（`--iiif-z-panel: 15` < `--iiif-z-toolbar: 20`），并预留 `--iiif-toolbar-clearance`，保证抽屉打开时工具栏仍可点击
- **完全没有图像资源的画布会被过滤**，过滤后再映射 `structures` 下标，保证目录页码与画面一致

### Known limitations

- 不支持 IIIF Collection（显式抛 `UNSUPPORTED_VERSION`，避免渲染出错误结果）
- 双页配对策略固定为「偶数下标起连续两页」，不读取 `viewingDirection`，也不区分封面单独成页
- 无图像标注（Annotation）与 IIIF Content Search 支持
- 未配置 CORS 时无法启用 WebGL 加速与导出图片（OSD 会自动回退到 Canvas 绘制器并打印告警）
- 色彩调节作用于整块画布，不支持逐页独立调节
- 缩略图条无虚拟滚动，画布数量极大时首屏渲染成本较高
- 界面状态不写入 URL，刷新或分享链接不会还原页码与视图
