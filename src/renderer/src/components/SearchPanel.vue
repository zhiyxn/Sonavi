<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AlbumSummary, ArtistSummary, TrackSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { searchLibrary } from '../services/library'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'

const props = defineProps<{ sessionId: string; serverId: string }>()
const emit = defineEmits<{
  openAlbum: [albumId: string]
  openArtist: [artistId: string]
}>()
const player = usePlayerStore()
const { errorMessage: starredError, pendingKey, toggleStarred } = useStarredMutation(
  () => props.sessionId
)
const input = ref('')
const debouncedQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined
const SEARCH_PAGE_SIZE = 25
const loadMoreSentinel = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

watch(input, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value.trim()
  }, 300)
})

onMounted(() => {
  if (!('IntersectionObserver' in globalThis)) return
  loadMoreObserver = new IntersectionObserver((entries) => {
    if (
      entries.some((entry) => entry.isIntersecting) &&
      searchQuery.hasNextPage.value &&
      !searchQuery.isFetchingNextPage.value
    ) {
      void searchQuery.fetchNextPage()
    }
  }, { rootMargin: '240px 0px' })
  if (loadMoreSentinel.value) loadMoreObserver.observe(loadMoreSentinel.value)
})

watch(loadMoreSentinel, (sentinel, previous) => {
  if (previous) loadMoreObserver?.unobserve(previous)
  if (sentinel) loadMoreObserver?.observe(sentinel)
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  loadMoreObserver?.disconnect()
})

const searchQuery = useInfiniteQuery({
  queryKey: computed(() => ['search', props.sessionId, debouncedQuery.value]),
  queryFn: ({ pageParam, signal }) =>
    searchLibrary(props.sessionId, debouncedQuery.value, pageParam, SEARCH_PAGE_SIZE, signal),
  enabled: computed(() => debouncedQuery.value.length > 0),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
  staleTime: 30_000
})

function unique<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

const artists = computed<ArtistSummary[]>(() =>
  unique((searchQuery.data.value?.pages ?? []).flatMap((page) => page.artists))
)
const albums = computed<AlbumSummary[]>(() =>
  unique((searchQuery.data.value?.pages ?? []).flatMap((page) => page.albums))
)
const tracks = computed<TrackSummary[]>(() =>
  unique((searchQuery.data.value?.pages ?? []).flatMap((page) => page.tracks))
)
const hasResults = computed(
  () => artists.value.length > 0 || albums.value.length > 0 || tracks.value.length > 0
)

function playTrack(track: TrackSummary): void {
  const index = Math.max(0, tracks.value.findIndex((item) => item.id === track.id))
  void player.replaceQueue(
    tracks.value,
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
  <section class="min-h-full" aria-labelledby="search-title">
    <p class="eyebrow">05 / SEARCH</p>
    <h1 id="search-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">搜索音乐库</h1>
    <label class="search-field">
      <span class="sr-only">搜索艺术家、专辑或歌曲</span>
      <input
        v-model="input"
        type="search"
        maxlength="200"
        autocomplete="off"
        placeholder="搜索艺术家、专辑或歌曲"
      />
    </label>

    <p v-if="input.trim() && input.trim() !== debouncedQuery" class="mt-5 text-sonavi-muted" role="status">
      正在准备搜索…
    </p>
    <p v-else-if="searchQuery.isPending.value && debouncedQuery" class="mt-5" role="status">
      正在搜索“{{ debouncedQuery }}”…
    </p>
    <div
      v-else-if="searchQuery.isError.value"
      class="mt-6 rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
      role="alert"
    >
      <p>{{ searchQuery.error.value?.message ?? '搜索失败。' }}</p>
      <Button class="mt-4" size="sm" @click="searchQuery.refetch()">重试</Button>
    </div>
    <p v-else-if="debouncedQuery && !hasResults" class="mt-6 text-sonavi-muted">
      没有找到“{{ debouncedQuery }}”的结果。
    </p>

    <div v-if="hasResults" class="search-results">
      <section v-if="artists.length" aria-labelledby="search-artists-title">
        <h2 id="search-artists-title">艺术家</h2>
        <div class="result-chips">
          <button
            v-for="artist in artists"
            :key="artist.id"
            type="button"
            @click="emit('openArtist', artist.id)"
          >
            <strong>{{ artist.name }}</strong>
            <small>{{ artist.albumCount }} 张专辑</small>
          </button>
        </div>
      </section>

      <section v-if="albums.length" aria-labelledby="search-albums-title">
        <h2 id="search-albums-title">专辑</h2>
        <div class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          <button
            v-for="album in albums"
            :key="album.id"
            type="button"
            class="album-card"
            @click="emit('openAlbum', album.id)"
          >
            <img
              v-if="album.coverUrl"
              :src="album.coverUrl"
              :alt="`${album.name} 封面`"
              loading="lazy"
            />
            <span v-else class="album-cover-placeholder" aria-hidden="true" />
            <strong>{{ album.name }}</strong>
            <small>{{ album.artist }}</small>
          </button>
        </div>
      </section>

      <section v-if="tracks.length" aria-labelledby="search-tracks-title">
        <h2 id="search-tracks-title">歌曲</h2>
        <ol class="track-results">
          <li v-for="track in tracks" :key="track.id">
            <span class="min-w-0">
              <strong>{{ track.title }}</strong>
              <small>{{ track.artist }} · {{ track.album }}</small>
            </span>
            <span class="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                :disabled="pendingKey === `track:${track.id}`"
                @click="toggleStarred('track', track.id, !track.starred)"
              >{{ track.starred ? '取消收藏' : '收藏' }}</Button>
              <Button variant="outline" size="sm" @click="appendTrack(track)">加入队列</Button>
              <Button size="sm" @click="playTrack(track)">播放</Button>
            </span>
          </li>
        </ol>
      </section>

      <p
        v-if="searchQuery.hasNextPage.value"
        ref="loadMoreSentinel"
        class="settings-help text-center"
        role="status"
      >
        {{ searchQuery.isFetchingNextPage.value ? '正在加载更多结果…' : '继续滚动以加载更多结果' }}
      </p>
    </div>
    <p v-if="starredError" class="mutation-error" role="alert">{{ starredError }}</p>
  </section>
</template>
