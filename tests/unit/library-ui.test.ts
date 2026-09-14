import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SonaviApi } from '../../src/shared/application'
import type { ArtistSummary, CancelSearchRequest } from '../../src/shared/library'
import VirtualArtistList from '../../src/renderer/src/components/VirtualArtistList.vue'
import { searchLibrary } from '../../src/renderer/src/services/library'

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'sonavi')
})

describe('P05 音乐库界面', () => {
  it('在固定 10,000 条合成数据下只渲染可见窗口并记录耗时', () => {
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
      'c1a3b589-7763-4fc6-8d52-cad7a11986bb',
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
      sessionId: 'c1a3b589-7763-4fc6-8d52-cad7a11986bb'
    })
  })
})
