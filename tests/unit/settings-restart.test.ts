import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SonaviApi } from '../../src/shared/application'
import SettingsPanel from '../../src/renderer/src/components/SettingsPanel.vue'

afterEach(() => {
  Reflect.deleteProperty(window, 'sonavi')
  document.body.innerHTML = ''
})

describe('设置页安全重启', () => {
  it('取消不调用 IPC，确认后只请求一次重启', async () => {
    const restartApplication = vi.fn(async () => true)
    Object.defineProperty(window, 'sonavi', {
      value: {
        desktop: {
          getPreferences: async () => ({ closeAction: 'hide', theme: 'system', volume: 1 }),
          updatePreferences: vi.fn(),
          restartApplication,
          getCoverCacheInfo: async () => ({
            itemCount: 0,
            totalBytes: 0,
            maxBytes: 134_217_728
          })
        },
        network: {
          getSettings: async () => ({
            playback: { mode: 'automatic', maxBitRate: 320 },
            proxy: { mode: 'system' }
          }),
          listDiagnostics: async () => []
        }
      } as unknown as SonaviApi,
      configurable: true
    })

    const wrapper = mount(SettingsPanel, {
      props: {
        applicationInfo: {
          name: 'Sonavi',
          version: '0.1.0',
          platform: 'windows',
          platformLabel: 'Windows',
          shortcutModifier: 'Ctrl',
          closeBehavior: 'hide-window',
          canHideToBackground: true
        },
        connection: {
          ok: true,
          sessionId: '1e2d7353-9554-46a5-84fe-89b53008f01d',
          server: {
            baseUrl: 'https://music.example.com',
            protocolVersion: '1.16.1',
            openSubsonic: true,
            capabilityStatus: 'available',
            extensions: [],
            musicFolders: []
          },
          credentialPersistence: 'encrypted'
        }
      },
      global: { plugins: [createPinia()] }
    })
    await flushPromises()

    const restartButton = wrapper.findAll('button')
      .find((button) => button.text() === '重启 Sonavi')
    expect(restartButton).toBeDefined()
    await restartButton?.trigger('click')
    await flushPromises()
    expect(restartApplication).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('重启 Sonavi？')

    const cancelButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '取消')
    cancelButton?.click()
    await flushPromises()
    expect(restartApplication).not.toHaveBeenCalled()

    await restartButton?.trigger('click')
    await flushPromises()
    const confirmButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '确认重启')
    confirmButton?.click()
    await flushPromises()
    expect(restartApplication).toHaveBeenCalledOnce()

    wrapper.unmount()
  })
})
