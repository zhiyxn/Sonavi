import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LyricsPanel from '../../src/renderer/src/components/LyricsPanel.vue'
import { usePlayerStore } from '../../src/renderer/src/stores/player'
import type { SonaviApi } from '../../src/shared/application'

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'sonavi')
})

function installTrack(currentTime = 0): ReturnType<typeof createPinia> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const player = usePlayerStore()
  player.queue = [
    {
      queueEntryId: 'entry-1',
      trackId: 'track-1',
      scope: {
        sessionId: '8db257ee-54de-4931-bf0f-f4ec1d817198',
        serverId: 'https://music.example.com',
        accountId: 'account-1'
      },
      track: {
        id: 'track-1',
        title: '跨平台试音',
        artist: 'Sonavi',
        album: '石与琥珀',
        duration: 4,
        streamUrl: 'sonavi-media://media/6fa932b2-9793-4d89-9a49-f79b942132c5',
        playback: {
          streamMode: 'original',
          seekMode: 'native',
          reason: '测试原始音频。'
        },
        starred: false
      }
    }
  ]
  player.currentEntryId = 'entry-1'
  player.currentTime = currentTime
  return pinia
}

function installLyricsApi(getLyrics: SonaviApi['playback']['getLyrics']): void {
  Object.defineProperty(window, 'sonavi', {
    configurable: true,
    value: { playback: { getLyrics, report: vi.fn() } } as unknown as SonaviApi
  })
}

describe('歌词浮层', () => {
  it('读取结构化歌词并依据 AudioEngine 进度和 offset 高亮', async () => {
    const pinia = installTrack(1.6)
    const getLyrics = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        source: 'structured',
        variants: [
          {
            language: 'zho',
            offsetMs: 100,
            synced: true,
            lines: [
              { startMs: 0, value: '第一行' },
              { startMs: 1500, value: '第二行' }
            ]
          }
        ]
      }
    })
    installLyricsApi(getLyrics)

    const wrapper = mount(LyricsPanel, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()

    expect(getLyrics).toHaveBeenCalledWith({
      sessionId: '8db257ee-54de-4931-bf0f-f4ec1d817198',
      trackId: 'track-1',
      artist: 'Sonavi',
      title: '跨平台试音'
    })
    expect(wrapper.findAll('.lyrics-lines li')[1]?.classes()).toContain('active')
    expect(wrapper.text()).toContain('第二行')
  })

  it('明确显示无歌词状态', async () => {
    const pinia = installTrack()
    installLyricsApi(
      vi.fn().mockResolvedValue({ ok: true, value: { source: 'none', variants: [] } })
    )
    const wrapper = mount(LyricsPanel, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.text()).toContain('服务器没有返回这首歌的歌词。')
  })

  it('歌词失败时保留安全错误和重试入口', async () => {
    const pinia = installTrack()
    installLyricsApi(
      vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'network', message: '歌词服务暂时不可用。', retryable: true }
      })
    )
    const wrapper = mount(LyricsPanel, { global: { plugins: [pinia, VueQueryPlugin] } })
    await flushPromises()

    expect(wrapper.text()).toContain('歌词服务暂时不可用。')
    expect(wrapper.findAll('button').some((button) => button.text().includes('重试'))).toBe(true)
  })
})
