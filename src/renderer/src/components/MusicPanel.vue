<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import { Heart } from '@lucide/vue'
import type { TrackSummary } from '../../../shared/library'
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
import { t } from '../i18n'

const props = defineProps<{ sessionId: string; serverId: string }>()
const player = usePlayerStore()
const { pendingKey, toggleStarred } = useStarredMutation(() => props.sessionId)
const input = ref('')
const submittedQuery = ref('')
const page = ref(1)
const pageSection = ref<HTMLElement | null>(null)
const PAGE_SIZE = 30

const tracksQuery = useQuery({
  queryKey: computed(() => ['search', props.sessionId, 'music', submittedQuery.value, page.value]),
  queryFn: ({ signal }) => searchLibrary({
    sessionId: props.sessionId,
    query: submittedQuery.value,
    artistOffset: 0,
    albumOffset: 0,
    trackOffset: (page.value - 1) * PAGE_SIZE,
    artistCount: 0,
    albumCount: 0,
    trackCount: PAGE_SIZE
  }, signal),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey[3] === submittedQuery.value ? previousData : undefined,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: false
})

const tracks = computed<TrackSummary[]>(() => tracksQuery.data.value?.tracks ?? [])
const paginationTotal = computed(() => {
  if (tracksQuery.data.value?.trackHasMore) return page.value * PAGE_SIZE + 1
  return (page.value - 1) * PAGE_SIZE + Math.max(1, tracks.value.length)
})
const pageLoading = computed(
  () => tracksQuery.isPlaceholderData.value &&
    tracksQuery.data.value?.trackNextOffset !== page.value * PAGE_SIZE
)

useErrorToast(
  () => tracksQuery.isError.value
    ? (tracksQuery.error.value?.message ?? '音乐列表加载失败。')
    : null,
  { title: '音乐列表加载失败', id: 'music-query-error' }
)

function submitSearch(): void {
  const nextQuery = input.value.trim()
  if (nextQuery === submittedQuery.value) {
    void tracksQuery.refetch()
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
  if (nextPage === page.value || tracksQuery.isFetching.value) return
  page.value = nextPage
  await nextTick()
  pageSection.value?.scrollIntoView?.({ block: 'start' })
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
  <section ref="pageSection" class="min-h-full" aria-labelledby="music-title">
    <p class="eyebrow">MUSIC</p>
    <h1 id="music-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">{{ t('音乐') }}</h1>
    <form class="search-form search-form-sticky" role="search" @submit.prevent="submitSearch">
      <label class="search-field">
        <span class="sr-only">{{ t('搜索歌曲') }}</span>
        <Input
          v-model="input"
          type="search"
          maxlength="200"
          autocomplete="off"
          :placeholder="t('搜索歌曲')"
          @keydown.enter="handleSearchEnter"
        />
      </label>
      <Button type="submit">{{ t('搜索') }}</Button>
      <Button
        type="button"
        variant="outline"
        :disabled="tracksQuery.isFetching.value"
        @click="tracksQuery.refetch()"
      >
        {{ t(tracksQuery.isFetching.value ? '正在刷新…' : '刷新') }}
      </Button>
    </form>

    <p v-if="tracksQuery.isPending.value" class="mt-5" role="status">{{ t('正在读取音乐…') }}</p>
    <div
      v-else-if="tracksQuery.isError.value"
      class="mt-6 rounded-2xl border border-sonavi-border bg-sonavi-raised p-6"
      role="alert"
    >
      <p>{{ t(tracksQuery.error.value?.message ?? '音乐列表加载失败。') }}</p>
      <Button class="mt-4" size="sm" @click="tracksQuery.refetch()">{{ t('重试') }}</Button>
    </div>
    <template v-else>
      <p v-if="tracks.length === 0" class="mt-6 text-sonavi-muted">
        {{ submittedQuery ? t('没有找到“{query}”的歌曲。', { query: submittedQuery }) : t('音乐库中暂无歌曲。') }}
      </p>
      <template v-else>
        <header class="search-result-section-header mt-8">
          <h2>{{ submittedQuery ? t('“{query}”的歌曲', { query: submittedQuery }) : t('全部歌曲') }}</h2>
          <span>{{ pageLoading ? t('第 {page} 页 · 加载中', { page }) : t('第 {page} 页 · {count} 首', { page, count: tracks.length }) }}</span>
        </header>
        <p v-if="pageLoading" class="settings-help" role="status">{{ t('正在加载歌曲第 {page} 页…', { page }) }}</p>
        <ol v-else class="track-results mt-4">
          <li v-for="track in tracks" :key="track.id">
            <span class="min-w-0">
              <strong>{{ track.title }}</strong>
              <small>{{ track.artist }} · {{ track.album }}</small>
            </span>
            <span class="flex gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="pendingKey === `track:${track.id}`"
                :aria-label="t(track.starred ? '取消收藏 {title}' : '收藏 {title}', { title: track.title })"
                :aria-pressed="track.starred"
                @click="toggleStarred('track', track.id, !track.starred)"
              >
                <Heart
                  :size="17"
                  :fill="track.starred ? 'currentColor' : 'none'"
                  :class="{ 'text-[var(--sonavi-accent)]': track.starred }"
                  aria-hidden="true"
                />
              </Button>
              <Button variant="outline" size="sm" @click="appendTrack(track)">{{ t('加入队列') }}</Button>
              <Button size="sm" @click="playTrack(track)">{{ t('播放') }}</Button>
            </span>
          </li>
        </ol>
      </template>
      <div v-if="tracks.length > 0 || page > 1" class="search-pagination" data-testid="music-pagination">
        <Pagination
          :page="page"
          :items-per-page="PAGE_SIZE"
          :total="paginationTotal"
          :sibling-count="1"
          show-edges
          @update:page="updatePage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious :aria-label="t('歌曲上一页')" />
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
            <PaginationNext :aria-label="t('歌曲下一页')" />
          </PaginationContent>
        </Pagination>
        <p class="settings-help text-center">{{ t('歌曲每页最多显示 30 首') }}</p>
      </div>
    </template>
  </section>
</template>
