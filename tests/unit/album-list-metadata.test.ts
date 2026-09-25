import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { Plugin } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ArtistsPanel from '../../src/renderer/src/components/ArtistsPanel.vue'
import FavoritesPanel from '../../src/renderer/src/components/FavoritesPanel.vue'
import LibraryPanel from '../../src/renderer/src/components/LibraryPanel.vue'
import {
  getArtist,
  listAlbums,
  listStarred,
  searchLibrary
} from '../../src/renderer/src/services/library'

vi.mock('../../src/renderer/src/services/library', () => ({
  getAlbum: vi.fn(),
  getArtist: vi.fn(),
  listAlbums: vi.fn(),
  listArtists: vi.fn(),
  listStarred: vi.fn(),
  searchLibrary: vi.fn()
}))

const SESSION_ID = 'c1a3b589-7763-4fc6-8d52-cad7a11986bb'
const SERVER_ID = 'https://music.example.com'

function globalPlugins() {
  const queryPlugin: [Plugin, { queryClient: QueryClient }] = [
    VueQueryPlugin,
    {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } })
    }
  ]
  return {
    plugins: [
      createPinia(),
      queryPlugin
    ]
  }
}

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.clearAllMocks()
})

describe('专辑列表元数据与搜索布局', () => {
  it('全部专辑卡片显示歌曲数量', async () => {
    vi.mocked(listAlbums).mockResolvedValue({
      items: [{
        id: 'album-library',
        name: '音乐库专辑',
        artist: '一个非常非常非常非常非常非常非常长的艺术家名称',
        songCount: 11,
        duration: 660,
        starred: false
      }],
      nextOffset: 1,
      hasMore: false
    })

    const wrapper = mount(LibraryPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: SERVER_ID,
        serverName: '测试服务器',
        listType: 'alphabeticalByName',
        title: '全部专辑',
        selectedAlbumId: null
      },
      global: globalPlugins()
    })
    await flushPromises()

    expect(wrapper.get('.album-card').text()).toContain('11 首歌曲')
    expect(wrapper.get('.album-card-song-count').text()).toBe('11 首歌曲')
  })

  it('艺术家详情中的专辑卡片显示歌曲数量', async () => {
    vi.mocked(getArtist).mockResolvedValue({
      id: 'artist-1',
      name: 'Sonavi Artist',
      albumCount: 1,
      starred: false,
      albums: [{
        id: 'album-artist',
        name: '艺术家专辑',
        artist: 'Sonavi Artist',
        year: 2026,
        songCount: 7,
        duration: 420,
        starred: false
      }]
    })

    const wrapper = mount(ArtistsPanel, {
      props: {
        sessionId: SESSION_ID,
        selectedArtistId: 'artist-1',
        artistListEnabled: false
      },
      global: globalPlugins()
    })
    await flushPromises()

    expect(wrapper.get('.album-card').text()).toContain('7 首歌曲')
    expect(wrapper.get('.album-card-song-count').text()).toBe('7 首歌曲')
  })

  it('收藏专辑列表显示歌曲数量', async () => {
    vi.mocked(listStarred).mockResolvedValue({
      artists: [],
      albums: [{
        id: 'album-favorite',
        name: '收藏专辑',
        artist: 'Sonavi Artist',
        songCount: 5,
        duration: 300,
        starred: true
      }],
      tracks: []
    })

    const wrapper = mount(FavoritesPanel, {
      props: { sessionId: SESSION_ID, serverId: SERVER_ID },
      global: globalPlugins()
    })
    await flushPromises()

    expect(wrapper.get('.entity-main').text()).toContain('5 首歌曲')
    expect(wrapper.get('.album-card-song-count').text()).toBe('5 首歌曲')
  })

  it('专辑页内搜索结果显示专辑歌曲数量', async () => {
    vi.mocked(listAlbums).mockResolvedValue({ items: [], nextOffset: 30, hasMore: false })
    vi.mocked(searchLibrary).mockResolvedValue({
      artists: [],
      albums: [{
        id: 'album-search',
        name: '搜索专辑',
        artist: 'Sonavi Artist',
        songCount: 9,
        duration: 540,
        starred: false
      }],
      tracks: [],
      artistNextOffset: 0,
      albumNextOffset: 30,
      trackNextOffset: 0,
      artistHasMore: false,
      albumHasMore: false,
      trackHasMore: false
    })

    const wrapper = mount(LibraryPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: SERVER_ID,
        serverName: '测试服务器',
        listType: 'alphabeticalByName',
        title: '全部专辑',
        selectedAlbumId: null
      },
      global: globalPlugins()
    })
    await wrapper.get('input[placeholder="搜索专辑"]').setValue('Sonavi')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-slot="pagination-next"]').exists()).toBe(true)
    expect(wrapper.get('.album-card').text()).toContain('9 首歌曲')
    expect(wrapper.get('.album-card-song-count').text()).toBe('9 首歌曲')
  })
})
