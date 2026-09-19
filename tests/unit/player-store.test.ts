import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackSummary } from '../../src/shared/library'
import PlayerBar from '../../src/renderer/src/components/PlayerBar.vue'
import { Slider } from '../../src/renderer/src/components/ui/slider'
import { usePlayerStore, type PlaybackScope } from '../../src/renderer/src/stores/player'

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = []
  src = ''
  preload = ''
  currentTime = 0
  duration = 10
  volume = 1
  paused = true
  ended = false
  playCalls = 0

  constructor() {
    super()
    FakeAudio.instances.push(this)
  }

  load(): void {
    if (this.src) this.dispatchEvent(new Event('loadstart'))
  }

  pause(): void {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  async play(): Promise<void> {
    this.playCalls += 1
    this.paused = false
    this.ended = false
    this.dispatchEvent(new Event('playing'))
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.src = ''
  }
}

const scope: PlaybackScope = {
  sessionId: 'session-1',
  serverId: 'https://music.example.com',
  accountId: 'account-1'
}

function track(id: string, title = id): TrackSummary {
  return {
    id,
    title,
    artist: 'Sonavi Artist',
    album: 'Queue Album',
    duration: 10,
    streamUrl: `sonavi-media://${id}`,
    playback: {
      streamMode: 'original',
      seekMode: 'native',
      reason: '测试原始音频。'
    },
    starred: false
  }
}

function transcodedTrack(
  id: string,
  seekMode: TrackSummary['playback']['seekMode']
): TrackSummary {
  return {
    ...track(id),
    streamUrl: `sonavi-media://transcoded-${id}`,
    playback: {
      streamMode: 'transcode',
      seekMode,
      reason: '测试兼容转码。'
    }
  }
}

beforeEach(() => {
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('P04 播放队列', () => {
  it('允许重复歌曲，并按 queueEntryId 删除单次出现', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('same'), track('same')], 0, scope)

    expect(player.queue).toHaveLength(2)
    expect(player.queue[0]?.trackId).toBe(player.queue[1]?.trackId)
    expect(player.queue[0]?.queueEntryId).not.toBe(player.queue[1]?.queueEntryId)

    player.removeQueueEntry(player.queue[1]!.queueEntryId)
    expect(player.queue).toHaveLength(1)
    expect(player.currentEntryId).toBe(player.queue[0]?.queueEntryId)
  })

  it('删除当前项时选择后继并保持播放意图，删空后回到 idle', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 0, scope)
    const firstId = player.currentEntryId!

    player.removeQueueEntry(firstId)
    await Promise.resolve()
    expect(player.track?.id).toBe('two')
    expect(player.state).toBe('playing')

    player.removeQueueEntry(player.currentEntryId!)
    expect(player.queue).toHaveLength(0)
    expect(player.state).toBe('idle')
  })

  it('随机播放保持顺序，并让上一首沿实际播放历史返回', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two'), track('three')], 0, scope)
    player.togglePlaybackOrder()

    await player.next()
    await player.next()
    expect(player.track?.id).toBe('three')
    await player.previous()
    expect(player.track?.id).toBe('two')
  })

  it('自然结束遵循单曲循环，手动下一首仍切到下一项', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 0, scope)
    player.cycleRepeatMode()
    player.cycleRepeatMode()
    expect(player.repeatMode).toBe('one')

    const currentAudio = FakeAudio.instances.at(-1)!
    const firstEntryId = player.currentEntryId
    currentAudio.ended = true
    currentAudio.dispatchEvent(new Event('ended'))
    await Promise.resolve()
    expect(player.currentEntryId).toBe(firstEntryId)
    expect(currentAudio.playCalls).toBe(2)

    await player.next()
    expect(player.track?.id).toBe('two')
  })

  it('列表循环在自然结束最后一项后回到首项', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 1, scope)
    player.cycleRepeatMode()
    expect(player.repeatMode).toBe('all')

    const currentAudio = FakeAudio.instances.at(-1)!
    currentAudio.ended = true
    currentAudio.dispatchEvent(new Event('ended'))
    await Promise.resolve()
    await Promise.resolve()
    expect(player.track?.id).toBe('one')
  })

  it('空队列的前后切换无副作用，重排不改变当前项', async () => {
    const player = usePlayerStore()
    await player.next()
    await player.previous()
    expect(player.state).toBe('idle')

    await player.replaceQueue([track('one'), track('two'), track('three')], 1, scope, false)
    const currentId = player.currentEntryId
    player.moveQueueEntry(player.queue[2]!.queueEntryId, 0)
    expect(player.queue.map((entry) => entry.trackId)).toEqual(['three', 'one', 'two'])
    expect(player.currentEntryId).toBe(currentId)
    expect(player.state).toBe('paused')
  })

  it('暂停状态 seek 后继续保持暂停', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one')], 0, scope, false)
    const audio = FakeAudio.instances.at(-1)!

    player.seek(6)
    audio.dispatchEvent(new Event('seeked'))
    expect(player.currentTime).toBe(6)
    expect(player.state).toBe('paused')
  })

  it('seek 后点击上一首仍切换到前一个队列项', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 1, scope)
    const currentAudio = FakeAudio.instances.at(-1)!

    await player.seek(6)
    currentAudio.dispatchEvent(new Event('seeked'))
    expect(player.currentTime).toBe(6)

    await player.previous()
    expect(player.track?.id).toBe('one')
    expect(player.currentTime).toBe(0)
  })

  it('音频流失败后可在原进度创建新宿主并重试', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('retryable')], 0, scope)
    const failedAudio = FakeAudio.instances.at(-1)!
    failedAudio.currentTime = 5
    failedAudio.dispatchEvent(new Event('timeupdate'))
    failedAudio.dispatchEvent(new Event('error'))
    expect(player.state).toBe('error')

    await player.retry()

    expect(FakeAudio.instances).toHaveLength(2)
    expect(FakeAudio.instances.at(-1)).toMatchObject({
      src: 'sonavi-media://retryable',
      currentTime: 5,
      paused: false
    })
    expect(player.errorMessage).toBe('')
  })

  it('音频流中断后按队列项最多自动恢复一次并保持原进度', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('auto-retry')], 0, scope)
    const firstAudio = FakeAudio.instances.at(-1)!
    firstAudio.currentTime = 5
    firstAudio.dispatchEvent(new Event('timeupdate'))
    firstAudio.dispatchEvent(new Event('error'))

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(FakeAudio.instances).toHaveLength(2)
    expect(FakeAudio.instances.at(-1)).toMatchObject({
      src: 'sonavi-media://auto-retry',
      currentTime: 5,
      paused: false
    })

    FakeAudio.instances.at(-1)!.dispatchEvent(new Event('error'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(FakeAudio.instances).toHaveLength(2)
    expect(player.state).toBe('error')
  })

  it('转码跳转通过受限 API 换流，并保持完整时间线与暂停意图', async () => {
    const createTranscodeSeek = vi.fn().mockResolvedValue({
      ok: true,
      streamUrl: 'sonavi-media://media/00000000-0000-4000-8000-000000000001',
      timelineOffset: 6
    })
    Object.defineProperty(window, 'sonavi', {
      value: { network: { createTranscodeSeek } },
      configurable: true
    })
    const player = usePlayerStore()
    const transcoded = {
      ...track('transcoded'),
      playback: {
        streamMode: 'transcode' as const,
        seekMode: 'transcode-offset' as const,
        reason: '测试转码跳转。'
      }
    }
    await player.replaceQueue([transcoded], 0, scope, false)

    await player.seek(6)
    expect(createTranscodeSeek).toHaveBeenCalledWith({
      sessionId: scope.sessionId,
      trackId: 'transcoded',
      timeOffset: 6
    })
    expect(FakeAudio.instances.at(-1)).toMatchObject({
      src: 'sonavi-media://media/00000000-0000-4000-8000-000000000001',
      paused: true
    })
    expect(player.currentTime).toBe(6)
    expect(player.duration).toBe(10)
  })

  it('播放策略变化时优先在当前进度切换转码并更新整个队列', async () => {
    const createTranscodeSeek = vi.fn().mockResolvedValue({
      ok: true,
      streamUrl: 'sonavi-media://media/00000000-0000-4000-8000-000000000002',
      timelineOffset: 4
    })
    Object.defineProperty(window, 'sonavi', {
      value: { network: { createTranscodeSeek } },
      configurable: true
    })
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 0, scope)
    const firstAudio = FakeAudio.instances.at(-1)!
    firstAudio.currentTime = 4
    firstAudio.dispatchEvent(new Event('timeupdate'))

    await player.refreshQueueTracks([
      transcodedTrack('one', 'transcode-offset'),
      transcodedTrack('two', 'transcode-offset')
    ])

    expect(createTranscodeSeek).toHaveBeenCalledWith({
      sessionId: scope.sessionId,
      trackId: 'one',
      timeOffset: 4
    })
    expect(player.track?.playback.streamMode).toBe('transcode')
    expect(player.queue[1]?.track.playback.streamMode).toBe('transcode')
    expect(FakeAudio.instances.at(-1)).toMatchObject({
      src: 'sonavi-media://media/00000000-0000-4000-8000-000000000002',
      paused: false
    })
    expect(player.currentTime).toBe(4)
  })

  it('服务器不支持转码偏移时保持当前流，下一曲使用新转码策略', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 0, scope)
    const firstAudio = FakeAudio.instances.at(-1)!
    firstAudio.currentTime = 4
    firstAudio.dispatchEvent(new Event('timeupdate'))

    await player.refreshQueueTracks([
      transcodedTrack('one', 'unavailable'),
      transcodedTrack('two', 'unavailable')
    ])

    expect(FakeAudio.instances).toHaveLength(1)
    expect(player.track?.playback.streamMode).toBe('original')
    expect(player.queue[1]?.track.playback.streamMode).toBe('transcode')

    await player.next()
    expect(player.track?.id).toBe('two')
    expect(player.track?.playback.streamMode).toBe('transcode')
    expect(FakeAudio.instances.at(-1)?.src).toBe('sonavi-media://transcoded-two')
  })

  it('连续点击播放控制不会创建第二个引擎或音频宿主', async () => {
    const player = usePlayerStore()
    await player.replaceQueue([track('one')], 0, scope)
    expect(FakeAudio.instances).toHaveLength(1)

    player.toggle()
    player.toggle()
    await Promise.resolve()
    expect(FakeAudio.instances).toHaveLength(1)
    expect(player.state).toBe('playing')
  })

  it('播放器组件卸载不会清空全局队列或打断音频', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue([track('route-safe')], 0, scope)
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    wrapper.unmount()
    expect(player.track?.id).toBe('route-safe')
    expect(player.state).toBe('playing')
    expect(FakeAudio.instances).toHaveLength(1)
  })

  it('主播放控制保留独立的高对比样式标记', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue([track('contrast')], 0, scope)
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    const primaryControl = wrapper.get('button[aria-label="暂停"]')
    expect(primaryControl.classes()).toContain('transport-primary')
    expect(primaryControl.find('svg').exists()).toBe(true)
  })

  it('播放进度和音量使用带无障碍名称的 shadcn Slider', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    expect(wrapper.get('[data-slot="slider-thumb"][aria-label="播放进度"]').attributes('role')).toBe('slider')
    expect(wrapper.get('[data-slot="slider-thumb"][aria-label="音量"]').attributes('role')).toBe('slider')
  })

  it('Slider 步进浮点值在进入播放边界前归一化', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    const seek = vi.spyOn(player, 'seek').mockResolvedValue()
    const setVolume = vi.spyOn(player, 'setVolume')
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })
    const sliders = wrapper.findAllComponents(Slider)

    sliders[0]?.vm.$emit('valueCommit', [2.0000000000000004])
    sliders[1]?.vm.$emit('update:modelValue', [0.42000000000000004])
    await wrapper.vm.$nextTick()

    expect(seek).toHaveBeenCalledWith(2)
    expect(setVolume).toHaveBeenCalledWith(0.42)
  })

  it('拖动进度时保留临时值，松手后才提交 seek', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    const seek = vi.spyOn(player, 'seek').mockResolvedValue()
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })
    const progress = wrapper.findAllComponents(Slider)[0]!

    progress.vm.$emit('update:modelValue', [4.2])
    await wrapper.vm.$nextTick()

    expect(progress.props('modelValue')).toEqual([4.2])
    expect(seek).not.toHaveBeenCalled()

    progress.vm.$emit('valueCommit', [4.2])
    await wrapper.vm.$nextTick()
    expect(seek).toHaveBeenCalledOnce()
    expect(seek).toHaveBeenCalledWith(4.2)
  })

  it('播放区域优先显示当前歌曲封面，没有封面时保留占位符', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue(
      [{ ...track('covered'), coverUrl: 'sonavi-media://media/cover-handle' }],
      0,
      scope,
      false
    )
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    expect(wrapper.get('.album-placeholder img').attributes('src')).toBe(
      'sonavi-media://media/cover-handle'
    )
    player.stop()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.album-placeholder').text()).toBe('S')
  })

  it('播放器区分源歌曲格式与实际播放模式', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue(
      [{ ...track('flac-source'), contentType: 'audio/flac; charset=binary' }],
      0,
      scope,
      false
    )
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    expect(wrapper.get('.player-stream-note').text()).toBe('FLAC · 原始音频')

    await player.replaceQueue(
      [{ ...transcodedTrack('aac-source', 'transcode-offset'), contentType: 'audio/mp4' }],
      0,
      scope,
      false
    )
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.player-stream-note').text()).toBe('M4A → MP3 · 兼容转码')

    await player.replaceQueue(
      [{ ...track('unknown-source'), contentType: 'text/html<script>' }],
      0,
      scope,
      false
    )
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.player-stream-note').text()).toBe('未知格式 · 原始音频')
  })

  it('打开播放队列时将当前歌曲滚动到可视区域中央', async () => {
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue(
      Array.from({ length: 12 }, (_, index) => track(`track-${index + 1}`)),
      8,
      scope,
      false
    )
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    await wrapper.get('button[aria-label="播放队列"]').trigger('click')
    await wrapper.vm.$nextTick()

    const currentItem = wrapper.get('li[aria-current="true"]')
    expect(currentItem.classes()).toContain('current')
    expect(currentItem.get('.queue-track strong').text()).toBe('track-9')
    expect(currentItem.text()).toContain('track-9')
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  it('点击播放器其他区域会关闭播放队列', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 0, scope, false)
    const wrapper = mount(PlayerBar, { global: { plugins: [pinia] } })

    await wrapper.get('button[aria-label="播放队列"]').trigger('click')
    expect(wrapper.find('#player-queue').exists()).toBe(true)

    await wrapper.get('.queue-track').trigger('click')
    expect(wrapper.find('#player-queue').exists()).toBe(true)

    await wrapper.get('.album-placeholder').trigger('click')
    expect(wrapper.find('#player-queue').exists()).toBe(false)
  })

  it('点击播放器之外的应用页面也会关闭播放队列', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two')], 0, scope, false)
    const outside = document.createElement('button')
    document.body.append(outside)
    const wrapper = mount(PlayerBar, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })

    await wrapper.get('button[aria-label="播放队列"]').trigger('click')
    expect(wrapper.find('#player-queue').exists()).toBe(true)

    outside.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#player-queue').exists()).toBe(false)

    wrapper.unmount()
    outside.remove()
  })

  it('删除非当前项或当前项后播放队列保持展开', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    const pinia = createPinia()
    setActivePinia(pinia)
    const player = usePlayerStore()
    await player.replaceQueue([track('one'), track('two'), track('three')], 0, scope, false)
    const wrapper = mount(PlayerBar, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })

    await wrapper.get('button[aria-label="播放队列"]').trigger('click')
    await wrapper.get('button[aria-label="从队列移除 two"]').trigger('click')
    expect(wrapper.find('#player-queue').exists()).toBe(true)
    expect(player.queue.map((entry) => entry.track.id)).toEqual(['one', 'three'])

    await wrapper.get('button[aria-label="从队列移除 one"]').trigger('click')
    expect(wrapper.find('#player-queue').exists()).toBe(true)
    expect(player.queue.map((entry) => entry.track.id)).toEqual(['three'])

    wrapper.unmount()
  })
})
