<script setup lang="ts">
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { AlbumListType, AlbumSummary, TrackSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { getAlbum, listAlbums } from '../services/library'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'

const props = defineProps<{
  sessionId: string
  serverName: string
  serverId: string
  listType: AlbumListType
  title: string
  selectedAlbumId: string | null
}>()
const emit = defineEmits<{
  forget: []
  'update:selectedAlbumId': [albumId: string | null]
}>()
const player = usePlayerStore()
const { errorMessage: starredError, pendingKey, toggleStarred } = useStarredMutation(
  () => props.sessionId
)
const ALBUM_PAGE_SIZE = 30

const albumsQuery = useInfiniteQuery({
  queryKey: computed(() => ['albums', props.sessionId, props.listType]),
  queryFn: ({ pageParam }) =>
    listAlbums({
      sessionId: props.sessionId,
      type: props.listType,
      offset: pageParam,
      size: ALBUM_PAGE_SIZE
    }),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
  staleTime: 30_000
})

const albums = computed(() => {
  const uniqueAlbums = new Map<string, AlbumSummary>()
  for (const page of albumsQuery.data.value?.pages ?? []) {
    for (const album of page.items) uniqueAlbums.set(album.id, album)
  }
  return [...uniqueAlbums.values()]
})

const albumQuery = useQuery({
  queryKey: computed(() => ['album', props.sessionId, props.selectedAlbumId]),
  queryFn: () => getAlbum(props.sessionId, props.selectedAlbumId ?? ''),
  enabled: computed(() => props.selectedAlbumId !== null),
  staleTime: 30_000
})

function openAlbum(album: AlbumSummary): void {
  emit('update:selectedAlbumId', album.id)
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
  <section class="min-h-full" aria-labelledby="library-title">
    <div class="mb-8 flex items-end justify-between gap-4">
      <div>
        <p class="eyebrow">03 / LIBRARY</p>
        <h1 id="library-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">
          {{ selectedAlbumId ? '专辑详情' : title }}
        </h1>
        <p class="mt-2 text-sm text-sonavi-muted">{{ serverName }} · 真实 OpenSubsonic 数据</p>
      </div>
      <div class="flex gap-2">
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
          @click="emit('update:selectedAlbumId', null)"
        >
          返回专辑
        </Button>
        <Button variant="ghost" @click="emit('forget')">退出并忘记账号</Button>
      </div>
    </div>

    <p v-if="albumsQuery.isPending.value" role="status">正在读取音乐库…</p>
    <div
      v-else-if="albumsQuery.isError.value && albums.length === 0"
      class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
      role="alert"
    >
      <p>{{ albumsQuery.error.value?.message ?? '音乐库加载失败。' }}</p>
      <Button class="mt-4" size="sm" @click="albumsQuery.refetch()">重试</Button>
    </div>

    <template v-else-if="selectedAlbumId">
      <p v-if="albumQuery.isPending.value" role="status">正在读取专辑…</p>
      <div v-else-if="albumQuery.data.value" class="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div>
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

        <ol class="overflow-hidden rounded-2xl border border-sonavi-border bg-sonavi-raised">
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

    <template v-else>
      <p v-if="albums.length === 0" class="text-sm text-sonavi-muted">音乐库中暂无专辑。</p>
      <div v-else class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        <button
          v-for="album in albums"
          :key="album.id"
          type="button"
          class="group min-w-0 rounded-2xl border border-sonavi-border bg-sonavi-raised p-3 text-left transition hover:-translate-y-0.5 hover:border-sonavi-accent"
          @click="openAlbum(album)"
        >
          <img
            v-if="album.coverUrl"
            :src="album.coverUrl"
            :alt="`${album.name} 封面`"
            class="aspect-square w-full rounded-xl bg-sonavi-border object-cover"
          />
          <div v-else class="aspect-square rounded-xl bg-sonavi-border" aria-hidden="true" />
          <strong class="mt-3 block truncate">{{ album.name }}</strong>
          <span class="block truncate text-xs text-sonavi-muted">{{ album.artist }}</span>
        </button>
      </div>
      <div
        v-if="albumsQuery.isError.value"
        class="mt-8 rounded-2xl border border-sonavi-border bg-sonavi-raised p-4 text-center"
        role="alert"
      >
        <p>下一页加载失败，已加载的 {{ albums.length }} 张专辑仍可使用。</p>
        <Button class="mt-3" size="sm" variant="outline" @click="albumsQuery.fetchNextPage()">
          重试加载
        </Button>
      </div>
      <div v-else-if="albumsQuery.hasNextPage.value" class="mt-8 flex justify-center">
        <Button
          variant="outline"
          :disabled="albumsQuery.isFetchingNextPage.value"
          @click="albumsQuery.fetchNextPage()"
        >
          {{ albumsQuery.isFetchingNextPage.value ? '正在加载…' : '加载更多专辑' }}
        </Button>
      </div>
      <p v-else-if="albums.length > 0" class="mt-8 text-center text-xs text-sonavi-muted">
        已加载全部 {{ albums.length }} 张专辑
      </p>
    </template>
    <p v-if="starredError" class="mutation-error" role="alert">{{ starredError }}</p>
  </section>
</template>
