<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import type { AlbumListType, AlbumSummary, TrackSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { useErrorToast } from '../lib/notifications'
import { getAlbum, listAlbums } from '../services/library'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'
import DeferredCoverImage from './DeferredCoverImage.vue'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from './ui/pagination'

const props = withDefaults(defineProps<{
  sessionId: string
  serverName: string
  serverId: string
  listType: AlbumListType
  title: string
  selectedAlbumId: string | null
  page?: number
  backLabel?: string
  albumListEnabled?: boolean
}>(), {
  page: 1,
  backLabel: '返回专辑',
  albumListEnabled: true
})
const emit = defineEmits<{
  'update:selectedAlbumId': [albumId: string | null]
  'update:page': [page: number]
}>()
const player = usePlayerStore()
const { pendingKey, toggleStarred } = useStarredMutation(() => props.sessionId)
const ALBUM_PAGE_SIZE = 30
const libraryRoot = ref<HTMLElement | null>(null)
const albumListScrollTop = ref(0)
const restoreAlbumListScroll = ref(false)
const currentPage = computed(() => Math.max(1, Math.floor(props.page)))
const albumRequestAttempts = new Map<string, number>()

function albumRequestKey(): string {
  return `${props.sessionId}:${props.listType}:${currentPage.value}`
}

async function loadAlbumPage() {
  const requestKey = albumRequestKey()
  const attempt = (albumRequestAttempts.get(requestKey) ?? 0) + 1
  albumRequestAttempts.set(requestKey, attempt)
  const page = await listAlbums({
    sessionId: props.sessionId,
    type: props.listType,
    offset: (currentPage.value - 1) * ALBUM_PAGE_SIZE,
    size: ALBUM_PAGE_SIZE,
    attempt
  })
  albumRequestAttempts.delete(requestKey)
  return page
}

const albumsQuery = useQuery({
  queryKey: computed(() => ['albums', props.sessionId, props.listType, currentPage.value]),
  queryFn: loadAlbumPage,
  enabled: computed(() => props.albumListEnabled !== false),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1
})

const albums = computed<AlbumSummary[]>(() => albumsQuery.data.value?.items ?? [])
const paginationTotal = computed(() => {
  if (albumsQuery.data.value?.hasMore) return currentPage.value * ALBUM_PAGE_SIZE + 1
  return (currentPage.value - 1) * ALBUM_PAGE_SIZE + albums.value.length
})

const albumQuery = useQuery({
  queryKey: computed(() => ['album', props.sessionId, props.selectedAlbumId]),
  queryFn: () => getAlbum(props.sessionId, props.selectedAlbumId ?? ''),
  enabled: computed(() => props.selectedAlbumId !== null),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false
})

useErrorToast(
  () => albumsQuery.isError.value
    ? (albumsQuery.error.value?.message ?? '音乐库加载失败。')
    : null,
  { title: '音乐库加载失败', id: 'albums-query-error' }
)
useErrorToast(
  () => albumQuery.isError.value
    ? (albumQuery.error.value?.message ?? '专辑详情加载失败。')
    : null,
  { title: '专辑详情加载失败', id: 'album-query-error' }
)

function workspaceScroller(): HTMLElement | null {
  return libraryRoot.value?.closest<HTMLElement>('.workspace') ?? null
}

async function openAlbum(album: AlbumSummary): Promise<void> {
  const scroller = workspaceScroller()
  albumListScrollTop.value = scroller?.scrollTop ?? 0
  restoreAlbumListScroll.value = true
  emit('update:selectedAlbumId', album.id)
  await nextTick()
  if (scroller) scroller.scrollTop = 0
}

async function returnToAlbumList(): Promise<void> {
  const scroller = workspaceScroller()
  emit('update:selectedAlbumId', null)
  await nextTick()
  if (scroller && restoreAlbumListScroll.value) {
    scroller.scrollTop = albumListScrollTop.value
  }
  restoreAlbumListScroll.value = false
}

async function updatePage(page: number): Promise<void> {
  const nextPage = Math.max(1, Math.floor(page))
  if (nextPage === currentPage.value) return
  emit('update:page', nextPage)
  await nextTick()
  const scroller = workspaceScroller()
  if (scroller) scroller.scrollTop = 0
}

function refreshCurrentView(): void {
  if (props.selectedAlbumId) {
    void albumQuery.refetch()
    return
  }
  retryAlbumList()
}

function retryAlbumList(): void {
  albumRequestAttempts.delete(albumRequestKey())
  void albumsQuery.refetch()
}

function playTrack(track: TrackSummary): void {
  const tracks = albumQuery.data.value?.tracks ?? [track]
  const startIndex = Math.max(
    0,
    tracks.findIndex((item) => item.id === track.id)
  )
  void player.replaceQueue(
    tracks,
    startIndex,
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
  <section
    ref="libraryRoot"
    :class="selectedAlbumId ? 'album-detail-page' : 'min-h-full'"
    aria-labelledby="library-title"
  >
    <div class="library-page-header mb-8 flex items-end justify-between gap-4">
      <div>
        <p class="eyebrow">LIBRARY</p>
        <h1 id="library-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">
          {{ selectedAlbumId ? '专辑详情' : title }}
        </h1>
        <p class="mt-2 text-sm text-sonavi-muted">{{ serverName }} · 真实 OpenSubsonic 数据</p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          :disabled="selectedAlbumId ? albumQuery.isFetching.value : albumsQuery.isFetching.value"
          @click="refreshCurrentView"
        >
          {{
            (selectedAlbumId ? albumQuery.isFetching.value : albumsQuery.isFetching.value)
              ? '正在刷新…'
              : '刷新'
          }}
        </Button>
        <Button
          v-if="selectedAlbumId && albumQuery.data.value"
          variant="outline"
          :disabled="pendingKey === `album:${albumQuery.data.value.id}`"
          @click="toggleStarred('album', albumQuery.data.value.id, !albumQuery.data.value.starred)"
        >
          {{ albumQuery.data.value.starred ? '取消收藏专辑' : '收藏专辑' }}
        </Button>
        <Button
          v-if="selectedAlbumId"
          variant="outline"
          @click="returnToAlbumList"
        >
          {{ backLabel }}
        </Button>
      </div>
    </div>

    <template v-if="selectedAlbumId">
      <p v-if="albumQuery.isPending.value" role="status">正在读取专辑…</p>
      <div
        v-else-if="albumQuery.isError.value"
        class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
        role="alert"
      >
        <p>{{ albumQuery.error.value?.message ?? '专辑详情加载失败。' }}</p>
        <Button class="mt-4" size="sm" @click="albumQuery.refetch()">重试</Button>
      </div>
      <div v-else-if="albumQuery.data.value" class="album-detail-layout">
        <div class="album-detail-summary">
          <img
            v-if="albumQuery.data.value.coverUrl"
            :src="albumQuery.data.value.coverUrl"
            :alt="`${albumQuery.data.value.name} 封面`"
            class="aspect-square w-full rounded-2xl bg-sonavi-border object-cover shadow-lg"
          />
          <div v-else class="aspect-square rounded-2xl bg-sonavi-border" aria-hidden="true" />
          <h2 class="mt-4 text-xl font-semibold">{{ albumQuery.data.value.name }}</h2>
          <p class="text-sm text-sonavi-muted">{{ albumQuery.data.value.artist }}</p>
        </div>

        <ol
          class="album-track-list rounded-2xl border border-sonavi-border bg-sonavi-raised"
          aria-label="歌曲列表"
          tabindex="0"
        >
          <li
            v-for="(track, index) in albumQuery.data.value.tracks"
            :key="track.id"
            class="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-sonavi-border px-4 py-3 last:border-b-0"
          >
            <span class="text-xs text-sonavi-muted">{{ track.track ?? index + 1 }}</span>
            <span class="min-w-0">
              <strong class="block truncate text-sm">{{ track.title }}</strong>
              <small class="block truncate text-sonavi-muted">{{ track.artist }}</small>
            </span>
            <span class="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                :disabled="pendingKey === `track:${track.id}`"
                @click="toggleStarred('track', track.id, !track.starred)"
              >
                {{ track.starred ? '取消收藏' : '收藏' }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :aria-label="`加入队列 ${track.title}`"
                @click="appendTrack(track)"
              >
                加入队列
              </Button>
              <Button size="sm" :aria-label="`播放 ${track.title}`" @click="playTrack(track)">
                播放
              </Button>
            </span>
          </li>
        </ol>
      </div>
    </template>

    <p v-else-if="albumsQuery.isPending.value" role="status">正在读取音乐库…</p>
    <div
      v-else-if="albumsQuery.isError.value && albums.length === 0"
      class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
      role="alert"
    >
      <p>{{ albumsQuery.error.value?.message ?? '音乐库加载失败。' }}</p>
      <Button class="mt-4" size="sm" @click="retryAlbumList">重试</Button>
    </div>

    <template v-else>
      <p v-if="albums.length === 0" class="text-sm text-sonavi-muted">音乐库中暂无专辑。</p>
      <div v-else class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        <button
          v-for="album in albums"
          :key="album.id"
          type="button"
          class="album-card group"
          @click="openAlbum(album)"
        >
          <DeferredCoverImage
            v-if="album.coverUrl"
            :src="album.coverUrl"
            :alt="`${album.name} 封面`"
            image-class="aspect-square w-full rounded-xl bg-sonavi-border object-cover"
            placeholder-class="aspect-square rounded-xl bg-sonavi-border"
          />
          <div v-else class="aspect-square rounded-xl bg-sonavi-border" aria-hidden="true" />
          <strong class="mt-3 block truncate">{{ album.name }}</strong>
          <small class="album-card-meta">
            <span class="album-card-meta-name">{{ album.artist }}</span>
            <span class="album-card-song-count">{{ album.songCount }} 首歌曲</span>
          </small>
        </button>
      </div>
      <div v-if="albums.length > 0" class="mt-8 space-y-3">
        <Pagination
          :page="currentPage"
          :items-per-page="ALBUM_PAGE_SIZE"
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
        <p class="text-center text-xs text-sonavi-muted">
          第 {{ currentPage }} 页 · 本页 {{ albums.length }} 张专辑
        </p>
      </div>
    </template>
  </section>
</template>
