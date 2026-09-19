import type {
  AudioEngine,
  AudioEngineEvent,
  AudioEngineListener,
  AudioEngineSnapshot,
  AudioEngineSource,
  AudioEngineState
} from './types'

type AudioElementFactory = () => HTMLAudioElement

const PLAYBACK_ERROR = '系统未能开始播放，请重试。'
const STREAM_ERROR = '音频流加载失败。'
const BUFFER_TIMEOUT_ERROR = '音频缓冲时间过长，已停止旧连接并尝试恢复。'
const FALLBACK_NOTICE = '原始音频解码失败，正在进行一次兼容转码。'
const DEFAULT_BUFFER_TIMEOUT_MS = 30_000

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export class HtmlAudioEngine implements AudioEngine {
  private readonly listeners = new Set<AudioEngineListener>()
  private readonly audioFactory: AudioElementFactory
  private audio: HTMLAudioElement | null = null
  private cleanups: Array<() => void> = []
  private commandId = 0
  private endedGeneration = -1
  private playbackRequested = false
  private timelineOffset = 0
  private fallbackStreamUrl: string | null = null
  private fallbackAttempted = false
  private bufferTimeout: ReturnType<typeof setTimeout> | null = null
  private snapshot: AudioEngineSnapshot = {
    generationId: 0,
    state: 'idle',
    trackId: null,
    currentTime: 0,
    duration: 0,
    volume: 1,
    errorMessage: '',
    errorReason: null
  }

  constructor(
    audioFactory: AudioElementFactory = () => new Audio(),
    private readonly bufferTimeoutMs = DEFAULT_BUFFER_TIMEOUT_MS
  ) {
    this.audioFactory = audioFactory
  }

  getSnapshot(): AudioEngineSnapshot {
    return { ...this.snapshot }
  }

  subscribe(listener: AudioEngineListener): () => void {
    this.listeners.add(listener)
    listener({ type: 'snapshot', snapshot: this.getSnapshot() })
    return () => this.listeners.delete(listener)
  }

  async load(source: AudioEngineSource, autoplay: boolean): Promise<void> {
    const generationId = this.snapshot.generationId + 1
    this.commandId += 1
    this.endedGeneration = -1
    this.playbackRequested = autoplay
    this.timelineOffset = source.timelineOffset ?? 0
    this.fallbackStreamUrl = source.fallbackStreamUrl ?? null
    this.fallbackAttempted = false
    this.disposeAudio()

    const audio = this.audioFactory()
    this.audio = audio
    audio.preload = 'metadata'
    audio.volume = this.snapshot.volume
    this.snapshot = {
      ...this.snapshot,
      generationId,
      state: autoplay ? 'loading' : 'paused',
      trackId: source.trackId,
      currentTime: this.timelineOffset,
      duration: source.duration,
      errorMessage: '',
      errorReason: null
    }
    this.bindAudioEvents(audio, generationId)
    audio.src = source.streamUrl
    audio.load()
    this.emitSnapshot()

    if (autoplay) await this.tryPlay(generationId)
  }

  async play(): Promise<void> {
    if (!this.audio || !this.snapshot.trackId) return
    this.endedGeneration = -1
    this.playbackRequested = true
    if (this.snapshot.state === 'ended') {
      this.audio.currentTime = 0
      this.updateSnapshot({ currentTime: this.timelineOffset })
    }
    this.updateSnapshot({ state: 'loading', errorMessage: '', errorReason: null })
    await this.tryPlay(this.snapshot.generationId)
  }

  pause(): void {
    if (!this.audio || !this.snapshot.trackId) return
    this.commandId += 1
    this.playbackRequested = false
    this.clearBufferTimeout()
    this.audio.pause()
    this.updateSnapshot({ state: 'paused' })
  }

  seek(seconds: number): void {
    if (!this.audio || !Number.isFinite(seconds) || !this.snapshot.trackId) return
    const maximum = this.snapshot.duration > 0 ? this.snapshot.duration : seconds
    const nextTime = clamp(seconds, 0, maximum)
    this.clearBufferTimeout()
    this.updateSnapshot({ state: 'seeking', currentTime: nextTime })
    this.audio.currentTime = Math.max(0, nextTime - this.timelineOffset)
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return
    const nextVolume = clamp(volume, 0, 1)
    if (this.audio) this.audio.volume = nextVolume
    this.updateSnapshot({ volume: nextVolume })
  }

  stop(): void {
    this.commandId += 1
    this.endedGeneration = -1
    this.playbackRequested = false
    this.disposeAudio()
    this.snapshot = {
      ...this.snapshot,
      generationId: this.snapshot.generationId + 1,
      state: 'idle',
      trackId: null,
      currentTime: 0,
      duration: 0,
      errorMessage: '',
      errorReason: null
    }
    this.emitSnapshot()
  }

  private async tryPlay(generationId: number): Promise<void> {
    const audio = this.audio
    if (!audio || generationId !== this.snapshot.generationId) return
    const commandId = ++this.commandId
    try {
      await audio.play()
    } catch {
      if (generationId !== this.snapshot.generationId || commandId !== this.commandId) return
      this.playbackRequested = false
      this.updateSnapshot({
        state: 'error',
        errorMessage: PLAYBACK_ERROR,
        errorReason: 'playback-start'
      })
    }
  }

  private bindAudioEvents(audio: HTMLAudioElement, generationId: number): void {
    const on = (type: string, listener: EventListener): void => {
      audio.addEventListener(type, listener)
      this.cleanups.push(() => audio.removeEventListener(type, listener))
    }
    const updateIfCurrent = (patch: Partial<AudioEngineSnapshot>): void => {
      if (generationId !== this.snapshot.generationId || audio !== this.audio) return
      this.updateSnapshot(patch)
    }

    on('loadstart', () =>
      updateIfCurrent({ state: this.playbackRequested ? 'loading' : 'paused' })
    )
    on('playing', () => {
      this.clearBufferTimeout()
      if (!this.playbackRequested) {
        audio.pause()
        updateIfCurrent({ state: 'paused' })
        return
      }
      updateIfCurrent({ state: 'playing', errorMessage: '', errorReason: null })
    })
    on('pause', () => {
      this.clearBufferTimeout()
      if (!audio.ended) updateIfCurrent({ state: 'paused' })
    })
    on('waiting', () => this.enterBuffering(audio, generationId, updateIfCurrent))
    on('stalled', () => this.enterBuffering(audio, generationId, updateIfCurrent))
    const fullTimelineTime = (): number => this.timelineOffset + audio.currentTime
    on('seeking', () => {
      this.clearBufferTimeout()
      updateIfCurrent({ state: 'seeking', currentTime: fullTimelineTime() })
    })
    on('seeked', () => {
      this.clearBufferTimeout()
      updateIfCurrent({
        state: this.playbackRequested && !audio.paused ? 'playing' : 'paused',
        currentTime: fullTimelineTime()
      })
    })
    on('timeupdate', () => {
      if (this.snapshot.state === 'buffering' && this.playbackRequested) {
        this.clearBufferTimeout()
        updateIfCurrent({ state: 'playing', currentTime: fullTimelineTime() })
        return
      }
      updateIfCurrent({ currentTime: fullTimelineTime() })
    })
    on('durationchange', () => {
      if (this.timelineOffset === 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
        updateIfCurrent({ duration: audio.duration })
      }
    })
    on('error', () => {
      this.clearBufferTimeout()
      if (this.fallbackStreamUrl && !this.fallbackAttempted) {
        const shouldResume = this.playbackRequested
        this.fallbackAttempted = true
        audio.src = this.fallbackStreamUrl
        updateIfCurrent({
          state: shouldResume ? 'loading' : 'paused',
          currentTime: 0,
          errorMessage: FALLBACK_NOTICE,
          errorReason: null
        })
        audio.load()
        if (shouldResume) void this.tryPlay(generationId)
        return
      }
      this.playbackRequested = false
      updateIfCurrent({ state: 'error', errorMessage: STREAM_ERROR, errorReason: 'stream' })
    })
    on('ended', () => {
      this.clearBufferTimeout()
      if (
        generationId !== this.snapshot.generationId ||
        audio !== this.audio ||
        this.endedGeneration === generationId ||
        !this.snapshot.trackId
      ) {
        return
      }
      this.endedGeneration = generationId
      this.playbackRequested = false
      this.updateSnapshot({ state: 'ended', currentTime: this.snapshot.duration })
      this.emit({ type: 'ended', generationId, trackId: this.snapshot.trackId })
    })
  }

  private enterBuffering(
    audio: HTMLAudioElement,
    generationId: number,
    updateIfCurrent: (patch: Partial<AudioEngineSnapshot>) => void
  ): void {
    if (!this.playbackRequested) {
      this.clearBufferTimeout()
      updateIfCurrent({ state: 'paused' })
      return
    }
    updateIfCurrent({ state: 'buffering' })
    if (this.bufferTimeout !== null) return
    this.bufferTimeout = setTimeout(() => {
      this.bufferTimeout = null
      if (
        generationId !== this.snapshot.generationId ||
        audio !== this.audio ||
        !this.playbackRequested ||
        this.snapshot.state !== 'buffering'
      ) {
        return
      }
      this.playbackRequested = false
      this.disposeAudio()
      this.updateSnapshot({
        state: 'error',
        errorMessage: BUFFER_TIMEOUT_ERROR,
        errorReason: 'buffer-timeout'
      })
    }, this.bufferTimeoutMs)
  }

  private clearBufferTimeout(): void {
    if (this.bufferTimeout === null) return
    clearTimeout(this.bufferTimeout)
    this.bufferTimeout = null
  }

  private disposeAudio(): void {
    this.clearBufferTimeout()
    const audio = this.audio
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    this.audio = null
  }

  private updateSnapshot(patch: Partial<AudioEngineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.emitSnapshot()
  }

  private emitSnapshot(): void {
    this.emit({ type: 'snapshot', snapshot: this.getSnapshot() })
  }

  private emit(event: AudioEngineEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

export function isActivePlaybackState(state: AudioEngineState): boolean {
  return state === 'loading' || state === 'playing' || state === 'buffering' || state === 'seeking'
}
