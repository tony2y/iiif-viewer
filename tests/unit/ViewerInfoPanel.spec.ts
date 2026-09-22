import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ViewerInfoPanel from '../../src/components/ViewerInfoPanel.vue'
import { IIIF_VIEWER_I18N_KEY, useViewerI18n } from '../../src/composables/useViewerI18n'
import { parseManifest } from '../../src/core/iiif'
import type { IiifManifest } from '../../src/types/iiif'

const i18n = useViewerI18n({ locale: 'zh-CN' })

const RAW_MANIFEST = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.org/manifest/1',
  type: 'Manifest',
  label: { en: ['An example book'], zh: ['示例图册'] },
  summary: { en: ['A short description'] },
  rights: 'http://creativecommons.org/licenses/by/4.0/',
  provider: [{ id: 'https://example.org', type: 'Agent', label: { en: ['Example Library'] } }],
  metadata: [{ label: { en: ['Date'] }, value: { none: ['1888'] } }],
  items: [1, 2, 3, 4].map((page) => ({
    id: `https://example.org/canvas/${page}`,
    type: 'Canvas',
    items: [
      {
        items: [
          {
            body: {
              id: `https://example.org/img/${page}/full/max/0/default.jpg`,
              type: 'Image',
              service: [{ id: `https://example.org/img/${page}`, type: 'ImageService3' }],
            },
          },
        ],
      },
    ],
  })),
  structures: [
    {
      id: 'https://example.org/range/cover',
      type: 'Range',
      label: { en: ['Cover'] },
      items: [{ id: 'https://example.org/canvas/1', type: 'Canvas' }],
    },
    {
      id: 'https://example.org/range/chapter-1',
      type: 'Range',
      label: { en: ['Chapter 1'] },
      items: [
        { id: 'https://example.org/canvas/2', type: 'Canvas' },
        { id: 'https://example.org/canvas/3', type: 'Canvas' },
      ],
    },
  ],
}

function manifestWithToc(): IiifManifest {
  return parseManifest(RAW_MANIFEST, 'https://example.org/manifest/1', 'zh-CN')
}

function manifestWithoutToc(): IiifManifest {
  const { structures: _structures, ...rest } = RAW_MANIFEST
  return parseManifest(rest, 'https://example.org/manifest/1', 'zh-CN')
}

function mountPanel(manifest: IiifManifest, currentIndex = 0) {
  return mount(ViewerInfoPanel, {
    props: { manifest, open: true, currentIndex },
    attachTo: document.body,
    global: {
      provide: { [IIIF_VIEWER_I18N_KEY as symbol]: i18n },
    },
  })
}

describe('ViewerInfoPanel · 目录 Tab', () => {
  it('有目录时渲染 tablist 且默认激活目录页', () => {
    const wrapper = mountPanel(manifestWithToc())

    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['目录', '作品信息'])
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(tabs[1]!.attributes('aria-selected')).toBe('false')

    // roving tabindex：仅激活的 tab 可 Tab 聚焦
    expect(tabs[0]!.attributes('tabindex')).toBe('0')
    expect(tabs[1]!.attributes('tabindex')).toBe('-1')

    expect(wrapper.find('[role="tabpanel"]').attributes('id')).toBe('iiif-viewer-info-panel-toc')
    expect(wrapper.text()).toContain('示例图册')
  })

  it('tab 与 tabpanel 通过 aria-controls / aria-labelledby 关联', () => {
    const wrapper = mountPanel(manifestWithToc())

    const tab = wrapper.findAll('[role="tab"]')[0]!
    const panel = wrapper.find('[role="tabpanel"]')
    expect(tab.attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.attributes('aria-labelledby')).toBe(tab.attributes('id'))
  })

  it('切到作品信息后展示 metadata / 简介 / 使用许可，目录内容被隐藏', async () => {
    const wrapper = mountPanel(manifestWithToc())
    expect(wrapper.text()).toContain('Cover')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')

    expect(wrapper.find('[role="tabpanel"]').attributes('id')).toBe('iiif-viewer-info-panel-info')
    expect(wrapper.text()).toContain('A short description')
    expect(wrapper.text()).toContain('1888')
    expect(wrapper.text()).toContain('creativecommons')
    expect(wrapper.text()).toContain('Example Library')
    expect(wrapper.text()).not.toContain('Cover')
  })

  it('左右方向键在 tab 之间切换', async () => {
    const wrapper = mountPanel(manifestWithToc())

    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('keydown', { key: 'ArrowRight' })
    // 循环回到第一个
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')

    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'End' })
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('keydown', { key: 'Home' })
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
  })

  it('点击目录项派发对应画布下标', async () => {
    const wrapper = mountPanel(manifestWithToc())

    const entries = wrapper.findAll('button.iiif-toc__entry')
    expect(entries.map((entry) => entry.find('.iiif-toc__label').text())).toEqual([
      'Cover',
      'Chapter 1',
    ])
    expect(entries.map((entry) => entry.find('.iiif-toc__page').text())).toEqual(['1', '2'])

    await entries[1]!.trigger('click')
    expect(wrapper.emitted('select-canvas')?.[0]).toEqual([1])

    await entries[0]!.trigger('click')
    expect(wrapper.emitted('select-canvas')?.[1]).toEqual([0])
  })

  it('高亮覆盖当前页的目录项', () => {
    const wrapper = mountPanel(manifestWithToc(), 2)

    const entries = wrapper.findAll('button.iiif-toc__entry')
    expect(entries[0]!.attributes('aria-current')).toBeUndefined()
    expect(entries[1]!.attributes('aria-current')).toBe('true')
  })
})

describe('ViewerInfoPanel · 无目录', () => {
  it('不渲染 tablist，直接展示作品信息', () => {
    const wrapper = mountPanel(manifestWithoutToc())

    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('A short description')
    expect(wrapper.text()).toContain('1888')
  })
})

describe('ViewerInfoPanel · 通用行为', () => {
  it('未展开时不渲染面板', () => {
    const wrapper = mount(ViewerInfoPanel, {
      props: { manifest: manifestWithToc(), open: false },
      global: { provide: { [IIIF_VIEWER_I18N_KEY as symbol]: i18n } },
    })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('标题使用 manifest 名称；无 manifest 时回退到内置文案', () => {
    const withManifest = mountPanel(manifestWithToc())
    expect(withManifest.find('#iiif-viewer-info-title').text()).toBe('示例图册')

    const withoutManifest = mount(ViewerInfoPanel, {
      props: { manifest: null, open: true },
      global: { provide: { [IIIF_VIEWER_I18N_KEY as symbol]: i18n } },
    })
    expect(withoutManifest.find('#iiif-viewer-info-title').text()).toBe('作品信息')
  })

  it('切换 manifest 时目录 Tab 重置为目录页', async () => {
    const wrapper = mountPanel(manifestWithToc())

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')

    await wrapper.setProps({ manifest: manifestWithoutToc() })
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)

    await wrapper.setProps({ manifest: manifestWithToc() })
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
  })

  it('Esc 派发 close', async () => {
    const wrapper = mountPanel(manifestWithToc())

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('关闭按钮派发 close', async () => {
    const wrapper = mountPanel(manifestWithToc())

    await wrapper.find('button[aria-label="关闭"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
