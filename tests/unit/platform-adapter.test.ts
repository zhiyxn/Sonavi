import { describe, expect, it } from 'vitest'
import { getPlatformAdapter } from '../../src/main/platform'

describe('平台适配入口', () => {
  it('Windows 使用 Ctrl，关闭最后窗口时退出', () => {
    const adapter = getPlatformAdapter('win32')

    expect(adapter.applicationInfo).toMatchObject({
      platform: 'windows',
      shortcutModifier: 'Ctrl',
      closeBehavior: 'quit'
    })
    expect(adapter.quitWhenAllWindowsClosed).toBe(true)
    expect(adapter.createWindowOptions().titleBarStyle).toBe('default')
  })

  it('macOS 使用 Cmd，关闭最后窗口后允许 Dock 重新激活', () => {
    const adapter = getPlatformAdapter('darwin')

    expect(adapter.applicationInfo).toMatchObject({
      platform: 'macos',
      shortcutModifier: 'Cmd',
      closeBehavior: 'close-window'
    })
    expect(adapter.quitWhenAllWindowsClosed).toBe(false)
    expect(adapter.createWindowOptions().titleBarStyle).toBe('default')
  })

  it('不把 Linux 悄悄标记为正式支持平台', () => {
    expect(getPlatformAdapter('linux').applicationInfo.platform).toBe('unsupported')
  })
})
