import { describe, expect, it } from 'vitest'

import {
  MIN_SUPPORTED_OSD_MAJOR,
  TESTED_OSD_MAJOR,
  builtinOpenSeadragon,
  resolveOpenSeadragon,
  verifyOpenSeadragon,
} from '../../src/core/openseadragon'
import type { OpenseadragonNamespace } from '../../src/types/viewer'

/** 构造一个具备完整必要 API 的命名空间，便于按需破坏其中一项来测试校验分支 */
function makeNamespace(options: { major?: number | null; drop?: string[] } = {}) {
  const { major = TESTED_OSD_MAJOR, drop = [] } = options
  const noop = () => undefined

  const Viewer = function ViewerStub() {} as unknown as { prototype: Record<string, unknown> }
  Viewer.prototype = { open: noop, destroy: noop, addHandler: noop }

  const Viewport = function ViewportStub() {} as unknown as { prototype: Record<string, unknown> }
  Viewport.prototype = {
    rotateTo: noop,
    setFlip: noop,
    viewportToImageZoom: noop,
    fitHorizontally: noop,
    fitVertically: noop,
  }

  for (const path of drop) {
    const [className, methodName] = path.split('.')
    const target = className === 'Viewer' ? Viewer.prototype : Viewport.prototype
    delete target[methodName!]
  }

  const namespace = ((_options: unknown) => undefined) as unknown as Record<string, unknown>
  if (major !== null) {
    namespace.version = { versionStr: `${major}.0.0`, major, minor: 0, revision: 0 }
  }
  namespace.Viewer = Viewer
  namespace.Viewport = Viewport
  return namespace as unknown as OpenseadragonNamespace
}

describe('core/openseadragon · verifyOpenSeadragon', () => {
  it('内置的 OpenSeadragon（peer 实例）通过全部必要检查', () => {
    const report = verifyOpenSeadragon(builtinOpenSeadragon)

    expect(report.ok).toBe(true)
    expect(report.missing).toEqual([])
    expect(report.version).toBeTruthy()
    expect(builtinOpenSeadragon.version.major).toBeGreaterThanOrEqual(MIN_SUPPORTED_OSD_MAJOR)
  })

  it('不可调用时判定为不兼容', () => {
    expect(verifyOpenSeadragon({}).ok).toBe(false)
    expect(verifyOpenSeadragon(null).ok).toBe(false)
    expect(verifyOpenSeadragon(undefined).ok).toBe(false)
    expect(verifyOpenSeadragon((_options: unknown) => undefined).ok).toBe(false)
  })

  it('缺少必要原型方法时逐项列出', () => {
    const report = verifyOpenSeadragon(
      makeNamespace({ drop: ['Viewport.rotateTo', 'Viewer.open', 'Viewport.setFlip'] }),
    )

    expect(report.ok).toBe(false)
    expect(report.missing).toContain('Viewport.prototype.rotateTo')
    expect(report.missing).toContain('Viewer.prototype.open')
    expect(report.missing).toContain('Viewport.prototype.setFlip')
  })

  it('主版本低于最低支持版本时判定为不兼容', () => {
    const report = verifyOpenSeadragon(makeNamespace({ major: MIN_SUPPORTED_OSD_MAJOR - 1 }))

    expect(report.ok).toBe(false)
    expect(report.missing.join(' ')).toContain(`>= ${MIN_SUPPORTED_OSD_MAJOR}`)
  })

  it('主版本高于测试基线时仅告警，仍可运行', () => {
    const report = verifyOpenSeadragon(makeNamespace({ major: TESTED_OSD_MAJOR + 1 }))

    expect(report.ok).toBe(true)
    expect(report.warnings.join(' ')).toContain(String(TESTED_OSD_MAJOR))
  })

  it('读不到版本号时告警但不阻断', () => {
    const report = verifyOpenSeadragon(makeNamespace({ major: null }))

    expect(report.ok).toBe(true)
    expect(report.version).toBeUndefined()
    expect(report.warnings).toHaveLength(1)
  })
})

describe('core/openseadragon · resolveOpenSeadragon', () => {
  it('未注入时回退到内置实例', () => {
    expect(resolveOpenSeadragon()).toBe(builtinOpenSeadragon)
    expect(resolveOpenSeadragon(null)).toBe(builtinOpenSeadragon)
    expect(resolveOpenSeadragon(undefined)).toBe(builtinOpenSeadragon)
  })

  it('注入时优先使用注入对象', () => {
    const injected = makeNamespace({ major: 5 })
    expect(resolveOpenSeadragon(injected)).toBe(injected)
  })
})
