import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FavoritesPanel from '../../src/renderer/src/components/FavoritesPanel.vue'
import PlaylistsPanel from '../../src/renderer/src/components/PlaylistsPanel.vue'
import type { SonaviApi } from '../../src/shared/application'
import {
  SetStarredRequestSchema,
  UpdatePlaylistRequestSchema
} from '../../src/shared/library-schema'

const SESSION_ID = '9f73bd9a-acde-4f0f-a3f6-3ddff7d09342'
const MEDIA_ID = 'efce40f2-b50d-4b85-8aa9-8c0a6803f205'

function mountWithPlugins(component: typeof FavoritesPanel | typeof PlaylistsPanel) {
  return mount(component, {
    props: { sessionId: SESSION_ID, serverId: 'https://music.example.com' },
    global: { plugins: [createPinia(), VueQueryPlugin] }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'sonavi')
})

describe('P06 收藏与歌单界面', () => {
  it('运行时拒绝空歌单更新、负索引和未知收藏类型', () => {
    expect(
      UpdatePlaylistRequestSchema.safeParse({
        sessionId: SESSION_ID,
        playlistId: 'playlist-1'
      }).success
    ).toBe(false)
    expect(
      UpdatePlaylistRequestSchema.safeParse({
        sessionId: SESSION_ID,
        playlistId: 'playlist-1',
        songIndexesToRemove: [-1]
      }).success
    ).toBe(false)
    expect(
      SetStarredRequestSchema.safeParse({
        sessionId: SESSION_ID,
        targetType: 'folder',
        targetId: 'unsafe',
        starred: true
      }).success
    ).toBe(false)
  })

  it('显示服务器收藏并通过受限 API 取消歌曲收藏', async () => {
    const setStarred = vi.fn<SonaviApi['library']['setStarred']>().mockResolvedValue({
      ok: true,
      value: { changed: true }
    })
    const listStarred = vi.fn<SonaviApi['library']['listStarred']>().mockResolvedValue({
      ok: true,
      value: {
        artists: [],
        albums: [],
        tracks: [
          {
            id: 'track-1',
            title: '收藏歌曲',
            artist: '艺术家',
            album: '专辑',
            duration: 60,
            streamUrl: `sonavi-media://media/${MEDIA_ID}`,
            playback: {
              streamMode: 'original',
              seekMode: 'native',
              reason: '测试原始音频。'
            },
            starred: true
          }
        ]
      }
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listStarred, setStarred } } as unknown as SonaviApi
    })

    const wrapper = mountWithPlugins(FavoritesPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('收藏歌曲')
    const unstar = wrapper.findAll('button').find((button) => button.text() === '取消收藏')
    await unstar?.trigger('click')
    await flushPromises()

    expect(setStarred).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      targetType: 'track',
      targetId: 'track-1',
      starred: false
    })
  })

  it('创建空歌单并等待服务器列表刷新', async () => {
    const listPlaylists = vi.fn<SonaviApi['library']['listPlaylists']>().mockResolvedValue({
      ok: true,
      value: []
    })
    const createPlaylist = vi.fn<SonaviApi['library']['createPlaylist']>().mockResolvedValue({
      ok: true,
      value: { changed: true }
    })
    Object.defineProperty(window, 'sonavi', {
      configurable: true,
      value: { library: { listPlaylists, createPlaylist } } as unknown as SonaviApi
    })

    const wrapper = mountWithPlugins(PlaylistsPanel)
    await flushPromises()
    await wrapper.get('input[placeholder="例如：夜间聆听"]').setValue('  夜间聆听  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createPlaylist).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      name: '夜间聆听',
      songIds: []
    })
    expect(wrapper.text()).toContain('歌单已创建')
  })
})
