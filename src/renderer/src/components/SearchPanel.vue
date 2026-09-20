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
import DeferredCoverImage from './DeferredCoverImage.vue'
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
const albumPage = ref(1)
const trackPage = ref(1)
const albumSection = ref<HTMLElement | null>(null)
const trackSection = ref<HTMLElement | null>(null)

const searchQuery = useQuery({
  queryKey: computed(() => [
    'search',
    props.sessionId,
    submittedQuery.value,
    albumPage.value,
    trackPage.value
  ]),
  queryFn: ({ signal }) => searchLibrary(
    props.sessionId,
    submittedQuery.value,
    (albumPage.value - 1) * SEARCH_PAGE_SIZE,
    (trackPage.value - 1) * SEARCH_PAGE_SIZE,
    SEARCH_PAGE_SIZE,
    signal
  ),
  enabled: computed(() => submittedQuery.value.length > 0),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey[2] === submittedQuery.value ? previousData : undefined,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: false
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
    albumPage.value = 1
    trackPage.value = 1
    return
  }
  if (nextQuery === submittedQuery.value) {
    void searchQuery.refetch()
    return
  }
  albumPage.value = 1
  trackPage.value = 1
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
  () => artists.value.length > 0 || albums.value.length > 0 || tracks.value.length > 0 ||
    albumPage.value > 1 || trackPage.value > 1
)
const albumPaginationTotal = computed(() => {
  if (searchQuery.data.value?.albumHasMore) return albumPage.value * SEARCH_PAGE_SIZE + 1
  return (albumPage.value - 1) * SEARCH_PAGE_SIZE + Math.max(1, albums.value.length)
})
const trackPaginationTotal = computed(() => {
  if (searchQuery.data.value?.trackHasMore) return trackPage.value * SEARCH_PAGE_SIZE + 1
  return (trackPage.value - 1) * SEARCH_PAGE_SIZE + Math.max(1, tracks.value.length)
})
const albumPageLoading = computed(
  () => searchQuery.isPlaceholderData.value &&
    searchQuery.data.value?.albumNextOffset !== albumPage.value * SEARCH_PAGE_SIZE
)
const trackPageLoading = computed(
  () => searchQuery.isPlaceholderData.value &&
    searchQuery.data.value?.trackNextOffset !== trackPage.value * SEARCH_PAGE_SIZE
)

async function updateAlbumPage(page: number): Promise<void> {
  const nextPage = Math.max(1, Math.floor(page))
  if (nextPage === albumPage.value || searchQuery.isFetching.value) return
  albumPage.value = nextPage
  await nextTick()
  albumSection.value?.scrollIntoView?.({ block: 'start' })
}

async function updateTrackPage(page: number): Promise<void> {
  const nextPage = Math.max(1, Math.floor(page))
  if (nextPage === trackPage.value || searchQuery.isFetching.value) return
  trackPage.value = nextPage
  await nextTick()
  trackSection.value?.scrollIntoView?.({ block: 'start' })
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
  <section class="min-h-full" aria-labelledby="search-title">
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
        <span>{{ artists.length }} 位艺术家 · 专辑第 {{ albumPage }} 页（{{ albumPageLoading ? '加载中' : `${albums.length} 张` }}） · 歌曲第 {{ trackPage }} 页（{{ trackPageLoading ? '加载中' : `${tracks.length} 首` }}）</span>
      </div>

      <div class="search-results-layout">
        <div v-if="artists.length || albums.length || albumPage > 1" class="search-discovery-column">
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
            v-if="albums.length || albumPage > 1"
            ref="albumSection"
            class="search-result-section search-albums-section"
            data-testid="search-albums"
            aria-labelledby="search-albums-title"
          >
            <header class="search-result-section-header">
              <h2 id="search-albums-title">专辑</h2>
              <span>{{ albumPageLoading ? '加载中' : `${albums.length} 张` }}</span>
            </header>
            <p v-if="albumPageLoading" class="settings-help" role="status">
              正在加载专辑第 {{ albumPage }} 页…
            </p>
            <div v-else class="search-album-grid">
              <button
                v-for="album in albums"
                :key="album.id"
                type="button"
                class="album-card"
                @click="emit('openAlbum', album.id)"
              >
                <DeferredCoverImage
                  v-if="album.coverUrl"
                  :src="album.coverUrl"
                  :alt="`${album.name} 封面`"
                  image-class="album-cover-image"
                  placeholder-class="album-cover-placeholder"
                />
                <span v-else class="album-cover-placeholder" aria-hidden="true" />
                <strong>{{ album.name }}</strong>
                <small class="album-card-meta">
                  <span class="album-card-meta-name">{{ album.artist }}</span>
                  <span class="album-card-song-count">{{ album.songCount }} 首歌曲</span>
                </small>
              </button>
            </div>
            <p v-if="!albumPageLoading && !albums.length" class="settings-help">这一页没有专辑。</p>
            <div class="search-pagination" data-testid="search-albums-pagination">
              <Pagination
                :page="albumPage"
                :items-per-page="SEARCH_PAGE_SIZE"
                :total="albumPaginationTotal"
                :sibling-count="1"
                show-edges
                @update:page="updateAlbumPage"
              >
                <PaginationContent v-slot="{ items }">
                  <PaginationPrevious aria-label="专辑上一页" />
                  <template v-for="(item, index) in items" :key="index">
                    <PaginationItem
                      v-if="item.type === 'page'"
                      :value="item.value"
                      :is-active="item.value === albumPage"
                    >
                      {{ item.value }}
                    </PaginationItem>
                    <PaginationEllipsis v-else :index="index" />
                  </template>
                  <PaginationNext aria-label="专辑下一页" />
                </PaginationContent>
              </Pagination>
              <p class="settings-help text-center">专辑每页最多显示 25 张</p>
            </div>
          </section>
        </div>

        <section
          v-if="tracks.length || trackPage > 1"
          ref="trackSection"
          class="search-result-section search-tracks-section"
          data-testid="search-tracks"
          aria-labelledby="search-tracks-title"
        >
          <header class="search-result-section-header">
            <h2 id="search-tracks-title">歌曲</h2>
            <span>{{ trackPageLoading ? '加载中' : `${tracks.length} 首` }}</span>
          </header>
          <p v-if="trackPageLoading" class="settings-help" role="status">
            正在加载歌曲第 {{ trackPage }} 页…
          </p>
          <ol v-else class="track-results">
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
          <p v-if="!trackPageLoading && !tracks.length" class="settings-help">这一页没有歌曲。</p>
          <div class="search-pagination" data-testid="search-tracks-pagination">
            <Pagination
              :page="trackPage"
              :items-per-page="SEARCH_PAGE_SIZE"
              :total="trackPaginationTotal"
              :sibling-count="1"
              show-edges
              @update:page="updateTrackPage"
            >
              <PaginationContent v-slot="{ items }">
                <PaginationPrevious aria-label="歌曲上一页" />
                <template v-for="(item, index) in items" :key="index">
                  <PaginationItem
                    v-if="item.type === 'page'"
                    :value="item.value"
                    :is-active="item.value === trackPage"
                  >
                    {{ item.value }}
                  </PaginationItem>
                  <PaginationEllipsis v-else :index="index" />
                </template>
                <PaginationNext aria-label="歌曲下一页" />
              </PaginationContent>
            </Pagination>
            <p class="settings-help text-center">歌曲每页最多显示 25 首</p>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
