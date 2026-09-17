import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SonaviApi } from '../../src/shared/application'

const notificationMocks = vi.hoisted(() => ({
  requestConfirmation: vi.fn(),
  showErrorToast: vi.fn(),
  useErrorToast: vi.fn()
}))

vi.mock('../../src/renderer/src/lib/notifications', () => notificationMocks)

import PlaylistsPanel from '../../src/renderer/src/components/PlaylistsPanel.vue'

const SESSION_ID = '36e659a7-f0e6-4cb0-9a52-124f45d4befa'

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(window, 'sonavi')
})

describe('歌单二次确认', () => {
  it('取消时不删除，确认后才调用受限删除 API', async () => {
    const listPlaylists = vi.fn<SonaviApi['library']['listPlaylists']>().mockResolvedValue({
      ok: true,
      value: [{
        id: 'playlist-1',
        name: '待确认歌单',
        owner: 'listener',
        public: false,
        songCount: 0,
        duration: 0
      }]
    })
    const getPlaylist = vi.fn<SonaviApi['library']['getPlaylist']>().mockResolvedValue({
      ok: true,
      value: {
        id: 'playlist-1',
        name: '待确认歌单',
        owner: 'listener',
        public: false,
        songCount: 0,
        duration: 0,
        tracks: []
      }
    })
    const deletePlaylist = vi.fn<SonaviApi['library']['deletePlaylist']>().mockResolvedValue({
      ok: true,
      value: { changed: true }
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listPlaylists, getPlaylist, deletePlaylist } } as unknown as SonaviApi
    })
    notificationMocks.requestConfirmation
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    const wrapper = mount(PlaylistsPanel, {
      props: { sessionId: SESSION_ID, serverId: 'https://music.example.com' },
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
    const playlistButton = wrapper.findAll('button')
      .find((button) => button.text().includes('待确认歌单'))
    await playlistButton?.trigger('click')
    await flushPromises()

    const deleteButton = () => wrapper.findAll('button')
      .find((button) => button.text() === '删除歌单')
    await deleteButton()?.trigger('click')
    await flushPromises()
    expect(deletePlaylist).not.toHaveBeenCalled()

    await deleteButton()?.trigger('click')
    await flushPromises()
    expect(notificationMocks.requestConfirmation).toHaveBeenLastCalledWith({
      title: '删除歌单“待确认歌单”？',
      description: '此操作会同步到服务器，删除后无法在 Sonavi 中撤销。',
      confirmLabel: '删除歌单'
    })
    expect(deletePlaylist).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      playlistId: 'playlist-1'
    })
  })
})
