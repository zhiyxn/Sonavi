import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SearchPanel from '../../src/renderer/src/components/SearchPanel.vue'
import { searchLibrary } from '../../src/renderer/src/services/library'

vi.mock('../../src/renderer/src/services/library', () => ({
  searchLibrary: vi.fn()
}))

const SESSION_ID = 'c1a3b589-7763-4fc6-8d52-cad7a11986bb'

afterEach(() => {
  vi.clearAllMocks()
})

describe('搜索面板', () => {
  it('只在按回车或点击搜索按钮时提交当前关键词', async () => {
    vi.mocked(searchLibrary).mockResolvedValue({
      artists: [],
      albums: [],
      tracks: [],
      albumNextOffset: 25,
      trackNextOffset: 25,
      albumHasMore: false,
      trackHasMore: false
    })
    const wrapper = mount(SearchPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com'
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
    const input = wrapper.get('input[type="search"]')

    await input.setValue('  第一首歌  ')
    await new Promise((resolve) => setTimeout(resolve, 350))
    await flushPromises()
    expect(searchLibrary).not.toHaveBeenCalled()

    await input.trigger('keydown.enter')
    await flushPromises()
    expect(searchLibrary).toHaveBeenCalledTimes(1)
    expect(searchLibrary).toHaveBeenLastCalledWith(
      SESSION_ID,
      '第一首歌',
      0,
      0,
      25,
      expect.any(AbortSignal)
    )

    await input.setValue('第二首歌')
    await flushPromises()
    expect(searchLibrary).toHaveBeenCalledTimes(1)

    await wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()
    expect(searchLibrary).toHaveBeenCalledTimes(2)
    expect(searchLibrary).toHaveBeenLastCalledWith(
      SESSION_ID,
      '第二首歌',
      0,
      0,
      25,
      expect.any(AbortSignal)
    )

    const refresh = wrapper.findAll('button').find((button) => button.text() === '刷新结果')
    await refresh?.trigger('click')
    await flushPromises()
    expect(searchLibrary).toHaveBeenCalledTimes(3)
    expect(searchLibrary).toHaveBeenLastCalledWith(
      SESSION_ID,
      '第二首歌',
      0,
      0,
      25,
      expect.any(AbortSignal)
    )
  })

  it('纵向排列结果，并用两个分页分别控制专辑与歌曲', async () => {
    vi.mocked(searchLibrary).mockImplementation(async (
      _sessionId,
      _query,
      albumOffset,
      trackOffset
    ) => ({
      artists: [],
      albums: [{
        id: `album-${albumOffset}`,
        name: albumOffset === 0 ? '第一页专辑' : '第二页专辑',
        artist: 'Sonavi Artist',
        songCount: 1,
        duration: 180,
        starred: false
      }],
      tracks: [{
        id: `track-${trackOffset}`,
        title: trackOffset === 0 ? '第一页歌曲' : '第二页歌曲',
        artist: 'Sonavi Artist',
        album: '分页专辑',
        duration: 180,
        streamUrl: `sonavi-media://media/${trackOffset === 0
          ? '11111111-1111-4111-8111-111111111111'
          : '22222222-2222-4222-8222-222222222222'}`,
        playback: {
          streamMode: 'original',
          seekMode: 'native',
          reason: '测试原始音频。'
        },
        starred: false
      }],
      albumNextOffset: albumOffset + 25,
      trackNextOffset: trackOffset + 25,
      albumHasMore: albumOffset === 0,
      trackHasMore: trackOffset === 0
    }))
    const wrapper = mount(SearchPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com'
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

    await wrapper.get('input[type="search"]').setValue('分页')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('第一页专辑')
    expect(wrapper.text()).toContain('第一页歌曲')
    expect(wrapper.findAll('[data-testid="search-albums"], [data-testid="search-tracks"]')
      .map((section) => section.attributes('data-testid'))).toEqual([
      'search-albums',
      'search-tracks'
    ])

    await wrapper.get('[data-testid="search-albums-pagination"] [data-slot="pagination-next"]')
      .trigger('click')
    await flushPromises()

    expect(searchLibrary).toHaveBeenLastCalledWith(
      SESSION_ID,
      '分页',
      25,
      0,
      25,
      expect.any(AbortSignal)
    )
    expect(wrapper.text()).toContain('第二页专辑')
    expect(wrapper.text()).not.toContain('第一页专辑')
    expect(wrapper.text()).toContain('第一页歌曲')

    await wrapper.get('[data-testid="search-tracks-pagination"] [data-slot="pagination-next"]')
      .trigger('click')
    await flushPromises()

    expect(searchLibrary).toHaveBeenLastCalledWith(
      SESSION_ID,
      '分页',
      25,
      25,
      25,
      expect.any(AbortSignal)
    )
    expect(wrapper.text()).toContain('第二页歌曲')
    expect(wrapper.text()).not.toContain('第一页歌曲')
    expect(wrapper.text()).toContain('专辑第 2 页')
    expect(wrapper.text()).toContain('歌曲第 2 页')
  })

  it('搜索失败时不执行默认自动重试，只保留用户重试入口', async () => {
    vi.mocked(searchLibrary).mockRejectedValue(new Error('正文读取超时'))
    const wrapper = mount(SearchPanel, {
      props: {
        sessionId: SESSION_ID,
        serverId: 'https://music.example.com'
      },
      global: {
        plugins: [
          createPinia(),
          [VueQueryPlugin, {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: 3, retryDelay: 0 } }
            })
          }]
        ]
      }
    })

    await wrapper.get('input[type="search"]').setValue('超时测试')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))

    expect(searchLibrary).toHaveBeenCalledTimes(1)
  })
})
