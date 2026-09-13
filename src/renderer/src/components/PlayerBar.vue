<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play } from '@lucide/vue'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'

const player = usePlayerStore()

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

const progress = computed(() => {
  if (player.duration <= 0) return 0
  return Math.min(100, (player.currentTime / player.duration) * 100)
})

function onSeek(event: Event): void {
  player.seek(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <footer class="player-bar" aria-label="播放器">
    <div class="album-placeholder" aria-hidden="true">{{ player.track ? '♪' : 'S' }}</div>
    <div class="min-w-0">
      <strong class="block truncate">{{ player.track?.title ?? '选择歌曲开始播放' }}</strong>
      <span class="block truncate">{{ player.track?.artist ?? 'Sonavi AudioEngine' }}</span>
      <span v-if="player.errorMessage" class="player-error" role="alert">{{ player.errorMessage }}</span>
    </div>
    <div class="player-controls">
      <Button
        size="icon"
        :disabled="!player.track"
        :aria-label="player.isPlaying ? '暂停' : '继续播放'"
        @click="player.toggle"
      >
        <Pause v-if="player.isPlaying" :size="18" aria-hidden="true" />
        <Play v-else :size="18" aria-hidden="true" />
      </Button>
      <span>{{ formatTime(player.currentTime) }}</span>
      <input
        aria-label="播放进度"
        type="range"
        min="0"
        :max="Math.max(player.duration, 0)"
        step="0.1"
        :value="player.currentTime"
        :disabled="!player.track"
        :style="{ '--player-progress': `${progress}%` }"
        @input="onSeek"
      />
      <span>{{ formatTime(player.duration) }}</span>
    </div>
    <span class="phase-pill">P03 流式播放</span>
  </footer>
</template>
