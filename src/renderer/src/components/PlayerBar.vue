<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  Captions,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2
} from '@lucide/vue'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import LyricsPanel from './LyricsPanel.vue'

const player = usePlayerStore()
const queueOpen = ref(false)
const queueList = ref<HTMLOListElement | null>(null)
const lyricsOpen = ref(false)
const seekPreview = ref<number | null>(null)

const stateLabels = {
  idle: '空闲',
  loading: '正在加载',
  playing: '正在播放',
  paused: '已暂停',
  buffering: '正在缓冲',
  seeking: '正在跳转',
  ended: '播放结束',
  error: '播放错误'
} as const

const audioFormatLabels: Readonly<Record<string, string>> = {
  'audio/aac': 'AAC',
  'audio/flac': 'FLAC',
  'audio/mp3': 'MP3',
  'audio/mp4': 'M4A',
  'audio/mpeg': 'MP3',
  'audio/ogg': 'OGG',
  'audio/opus': 'OPUS',
  'audio/wav': 'WAV',
  'audio/webm': 'WEBM',
  'audio/x-aac': 'AAC',
  'audio/x-alac': 'ALAC',
  'audio/x-flac': 'FLAC',
  'audio/x-m4a': 'M4A',
  'audio/x-wav': 'WAV'
}

function getSourceFormatLabel(contentType: string | undefined): string {
  const normalizedType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
  return normalizedType ? (audioFormatLabels[normalizedType] ?? '未知格式') : '未知格式'
}

const streamNote = computed(() => {
  const track = player.track
  if (!track) return ''

  const sourceFormat = getSourceFormatLabel(track.contentType)
  return track.playback.streamMode === 'transcode'
    ? `${sourceFormat} → MP3 · 兼容转码`
    : `${sourceFormat} · 原始音频`
})

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

const progressModelValue = computed(() => [seekPreview.value ?? player.currentTime])

function normalizeSeekValue(value: number): number {
  return Math.round(value * 1000) / 1000
}

function onSeekPreview(values: number[] | undefined): void {
  const value = values?.[0]
  if (value !== undefined && Number.isFinite(value)) seekPreview.value = normalizeSeekValue(value)
}

async function onSeek(values: number[] | undefined): Promise<void> {
  const value = values?.[0]
  if (value === undefined || !Number.isFinite(value)) {
    seekPreview.value = null
    return
  }

  const nextValue = normalizeSeekValue(value)
  seekPreview.value = nextValue
  try {
    await player.seek(nextValue)
  } finally {
    seekPreview.value = null
  }
}

function onVolume(values: number[] | undefined): void {
  const value = values?.[0]
  if (value !== undefined) player.setVolume(Math.round(value * 100) / 100)
}

const repeatLabel = computed(() => {
  if (player.repeatMode === 'one') return '单曲循环'
  if (player.repeatMode === 'all') return '列表循环'
  return '不循环'
})

watch(
  () => player.currentEntry?.queueEntryId,
  () => { seekPreview.value = null }
)

async function toggleQueue(): Promise<void> {
  queueOpen.value = !queueOpen.value
  if (!queueOpen.value) return

  lyricsOpen.value = false
  await nextTick()
  queueList.value
    ?.querySelector<HTMLElement>('[aria-current="true"]')
    ?.scrollIntoView({ block: 'center' })
}

function toggleLyrics(): void {
  lyricsOpen.value = !lyricsOpen.value
  if (lyricsOpen.value) queueOpen.value = false
}

function closeQueueFromDocument(event: MouseEvent): void {
  if (!queueOpen.value || !(event.target instanceof Element)) return
  if (event.target.closest('.queue-panel, [aria-controls="player-queue"]')) return
  queueOpen.value = false
}

onMounted(() => document.addEventListener('click', closeQueueFromDocument))
onBeforeUnmount(() => document.removeEventListener('click', closeQueueFromDocument))
</script>

<template>
  <footer class="player-bar" aria-label="播放器" @click="closeQueueFromDocument">
    <section
      v-if="queueOpen"
      id="player-queue"
      class="queue-panel"
      aria-labelledby="queue-title"
      @click.stop
    >
      <header>
        <div>
          <h2 id="queue-title">播放队列</h2>
          <p>{{ player.queue.length }} 项 · {{ player.playbackOrder === 'shuffle' ? '随机' : '顺序' }}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          :disabled="player.queue.length === 0"
          @click="player.clearQueue"
        >
          清空
        </Button>
      </header>
      <p v-if="player.queue.length === 0" class="queue-empty">队列为空。</p>
      <ol v-else ref="queueList">
        <li
          v-for="(entry, index) in player.queue"
          :key="entry.queueEntryId"
          :class="{ current: entry.queueEntryId === player.currentEntryId }"
          :aria-current="entry.queueEntryId === player.currentEntryId ? 'true' : undefined"
        >
          <button
            type="button"
            class="queue-track"
            :aria-label="`播放队列中的 ${entry.track.title}`"
            @click="player.playQueueEntry(entry.queueEntryId)"
          >
            <strong>{{ entry.track.title }}</strong>
            <span>{{ entry.track.artist }}</span>
          </button>
          <div class="queue-actions">
            <Button
              variant="ghost"
              size="icon"
              :disabled="index === 0"
              :aria-label="`上移 ${entry.track.title}`"
              @click="player.moveQueueEntry(entry.queueEntryId, index - 1)"
            >
              <ChevronUp :size="15" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :disabled="index === player.queue.length - 1"
              :aria-label="`下移 ${entry.track.title}`"
              @click="player.moveQueueEntry(entry.queueEntryId, index + 1)"
            >
              <ChevronDown :size="15" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :aria-label="`从队列移除 ${entry.track.title}`"
              @click="player.removeQueueEntry(entry.queueEntryId)"
            >
              <Trash2 :size="15" aria-hidden="true" />
            </Button>
          </div>
        </li>
      </ol>
    </section>
    <LyricsPanel v-if="lyricsOpen" @close="lyricsOpen = false" />
    <div class="player-track">
      <div class="album-placeholder">
        <img
          v-if="player.track?.coverUrl"
          :src="player.track.coverUrl"
          alt=""
          aria-hidden="true"
        />
        <span v-else aria-hidden="true">{{ player.track ? '♪' : 'S' }}</span>
      </div>
      <div class="player-track-details min-w-0">
        <strong class="block truncate">{{ player.track?.title ?? '选择歌曲开始播放' }}</strong>
        <span class="block truncate">{{ player.track?.artist ?? 'Sonavi AudioEngine' }}</span>
        <div v-if="player.errorMessage" class="player-error-row" role="alert">
          <span class="player-error">{{ player.errorMessage }}</span>
          <Button variant="ghost" size="sm" @click="player.retry">重试播放</Button>
        </div>
        <span
          v-else-if="player.track"
          class="player-stream-note"
          :title="`${streamNote}。${player.track.playback.reason}`"
        >
          {{ streamNote }}
        </span>
      </div>
    </div>
    <div class="player-controls">
      <Button
        variant="ghost"
        size="icon"
        :class="{ 'control-active': player.playbackOrder === 'shuffle' }"
        :aria-label="player.playbackOrder === 'shuffle' ? '关闭随机播放' : '开启随机播放'"
        :aria-pressed="player.playbackOrder === 'shuffle'"
        @click="player.togglePlaybackOrder"
      >
        <Shuffle :size="17" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :disabled="!player.canGoPrevious"
        aria-label="上一首"
        @click="player.previous"
      >
        <SkipBack :size="18" aria-hidden="true" />
      </Button>
      <Button
        class="transport-primary"
        size="icon"
        :disabled="!player.track"
        :aria-label="player.isPlaying ? '暂停' : '继续播放'"
        @click="player.toggle"
      >
        <Pause v-if="player.isPlaying" :size="18" aria-hidden="true" />
        <Play v-else :size="18" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :disabled="!player.canGoNext"
        aria-label="下一首"
        @click="player.next"
      >
        <SkipForward :size="18" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :class="{ 'control-active': player.repeatMode !== 'off' }"
        :aria-label="`${repeatLabel}，点击切换循环模式`"
        @click="player.cycleRepeatMode"
      >
        <Repeat1 v-if="player.repeatMode === 'one'" :size="17" aria-hidden="true" />
        <Repeat v-else :size="17" aria-hidden="true" />
      </Button>
      <span>{{ formatTime(player.currentTime) }}</span>
      <Slider
        class="player-progress-slider"
        aria-label="播放进度"
        :min="0"
        :max="Math.max(player.duration, 1)"
        :step="0.1"
        :model-value="progressModelValue"
        :disabled="!player.track || !player.canSeek"
        :title="player.track && !player.canSeek ? '当前播放策略无法安全跳转；可在设置中选择原始模式，或使用支持 transcodeOffset 的服务器。' : undefined"
        @update:model-value="onSeekPreview"
        @value-commit="onSeek"
      />
      <span>{{ formatTime(player.duration) }}</span>
    </div>
    <div class="player-utilities">
      <Volume2 :size="17" aria-hidden="true" />
      <Slider
        class="player-volume-slider"
        aria-label="音量"
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="[player.volume]"
        @update:model-value="onVolume"
      />
      <span class="phase-pill" role="status">{{ stateLabels[player.state] }}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="歌词"
        :disabled="!player.track"
        :aria-expanded="lyricsOpen"
        aria-controls="player-lyrics"
        @click="toggleLyrics"
      >
        <Captions :size="19" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="播放队列"
        :aria-expanded="queueOpen"
        aria-controls="player-queue"
        @click="toggleQueue"
      >
        <ListMusic :size="19" aria-hidden="true" />
      </Button>
    </div>
  </footer>
</template>
