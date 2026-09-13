import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'
import type { TrackSummary } from '../../../shared/library'

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export const usePlayerStore = defineStore('player', () => {
  const state = ref<PlayerState>('idle')
  const track = ref<TrackSummary | null>(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const errorMessage = ref('')
  let audio: HTMLAudioElement | null = null

  const isPlaying = computed(() => state.value === 'playing')

  function getAudio(): HTMLAudioElement {
    if (audio) return audio
    audio = markRaw(new Audio())
    audio.preload = 'metadata'
    audio.addEventListener('loadstart', () => {
      state.value = 'loading'
    })
    audio.addEventListener('playing', () => {
      state.value = 'playing'
    })
    audio.addEventListener('pause', () => {
      if (track.value && !audio?.ended) state.value = 'paused'
    })
    audio.addEventListener('timeupdate', () => {
      currentTime.value = audio?.currentTime ?? 0
    })
    audio.addEventListener('durationchange', () => {
      duration.value = Number.isFinite(audio?.duration) ? (audio?.duration ?? 0) : 0
    })
    audio.addEventListener('ended', () => {
      state.value = 'paused'
      currentTime.value = 0
    })
    audio.addEventListener('error', () => {
      state.value = 'error'
      errorMessage.value = '音频流加载失败。'
    })
    return audio
  }

  async function play(selectedTrack: TrackSummary): Promise<void> {
    const element = getAudio()
    errorMessage.value = ''
    if (track.value?.id !== selectedTrack.id) {
      track.value = selectedTrack
      currentTime.value = 0
      duration.value = selectedTrack.duration
      element.src = selectedTrack.streamUrl
      element.load()
    }

    try {
      await element.play()
    } catch {
      state.value = 'error'
      errorMessage.value = '系统未能开始播放，请重试。'
    }
  }

  function toggle(): void {
    if (!audio || !track.value) return
    if (audio.paused) void play(track.value)
    else audio.pause()
  }

  function seek(seconds: number): void {
    if (!audio || !Number.isFinite(seconds)) return
    audio.currentTime = Math.max(0, Math.min(seconds, duration.value || seconds))
  }

  return { state, track, currentTime, duration, errorMessage, isPlaying, play, toggle, seek }
})
