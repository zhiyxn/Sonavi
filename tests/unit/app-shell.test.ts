import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from '../../src/renderer/src/App.vue'
import type { SonaviApi } from '../../src/shared/application'
import { usePlayerStore } from '../../src/renderer/src/stores/player'
import { useSessionStore } from '../../src/renderer/src/stores/session'

function installPlatformApi(platform: 'windows' | 'macos'): SonaviApi {
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
  return api
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

  it('断开连接先暂停并保存队列，确认断开后才清空播放器', async () => {
    const api = installPlatformApi('windows')
    let finishDisconnect: ((result: boolean) => void) | undefined
    api.connection.disconnect = vi.fn(
      () => new Promise<boolean>((resolve) => { finishDisconnect = resolve })
    )
    api.desktop.savePausedQueue = vi.fn(async () => true)
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    const session = useSessionStore(pinia)
    const player = usePlayerStore(pinia)
    const pause = vi.spyOn(player, 'pause').mockImplementation(() => undefined)
    const stop = vi.spyOn(player, 'stop').mockImplementation(() => undefined)

    session.establish({
      ok: true,
      sessionId: '1e2d7353-9554-46a5-84fe-89b53008f01d',
      server: {
        baseUrl: 'https://music.example.com',
        protocolVersion: '1.16.1',
        serverType: 'navidrome',
        openSubsonic: true,
        capabilityStatus: 'available',
        extensions: [],
        musicFolders: []
      },
      credentialPersistence: 'encrypted'
    })
    await flushPromises()

    const settingsButton = wrapper.findAll('button').find((button) => button.text() === '设置')
    await settingsButton?.trigger('click')
    const disconnectButton = wrapper.findAll('button').find((button) => button.text() === '断开连接')
    await disconnectButton?.trigger('click')
    await flushPromises()

    expect(pause).toHaveBeenCalledOnce()
    expect(api.desktop.savePausedQueue).toHaveBeenCalledOnce()
    expect(api.connection.disconnect).toHaveBeenCalledOnce()
    expect(vi.mocked(api.desktop.savePausedQueue).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.connection.disconnect).mock.invocationCallOrder[0] ?? 0
    )
    expect(stop).not.toHaveBeenCalled()

    finishDisconnect?.(true)
    await flushPromises()
    expect(stop).toHaveBeenCalledOnce()
    expect(session.connection).toBeNull()
  })
})
