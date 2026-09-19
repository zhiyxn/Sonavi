<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { ArtistSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { useErrorToast } from '../lib/notifications'
import { getArtist, listArtists } from '../services/library'
import { Button } from './ui/button'
import VirtualArtistList from './VirtualArtistList.vue'

const props = withDefaults(defineProps<{
  sessionId: string
  selectedArtistId: string | null
  listScrollTop?: number
}>(), {
  listScrollTop: 0
})
const emit = defineEmits<{
  'update:selectedArtistId': [artistId: string | null]
  'update:listScrollTop': [scrollTop: number]
  openAlbum: [albumId: string]
}>()
const { pendingKey, toggleStarred } = useStarredMutation(() => props.sessionId)

const artistsQuery = useQuery({
  queryKey: computed(() => ['artists', props.sessionId]),
  queryFn: () => listArtists(props.sessionId),
  retry: false,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false
})

const artists = computed(() =>
  (artistsQuery.data.value?.indexes ?? []).flatMap((index) => index.artists)
)

const artistQuery = useQuery({
  queryKey: computed(() => ['artist', props.sessionId, props.selectedArtistId]),
  queryFn: () => getArtist(props.sessionId, props.selectedArtistId ?? ''),
  enabled: computed(() => props.selectedArtistId !== null),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false
})

useErrorToast(
  () => artistsQuery.isError.value
    ? (artistsQuery.error.value?.message ?? '艺术家列表加载失败。')
    : null,
  { title: '艺术家列表加载失败', id: 'artists-query-error' }
)
useErrorToast(
  () => artistQuery.isError.value
    ? (artistQuery.error.value?.message ?? '艺术家详情加载失败。')
    : null,
  { title: '艺术家详情加载失败', id: 'artist-query-error' }
)

function openArtist(artist: ArtistSummary): void {
  emit('update:selectedArtistId', artist.id)
}

function refreshCurrentView(): void {
  if (props.selectedArtistId) {
    void artistQuery.refetch()
    return
  }
  void artistsQuery.refetch()
}
</script>

<template>
  <section
    class="artists-page min-h-full"
    :class="{ 'artists-list-page': !selectedArtistId }"
    aria-labelledby="artists-title"
  >
    <div class="artists-page-header mb-8 flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="eyebrow">ARTISTS</p>
        <h1 id="artists-title" class="mt-4 truncate text-4xl font-medium tracking-[-0.04em]">
          {{ selectedArtistId ? (artistQuery.data.value?.name ?? '艺术家详情') : '艺术家' }}
        </h1>
        <p class="mt-2 text-sm text-sonavi-muted">按服务器提供的索引浏览</p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          :disabled="selectedArtistId ? artistQuery.isFetching.value : artistsQuery.isFetching.value"
          @click="refreshCurrentView"
        >
          {{
            (selectedArtistId ? artistQuery.isFetching.value : artistsQuery.isFetching.value)
              ? '正在刷新…'
              : '刷新'
          }}
        </Button>
        <Button
          v-if="selectedArtistId && artistQuery.data.value"
          variant="outline"
          :disabled="pendingKey === `artist:${artistQuery.data.value.id}`"
          @click="toggleStarred('artist', artistQuery.data.value.id, !artistQuery.data.value.starred)"
        >
          {{ artistQuery.data.value.starred ? '取消收藏' : '收藏艺术家' }}
        </Button>
        <Button
          v-if="selectedArtistId"
          variant="outline"
          @click="emit('update:selectedArtistId', null)"
        >
          返回艺术家
        </Button>
      </div>
    </div>

    <template v-if="selectedArtistId">
      <p v-if="artistQuery.isPending.value" role="status">正在读取艺术家…</p>
      <div
        v-else-if="artistQuery.isError.value"
        class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
        role="alert"
      >
        <p>{{ artistQuery.error.value?.message ?? '艺术家加载失败。' }}</p>
        <Button class="mt-4" size="sm" @click="artistQuery.refetch()">重试</Button>
      </div>
      <div v-else-if="artistQuery.data.value">
        <div class="mb-8 flex items-center gap-5">
          <img
            v-if="artistQuery.data.value.coverUrl"
            :src="artistQuery.data.value.coverUrl"
            :alt="`${artistQuery.data.value.name} 封面`"
            class="h-28 w-28 rounded-full bg-sonavi-border object-cover"
          />
          <div v-else class="h-28 w-28 rounded-full bg-sonavi-border" aria-hidden="true" />
          <p class="text-sm text-sonavi-muted">
            {{ artistQuery.data.value.albumCount }} 张专辑
          </p>
        </div>
        <p v-if="artistQuery.data.value.albums.length === 0" class="text-sonavi-muted">
          该艺术家暂无专辑。
        </p>
        <div v-else class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          <button
            v-for="album in artistQuery.data.value.albums"
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
            <small>{{ album.year ?? '年份未知' }}</small>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="artistsQuery.isPending.value" role="status">正在读取艺术家列表…</p>
      <div
        v-else-if="artistsQuery.isError.value"
        class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
        role="alert"
      >
        <p>{{ artistsQuery.error.value?.message ?? '艺术家列表加载失败。' }}</p>
        <Button class="mt-4" size="sm" @click="artistsQuery.refetch()">重试</Button>
      </div>
      <p v-else-if="artists.length === 0" class="text-sonavi-muted">音乐库中暂无艺术家。</p>
      <VirtualArtistList
        v-else
        :artists="artists"
        :scroll-top="listScrollTop"
        @select="openArtist"
        @update:scroll-top="emit('update:listScrollTop', $event)"
      />
    </template>
  </section>
</template>
