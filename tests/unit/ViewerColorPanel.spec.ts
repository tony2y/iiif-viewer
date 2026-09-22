import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ViewerColorPanel from '../../src/components/ViewerColorPanel.vue'
import { IIIF_VIEWER_I18N_KEY, useViewerI18n } from '../../src/composables/useViewerI18n'
import { DEFAULT_COLOR_ADJUSTMENTS, type IiifColorAdjustments } from '../../src/core/color'

/** 固定为中文，避免受运行环境语言影响 */
const i18n = useViewerI18n({ locale: 'zh-CN' })

function mountPanel(open = true, colors: IiifColorAdjustments = { ...DEFAULT_COLOR_ADJUSTMENTS }) {
  return mount(ViewerColorPanel, {
    props: { open, colors },
    attachTo: document.body,
    global: {
      provide: { [IIIF_VIEWER_I18N_KEY as symbol]: i18n },
    },
  })
}

describe('ViewerColorPanel', () => {
  it('未展开时不渲染面板', () => {
    const wrapper = mountPanel(false)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('展开时渲染带可访问名称的三个滑杆', () => {
    const wrapper = mountPanel()

    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('false')

    const sliders = wrapper.findAll('input[type="range"]')
    expect(sliders).toHaveLength(3)

    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toEqual(['亮度', '对比度', '饱和度'])

    for (const label of wrapper.findAll('label')) {
      const id = label.attributes('for')
      expect(id).toBeTruthy()
      expect(wrapper.find(`#${id}`).exists()).toBe(true)
    }
  })

  it('滑杆的 min / max / step 与取值范围一致', () => {
    const wrapper = mountPanel()

    const brightness = wrapper.find('#iiif-color-brightness')
    expect(brightness.attributes('min')).toBe('50')
    expect(brightness.attributes('max')).toBe('150')

    const saturation = wrapper.find('#iiif-color-saturation')
    expect(saturation.attributes('min')).toBe('0')
    expect(saturation.attributes('max')).toBe('200')
  })

  it('拖动滑杆时派发归一化后的完整取值', async () => {
    const wrapper = mountPanel()

    const brightness = wrapper.find('#iiif-color-brightness')
    await brightness.setValue(130)

    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual({
      brightness: 130,
      contrast: 100,
      saturation: 100,
    })
  })

  it('超出范围的输入会被夹取', async () => {
    const wrapper = mountPanel()

    await wrapper.find('#iiif-color-contrast').setValue(999)

    expect(wrapper.emitted('change')?.at(-1)?.[0]).toMatchObject({ contrast: 150 })
  })

  it('点击数值按钮把该维度恢复为中性值', async () => {
    const wrapper = mountPanel(true, { brightness: 140, contrast: 80, saturation: 60 })

    const valueButtons = wrapper.findAll('button.iiif-color__value')
    expect(valueButtons).toHaveLength(3)
    await valueButtons[0]!.trigger('click')

    expect(wrapper.emitted('change')?.at(-1)?.[0]).toMatchObject({ brightness: 100 })
  })

  it('中性值时展示「默认」标记且重置按钮禁用', () => {
    const neutral = mountPanel(true, { ...DEFAULT_COLOR_ADJUSTMENTS })
    expect(neutral.text()).toContain('默认')
    expect(neutral.find('button[aria-label="重置为默认"]').attributes('disabled')).toBeDefined()

    const adjusted = mountPanel(true, { brightness: 120, contrast: 100, saturation: 100 })
    expect(adjusted.find('button[aria-label="重置为默认"]').attributes('disabled')).toBeUndefined()
  })

  it('点击重置派发 reset', async () => {
    const wrapper = mountPanel(true, { brightness: 120, contrast: 100, saturation: 100 })

    await wrapper.find('button[aria-label="重置为默认"]').trigger('click')

    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('关闭按钮与 Esc 都派发 close', async () => {
    const wrapper = mountPanel()

    await wrapper.find('button[aria-label="关闭"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('展开时把焦点移到关闭按钮', async () => {
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()

    expect(document.activeElement?.getAttribute('aria-label')).toBe('关闭')
  })

  it('关闭面板后移除全局键盘监听', async () => {
    const wrapper = mountPanel()
    await wrapper.setProps({ open: false })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
