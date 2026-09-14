<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { ArtistSummary } from '../../../shared/library'
import { getArtist, listArtists } from '../services/library'
import { Button } from './ui/button'
import VirtualArtistList from './VirtualArtistList.vue'

const props = defineProps<{
  sessionId: string
  selectedArtistId: string | null
}>()
const emit = defineEmits<{
  'update:selectedArtistId': [artistId: string | null]
  openAlbum: [albumId: string]
}>()

const artistsQuery = useQuery({
  queryKey: computed(() => ['artists', props.sessionId]),
  queryFn: () => listArtists(props.sessionId),
  staleTime: 30_000
})

const artists = computed(() =>
  (artistsQuery.data.value?.indexes ?? []).flatMap((index) => index.artists)
)

const artistQuery = useQuery({
  queryKey: computed(() => ['artist', props.sessionId, props.selectedArtistId]),
  queryFn: () => getArtist(props.sessionId, props.selectedArtistId ?? ''),
  enabled: computed(() => props.selectedArtistId !== null),
  staleTime: 30_000
})

function openArtist(artist: ArtistSummary): void {
  emit('update:selectedArtistId', artist.id)
}
</script>

<template>
  <section class="min-h-full" aria-labelledby="artists-title">
    <div class="mb-8 flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="eyebrow">05 / ARTISTS</p>
        <h1 id="artists-title" class="mt-4 truncate text-4xl font-medium tracking-[-0.04em]">
          {{ selectedArtistId ? (artistQuery.data.value?.name ?? '艺术家详情') : '艺术家' }}
        </h1>
        <p class="mt-2 text-sm text-sonavi-muted">按服务器提供的索引浏览</p>
      </div>
      <Button
        v-if="selectedArtistId"
        variant="outline"
        @click="emit('update:selectedArtistId', null)"
      >
        返回艺术家
      </Button>
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
      <VirtualArtistList v-else :artists="artists" @select="openArtist" />
    </template>
  </section>
</template>
