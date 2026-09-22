import { describe, expect, it } from 'vitest'

import {
  ensureInfoJsonUrl,
  isAbsoluteUrl,
  isImageFileUrl,
  isInfoJsonUrl,
  isLikelyManifestUrl,
  looksLikeJson,
  resolveUrl,
  stripQuery,
  stripTrailingSlash,
} from '../../src/core/url'

describe('core/url', () => {
  describe('stripQuery', () => {
    it('去掉查询串与 hash', () => {
      expect(stripQuery('https://a.com/b/info.json?v=1#top')).toBe('https://a.com/b/info.json')
    })

    it('无查询串时原样返回', () => {
      expect(stripQuery('https://a.com/b')).toBe('https://a.com/b')
    })
  })

  describe('stripTrailingSlash', () => {
    it('去掉一个或多个结尾斜杠', () => {
      expect(stripTrailingSlash('https://a.com/b///')).toBe('https://a.com/b')
    })

    it('不修改无结尾斜杠的地址', () => {
      expect(stripTrailingSlash('https://a.com/b')).toBe('https://a.com/b')
    })
  })

  describe('isAbsoluteUrl', () => {
    it.each([
      ['https://a.com/x', true],
      ['http://a.com/x', true],
      ['//a.com/x', true],
      ['/x/info.json', false],
      ['x/info.json', false],
    ])('%s → %s', (input, expected) => {
      expect(isAbsoluteUrl(input)).toBe(expected)
    })
  })

  describe('resolveUrl', () => {
    it('拼接相对路径并去重斜杠', () => {
      expect(resolveUrl('https://a.com/base/', '/x/info.json')).toBe(
        'https://a.com/base/x/info.json',
      )
    })

    it('path 为绝对地址时原样返回', () => {
      expect(resolveUrl('https://a.com/base', 'https://b.com/info.json')).toBe(
        'https://b.com/info.json',
      )
    })

    it('path 为空时返回 base', () => {
      expect(resolveUrl('https://a.com/base', '')).toBe('https://a.com/base')
    })
  })

  describe('isInfoJsonUrl', () => {
    it.each([
      ['https://a.com/iiif/id/info.json', true],
      ['https://a.com/iiif/id/info.json?x=1', true],
      ['https://a.com/iiif/id/INFO.JSON', true],
      ['https://a.com/iiif/id', false],
      ['https://a.com/manifest.json', false],
    ])('%s → %s', (input, expected) => {
      expect(isInfoJsonUrl(input)).toBe(expected)
    })
  })

  describe('isImageFileUrl', () => {
    it.each([
      ['https://a.com/a.jpg', true],
      ['https://a.com/a.JPEG', true],
      ['https://a.com/a.png?w=10', true],
      ['https://a.com/a.tif', true],
      ['https://a.com/info.json', false],
    ])('%s → %s', (input, expected) => {
      expect(isImageFileUrl(input)).toBe(expected)
    })
  })

  describe('isLikelyManifestUrl', () => {
    it.each([
      ['https://a.com/manifest.json', true],
      ['https://a.com/iiif/MANIFEST', true],
      ['https://a.com/collection/123', true],
      ['https://a.com/presentation/b18035723', true],
      ['https://iiif.wellcomecollection.org/presentation/b18035723', true],
      ['https://a.com/iiif/id/info.json', false],
    ])('%s → %s', (input, expected) => {
      expect(isLikelyManifestUrl(input)).toBe(expected)
    })
  })

  describe('ensureInfoJsonUrl', () => {
    it('已是 info.json 时原样返回', () => {
      expect(ensureInfoJsonUrl('https://a.com/iiif/id/info.json')).toBe(
        'https://a.com/iiif/id/info.json',
      )
    })

    it('服务基址会补全 /info.json 并去掉结尾斜杠', () => {
      expect(ensureInfoJsonUrl('https://a.com/iiif/id/')).toBe('https://a.com/iiif/id/info.json')
    })

    it('带查询串时先剥离查询串', () => {
      expect(ensureInfoJsonUrl('https://a.com/iiif/id?lang=zh')).toBe(
        'https://a.com/iiif/id/info.json',
      )
    })
  })

  describe('looksLikeJson', () => {
    it('识别对象与数组字面量', () => {
      expect(looksLikeJson('  {"a":1} ')).toBe(true)
      expect(looksLikeJson('[1,2]')).toBe(true)
      expect(looksLikeJson('<html>')).toBe(false)
    })
  })
})
