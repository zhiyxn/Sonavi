import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import type { Plugin } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ArtistsPanel from '../../src/renderer/src/components/ArtistsPanel.vue'
import LibraryPanel from '../../src/renderer/src/components/LibraryPanel.vue'
import MusicPanel from '../../src/renderer/src/components/MusicPanel.vue'
import { listAlbums, searchLibrary } from '../../src/renderer/src/services/library'

vi.mock('../../src/renderer/src/services/library', () => ({
  getAlbum: vi.fn(),
  getArtist: vi.fn(),
  listAlbums: vi.fn(),
  searchLibrary: vi.fn(),
  setStarred: vi.fn()
}))

const SESSION_ID = 'c1a3b589-7763-4fc6-8d52-cad7a11986bb'

function result(overrides: Record<string, unknown> = {}) {
  return {
    artists: [],
    albums: [],
    tracks: [],
    artistNextOffset: 0,
    albumNextOffset: 0,
    trackNextOffset: 0,
    artistHasMore: false,
    albumHasMore: false,
    trackHasMore: false,
    ...overrides
  }
}

function globalOptions() {
  const queryPlugin: [Plugin, { queryClient: QueryClient }] = [VueQueryPlugin, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } })
  }]
  return {
    plugins: [
      createPinia(),
      queryPlugin
    ]
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('音乐库内嵌搜索与服务端分页', () => {
  it('音乐页以空查询分页浏览歌曲，并只在显式提交后切换关键词', async () => {
    vi.mocked(searchLibrary).mockImplementation(async (request) => result({
      tracks: [{
        id: `track-${request.trackOffset}`,
        title: request.query || '全部歌曲',
        artist: 'Sonavi Artist',
        album: 'Sonavi Album',
        duration: 120,
        streamUrl: 'sonavi-media://media/11111111-1111-4111-8111-111111111111',
        playback: { streamMode: 'original', seekMode: 'native', reason: '测试' },
        starred: false
      }],
      trackNextOffset: request.trackOffset + request.trackCount,
      trackHasMore: request.trackOffset === 0
    }))
    const wrapper = mount(MusicPanel, {
      props: { sessionId: SESSION_ID, serverId: 'https://music.example.com' },
      global: globalOptions()
    })
    await flushPromises()
    expect(wrapper.get('form').classes()).toContain('search-form-sticky')

    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '',
      artistCount: 0,
      albumCount: 0,
      trackCount: 30,
      trackOffset: 0
    }), expect.any(AbortSignal))

    const input = wrapper.get('input[type="search"]')
    await input.setValue('明确搜索')
    await flushPromises()
    expect(searchLibrary).toHaveBeenCalledTimes(1)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '明确搜索',
      trackOffset: 0
    }), expect.any(AbortSignal))

    await wrapper.get('[data-testid="music-pagination"] [data-slot="pagination-next"]')
      .trigger('click')
    await flushPromises()
    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '明确搜索',
      trackOffset: 30
    }), expect.any(AbortSignal))
  })

  it('服务器返回空的后继页时仍保留上一页入口', async () => {
    vi.mocked(searchLibrary).mockImplementation(async (request) => result({
      tracks: request.trackOffset === 0
        ? [{
            id: 'track-0',
            title: '第一页歌曲',
            artist: 'Sonavi Artist',
            album: 'Sonavi Album',
            duration: 120,
            streamUrl: 'sonavi-media://media/11111111-1111-4111-8111-111111111111',
            playback: { streamMode: 'original', seekMode: 'native', reason: '测试' },
            starred: false
          }]
        : [],
      trackNextOffset: request.trackOffset + request.trackCount,
      trackHasMore: request.trackOffset === 0
    }))
    const wrapper = mount(MusicPanel, {
      props: { sessionId: SESSION_ID, serverId: 'https://music.example.com' },
      global: globalOptions()
    })
    await flushPromises()

    await wrapper.get('[data-testid="music-pagination"] [data-slot="pagination-next"]')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('音乐库中暂无歌曲')
    const previous = wrapper.get(
      '[data-testid="music-pagination"] [data-slot="pagination-previous"]'
    )
    expect(previous.attributes('data-disabled')).toBeUndefined()
  })

  it('专辑页保留字母列表，并在提交搜索后切换为专辑限定结果', async () => {
    vi.mocked(listAlbums).mockResolvedValue({ items: [], nextOffset: 30, hasMore: false })
    vi.mocked(searchLibrary).mockResolvedValue(result())
    const wrapper = mount(LibraryPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com',
        serverName: '测试服务器',
        listType: 'alphabeticalByName',
        title: '全部专辑',
        selectedAlbumId: null
      },
      global: globalOptions()
    })
    await flushPromises()
    expect(wrapper.get('form').classes()).toContain('search-form-sticky')

    expect(listAlbums).toHaveBeenCalledOnce()
    expect(searchLibrary).not.toHaveBeenCalled()
    await wrapper.get('input[placeholder="搜索专辑"]').setValue('石与琥珀')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '石与琥珀',
      artistCount: 0,
      albumCount: 30,
      trackCount: 0
    }), expect.any(AbortSignal))
  })

  it('艺术家页用空查询和 artistOffset 服务端分页，并支持艺术家限定搜索', async () => {
    vi.mocked(searchLibrary).mockImplementation(async (request) => result({
      artists: [{
        id: `artist-${request.artistOffset}`,
        name: request.query || '全部艺术家',
        albumCount: 1,
        starred: false
      }],
      artistNextOffset: request.artistOffset + request.artistCount,
      artistHasMore: request.artistOffset === 0
    }))
    const wrapper = mount(ArtistsPanel, {
      props: { sessionId: SESSION_ID, selectedArtistId: null },
      global: globalOptions()
    })
    await flushPromises()
    expect(wrapper.get('form').classes()).toContain('search-form-sticky')

    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '',
      artistOffset: 0,
      artistCount: 50,
      albumCount: 0,
      trackCount: 0
    }), expect.any(AbortSignal))

    await wrapper.get('[data-testid="artists-pagination"] [data-slot="pagination-next"]')
      .trigger('click')
    await flushPromises()
    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      artistOffset: 50
    }), expect.any(AbortSignal))

    await wrapper.get('input[placeholder="搜索艺术家"]').setValue('声波旅人')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '声波旅人',
      artistOffset: 0
    }), expect.any(AbortSignal))
  })
})
