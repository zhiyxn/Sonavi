<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { Heart } from '@lucide/vue'
import type { TrackSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { useErrorToast } from '../lib/notifications'
import { listStarred } from '../services/library'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'
import { t } from '../i18n'

const props = defineProps<{ sessionId: string; serverId: string }>()
const emit = defineEmits<{
  openAlbum: [albumId: string]
  openArtist: [artistId: string]
}>()
const player = usePlayerStore()
const starredQuery = useQuery({
  queryKey: computed(() => ['starred', props.sessionId]),
  queryFn: () => listStarred(props.sessionId),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: false
})
const { pendingKey, toggleStarred } = useStarredMutation(() => props.sessionId)

useErrorToast(
  () => starredQuery.isError.value
    ? (starredQuery.error.value?.message ?? '收藏加载失败。')
    : null,
  { title: '收藏加载失败', id: 'starred-query-error' }
)

const hasItems = computed(() => {
  const value = starredQuery.data.value
  return Boolean(value && (value.artists.length || value.albums.length || value.tracks.length))
})

function playTrack(track: TrackSummary): void {
  const tracks = starredQuery.data.value?.tracks ?? [track]
  const index = Math.max(0, tracks.findIndex((item) => item.id === track.id))
  void player.replaceQueue(
    tracks,
    index,
    { sessionId: props.sessionId, serverId: props.serverId, accountId: props.sessionId },
    true
  )
}

function appendTrack(track: TrackSummary): void {
  player.appendToQueue(
    [track],
    { sessionId: props.sessionId, serverId: props.serverId, accountId: props.sessionId }
  )
}
</script>

<template>
  <section class="min-h-full" aria-labelledby="favorites-title">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="eyebrow">FAVORITES</p>
        <h1 id="favorites-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">{{ t('收藏') }}</h1>
        <p class="mt-2 text-sm text-sonavi-muted">{{ t('与服务器账号实时同步，不在本机伪造收藏状态') }}</p>
      </div>
      <Button
        variant="outline"
        :disabled="starredQuery.isFetching.value"
        @click="starredQuery.refetch()"
      >
        {{ t(starredQuery.isFetching.value ? '正在刷新…' : '刷新') }}
      </Button>
    </div>

    <p v-if="starredQuery.isPending.value" class="mt-8" role="status">{{ t('正在读取收藏…') }}</p>
    <div v-else-if="starredQuery.isError.value" class="state-card" role="alert">
      <p>{{ t(starredQuery.error.value?.message ?? '收藏加载失败。') }}</p>
      <Button class="mt-4" size="sm" @click="starredQuery.refetch()">{{ t('重试') }}</Button>
    </div>
    <p v-else-if="!hasItems" class="mt-8 text-sonavi-muted">{{ t('还没有收藏的艺术家、专辑或歌曲。') }}</p>

    <div v-if="hasItems" class="collection-sections">
      <section v-if="starredQuery.data.value?.artists.length" aria-labelledby="favorite-artists">
        <h2 id="favorite-artists">{{ t('艺术家') }}</h2>
        <div class="entity-grid">
          <article v-for="artist in starredQuery.data.value.artists" :key="artist.id" class="entity-row">
            <button type="button" class="entity-main" @click="emit('openArtist', artist.id)">
              <strong>{{ artist.name }}</strong>
              <small>{{ t('{count} 张专辑', { count: artist.albumCount }) }}</small>
            </button>
            <Button
              variant="ghost"
              size="sm"
              :disabled="pendingKey === `artist:${artist.id}`"
              :aria-label="t('取消收藏 {title}', { title: artist.name })"
              :aria-pressed="true"
              @click="toggleStarred('artist', artist.id, false)"
            >
              {{ t('取消收藏') }}
            </Button>
          </article>
        </div>
      </section>

      <section v-if="starredQuery.data.value?.albums.length" aria-labelledby="favorite-albums">
        <h2 id="favorite-albums">{{ t('专辑') }}</h2>
        <div class="entity-grid">
          <article v-for="album in starredQuery.data.value.albums" :key="album.id" class="entity-row">
            <button type="button" class="entity-main" @click="emit('openAlbum', album.id)">
              <strong>{{ album.name }}</strong>
              <small class="album-card-meta">
                <span class="album-card-meta-name">{{ album.artist }}</span>
                <span class="album-card-song-count">{{ t('{count} 首歌曲', { count: album.songCount }) }}</span>
              </small>
            </button>
            <Button
              variant="ghost"
              size="sm"
              :disabled="pendingKey === `album:${album.id}`"
              :aria-label="t('取消收藏 {title}', { title: album.name })"
              :aria-pressed="true"
              @click="toggleStarred('album', album.id, false)"
            >
              {{ t('取消收藏') }}
            </Button>
          </article>
        </div>
      </section>

      <section v-if="starredQuery.data.value?.tracks.length" aria-labelledby="favorite-tracks">
        <h2 id="favorite-tracks">{{ t('歌曲') }}</h2>
        <ol class="track-results">
          <li v-for="track in starredQuery.data.value.tracks" :key="track.id">
            <span class="min-w-0">
              <strong>{{ track.title }}</strong>
              <small>{{ track.artist }} · {{ track.album }}</small>
            </span>
            <span class="flex gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="pendingKey === `track:${track.id}`"
                :aria-label="t('取消收藏 {title}', { title: track.title })"
                :aria-pressed="true"
                @click="toggleStarred('track', track.id, false)"
              >
                <Heart
                  :size="17"
                  fill="currentColor"
                  class="text-[var(--sonavi-accent)]"
                  aria-hidden="true"
                />
              </Button>
              <Button variant="outline" size="sm" @click="appendTrack(track)">{{ t('加入队列') }}</Button>
              <Button size="sm" @click="playTrack(track)">{{ t('播放') }}</Button>
            </span>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>
