import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ViewerToolbar from '../../src/components/ViewerToolbar.vue'
import { useViewerI18n, IIIF_VIEWER_I18N_KEY } from '../../src/composables/useViewerI18n'
import { DEFAULT_TOOLBAR_OPTIONS } from '../../src/types/viewer'
import type {
  IiifViewerState,
  IiifViewerToolbarAction,
  ResolvedToolbarOptions,
} from '../../src/types/viewer'

/** 固定为中文，避免受运行环境语言影响 */
const i18n = useViewerI18n({ locale: 'zh-CN' })

function createState(patch: Partial<IiifViewerState> = {}): IiifViewerState {
  return {
    zoomPercent: 100,
    rotation: 0,
    flipped: false,
    page: 0,
    total: 1,
    fullscreen: false,
    canGoPrev: false,
    canGoNext: false,
    progress: 100,
    doublePage: false,
    colors: { brightness: 100, contrast: 100, saturation: 100 },
    ...patch,
  }
}

function mountToolbar(
  state: Partial<IiifViewerState> = {},
  options: Partial<ResolvedToolbarOptions> = {},
  extra: Record<string, unknown> = {},
) {
  return mount(ViewerToolbar, {
    props: {
      options: { ...DEFAULT_TOOLBAR_OPTIONS, ...options },
      state: createState(state),
      ...extra,
    },
    global: {
      provide: { [IIIF_VIEWER_I18N_KEY as symbol]: i18n },
    },
  })
}

describe('ViewerToolbar', () => {
  it('是带可访问名称的 toolbar 区域', () => {
    const wrapper = mountToolbar()

    const toolbar = wrapper.find('[role="toolbar"]')
    expect(toolbar.exists()).toBe(true)
    expect(toolbar.attributes('aria-label')).toBe('查看器工具栏')
  })

  it('每个图标按钮都有可访问名称', () => {
    const wrapper = mountToolbar()

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.attributes('aria-label')).toBeTruthy()
    }
  })

  it('点击按钮派发对应的 action', async () => {
    const wrapper = mountToolbar()

    await wrapper.find('button[aria-label="放大"]').trigger('click')
    await wrapper.find('button[aria-label="缩小"]').trigger('click')
    await wrapper.find('button[aria-label="复位视图"]').trigger('click')
    await wrapper.find('button[aria-label="向左旋转"]').trigger('click')
    await wrapper.find('button[aria-label="向右旋转"]').trigger('click')
    await wrapper.find('button[aria-label="水平翻转"]').trigger('click')

    expect(wrapper.emitted('action')?.map((item) => item[0])).toEqual([
      'zoom-in',
      'zoom-out',
      'reset',
      'rotate-left',
      'rotate-right',
      'flip-horizontal',
    ])
  })

  it('细项开关可隐藏对应动作', () => {
    const wrapper = mountToolbar({}, { rotate: false, flip: false, zoom: false })

    expect(wrapper.find('button[aria-label="放大"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="向左旋转"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="水平翻转"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="复位视图"]').exists()).toBe(true)
  })

  it('翻转与全屏状态通过 aria-pressed 表达', async () => {
    const wrapper = mountToolbar({ flipped: true, fullscreen: true })

    expect(wrapper.find('button[aria-label="水平翻转"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('button[aria-label="退出全屏"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('button[aria-label="退出全屏"]').exists()).toBe(true)

    await wrapper.find('button[aria-label="退出全屏"]').trigger('click')
    expect(wrapper.emitted('action')).toContainEqual(['fullscreen'])
  })

  it('多画布时才显示翻页按钮，并按边界禁用', () => {
    const first = mountToolbar({ total: 3, page: 0, canGoNext: true })
    expect(first.find('button[aria-label="上一页"]').attributes('disabled')).toBeDefined()
    expect(first.find('button[aria-label="下一页"]').attributes('disabled')).toBeUndefined()

    const last = mountToolbar({ total: 3, page: 2, canGoPrev: true })
    expect(last.find('button[aria-label="上一页"]').attributes('disabled')).toBeUndefined()
    expect(last.find('button[aria-label="下一页"]').attributes('disabled')).toBeDefined()
  })

  it('单画布时不显示翻页与缩略图按钮', () => {
    const wrapper = mountToolbar({ total: 1 })

    expect(wrapper.find('button[aria-label="上一页"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="缩略图"]').exists()).toBe(false)
  })

  it('窄容器下只保留核心动作，其余收进「更多」菜单', async () => {
    const wrapper = mountToolbar({ total: 3, canGoNext: true }, {}, { compact: true })

    expect(wrapper.find('button[aria-label="放大"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="复位视图"]').exists()).toBe(true)
    // 非核心动作移入菜单
    expect(wrapper.find('button[aria-label="向右旋转"]').exists()).toBe(false)

    const moreButton = wrapper.find('button[aria-label="更多操作"]')
    expect(moreButton.attributes('aria-expanded')).toBe('false')

    await moreButton.trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(moreButton.attributes('aria-expanded')).toBe('true')

    const menuItems = wrapper.findAll('[role="menuitem"]')
    const labels = menuItems.map((item) => item.text())
    expect(labels).toContain('向右旋转')
    expect(labels).toContain('下一页')
    expect(labels).toContain('缩略图')

    await menuItems[0]!.trigger('click')

    expect(wrapper.emitted('action')?.at(-1)?.[0]).toBe('rotate-left')
    // 选择后菜单自动收起
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('菜单中禁用的项不会派发 action', async () => {
    const wrapper = mountToolbar({ total: 3, page: 0, canGoNext: true }, {}, { compact: true })

    await wrapper.find('button[aria-label="更多操作"]').trigger('click')

    const prev = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === '上一页')
    expect(prev?.attributes('disabled')).toBeDefined()

    await prev?.trigger('click')

    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('切回宽容器时收起菜单', async () => {
    const wrapper = mountToolbar({ total: 3, canGoNext: true }, {}, { compact: true })

    await wrapper.find('button[aria-label="更多操作"]').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)

    await wrapper.setProps({ compact: false })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="向右旋转"]').exists()).toBe(true)
  })

  it('thumbnailsOpen / infoOpen 反映为切换态', () => {
    const wrapper = mountToolbar(
      { total: 3, canGoNext: true },
      {},
      { thumbnailsOpen: true, infoOpen: true },
    )

    expect(wrapper.find('button[aria-label="缩略图"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('button[aria-label="作品信息"]').attributes('aria-pressed')).toBe('true')
  })

  it('按停靠位置设置方向类名', () => {
    for (const position of ['top', 'bottom', 'left', 'right'] as const) {
      const wrapper = mountToolbar({}, { position })
      expect(wrapper.find(`.iiif-toolbar--${position}`).exists()).toBe(true)
    }
  })

  it('extra 插槽可追加自定义动作', () => {
    const wrapper = mount(ViewerToolbar, {
      props: {
        options: { ...DEFAULT_TOOLBAR_OPTIONS },
        state: createState(),
      },
      slots: {
        extra: '<button aria-label="自定义动作">自定义</button>',
      },
      global: {
        provide: { [IIIF_VIEWER_I18N_KEY as symbol]: i18n },
      },
    })

    expect(wrapper.find('button[aria-label="自定义动作"]').exists()).toBe(true)
  })

  it('全部动作都可被点击并派发（覆盖每个分支）', async () => {
    const wrapper = mountToolbar({ total: 3, page: 1, canGoPrev: true, canGoNext: true })

    const clicked: IiifViewerToolbarAction[] = []
    for (const button of wrapper.findAll('button')) {
      if (button.attributes('aria-label') === '更多操作') continue
      await button.trigger('click')
      clicked.push(wrapper.emitted('action')!.at(-1)![0] as IiifViewerToolbarAction)
    }

    expect(new Set(clicked)).toEqual(
      new Set<IiifViewerToolbarAction>([
        'zoom-in',
        'zoom-out',
        'reset',
        'rotate-left',
        'rotate-right',
        'flip-horizontal',
        'prev',
        'next',
        'thumbnails',
        'double-page',
        'info',
        'color-adjust',
        'fullscreen',
      ]),
    )
  })

  it('双页切换按钮反映当前模式，点击派发 double-page', async () => {
    const single = mountToolbar({ total: 3, canGoNext: true })
    const singleButton = single.find('button[aria-label="单页显示"]')
    expect(singleButton.exists()).toBe(true)
    expect(singleButton.attributes('aria-pressed')).toBe('false')

    await singleButton.trigger('click')
    expect(single.emitted('action')).toContainEqual(['double-page'])

    const spread = mountToolbar({ total: 3, canGoNext: true, doublePage: true })
    const spreadButton = spread.find('button[aria-label="双页显示"]')
    expect(spreadButton.exists()).toBe(true)
    expect(spreadButton.attributes('aria-pressed')).toBe('true')
  })

  it('单画布时不显示双页切换按钮', () => {
    const wrapper = mountToolbar({ total: 1 })

    expect(wrapper.find('button[aria-label="单页显示"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="双页显示"]').exists()).toBe(false)
  })

  it('toolbar.doublePage 为 false 时隐藏双页按钮', () => {
    const wrapper = mountToolbar({ total: 3, canGoNext: true }, { doublePage: false })

    expect(wrapper.find('button[aria-label="单页显示"]').exists()).toBe(false)
  })

  it('色彩模块关闭时不渲染色彩按钮', () => {
    const off = mountToolbar({}, {}, { colorAdjust: false })
    expect(off.find('button[aria-label="色彩调节"]').exists()).toBe(false)

    const on = mountToolbar({}, {}, { colorOpen: true })
    const button = on.find('button[aria-label="色彩调节"]')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-pressed')).toBe('true')
  })
})
