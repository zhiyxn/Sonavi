import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConnectPanel from '../../src/renderer/src/components/ConnectPanel.vue'
import type { ApplicationInfo, SonaviApi } from '../../src/shared/application'

const applicationInfo: ApplicationInfo = {
  name: 'Sonavi',
  version: '0.1.0',
  platform: 'windows',
  platformLabel: 'Windows',
  shortcutModifier: 'Ctrl',
  closeBehavior: 'quit',
  canHideToBackground: false
}

afterEach(() => {
  Reflect.deleteProperty(window, 'sonavi')
})

describe('ConnectPanel', () => {
  it('通过受限 preload API 测试连接并在结束后清空密码', async () => {
    const test = vi.fn<SonaviApi['connection']['test']>().mockResolvedValue({
      ok: true,
      sessionId: '1e2d7353-9554-46a5-84fe-89b53008f01d',
      server: {
        baseUrl: 'https://music.example.com',
        protocolVersion: '1.16.1',
        serverType: 'navidrome',
        openSubsonic: true,
        capabilityStatus: 'available',
        extensions: [],
        musicFolders: [{ id: '1', name: 'Music' }]
      },
      credentialPersistence: 'encrypted'
    })
    Object.defineProperty(window, 'sonavi', {
      value: {
        application: { getInfo: vi.fn() },
        connection: { test },
        library: { listAlbums: vi.fn(), getAlbum: vi.fn() }
      } satisfies SonaviApi,
      configurable: true
    })

    const wrapper = mount(ConnectPanel, { props: { applicationInfo } })
    await wrapper.get('#server-url').setValue('https://music.example.com')
    await wrapper.get('#username').setValue('listener')
    await wrapper.get('#password').setValue('secret')
    await wrapper.get('#remember-me').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(test).toHaveBeenCalledWith({
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret',
      rememberMe: true,
      allowInsecureHttp: false
    })
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('凭据已使用系统加密保存')
  })
})
