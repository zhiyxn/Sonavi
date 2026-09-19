export type AudioEngineState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'seeking'
  | 'ended'
  | 'error'

export type AudioEngineErrorReason = 'playback-start' | 'stream' | 'buffer-timeout'

export interface AudioEngineSource {
  trackId: string
  streamUrl: string
  fallbackStreamUrl?: string | undefined
  duration: number
  timelineOffset?: number | undefined
}

export interface AudioEngineSnapshot {
  generationId: number
  state: AudioEngineState
  trackId: string | null
  currentTime: number
  duration: number
  volume: number
  errorMessage: string
  errorReason: AudioEngineErrorReason | null
}

export type AudioEngineEvent =
  | { type: 'snapshot'; snapshot: AudioEngineSnapshot }
  | { type: 'ended'; generationId: number; trackId: string }

export type AudioEngineListener = (event: AudioEngineEvent) => void

/** 唯一 AudioEngine 是 renderer 中创建和控制 HTMLAudioElement 的唯一边界。 */
export interface AudioEngine {
  getSnapshot: () => AudioEngineSnapshot
  subscribe: (listener: AudioEngineListener) => () => void
  load: (source: AudioEngineSource, autoplay: boolean) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  stop: () => void
}
