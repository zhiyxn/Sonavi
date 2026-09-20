<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import type { AlbumSummary, ArtistSummary, TrackSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { useErrorToast } from '../lib/notifications'
import { searchLibrary } from '../services/library'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from './ui/pagination'

const props = defineProps<{ sessionId: string; serverId: string }>()
const emit = defineEmits<{
  openAlbum: [albumId: string]
  openArtist: [artistId: string]
}>()
const player = usePlayerStore()
const { pendingKey, toggleStarred } = useStarredMutation(() => props.sessionId)
const input = ref('')
const submittedQuery = ref('')
const SEARCH_PAGE_SIZE = 25
const currentPage = ref(1)
const searchRoot = ref<HTMLElement | null>(null)

const searchQuery = useQuery({
  queryKey: computed(() => ['search', props.sessionId, submittedQuery.value, currentPage.value]),
  queryFn: ({ signal }) => searchLibrary(
    props.sessionId,
    submittedQuery.value,
    (currentPage.value - 1) * SEARCH_PAGE_SIZE,
    SEARCH_PAGE_SIZE,
    signal
  ),
  enabled: computed(() => submittedQuery.value.length > 0),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false
})

useErrorToast(
  () => searchQuery.isError.value
    ? (searchQuery.error.value?.message ?? '搜索失败。')
    : null,
  { title: '搜索失败', id: 'search-query-error' }
)

function submitSearch(): void {
  const nextQuery = input.value.trim()
  if (!nextQuery) {
    submittedQuery.value = ''
    currentPage.value = 1
    return
  }
  if (nextQuery === submittedQuery.value) {
    void searchQuery.refetch()
    return
  }
  currentPage.value = 1
  submittedQuery.value = nextQuery
}

function handleSearchEnter(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  submitSearch()
}

const artists = computed<ArtistSummary[]>(() => searchQuery.data.value?.artists ?? [])
const albums = computed<AlbumSummary[]>(() => searchQuery.data.value?.albums ?? [])
const tracks = computed<TrackSummary[]>(() => searchQuery.data.value?.tracks ?? [])
const hasResults = computed(
  () => artists.value.length > 0 || albums.value.length > 0 || tracks.value.length > 0
)
const paginationTotal = computed(() => {
  if (searchQuery.data.value?.hasMore) return currentPage.value * SEARCH_PAGE_SIZE + 1
  const pageItemCount = Math.max(artists.value.length, albums.value.length, tracks.value.length)
  return (currentPage.value - 1) * SEARCH_PAGE_SIZE + pageItemCount
})

async function updatePage(page: number): Promise<void> {
  const nextPage = Math.max(1, Math.floor(page))
  if (nextPage === currentPage.value) return
  currentPage.value = nextPage
  await nextTick()
  const scroller = searchRoot.value?.closest<HTMLElement>('.workspace')
  if (scroller) scroller.scrollTop = 0
}

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
  <section ref="searchRoot" class="min-h-full" aria-labelledby="search-title">
    <p class="eyebrow">SEARCH</p>
    <h1 id="search-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">搜索音乐库</h1>
    <form class="search-form" role="search" @submit.prevent="submitSearch">
      <label class="search-field">
        <span class="sr-only">搜索艺术家、专辑或歌曲</span>
        <Input
          v-model="input"
          type="search"
          maxlength="200"
          autocomplete="off"
          placeholder="搜索艺术家、专辑或歌曲"
          @keydown.enter="handleSearchEnter"
        />
      </label>
      <Button type="button" :disabled="!input.trim()" @click="submitSearch">搜索</Button>
      <Button
        v-if="submittedQuery"
        type="button"
        variant="outline"
        :disabled="searchQuery.isFetching.value"
        @click="searchQuery.refetch()"
      >
        {{ searchQuery.isFetching.value ? '正在刷新…' : '刷新结果' }}
      </Button>
    </form>

    <p v-if="searchQuery.isPending.value && submittedQuery" class="mt-5" role="status">
      正在搜索“{{ submittedQuery }}”…
    </p>
    <div
      v-else-if="searchQuery.isError.value"
      class="mt-6 rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
      role="alert"
    >
      <p>{{ searchQuery.error.value?.message ?? '搜索失败。' }}</p>
      <Button class="mt-4" size="sm" @click="searchQuery.refetch()">重试</Button>
    </div>
    <p v-else-if="submittedQuery && !hasResults" class="mt-6 text-sonavi-muted">
      没有找到“{{ submittedQuery }}”的结果。
    </p>

    <div v-if="hasResults" class="search-results">
      <div
        class="search-result-summary"
        data-testid="search-result-summary"
        role="status"
        aria-live="polite"
      >
        <span>“{{ submittedQuery }}”的搜索结果</span>
        <span>第 {{ currentPage }} 页 · {{ artists.length }} 位艺术家 · {{ albums.length }} 张专辑 · {{ tracks.length }} 首歌曲</span>
      </div>

      <div class="search-results-layout">
        <div v-if="artists.length || albums.length" class="search-discovery-column">
          <section
            v-if="artists.length"
            class="search-result-section search-artists-section"
            data-testid="search-artists"
            aria-labelledby="search-artists-title"
          >
            <header class="search-result-section-header">
              <h2 id="search-artists-title">艺术家</h2>
              <span>{{ artists.length }} 位</span>
            </header>
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

          <section
            v-if="albums.length"
            class="search-result-section search-albums-section"
            data-testid="search-albums"
            aria-labelledby="search-albums-title"
          >
            <header class="search-result-section-header">
              <h2 id="search-albums-title">专辑</h2>
              <span>{{ albums.length }} 张</span>
            </header>
            <div class="search-album-grid">
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
                  decoding="async"
                  fetchpriority="low"
                />
                <span v-else class="album-cover-placeholder" aria-hidden="true" />
                <strong>{{ album.name }}</strong>
                <small class="album-card-meta">
                  <span class="album-card-meta-name">{{ album.artist }}</span>
                  <span class="album-card-song-count">{{ album.songCount }} 首歌曲</span>
                </small>
              </button>
            </div>
          </section>
        </div>

        <section
          v-if="tracks.length"
          class="search-result-section search-tracks-section"
          data-testid="search-tracks"
          aria-labelledby="search-tracks-title"
        >
          <header class="search-result-section-header">
            <h2 id="search-tracks-title">歌曲</h2>
            <span>{{ tracks.length }} 首</span>
          </header>
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
      </div>

      <div class="search-pagination">
        <Pagination
          :page="currentPage"
          :items-per-page="SEARCH_PAGE_SIZE"
          :total="paginationTotal"
          :sibling-count="1"
          show-edges
          @update:page="updatePage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious aria-label="上一页" />
            <template v-for="(item, index) in items" :key="index">
              <PaginationItem
                v-if="item.type === 'page'"
                :value="item.value"
                :is-active="item.value === currentPage"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext aria-label="下一页" />
          </PaginationContent>
        </Pagination>
        <p class="settings-help text-center">每页最多显示 25 条同类结果</p>
      </div>
    </div>
  </section>
</template>
