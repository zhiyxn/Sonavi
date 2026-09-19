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
  closeBehavior: 'hide-window',
  canHideToBackground: true
}

afterEach(() => {
  Reflect.deleteProperty(window, 'sonavi')
})

describe('ConnectPanel', () => {
  it('通过受限 preload API 测试或恢复连接，且不向表单回填密码', async () => {
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
    const restore = vi.fn<SonaviApi['connection']['restore']>().mockResolvedValue({
      ok: true,
      sessionId: '18ae8abe-3827-4ed0-a1e4-07d3f37883ca',
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
        application: { getInfo: vi.fn(), openProjectHomepage: vi.fn() },
        connection: {
          test,
          restore,
          disconnect: vi.fn(),
          forget: vi.fn()
        },
        library: {
          listAlbums: vi.fn(),
          getAlbum: vi.fn(),
          listArtists: vi.fn(),
          getArtist: vi.fn(),
          search: vi.fn(),
          cancelSearch: vi.fn(),
          listStarred: vi.fn(),
          setStarred: vi.fn(),
          listPlaylists: vi.fn(),
          getPlaylist: vi.fn(),
          createPlaylist: vi.fn(),
          updatePlaylist: vi.fn(),
          deletePlaylist: vi.fn()
        },
        playback: {
          getLyrics: vi.fn(),
          report: vi.fn()
        },
        network: {
          getSettings: vi.fn(),
          updateSettings: vi.fn(),
          listDiagnostics: vi.fn(),
          exportDiagnostics: vi.fn(),
          reportPlaybackBuffer: vi.fn(),
          createTranscodeSeek: vi.fn()
        },
        desktop: {
          getPreferences: vi.fn(),
          updatePreferences: vi.fn(),
          updatePlaybackStatus: vi.fn(),
          onCommand: vi.fn(),
          savePausedQueue: vi.fn(),
          restorePausedQueue: vi.fn(),
          refreshQueuePlayback: vi.fn(),
          clearPausedQueue: vi.fn(),
          completeQuitPreparation: vi.fn(),
          restartApplication: vi.fn(),
          getCoverCacheInfo: vi.fn(),
          clearCoverCache: vi.fn()
        }
      } satisfies SonaviApi,
      configurable: true
    })

    const wrapper = mount(ConnectPanel, {
      props: { applicationInfo, savedConnectionAvailable: true }
    })
    expect(wrapper.findAll('[data-slot="input"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-slot="checkbox"]')).toHaveLength(2)
    expect(wrapper.get('button[type="submit"]').attributes('data-slot')).toBe('button')
    await wrapper.get('#server-url').setValue('https://music.example.com')
    await wrapper.get('#username').setValue('listener')
    await wrapper.get('#password').setValue('secret')
    await wrapper.get('#remember-me').trigger('click')
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

    await wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()
    expect(restore).toHaveBeenCalledOnce()
    expect(wrapper.emitted('connected')?.at(-1)?.[0]).toMatchObject({
      sessionId: '18ae8abe-3827-4ed0-a1e4-07d3f37883ca',
      credentialPersistence: 'encrypted'
    })
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('')
  })
})
