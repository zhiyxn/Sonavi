import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App.vue'
import type { SonaviApi } from '../../src/shared/application'

function installPlatformApi(platform: 'windows' | 'macos'): void {
  const isMac = platform === 'macos'
  const api: SonaviApi = {
    application: {
      getInfo: async () => ({
        name: 'Sonavi',
        version: '0.1.0',
        platform,
        platformLabel: isMac ? 'macOS' : 'Windows',
        shortcutModifier: isMac ? 'Cmd' : 'Ctrl',
        closeBehavior: isMac ? 'close-window' : 'quit',
        canHideToBackground: false
      })
    }
  }

  Object.defineProperty(window, 'sonavi', { value: api, writable: true, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(window, 'sonavi')
})

describe('共享应用外壳', () => {
  it('按 preload 契约显示 Windows 快捷键，不渲染伪窗口按钮', async () => {
    installPlatformApi('windows')
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Windows · v0.1.0')
    expect(wrapper.text()).toContain('设置快捷键 Ctrl+,')
    expect(wrapper.find('[data-testid="fake-macos-controls"]').exists()).toBe(false)
  })

  it('macOS 与 Windows 复用同一连接组件并显示 Cmd', async () => {
    installPlatformApi('macos')
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ConnectPanel' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('设置快捷键 Cmd+,')
    expect(wrapper.text()).toContain('在这台 macOS 设备上记住我')
  })
})
