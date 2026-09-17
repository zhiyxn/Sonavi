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
      nextOffset: 25,
      hasMore: false
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
      25,
      expect.any(AbortSignal)
    )
  })
})
