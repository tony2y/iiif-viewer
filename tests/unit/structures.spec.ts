import { describe, expect, it } from 'vitest'

import { findFirstCanvasIndex, parseManifest, parseStructures } from '../../src/core/iiif'
import type { IiifCanvas } from '../../src/types/iiif'

const CANVASES: IiifCanvas[] = [
  { id: 'https://example.org/canvas/1', label: 'p1' },
  { id: 'https://example.org/canvas/2', label: 'p2' },
  { id: 'https://example.org/canvas/3', label: 'p3' },
  { id: 'https://example.org/canvas/4', label: 'p4' },
]

/** Presentation 3：扁平 structures + items 引用 */
const V3_STRUCTURES = [
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
      { id: 'https://example.org/range/section-1a', type: 'Range' },
      { id: 'https://example.org/canvas/3', type: 'Canvas' },
    ],
  },
  {
    id: 'https://example.org/range/section-1a',
    type: 'Range',
    label: { en: ['Section 1a'] },
    items: [{ id: 'https://example.org/canvas/2', type: 'Canvas' }],
  },
]

/** Presentation 2：扁平 structures + ranges / canvases id 列表 */
const V2_STRUCTURES = [
  {
    '@id': 'https://example.org/range/part-1',
    '@type': 'sc:Range',
    label: 'Part 1',
    ranges: ['https://example.org/range/part-1-1'],
    canvases: ['https://example.org/canvas/1'],
  },
  {
    '@id': 'https://example.org/range/part-1-1',
    '@type': 'sc:Range',
    label: 'Part 1.1',
    canvases: ['https://example.org/canvas/2', 'https://example.org/canvas/3'],
  },
]

describe('core/iiif · parseStructures', () => {
  it('无 structures 时返回空数组', () => {
    expect(parseStructures(undefined, CANVASES)).toEqual([])
    expect(parseStructures([], CANVASES)).toEqual([])
  })

  it('解析 v3：按 items 引用组装成树，未被引用的作为根', () => {
    const tree = parseStructures(V3_STRUCTURES, CANVASES, 'en-US')

    expect(tree).toHaveLength(2)
    expect(tree.map((node) => node.label)).toEqual(['Cover', 'Chapter 1'])

    const [cover, chapter] = tree
    expect(cover?.canvasIndexes).toEqual([0])
    expect(cover?.children).toEqual([])

    // Chapter 1 直接含 canvas 3，子节点 Section 1a 含 canvas 2
    expect(chapter?.canvasIndexes).toEqual([2])
    expect(chapter?.children).toHaveLength(1)
    expect(chapter?.children[0]?.label).toBe('Section 1a')
    expect(chapter?.children[0]?.canvasIndexes).toEqual([1])
  })

  it('解析 v2：按 ranges / canvases 的 id 列表组装成树', () => {
    const tree = parseStructures(V2_STRUCTURES, CANVASES, 'en-US')

    expect(tree).toHaveLength(1)
    const [part1] = tree
    expect(part1?.label).toBe('Part 1')
    expect(part1?.canvasIndexes).toEqual([0])
    expect(part1?.children[0]?.canvasIndexes).toEqual([1, 2])
  })

  it('忽略未在画布列表中的 id，并按升序排列下标', () => {
    const tree = parseStructures(
      [
        {
          id: 'r',
          type: 'Range',
          label: 'R',
          items: [
            { id: 'https://example.org/canvas/3', type: 'Canvas' },
            { id: 'https://example.org/canvas/missing', type: 'Canvas' },
            { id: 'https://example.org/canvas/1', type: 'Canvas' },
          ],
        },
      ],
      CANVASES,
    )

    expect(tree[0]?.canvasIndexes).toEqual([0, 2])
  })

  it('缺失 label 时回退为基于 id 的占位文案', () => {
    const tree = parseStructures([{ id: 'range-x', type: 'Range' }], CANVASES)
    expect(tree[0]?.label).toBe('Range range-x')
  })

  it('环形引用不会导致死循环', () => {
    const tree = parseStructures(
      [
        { id: 'a', type: 'Range', label: 'A', items: [{ id: 'b', type: 'Range' }] },
        { id: 'b', type: 'Range', label: 'B', items: [{ id: 'a', type: 'Range' }] },
      ],
      CANVASES,
    )

    // a 与 b 互相引用，都会被视作「被引用」→ 无根节点
    expect(tree).toEqual([])
  })
})

describe('core/iiif · findFirstCanvasIndex', () => {
  it('优先取自身直接包含的第一个画布', () => {
    expect(findFirstCanvasIndex({ id: 'r', label: 'r', canvasIndexes: [2, 5], children: [] })).toBe(
      2,
    )
  })

  it('自身无画布时递归到子节点', () => {
    const tree = parseStructures(V3_STRUCTURES, CANVASES, 'en-US')
    const chapter = tree[1]!
    // Chapter 1 自身是 canvas 3（下标 2），因此取 2
    expect(findFirstCanvasIndex(chapter)).toBe(2)

    const onlyChild = {
      id: 'parent',
      label: 'parent',
      canvasIndexes: [],
      children: [{ id: 'child', label: 'child', canvasIndexes: [1], children: [] }],
    }
    expect(findFirstCanvasIndex(onlyChild)).toBe(1)
  })

  it('整棵子树都没有画布时返回 undefined', () => {
    expect(findFirstCanvasIndex({ id: 'r', label: 'r', canvasIndexes: [], children: [] })).toBe(
      undefined,
    )
  })
})

describe('core/iiif · parseManifest 与 structures 的联动', () => {
  const MANIFEST = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: 'https://example.org/manifest/1',
    type: 'Manifest',
    label: { en: ['Book'] },
    items: [1, 2, 3].map((page) => ({
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
    structures: V3_STRUCTURES,
  }

  it('structures 会被归一化到 manifest 上', () => {
    const manifest = parseManifest(MANIFEST, 'https://example.org/manifest/1', 'en-US')
    expect(manifest.structures).toHaveLength(2)
    expect(manifest.structures[1]?.children).toHaveLength(1)
  })

  it('不可渲染的画布会被过滤，且 structures 的下标随之对齐', () => {
    // 第 2 页缺少任何图像资源 → 被过滤；canvas/3 的下标由 2 变为 1
    const broken = {
      ...MANIFEST,
      items: [
        MANIFEST.items[0],
        { id: 'https://example.org/canvas/2', type: 'Canvas' },
        MANIFEST.items[2],
      ],
    }

    const manifest = parseManifest(broken, 'https://example.org/manifest/1', 'en-US')
    expect(manifest.canvases.map((canvas) => canvas.id)).toEqual([
      'https://example.org/canvas/1',
      'https://example.org/canvas/3',
    ])

    const chapter = manifest.structures[1]
    expect(chapter?.canvasIndexes).toEqual([1])
    expect(chapter?.children[0]?.canvasIndexes).toEqual([])
  })
})
