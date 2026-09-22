import { describe, expect, it } from 'vitest'

import { IiifViewerError, isIiifViewerError } from '../../src/core/errors'
import { IIIF_VIEWER_ERROR_CODES } from '../../src/types/errors'
import { BUILT_IN_MESSAGES } from '../../src/locales'

describe('core/errors', () => {
  it('继承 Error 并携带稳定错误码', () => {
    const error = new IiifViewerError('TIMEOUT')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(IiifViewerError)
    expect(error.name).toBe('IiifViewerError')
    expect(error.code).toBe('TIMEOUT')
    expect(error.message).toBeTruthy()
  })

  it('保留自定义 message 与 details', () => {
    const details = { status: 404 }
    const error = new IiifViewerError('HTTP_ERROR', 'HTTP 404', details)

    expect(error.message).toBe('HTTP 404')
    expect(error.details).toBe(details)
  })

  it('i18nKey 形如 errors.<CODE>', () => {
    expect(new IiifViewerError('NO_CANVAS').i18nKey).toBe('errors.NO_CANVAS')
  })

  it('from() 对已是本类型的异常原样返回', () => {
    const original = new IiifViewerError('INVALID_SOURCE')
    expect(IiifViewerError.from(original)).toBe(original)
  })

  it('from() 把普通异常规整为指定兜底错误码', () => {
    const error = IiifViewerError.from(new Error('boom'), 'OSD_INIT_FAILED')

    expect(error.code).toBe('OSD_INIT_FAILED')
    expect(error.message).toBe('boom')
    expect(error.details).toBeInstanceOf(Error)
  })

  it('from() 把 AbortError 识别为超时', () => {
    const abortError = new DOMException('aborted', 'AbortError')
    expect(IiifViewerError.from(abortError).code).toBe('TIMEOUT')
  })

  it('isIiifViewerError 类型守卫', () => {
    expect(isIiifViewerError(new IiifViewerError('TIMEOUT'))).toBe(true)
    expect(isIiifViewerError(new Error('x'))).toBe(false)
    expect(isIiifViewerError(null)).toBe(false)
  })

  it('每个错误码在中英文案中都有 title 与 desc', () => {
    for (const code of IIIF_VIEWER_ERROR_CODES) {
      for (const locale of ['zh-CN', 'en-US'] as const) {
        const messages = BUILT_IN_MESSAGES[locale]
        expect(messages[`errors.${code}.title`], `${locale} / ${code}.title`).toBeTruthy()
        expect(messages[`errors.${code}.desc`], `${locale} / ${code}.desc`).toBeTruthy()
      }
    }
  })
})
