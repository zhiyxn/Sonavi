import { describe, expect, it } from 'vitest'
import { getPlatformAdapter } from '../../src/main/platform'

describe('平台适配入口', () => {
  it('Windows 使用 Ctrl，默认关闭到托盘', () => {
    const adapter = getPlatformAdapter('win32')

    expect(adapter.applicationInfo).toMatchObject({
      platform: 'windows',
      shortcutModifier: 'Ctrl',
      closeBehavior: 'hide-window',
      canHideToBackground: true
    })
    expect(adapter.quitWhenAllWindowsClosed).toBe(true)
    expect(adapter.createWindowOptions().titleBarStyle).toBe('default')
  })

  it('macOS 使用 Cmd，默认隐藏并允许 Dock 重新激活', () => {
    const adapter = getPlatformAdapter('darwin')

    expect(adapter.applicationInfo).toMatchObject({
      platform: 'macos',
      shortcutModifier: 'Cmd',
      closeBehavior: 'hide-window',
      canHideToBackground: true
    })
    expect(adapter.quitWhenAllWindowsClosed).toBe(false)
    expect(adapter.createWindowOptions().titleBarStyle).toBe('default')
  })

  it('不把 Linux 悄悄标记为正式支持平台', () => {
    expect(getPlatformAdapter('linux').applicationInfo.platform).toBe('unsupported')
  })
})
