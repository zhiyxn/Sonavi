import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackSummary } from '../../src/shared/library'
import PlayerBar from '../../src/renderer/src/components/PlayerBar.vue'
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
    starred: false
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
})
