import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
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
      }),
      openProjectHomepage: vi.fn(async () => true)
    },
    connection: {
      test: async () => ({
        ok: false,
        error: { code: 'network', message: 'not used in app shell tests', retryable: true }
      }),
      restore: async () => null,
      listSaved: async () => [],
      connectSaved: async () => ({
        ok: false,
        error: { code: 'network', message: 'not used in app shell tests', retryable: true }
      }),
      deleteSaved: async () => true,
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
      updateSettings: async (settings) => ({
        settings,
        connectionsReset: false,
        playbackChanged: false
      }),
      listDiagnostics: async () => [],
      exportDiagnostics: async () => ({ exported: false, cancelled: true }),
      reportPlaybackBuffer: async () => undefined,
      createTranscodeSeek: async () => ({ ok: false, message: 'not used' })
    },
    desktop: {
      getPreferences: async () => ({ closeAction: 'hide', theme: 'system', volume: 1 }),
      updatePreferences: async (preferences) => preferences,
      updatePlaybackStatus: async () => true,
      onCommand: () => () => undefined,
      restartApplication: vi.fn(async () => true),
      savePausedQueue: async () => true,
      restorePausedQueue: async () => null,
      refreshQueuePlayback: async () => null,
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
  Reflect.deleteProperty(window, 'confirm')
  document.body.innerHTML = ''
})

enableAutoUnmount(afterEach)

describe('共享应用外壳', () => {
  it('连接后默认展示专辑，并使用音乐/专辑/艺术家导航而不保留首页和独立搜索', async () => {
    installPlatformApi('windows')
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()

    useSessionStore(pinia).establish({
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

    expect(wrapper.findAll('button.nav-item').map((button) => button.text())).toEqual([
      '音乐',
      '专辑',
      '艺术家',
      '收藏',
      '歌单',
      '服务器',
      '设置'
    ])
    expect(wrapper.findComponent({ name: 'LibraryPanel' }).exists()).toBe(true)
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('title')).toBe('全部专辑')
    expect(wrapper.findComponent({ name: 'SearchPanel' }).exists()).toBe(false)
  })

  it('按 preload 契约显示 Windows 快捷键，不渲染伪窗口按钮', async () => {
    const api = installPlatformApi('windows')
    const wrapper = mount(App, { global: { plugins: [createPinia(), VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Windows · v0.1.0')
    expect(wrapper.text()).toContain('设置快捷键 Ctrl+,')
    expect(wrapper.get('img.brand-logo').attributes('src')).toContain('sonavi-logo.png')
    await wrapper.get('button.brand').trigger('click')
    expect(api.application.openProjectHomepage).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="fake-macos-controls"]').exists()).toBe(false)
    expect(wrapper.find('[data-sonner-toaster]').exists()).toBe(true)
  })

  it('macOS 与 Windows 复用同一连接组件并显示 Cmd', async () => {
    installPlatformApi('macos')
    const wrapper = mount(App, { global: { plugins: [createPinia(), VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ConnectPanel' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('设置快捷键 Cmd+,')
    expect(wrapper.text()).toContain('在这台 macOS 设备上记住我')
  })

  it('从服务器管理添加账号时保留当前会话，并可取消返回', async () => {
    const api = installPlatformApi('windows')
    api.connection.disconnect = vi.fn(async () => true)
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    const session = useSessionStore(pinia)
    session.establish({
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
      credentialPersistence: 'encrypted',
      profileId: '82c3080c-82dc-4d4d-b7da-a610f9efffb4'
    })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '服务器')?.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '添加服务器')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('添加服务器')
    expect(session.connection?.sessionId).toBe('1e2d7353-9554-46a5-84fe-89b53008f01d')
    expect(api.connection.disconnect).not.toHaveBeenCalled()

    await wrapper.findAll('button').find((button) => button.text() === '取消')?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('服务器管理')
    expect(session.connection).not.toBeNull()
  })

  it('页面眉题只显示栏目名称，不保留无意义的重复编号', async () => {
    installPlatformApi('windows')
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.get('.eyebrow').text()).toBe('CONNECT')
    const session = useSessionStore(pinia)
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

    const headings = [
      ['音乐', 'MUSIC'],
      ['专辑', 'LIBRARY'],
      ['艺术家', 'ARTISTS'],
      ['收藏', 'FAVORITES'],
      ['歌单', 'PLAYLISTS'],
      ['设置', 'SETTINGS']
    ] as const
    const workspace = wrapper.get('.workspace')
    for (const [navigationLabel, heading] of headings) {
      const navigation = wrapper
        .findAll('button.nav-item')
        .find((button) => button.text() === navigationLabel)
      expect(navigation).toBeDefined()
      await navigation!.trigger('click')
      await flushPromises()
      expect(wrapper.get('.eyebrow').text()).toBe(heading)
      expect(wrapper.get('.eyebrow').text()).not.toContain('/')
      expect(workspace.classes()).not.toContain('workspace-artists-list')
    }
  })

  it('除设置外切换页面时分别保存并恢复各自滚动位置', async () => {
    const api = installPlatformApi('windows')
    api.library.search = vi.fn<SonaviApi['library']['search']>().mockResolvedValue({
      ok: true,
      value: {
        artists: [{ id: 'artist-1', name: 'Sonavi Artist', albumCount: 1, starred: false }],
        albums: [],
        tracks: [],
        artistNextOffset: 50,
        albumNextOffset: 0,
        trackNextOffset: 0,
        artistHasMore: false,
        albumHasMore: false,
        trackHasMore: false
      }
    })
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    useSessionStore(pinia).establish({
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
    const workspace = wrapper.get('.workspace')
    const navigation = (label: string) =>
      wrapper.findAll('button.nav-item').find((button) => button.text() === label)!

    const albumsLibrary = wrapper.getComponent({ name: 'LibraryPanel' })
    expect(albumsLibrary.props('page')).toBe(1)
    albumsLibrary.vm.$emit('update:page', 3)
    await flushPromises()
    workspace.element.scrollTop = 520
    await workspace.trigger('scroll')

    await navigation('音乐').trigger('click')
    await flushPromises()
    workspace.element.scrollTop = 260
    await workspace.trigger('scroll')

    await navigation('设置').trigger('click')
    await flushPromises()
    expect(workspace.element.scrollTop).toBe(0)
    await navigation('艺术家').trigger('click')
    await flushPromises()
    workspace.element.scrollTop = 216
    await workspace.trigger('scroll')

    await navigation('专辑').trigger('click')
    await flushPromises()
    expect(workspace.element.scrollTop).toBe(520)
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('page')).toBe(3)

    await navigation('设置').trigger('click')
    await flushPromises()
    expect(workspace.element.scrollTop).toBe(0)

    await navigation('艺术家').trigger('click')
    await flushPromises()
    expect(workspace.element.scrollTop).toBe(216)

    await navigation('音乐').trigger('click')
    await flushPromises()
    expect(workspace.element.scrollTop).toBe(260)
  })

  it('切换页面保留已访问页面实例且不重复读取当前专辑页', async () => {
    const api = installPlatformApi('windows')
    api.library.listAlbums = vi.fn<SonaviApi['library']['listAlbums']>().mockResolvedValue({
      ok: true,
      value: {
        items: [{
          id: 'album-1',
          name: '会话缓存专辑',
          artist: 'Sonavi Artist',
          songCount: 0,
          duration: 0,
          starred: false
        }],
        nextOffset: 30,
        hasMore: false
      }
    })
    api.library.search = vi.fn<SonaviApi['library']['search']>().mockResolvedValue({
      ok: true,
      value: {
        artists: [],
        albums: [],
        tracks: [],
        artistNextOffset: 25,
        albumNextOffset: 25,
        trackNextOffset: 25,
        artistHasMore: false,
        albumHasMore: false,
        trackHasMore: false
      }
    })
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    useSessionStore(pinia).establish({
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
    expect(api.library.listAlbums).toHaveBeenCalledOnce()

    const navigation = (label: string) =>
      wrapper.findAll('button.nav-item').find((button) => button.text() === label)!
    await navigation('音乐').trigger('click')
    await flushPromises()
    const searchInput = wrapper.get('input[type="search"]')
    await searchInput.setValue('保留的搜索')
    await searchInput.trigger('keydown.enter')
    await flushPromises()
    expect(api.library.search).toHaveBeenCalledTimes(2)

    await navigation('专辑').trigger('click')
    await flushPromises()
    expect(api.library.listAlbums).toHaveBeenCalledOnce()

    await navigation('音乐').trigger('click')
    await flushPromises()
    expect(wrapper.get('input[type="search"]').element).toHaveProperty('value', '保留的搜索')
    expect(api.library.search).toHaveBeenCalledTimes(2)
  })

  it('从艺术家搜索进入详情及其专辑时保留艺术家来源并逐级返回', async () => {
    const api = installPlatformApi('windows')
    api.library.listAlbums = vi.fn(api.library.listAlbums)
    api.library.getAlbum = vi.fn<SonaviApi['library']['getAlbum']>().mockResolvedValue({
      ok: true,
      value: {
        id: 'album-1',
        name: '艺术家来源专辑',
        artist: '测试艺术家',
        songCount: 0,
        duration: 0,
        starred: false,
        tracks: []
      }
    })
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    useSessionStore(pinia).establish({
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

    const navigation = (label: string) =>
      wrapper.findAll('button.nav-item').find((button) => button.text() === label)!
    await navigation('艺术家').trigger('click')
    await flushPromises()
    vi.mocked(api.library.listAlbums).mockClear()
    const searchInput = wrapper.get('input[placeholder="搜索艺术家"]')
    await searchInput.setValue('测试艺术家')
    await searchInput.trigger('keydown.enter')
    await flushPromises()
    wrapper.getComponent({ name: 'ArtistsPanel' }).vm.$emit('update:selectedArtistId', 'artist-1')
    await flushPromises()
    const artistsPanel = wrapper.getComponent({ name: 'ArtistsPanel' })
    expect(artistsPanel.props('selectedArtistId')).toBe('artist-1')
    expect(artistsPanel.props('artistListEnabled')).toBe(true)
    expect(artistsPanel.props('backLabel')).toBe('返回艺术家')
    expect(navigation('艺术家').classes()).toContain('active')
    const workspace = wrapper.get('.workspace')
    expect(workspace.classes()).not.toContain('workspace-artists-list')
    workspace.element.scrollTop = 410
    await workspace.trigger('scroll')

    artistsPanel.vm.$emit('openAlbum', 'album-1')
    await flushPromises()
    expect(workspace.element.scrollTop).toBe(0)
    expect(workspace.classes()).toContain('workspace-album-detail')
    expect(navigation('艺术家').classes()).toContain('active')
    expect(navigation('专辑').classes()).not.toContain('active')
    const libraryPanel = wrapper.getComponent({ name: 'LibraryPanel' })
    expect(libraryPanel.props('backLabel')).toBe('返回艺术家专辑')
    expect(libraryPanel.props('albumListEnabled')).toBe(false)
    expect(libraryPanel.text()).toContain('艺术家来源专辑')
    expect(api.library.listAlbums).not.toHaveBeenCalled()

    const back = wrapper.findAll('button').find((button) => button.text() === '返回艺术家专辑')
    await back?.trigger('click')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'ArtistsPanel' }).props('selectedArtistId')).toBe('artist-1')
    expect(navigation('艺术家').classes()).toContain('active')
    expect(workspace.element.scrollTop).toBe(410)
    expect(workspace.classes()).not.toContain('workspace-album-detail')

    wrapper.getComponent({ name: 'ArtistsPanel' }).vm.$emit('update:selectedArtistId', null)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ArtistsPanel' }).exists()).toBe(true)
    expect(wrapper.get('input[placeholder="搜索艺术家"]').element).toHaveProperty('value', '测试艺术家')
    expect(navigation('艺术家').classes()).toContain('active')
  })

  it('收藏的专辑详情保留来源栏目并返回原页面', async () => {
    const api = installPlatformApi('windows')
    api.library.getAlbum = vi.fn<SonaviApi['library']['getAlbum']>().mockResolvedValue({
      ok: true,
      value: {
        id: 'album-1',
        name: '来源专辑',
        artist: '测试艺术家',
        songCount: 0,
        duration: 0,
        starred: false,
        tracks: []
      }
    })
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    useSessionStore(pinia).establish({
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

    const navigation = (label: string) =>
      wrapper.findAll('button.nav-item').find((button) => button.text() === label)!
    for (const [label, componentName, backLabel] of [
      ['收藏', 'FavoritesPanel', '返回收藏']
    ] as const) {
      await navigation(label).trigger('click')
      await flushPromises()
      wrapper.getComponent({ name: componentName }).vm.$emit('openAlbum', 'album-1')
      await flushPromises()

      const libraryPanel = wrapper.getComponent({ name: 'LibraryPanel' })
      expect(libraryPanel.props('selectedAlbumId')).toBe('album-1')
      expect(libraryPanel.props('backLabel')).toBe(backLabel)
      expect(libraryPanel.props('albumListEnabled')).toBe(false)
      expect(navigation(label).classes()).toContain('active')
      expect(navigation('专辑').classes()).not.toContain('active')

      const back = wrapper.findAll('button').find((button) => button.text() === backLabel)
      await back?.trigger('click')
      await flushPromises()
      expect(wrapper.findComponent({ name: componentName }).exists()).toBe(true)
      expect(navigation(label).classes()).toContain('active')
    }
  })

  it('专辑与艺术家栏目分别保留自己的详情状态', async () => {
    const api = installPlatformApi('windows')
    api.library.listAlbums = vi.fn<SonaviApi['library']['listAlbums']>().mockResolvedValue({
      ok: true,
      value: { items: [], nextOffset: 30, hasMore: false }
    })
    api.library.getAlbum = vi.fn<SonaviApi['library']['getAlbum']>().mockResolvedValue({
      ok: true,
      value: {
        id: 'artist-album-1',
        name: '艺术家来源专辑',
        artist: '测试艺术家',
        songCount: 0,
        duration: 0,
        starred: false,
        tracks: []
      }
    })
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    useSessionStore(pinia).establish({
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
    const navigation = (label: string) =>
      wrapper.findAll('button.nav-item').find((button) => button.text() === label)!

    await navigation('艺术家').trigger('click')
    await flushPromises()
    let artistsPanel = wrapper.getComponent({ name: 'ArtistsPanel' })
    artistsPanel.vm.$emit('update:selectedArtistId', 'artist-1')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'ArtistsPanel' }).props('selectedArtistId')).toBe('artist-1')

    await navigation('专辑').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('selectedAlbumId')).toBeNull()

    await navigation('艺术家').trigger('click')
    await flushPromises()
    artistsPanel = wrapper.getComponent({ name: 'ArtistsPanel' })
    expect(artistsPanel.props('selectedArtistId')).toBe('artist-1')
    artistsPanel.vm.$emit('openAlbum', 'artist-album-1')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('selectedAlbumId')).toBe('artist-album-1')

    await navigation('专辑').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('selectedAlbumId')).toBeNull()

    await navigation('艺术家').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('selectedAlbumId')).toBe('artist-album-1')
    expect(wrapper.getComponent({ name: 'LibraryPanel' }).props('backLabel')).toBe('返回艺术家专辑')
  })

  it('清空缓存和断开连接均在 AlertDialog 确认后才执行', async () => {
    const api = installPlatformApi('windows')
    const profileId = '82c3080c-82dc-4d4d-b7da-a610f9efffb4'
    api.connection.listSaved = vi.fn(async () => [{
      id: profileId,
      serverUrl: 'https://music.example.com',
      username: 'listener',
      isDefault: true
    }])
    api.desktop.clearCoverCache = vi.fn(async () => ({
      itemCount: 0,
      totalBytes: 0,
      maxBytes: 134_217_728
    }))
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
      credentialPersistence: 'encrypted',
      profileId
    })
    await flushPromises()

    const settingsButton = wrapper.findAll('button').find((button) => button.text() === '设置')
    await settingsButton?.trigger('click')
    await flushPromises()

    const clearCacheButton = wrapper.findAll('button')
      .find((button) => button.text() === '清空当前账号缓存')
    await clearCacheButton?.trigger('click')
    await flushPromises()
    expect(api.desktop.clearCoverCache).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('清空当前账号的封面缓存？')

    const cancelCacheButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '取消')
    cancelCacheButton?.click()
    await flushPromises()
    expect(api.desktop.clearCoverCache).not.toHaveBeenCalled()

    await clearCacheButton?.trigger('click')
    await flushPromises()
    const confirmCacheButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '清空缓存')
    confirmCacheButton?.click()
    await flushPromises()
    expect(api.desktop.clearCoverCache).toHaveBeenCalledOnce()

    const disconnectButton = wrapper.findAll('button').find((button) => button.text() === '断开连接')
    await disconnectButton?.trigger('click')
    await flushPromises()

    expect(api.connection.disconnect).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('断开当前连接？')
    const confirmDisconnectButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '确认断开')
    confirmDisconnectButton?.click()
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
    expect(wrapper.text()).toContain('已保存服务器')
    expect(wrapper.text()).toContain('https://music.example.com')
  })

  it('保存播放设置刷新队列播放计划，仅代理连接重置时停止播放器', async () => {
    const api = installPlatformApi('windows')
    api.library.listAlbums = vi.fn<SonaviApi['library']['listAlbums']>().mockResolvedValue({
      ok: true,
      value: { items: [], nextOffset: 30, hasMore: false }
    })
    api.network.updateSettings = vi.fn(async (settings) => ({
      settings,
      connectionsReset: false,
      playbackChanged: true
    }))
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    const player = usePlayerStore(pinia)
    const stop = vi.spyOn(player, 'stop').mockImplementation(() => undefined)
    const refreshedTrack = {
      id: 'track-1',
      title: '策略切换测试',
      artist: 'Sonavi Artist',
      album: 'Queue Album',
      duration: 120,
      streamUrl: 'sonavi-media://media/00000000-0000-4000-8000-000000000003',
      playback: {
        streamMode: 'transcode' as const,
        seekMode: 'unavailable' as const,
        reason: '测试兼容转码。'
      },
      starred: false
    }
    player.queue = [{
      queueEntryId: 'queue-1',
      trackId: refreshedTrack.id,
      scope: {
        sessionId: '1e2d7353-9554-46a5-84fe-89b53008f01d',
        serverId: 'https://music.example.com',
        accountId: '1e2d7353-9554-46a5-84fe-89b53008f01d'
      },
      track: {
        ...refreshedTrack,
        streamUrl: 'sonavi-media://media/00000000-0000-4000-8000-000000000004',
        playback: {
          streamMode: 'original',
          seekMode: 'native',
          reason: '测试原始音频。'
        }
      }
    }]
    player.currentEntryId = 'queue-1'
    api.desktop.refreshQueuePlayback = vi.fn(async () => [refreshedTrack])
    const refreshQueueTracks = vi.spyOn(player, 'refreshQueueTracks').mockResolvedValue(true)

    useSessionStore(pinia).establish({
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
    expect(api.library.listAlbums).toHaveBeenCalledOnce()

    const settingsButton = wrapper.findAll('button').find((button) => button.text() === '设置')
    await settingsButton?.trigger('click')
    await flushPromises()
    const settingsPanel = wrapper.getComponent({ name: 'SettingsPanel' })
    const saveButton = settingsPanel.findAll('button')
      .find((button) => button.text() === '保存播放与网络设置')
    expect(saveButton).toBeDefined()
    const playbackAndNetworkForm = settingsPanel.findAll('form')[1]
    expect(playbackAndNetworkForm).toBeDefined()
    await playbackAndNetworkForm!.trigger('submit')
    await flushPromises()

    expect(api.network.updateSettings).toHaveBeenCalledOnce()
    expect(api.library.listAlbums).toHaveBeenCalledTimes(2)
    expect(api.desktop.refreshQueuePlayback).toHaveBeenCalledOnce()
    expect(refreshQueueTracks).toHaveBeenCalledWith([refreshedTrack])
    expect(settingsPanel.text()).toContain('当前歌曲会尽量从原进度切换，否则下一曲生效')
    expect(stop).not.toHaveBeenCalled()

    settingsPanel.vm.$emit('networkChanged', true, false)
    await flushPromises()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('退出并忘记账号使用 AlertDialog 二次确认，不调用原生 confirm', async () => {
    const api = installPlatformApi('windows')
    api.connection.forget = vi.fn(async () => true)
    const nativeConfirm = vi.fn()
    Object.defineProperty(window, 'confirm', { configurable: true, value: nativeConfirm })
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()
    useSessionStore(pinia).establish({
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
    await flushPromises()
    const forgetButton = wrapper.findAll('button').find((button) => button.text() === '退出并忘记账号')
    await forgetButton?.trigger('click')
    await flushPromises()

    expect(nativeConfirm).not.toHaveBeenCalled()
    expect(api.connection.forget).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('退出并忘记账号？')
    const confirmButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '退出并删除')
    expect(confirmButton).toBeDefined()
    confirmButton?.click()
    await flushPromises()

    expect(api.connection.forget).toHaveBeenCalledOnce()
    expect(useSessionStore(pinia).connection).toBeNull()
  })
})
