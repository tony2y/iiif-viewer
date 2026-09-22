/**
 * 简体中文文案。
 * key 采用扁平点号命名，便于 `t('toolbar.zoomIn')` 直接查表。
 */
const zhCN: Record<string, string> = {
  /* 组件级 */
  'viewer.label': '图像查看器',

  /* 工具栏 */
  'toolbar.label': '查看器工具栏',
  'toolbar.zoomIn': '放大',
  'toolbar.zoomOut': '缩小',
  'toolbar.reset': '复位视图',
  'toolbar.rotateLeft': '向左旋转',
  'toolbar.rotateRight': '向右旋转',
  'toolbar.flipHorizontal': '水平翻转',
  'toolbar.fullscreen': '全屏',
  'toolbar.exitFullscreen': '退出全屏',
  'toolbar.prev': '上一页',
  'toolbar.next': '下一页',
  'toolbar.thumbnails': '缩略图',
  'toolbar.info': '作品信息',
  'toolbar.more': '更多操作',
  'toolbar.doublePage': '双页显示',
  'toolbar.singlePage': '单页显示',
  'toolbar.colorAdjust': '色彩调节',

  /* 状态栏 */
  'status.loading': '正在加载图像…',
  'status.page': '第 {current} / {total} 页',
  'status.pageRange': '第 {from}–{to} / {total} 页',
  'status.zoom': '缩放 {percent}%',
  'status.rotated': '旋转 {degrees}°',
  'status.flipped': '已翻转',
  'status.spread': '双页',

  /* 空状态 */
  'empty.noCanvas': '该资源不包含可显示的画布。',

  /* 信息面板 */
  'info.title': '作品信息',
  'info.description': '简介',
  'info.metadata': '详细信息',
  'info.rights': '使用许可',
  'info.provider': '提供机构',
  'info.rawManifest': '查看原始 manifest',
  'info.close': '关闭',
  'info.tabs.toc': '目录',
  'info.tabs.info': '作品信息',
  'info.toc.empty': '该作品未提供目录结构。',

  /* 色彩调节面板 */
  'color.title': '色彩调节',
  'color.brightness': '亮度',
  'color.contrast': '对比度',
  'color.saturation': '饱和度',
  'color.neutral': '默认',
  'color.reset': '重置为默认',
  'color.close': '关闭',

  /* 无障碍 */
  'a11y.shortcutsHint':
    '查看器已聚焦。快捷键：+ / - 缩放，0 复位，R 旋转，F 全屏，左右方向键翻页，I 显示信息。',
  'a11y.thumbnails': '画布缩略图',
  'a11y.retry': '重试',

  /* 错误 */
  'errors.INVALID_SOURCE.title': '资源地址无效',
  'errors.INVALID_SOURCE.desc': '传入的 source 不是有效的 IIIF 资源地址，请检查后重试。',
  'errors.INVALID_SOURCE_TYPE.title': '资源类型不符',
  'errors.INVALID_SOURCE_TYPE.desc': '指定的 sourceType 与实际资源内容不一致。',
  'errors.NETWORK_ERROR.title': '网络请求失败',
  'errors.NETWORK_ERROR.desc': '无法访问该资源，请检查网络连接或服务端的 CORS 配置。',
  'errors.HTTP_ERROR.title': '服务端返回错误',
  'errors.HTTP_ERROR.desc': '资源不存在或服务端拒绝访问，请确认地址是否正确。',
  'errors.TIMEOUT.title': '请求超时',
  'errors.TIMEOUT.desc': '资源加载时间过长，请稍后重试或放宽 timeout 配置。',
  'errors.UNSUPPORTED_VERSION.title': '不支持的 IIIF 版本',
  'errors.UNSUPPORTED_VERSION.desc':
    '仅支持 IIIF Image API 2.x / 3.x 与 Presentation API 2.1 / 3.0。',
  'errors.INVALID_IIIF_INFO.title': 'info.json 数据异常',
  'errors.INVALID_IIIF_INFO.desc': '返回的 info.json 缺少必要字段（如 width / height），无法渲染。',
  'errors.INVALID_MANIFEST.title': 'manifest 数据异常',
  'errors.INVALID_MANIFEST.desc': '返回的 manifest 结构不符合 IIIF Presentation API 规范。',
  'errors.NO_CANVAS.title': '无可显示的画布',
  'errors.NO_CANVAS.desc': 'manifest 中不包含任何可渲染的画布。',
  'errors.OSD_INIT_FAILED.title': '查看器初始化失败',
  'errors.OSD_INIT_FAILED.desc': 'OpenSeadragon 初始化异常，请刷新页面后重试。',
}

export default zhCN
