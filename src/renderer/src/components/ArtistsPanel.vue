<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import type { ArtistSummary } from '../../../shared/library'
import { useStarredMutation } from '../composables/use-starred-mutation'
import { useErrorToast } from '../lib/notifications'
import { getArtist, searchLibrary } from '../services/library'
import { Button } from './ui/button'
import { Input } from './ui/input'
import ArtistList from './ArtistList.vue'
import DeferredCoverImage from './DeferredCoverImage.vue'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from './ui/pagination'
import { t } from '../i18n'

const props = withDefaults(defineProps<{
  sessionId: string
  selectedArtistId: string | null
  artistListEnabled?: boolean
}>(), {
  artistListEnabled: true
})
const emit = defineEmits<{
  'update:selectedArtistId': [artistId: string | null]
  openAlbum: [albumId: string]
}>()
const { pendingKey, toggleStarred } = useStarredMutation(() => props.sessionId)
const input = ref('')
const submittedQuery = ref('')
const page = ref(1)
const searchForm = ref<HTMLElement | null>(null)
const PAGE_SIZE = 50

const artistsQuery = useQuery({
  queryKey: computed(() => ['search', props.sessionId, 'artists', submittedQuery.value, page.value]),
  queryFn: ({ signal }) => searchLibrary({
    sessionId: props.sessionId,
    query: submittedQuery.value,
    artistOffset: (page.value - 1) * PAGE_SIZE,
    albumOffset: 0,
    trackOffset: 0,
    artistCount: PAGE_SIZE,
    albumCount: 0,
    trackCount: 0
  }, signal),
  enabled: computed(() => props.artistListEnabled),
  retry: false,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey[3] === submittedQuery.value ? previousData : undefined,
  refetchOnMount: false,
  refetchOnWindowFocus: false
})

const artists = computed<ArtistSummary[]>(() => artistsQuery.data.value?.artists ?? [])
const paginationTotal = computed(() => {
  if (artistsQuery.data.value?.artistHasMore) return page.value * PAGE_SIZE + 1
  return (page.value - 1) * PAGE_SIZE + Math.max(1, artists.value.length)
})

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

function submitSearch(): void {
  const nextQuery = input.value.trim()
  if (nextQuery === submittedQuery.value) {
    void artistsQuery.refetch()
    return
  }
  page.value = 1
  submittedQuery.value = nextQuery
}

function handleSearchEnter(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  submitSearch()
}

async function updatePage(next: number): Promise<void> {
  const nextPage = Math.max(1, Math.floor(next))
  if (nextPage === page.value || artistsQuery.isFetching.value) return
  page.value = nextPage
  await nextTick()
  searchForm.value?.scrollIntoView?.({ block: 'start' })
}
</script>

<template>
  <section class="artists-page min-h-full" aria-labelledby="artists-title">
    <div class="artists-page-header mb-8 flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="eyebrow">ARTISTS</p>
        <h1 id="artists-title" class="mt-4 truncate text-4xl font-medium tracking-[-0.04em]">
          {{ selectedArtistId ? (artistQuery.data.value?.name ?? t('艺术家详情')) : t('艺术家') }}
        </h1>
        <p class="mt-2 text-sm text-sonavi-muted">{{ t('按服务器分页浏览') }}</p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          :disabled="selectedArtistId ? artistQuery.isFetching.value : artistsQuery.isFetching.value"
          @click="refreshCurrentView"
        >
          {{
            (selectedArtistId ? artistQuery.isFetching.value : artistsQuery.isFetching.value)
              ? t('正在刷新…')
              : t('刷新')
          }}
        </Button>
        <Button
          v-if="selectedArtistId && artistQuery.data.value"
          variant="outline"
          :disabled="pendingKey === `artist:${artistQuery.data.value.id}`"
          :aria-label="t(artistQuery.data.value.starred ? '取消收藏 {title}' : '收藏 {title}', { title: artistQuery.data.value.name })"
          :aria-pressed="artistQuery.data.value.starred"
          @click="toggleStarred('artist', artistQuery.data.value.id, !artistQuery.data.value.starred)"
        >
          {{ t(artistQuery.data.value.starred ? '取消收藏' : '收藏艺术家') }}
        </Button>
        <Button
          v-if="selectedArtistId"
          variant="outline"
          @click="emit('update:selectedArtistId', null)"
        >
          {{ t('返回') }}
        </Button>
      </div>
    </div>

    <form
      v-if="!selectedArtistId && artistListEnabled"
      ref="searchForm"
      class="search-form search-form-sticky artists-search-form"
      role="search"
      @submit.prevent="submitSearch"
    >
      <label class="search-field">
        <span class="sr-only">{{ t('搜索艺术家') }}</span>
        <Input
          v-model="input"
          type="search"
          maxlength="200"
          autocomplete="off"
          :placeholder="t('搜索艺术家')"
          @keydown.enter="handleSearchEnter"
        />
      </label>
      <Button type="submit">{{ t('搜索') }}</Button>
    </form>

    <template v-if="selectedArtistId">
      <p v-if="artistQuery.isPending.value" role="status">{{ t('正在读取艺术家…') }}</p>
      <div
        v-else-if="artistQuery.isError.value"
        class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
        role="alert"
      >
        <p>{{ t(artistQuery.error.value?.message ?? '艺术家加载失败。') }}</p>
        <Button class="mt-4" size="sm" @click="artistQuery.refetch()">{{ t('重试') }}</Button>
      </div>
      <div v-else-if="artistQuery.data.value">
        <div class="mb-8 flex items-center gap-5">
          <img
            v-if="artistQuery.data.value.coverUrl"
            :src="artistQuery.data.value.coverUrl"
            :alt="t('{name} 封面', { name: artistQuery.data.value.name })"
            class="h-28 w-28 rounded-full bg-sonavi-border object-cover"
          />
          <div v-else class="h-28 w-28 rounded-full bg-sonavi-border" aria-hidden="true" />
          <p class="text-sm text-sonavi-muted">
            {{ t('{count} 张专辑', { count: artistQuery.data.value.albumCount }) }}
          </p>
        </div>
        <p v-if="artistQuery.data.value.albums.length === 0" class="text-sonavi-muted">
          {{ t('该艺术家暂无专辑。') }}
        </p>
        <div v-else class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          <button
            v-for="album in artistQuery.data.value.albums"
            :key="album.id"
            type="button"
            class="album-card"
            @click="emit('openAlbum', album.id)"
          >
            <DeferredCoverImage
              v-if="album.coverUrl"
              :src="album.coverUrl"
              :alt="t('{name} 封面', { name: album.name })"
              image-class="album-cover-image"
              placeholder-class="album-cover-placeholder"
            />
            <span v-else class="album-cover-placeholder" aria-hidden="true" />
            <strong>{{ album.name }}</strong>
            <small class="album-card-meta">
              <span class="album-card-meta-name">{{ album.year ?? t('年份未知') }}</span>
              <span class="album-card-song-count">{{ t('{count} 首歌曲', { count: album.songCount }) }}</span>
            </small>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="artistsQuery.isPending.value" role="status">{{ t('正在读取艺术家列表…') }}</p>
      <div
        v-else-if="artistsQuery.isError.value"
        class="rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
        role="alert"
      >
        <p>{{ t(artistsQuery.error.value?.message ?? '艺术家列表加载失败。') }}</p>
        <Button class="mt-4" size="sm" @click="artistsQuery.refetch()">{{ t('重试') }}</Button>
      </div>
      <p v-else-if="artists.length === 0" class="text-sonavi-muted">
        {{ submittedQuery ? t('没有找到“{query}”的艺术家。', { query: submittedQuery }) : t('音乐库中暂无艺术家。') }}
      </p>
      <ArtistList
        v-else
        :artists="artists"
        @select="openArtist"
      />
      <div
        v-if="artists.length > 0 || page > 1"
        class="search-pagination artists-pagination"
        data-testid="artists-pagination"
      >
        <Pagination
          :page="page"
          :items-per-page="PAGE_SIZE"
          :total="paginationTotal"
          :sibling-count="1"
          show-edges
          @update:page="updatePage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious :aria-label="t('艺术家上一页')" />
            <template v-for="(item, index) in items" :key="index">
              <PaginationItem
                v-if="item.type === 'page'"
                :value="item.value"
                :is-active="item.value === page"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext :aria-label="t('艺术家下一页')" />
          </PaginationContent>
        </Pagination>
        <p class="settings-help text-center">
          {{ submittedQuery
            ? t('“{query}” · 第 {page} 页 · 本页 {count} 位艺术家', { query: submittedQuery, page, count: artists.length })
            : t('第 {page} 页 · 本页 {count} 位艺术家', { page, count: artists.length }) }}
        </p>
      </div>
    </template>
  </section>
</template>
