import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
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
        closeBehavior: 'hide-window',
        canHideToBackground: true
      })
    },
    connection: {
      test: async () => ({
        ok: false,
        error: { code: 'network', message: 'not used in app shell tests', retryable: true }
      }),
      restore: async () => null,
      disconnect: async () => true,
      forget: async () => true
    },
    library: {
      listAlbums: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      getAlbum: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      listArtists: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      getArtist: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      search: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      cancelSearch: async () => false,
      listStarred: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      setStarred: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      listPlaylists: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      getPlaylist: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      createPlaylist: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      updatePlaylist: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      }),
      deletePlaylist: async () => ({
        ok: false,
        error: { code: 'not-connected', message: 'not used', retryable: false }
      })
    },
    playback: {
      getLyrics: async () => ({ ok: true, value: { source: 'none', variants: [] } }),
      report: async () => ({ ok: true, value: { reported: true } })
    },
    network: {
      getSettings: async () => ({
        playback: { mode: 'automatic', maxBitRate: 320 },
        proxy: { mode: 'system' }
      }),
      updateSettings: async (settings) => ({ settings, connectionsReset: false }),
      listDiagnostics: async () => [],
      exportDiagnostics: async () => ({ exported: false, cancelled: true }),
      createTranscodeSeek: async () => ({ ok: false, message: 'not used' })
    },
    desktop: {
      getPreferences: async () => ({ closeAction: 'hide', theme: 'system', volume: 1 }),
      updatePreferences: async (preferences) => preferences,
      updatePlaybackStatus: async () => true,
      onCommand: () => () => undefined,
      savePausedQueue: async () => true,
      restorePausedQueue: async () => null,
      clearPausedQueue: async () => true,
      completeQuitPreparation: async () => true,
      getCoverCacheInfo: async () => ({ itemCount: 0, totalBytes: 0, maxBytes: 134_217_728 }),
      clearCoverCache: async () => ({ itemCount: 0, totalBytes: 0, maxBytes: 134_217_728 })
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
    const wrapper = mount(App, { global: { plugins: [createPinia(), VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Windows · v0.1.0')
    expect(wrapper.text()).toContain('设置快捷键 Ctrl+,')
    expect(wrapper.get('img.brand-logo').attributes('src')).toContain('sonavi-logo.png')
    expect(wrapper.find('[data-testid="fake-macos-controls"]').exists()).toBe(false)
  })

  it('macOS 与 Windows 复用同一连接组件并显示 Cmd', async () => {
    installPlatformApi('macos')
    const wrapper = mount(App, { global: { plugins: [createPinia(), VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ConnectPanel' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('设置快捷键 Cmd+,')
    expect(wrapper.text()).toContain('在这台 macOS 设备上记住我')
  })
})
