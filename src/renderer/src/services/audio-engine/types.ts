export type AudioEngineState = 'idle'

export interface AudioEngineSnapshot {
  state: AudioEngineState
  trackId: null
}

/**
 * P01 只固定跨页面共享的播放引擎边界，不创建 Audio 实例，也不伪装播放能力。
 * P03/P04 将在这个接口后实现媒体协议、播放状态与队列。
 */
export interface AudioEngine {
  getSnapshot: () => AudioEngineSnapshot
}
