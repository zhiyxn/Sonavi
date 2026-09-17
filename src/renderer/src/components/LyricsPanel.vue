<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useErrorToast } from '../lib/notifications'
import { getLyrics } from '../services/playback'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'

const emit = defineEmits<{ close: [] }>()
const player = usePlayerStore()
const selectedVariantIndex = ref(0)

const lyricsQuery = useQuery({
  queryKey: computed(() => [
    'lyrics',
    player.currentEntry?.scope.sessionId,
    player.currentEntry?.trackId
  ]),
  queryFn: () => {
    const entry = player.currentEntry
    if (!entry) throw new Error('请先选择歌曲。')
    return getLyrics({
      sessionId: entry.scope.sessionId,
      trackId: entry.trackId,
      artist: entry.track.artist,
      title: entry.track.title
    })
  },
  enabled: computed(() => player.currentEntry !== null),
  staleTime: 5 * 60_000,
  retry: false
})

useErrorToast(
  () => lyricsQuery.isError.value
    ? (lyricsQuery.error.value?.message ?? '歌词加载失败。')
    : null,
  { title: '歌词加载失败', id: 'lyrics-query-error' }
)

watch(
  () => player.currentEntry?.queueEntryId,
  () => {
    selectedVariantIndex.value = 0
  }
)

const variants = computed(() => lyricsQuery.data.value?.variants ?? [])
const selectedVariant = computed(
  () => variants.value[selectedVariantIndex.value] ?? variants.value[0] ?? null
)
const activeLineIndex = computed(() => {
  const variant = selectedVariant.value
  if (!variant?.synced) return -1
  const playbackMs = player.currentTime * 1000
  let active = -1
  for (let index = 0; index < variant.lines.length; index += 1) {
    const startMs = variant.lines[index]?.startMs
    if (startMs === undefined || startMs + variant.offsetMs > playbackMs) continue
    active = index
  }
  return active
})

function variantLabel(index: number): string {
  const variant = variants.value[index]
  if (!variant) return `歌词 ${index + 1}`
  const language = variant.language ?? `版本 ${index + 1}`
  return `${language} · ${variant.synced ? '同步' : '文本'}`
}
</script>

<template>
  <section id="player-lyrics" class="lyrics-panel" aria-labelledby="lyrics-title">
    <header>
      <div class="min-w-0">
        <h2 id="lyrics-title">歌词</h2>
        <p class="truncate">{{ player.track?.title ?? '未选择歌曲' }} · {{ player.track?.artist }}</p>
      </div>
      <Button variant="ghost" size="sm" @click="emit('close')">关闭</Button>
    </header>

    <div v-if="lyricsQuery.isPending.value" class="lyrics-message" role="status">
      正在读取歌词…
    </div>
    <div v-else-if="lyricsQuery.isError.value" class="lyrics-message" role="alert">
      <p>{{ lyricsQuery.error.value?.message ?? '歌词加载失败。' }}</p>
      <Button size="sm" variant="outline" @click="lyricsQuery.refetch()">重试</Button>
    </div>
    <div v-else-if="variants.length === 0" class="lyrics-message">
      服务器没有返回这首歌的歌词。
    </div>
    <template v-else>
      <label v-if="variants.length > 1" class="lyrics-variant">
        <span>歌词版本</span>
        <select v-model.number="selectedVariantIndex">
          <option v-for="(_, index) in variants" :key="index" :value="index">
            {{ variantLabel(index) }}
          </option>
        </select>
      </label>
      <p v-if="selectedVariant?.displayTitle || selectedVariant?.displayArtist" class="lyrics-credit">
        {{ selectedVariant.displayTitle ?? player.track?.title }} ·
        {{ selectedVariant.displayArtist ?? player.track?.artist }}
      </p>
      <ol class="lyrics-lines" :class="{ synced: selectedVariant?.synced }">
        <li
          v-for="(line, index) in selectedVariant?.lines"
          :key="`${line.startMs ?? 'plain'}-${index}`"
          :class="{ active: index === activeLineIndex }"
          :aria-current="index === activeLineIndex ? 'true' : undefined"
        >
          {{ line.value || '\u00a0' }}
        </li>
      </ol>
    </template>
  </section>
</template>
