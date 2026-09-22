# Changelog

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
