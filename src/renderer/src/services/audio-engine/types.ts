export type AudioEngineState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export interface AudioEngineSnapshot {
  state: AudioEngineState
  trackId: string | null
  currentTime: number
  duration: number
}

/**
 * P03 使用一个 HTMLAudioElement 实例实现最短播放链路；P04 在此边界后扩展队列与完整状态机。
 */
export interface AudioEngine {
  getSnapshot: () => AudioEngineSnapshot
  play: (trackId: string, streamUrl: string) => Promise<void>
  pause: () => void
  seek: (seconds: number) => void
}
