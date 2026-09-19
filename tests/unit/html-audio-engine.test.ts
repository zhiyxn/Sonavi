import { afterEach, describe, expect, it, vi } from 'vitest'
import { HtmlAudioEngine } from '../../src/renderer/src/services/audio-engine/html-audio-engine'

class FakeAudio extends EventTarget {
  src = ''
  preload = ''
  currentTime = 0
  duration = 12
  volume = 1
  paused = true
  ended = false
  playImplementation: () => Promise<void> = async () => {
    this.paused = false
    this.dispatchEvent(new Event('playing'))
  }

  load(): void {
    if (this.src) this.dispatchEvent(new Event('loadstart'))
  }

  pause(): void {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  play(): Promise<void> {
    return this.playImplementation()
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.src = ''
  }
}

function asAudio(element: FakeAudio): HTMLAudioElement {
  return element as unknown as HTMLAudioElement
}

afterEach(() => {
  vi.useRealTimers()
})

describe('HtmlAudioEngine', () => {
  it('使用单一枚举状态表达加载、缓冲、seek、暂停、结束和错误', async () => {
    const element = new FakeAudio()
    const engine = new HtmlAudioEngine(() => asAudio(element))

    await engine.load({ trackId: 'track-1', streamUrl: 'sonavi-media://one', duration: 12 }, true)
    expect(engine.getSnapshot().state).toBe('playing')

    element.dispatchEvent(new Event('waiting'))
    expect(engine.getSnapshot().state).toBe('buffering')
    element.currentTime = 4
    element.dispatchEvent(new Event('seeking'))
    expect(engine.getSnapshot()).toMatchObject({ state: 'seeking', currentTime: 4 })
    element.paused = false
    element.dispatchEvent(new Event('seeked'))
    expect(engine.getSnapshot().state).toBe('playing')

    engine.pause()
    expect(engine.getSnapshot().state).toBe('paused')
    element.ended = true
    element.dispatchEvent(new Event('ended'))
    expect(engine.getSnapshot().state).toBe('ended')
    element.dispatchEvent(new Event('error'))
    expect(engine.getSnapshot()).toMatchObject({
      state: 'error',
      errorMessage: '音频流加载失败。',
      errorReason: 'stream'
    })
  })

  it('连续缓冲超过看门狗阈值时释放旧宿主并进入可恢复错误态', async () => {
    vi.useFakeTimers()
    const element = new FakeAudio()
    const engine = new HtmlAudioEngine(() => asAudio(element), 1_000)
    await engine.load({ trackId: 'slow', streamUrl: 'sonavi-media://slow', duration: 60 }, true)

    element.dispatchEvent(new Event('waiting'))
    await vi.advanceTimersByTimeAsync(999)
    expect(engine.getSnapshot().state).toBe('buffering')
    await vi.advanceTimersByTimeAsync(1)

    expect(element.src).toBe('')
    expect(engine.getSnapshot()).toMatchObject({
      state: 'error',
      errorReason: 'buffer-timeout'
    })
  })

  it('暂停加载不会被迟到的 play 拒绝改成错误', async () => {
    let rejectPlay: ((reason?: unknown) => void) | undefined
    const element = new FakeAudio()
    element.playImplementation = () =>
      new Promise<void>((_, reject) => {
        rejectPlay = reject
      })
    const engine = new HtmlAudioEngine(() => asAudio(element))

    const play = engine.load(
      { trackId: 'track-loading', streamUrl: 'sonavi-media://loading', duration: 12 },
      true
    )
    engine.pause()
    rejectPlay?.(new Error('late rejection'))
    await play
    element.dispatchEvent(new Event('playing'))

    expect(engine.getSnapshot()).toMatchObject({ state: 'paused', errorMessage: '' })
  })

  it('连续切歌后忽略旧元素事件与旧 play Promise', async () => {
    let rejectOldPlay: ((reason?: unknown) => void) | undefined
    const oldElement = new FakeAudio()
    oldElement.playImplementation = () =>
      new Promise<void>((_, reject) => {
        rejectOldPlay = reject
      })
    const newElement = new FakeAudio()
    const elements = [oldElement, newElement]
    const engine = new HtmlAudioEngine(() => asAudio(elements.shift()!))

    const oldLoad = engine.load(
      { trackId: 'old-track', streamUrl: 'sonavi-media://old', duration: 12 },
      true
    )
    await engine.load(
      { trackId: 'new-track', streamUrl: 'sonavi-media://new', duration: 12 },
      true
    )
    oldElement.dispatchEvent(new Event('error'))
    rejectOldPlay?.(new Error('old request failed late'))
    await oldLoad

    expect(engine.getSnapshot()).toMatchObject({
      generationId: 2,
      trackId: 'new-track',
      state: 'playing',
      errorMessage: ''
    })
  })

  it('恢复来源时可以保持暂停并应用音量', async () => {
    const element = new FakeAudio()
    const engine = new HtmlAudioEngine(() => asAudio(element))
    engine.setVolume(0.35)
    await engine.load({ trackId: 'restored', streamUrl: 'sonavi-media://restored', duration: 8 }, false)

    expect(element.volume).toBe(0.35)
    expect(engine.getSnapshot()).toMatchObject({ state: 'paused', volume: 0.35 })
  })

  it('原始音频解码失败时最多切换一次兼容转码', async () => {
    const element = new FakeAudio()
    const engine = new HtmlAudioEngine(() => asAudio(element))
    await engine.load(
      {
        trackId: 'fallback',
        streamUrl: 'sonavi-media://original',
        fallbackStreamUrl: 'sonavi-media://transcode',
        duration: 60
      },
      true
    )

    element.dispatchEvent(new Event('error'))
    expect(element.src).toBe('sonavi-media://transcode')
    element.dispatchEvent(new Event('error'))
    expect(engine.getSnapshot()).toMatchObject({ state: 'error', errorMessage: '音频流加载失败。' })
  })

  it('转码偏移片段继续使用完整歌曲时间线', async () => {
    const element = new FakeAudio()
    const engine = new HtmlAudioEngine(() => asAudio(element))
    await engine.load(
      {
        trackId: 'offset',
        streamUrl: 'sonavi-media://offset',
        duration: 120,
        timelineOffset: 40
      },
      false
    )
    element.currentTime = 5
    element.dispatchEvent(new Event('timeupdate'))
    element.duration = 80
    element.dispatchEvent(new Event('durationchange'))
    expect(engine.getSnapshot()).toMatchObject({ currentTime: 45, duration: 120 })
  })
})
