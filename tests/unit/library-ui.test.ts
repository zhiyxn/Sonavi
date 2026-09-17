import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SonaviApi } from '../../src/shared/application'
import type { ArtistSummary, CancelSearchRequest } from '../../src/shared/library'
import ArtistsPanel from '../../src/renderer/src/components/ArtistsPanel.vue'
import LibraryPanel from '../../src/renderer/src/components/LibraryPanel.vue'
import VirtualArtistList from '../../src/renderer/src/components/VirtualArtistList.vue'
import { searchLibrary } from '../../src/renderer/src/services/library'

const SESSION_ID = 'c1a3b589-7763-4fc6-8d52-cad7a11986bb'

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'sonavi')
  document.body.replaceChildren()
})

describe('P05 音乐库界面', () => {
  it('在固定 10,000 条合成数据下只渲染可见窗口并记录耗时', async () => {
    const artists: ArtistSummary[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: String(index),
      name: `艺术家 ${index} — 很长的中英文混排 Artist Name`,
      albumCount: index % 12,
      starred: false
    }))
    const startedAt = performance.now()
    const wrapper = mount(VirtualArtistList, { props: { artists } })
    const renderDurationMs = performance.now() - startedAt

    expect(wrapper.findAll('button').length).toBeLessThan(20)
    expect(renderDurationMs).toBeLessThan(1_000)
    expect(wrapper.text()).toContain('艺术家 0')
    expect(wrapper.text()).not.toContain('艺术家 9999')
    expect(wrapper.get('[data-testid="virtual-artist-list"]').attributes()).toMatchObject({
      'aria-label': '艺术家列表',
      tabindex: '0'
    })
    const viewport = wrapper.get('[data-testid="virtual-artist-list"]')
    viewport.element.scrollTop = 360
    await viewport.trigger('scroll')
    expect(wrapper.emitted('update:scrollTop')?.at(-1)).toEqual([360])
  })

  it('同一连接会话重新打开艺术家页面不会重复请求完整索引', async () => {
    const listArtists = vi.fn<SonaviApi['library']['listArtists']>().mockResolvedValue({
      ok: true,
      value: {
        indexes: [
          {
            name: 'S',
            artists: [{ id: 'artist-1', name: 'Sonavi Artist', albumCount: 1, starred: false }]
          }
        ]
      }
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listArtists } } as unknown as SonaviApi
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const mountArtists = () => mount(ArtistsPanel, {
      props: { sessionId: SESSION_ID, selectedArtistId: null },
      global: {
        plugins: [
          createPinia(),
          [VueQueryPlugin, { queryClient }]
        ]
      }
    })

    const first = mountArtists()
    await flushPromises()
    expect(first.text()).toContain('Sonavi Artist')
    expect(first.find('.artists-list-page').exists()).toBe(true)
    first.unmount()

    const reopened = mountArtists()
    await flushPromises()
    expect(reopened.text()).toContain('Sonavi Artist')
    expect(listArtists).toHaveBeenCalledOnce()
  })

  it.each([
    ['newest', '最近添加'],
    ['alphabeticalByName', '全部专辑']
  ] as const)('%s 列表从专辑详情返回时恢复进入前的滚动位置', async (listType, title) => {
    const listAlbums = vi.fn<SonaviApi['library']['listAlbums']>().mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            id: 'album-1',
            name: '恢复位置专辑',
            artist: 'Sonavi Artist',
            songCount: 0,
            duration: 0,
            starred: false
          }
        ],
        nextOffset: 1,
        hasMore: false
      }
    })
    const getAlbum = vi.fn<SonaviApi['library']['getAlbum']>().mockResolvedValue({
      ok: true,
      value: {
        id: 'album-1',
        name: '恢复位置专辑',
        artist: 'Sonavi Artist',
        songCount: 0,
        duration: 0,
        starred: false,
        tracks: [
          {
            id: 'track-1',
            title: '内部滚动歌曲',
            artist: 'Sonavi Artist',
            album: '恢复位置专辑',
            duration: 180,
            streamUrl: 'sonavi-media://media/11111111-1111-4111-8111-111111111111',
            playback: {
              streamMode: 'original',
              seekMode: 'native',
              reason: '测试原始音频。'
            },
            starred: false
          }
        ]
      }
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listAlbums, getAlbum } } as unknown as SonaviApi
    })
    const workspace = document.createElement('div')
    workspace.className = 'workspace'
    document.body.append(workspace)
    const wrapper = mount(LibraryPanel, {
      attachTo: workspace,
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com',
        serverName: '测试服务器',
        listType,
        title,
        selectedAlbumId: null,
        'onUpdate:selectedAlbumId': (selectedAlbumId: string | null) =>
          wrapper.setProps({ selectedAlbumId })
      },
      global: {
        plugins: [
          createPinia(),
          [VueQueryPlugin, {
            queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }]
        ]
      }
    })
    await flushPromises()
    workspace.scrollTop = 640

    const album = wrapper.findAll('button').find((button) => button.text().includes('恢复位置专辑'))
    await album?.trigger('click')
    await flushPromises()
    expect(workspace.scrollTop).toBe(0)
    expect(wrapper.text()).toContain('专辑详情')
    expect(wrapper.find('.album-detail-page').exists()).toBe(true)
    expect(wrapper.get('.album-track-list').attributes()).toMatchObject({
      'aria-label': '歌曲列表',
      tabindex: '0'
    })

    const back = wrapper.findAll('button').find((button) => button.text() === '返回专辑')
    await back?.trigger('click')
    await flushPromises()
    expect(workspace.scrollTop).toBe(640)
    expect(wrapper.text()).toContain(title)
  })

  it.each([
    ['newest', '最近添加'],
    ['alphabeticalByName', '全部专辑']
  ] as const)('%s 列表使用 shadcn Pagination 显式翻页', async (listType, title) => {
    const listAlbums = vi.fn<SonaviApi['library']['listAlbums']>(async (request) => ({
      ok: true,
      value: {
        items: [
          {
            id: `album-${request.offset + 1}`,
            name: request.offset === 0 ? '第一页专辑' : '第二页专辑',
            artist: 'Sonavi Artist',
            songCount: 0,
            duration: 0,
            starred: false
          }
        ],
        nextOffset: request.offset + 30,
        hasMore: request.offset === 0
      }
    }))
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listAlbums } } as unknown as SonaviApi
    })
    const workspace = document.createElement('div')
    workspace.className = 'workspace'
    document.body.append(workspace)
    const wrapper = mount(LibraryPanel, {
      attachTo: workspace,
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com',
        serverName: '测试服务器',
        listType,
        title,
        selectedAlbumId: null,
        page: 1,
        'onUpdate:page': (page: number) => wrapper.setProps({ page })
      },
      global: {
        plugins: [
          createPinia(),
          [VueQueryPlugin, {
            queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }]
        ]
      }
    })
    await flushPromises()

    expect(listAlbums).toHaveBeenLastCalledWith(expect.objectContaining({
      type: listType,
      offset: 0,
      size: 30
    }))
    expect(wrapper.text()).toContain('第一页专辑')
    expect(wrapper.text()).toContain('第 1 页 · 本页 1 张专辑')
    workspace.scrollTop = 480

    await wrapper.get('[data-slot="pagination-next"]').trigger('click')
    await flushPromises()

    expect(listAlbums).toHaveBeenLastCalledWith(expect.objectContaining({
      type: listType,
      offset: 30,
      size: 30
    }))
    expect(wrapper.text()).toContain('第二页专辑')
    expect(wrapper.text()).not.toContain('第一页专辑')
    expect(wrapper.text()).toContain('第 2 页 · 本页 1 张专辑')
    expect(workspace.scrollTop).toBe(0)
    expect(wrapper.get('[data-slot="pagination-next"]').attributes('disabled')).toBeDefined()
  })

  it('重新进入专辑页复用会话缓存，刷新按钮只重新读取当前页', async () => {
    const listAlbums = vi.fn<SonaviApi['library']['listAlbums']>().mockResolvedValue({
      ok: true,
      value: {
        items: [{
          id: 'album-1',
          name: '缓存专辑',
          artist: 'Sonavi Artist',
          songCount: 0,
          duration: 0,
          starred: false
        }],
        nextOffset: 30,
        hasMore: false
      }
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listAlbums } } as unknown as SonaviApi
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const mountLibrary = () => mount(LibraryPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com',
        serverName: '测试服务器',
        listType: 'newest',
        title: '最近添加',
        selectedAlbumId: null
      },
      global: {
        plugins: [
          createPinia(),
          [VueQueryPlugin, { queryClient }]
        ]
      }
    })

    const first = mountLibrary()
    await flushPromises()
    expect(first.text()).toContain('缓存专辑')
    expect(listAlbums).toHaveBeenCalledOnce()
    first.unmount()

    const reopened = mountLibrary()
    await flushPromises()
    expect(reopened.text()).toContain('缓存专辑')
    expect(listAlbums).toHaveBeenCalledOnce()

    const refresh = reopened.findAll('button').find((button) => button.text() === '刷新')
    await refresh?.trigger('click')
    await flushPromises()
    expect(listAlbums).toHaveBeenCalledTimes(2)
    expect(listAlbums).toHaveBeenLastCalledWith(expect.objectContaining({
      offset: 0,
      size: 30
    }))
  })

  it('renderer 中止搜索时只通过受限 API 请求主进程取消', async () => {
    let finishSearch: (() => void) | undefined
    const search = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<SonaviApi['library']['search']>>>((resolve) => {
          finishSearch = () =>
            resolve({
              ok: true,
              value: { artists: [], albums: [], tracks: [], nextOffset: 25, hasMore: false }
            })
        })
    )
    const cancelSearch = vi.fn(async (request: CancelSearchRequest) => {
      void request
      finishSearch?.()
      return true
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { search, cancelSearch } } as unknown as SonaviApi
    })
    const controller = new AbortController()
    const pending = searchLibrary(
      SESSION_ID,
      '跨平台',
      0,
      25,
      controller.signal
    )

    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(search).toHaveBeenCalledOnce()
    expect(cancelSearch).toHaveBeenCalledOnce()
    expect(cancelSearch.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION_ID
    })
  })
})
