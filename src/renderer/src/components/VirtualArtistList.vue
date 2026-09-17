<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ArtistSummary } from '../../../shared/library'

const props = withDefaults(defineProps<{ artists: ArtistSummary[]; scrollTop?: number }>(), {
  scrollTop: 0
})
const emit = defineEmits<{
  select: [artist: ArtistSummary]
  'update:scrollTop': [scrollTop: number]
}>()
const currentScrollTop = ref(props.scrollTop)
const viewport = ref<HTMLElement | null>(null)
const viewportHeight = ref(480)
const ROW_HEIGHT = 72
const OVERSCAN = 4
let resizeObserver: ResizeObserver | null = null

const startIndex = computed(() =>
  Math.max(0, Math.floor(currentScrollTop.value / ROW_HEIGHT) - OVERSCAN)
)
const endIndex = computed(() =>
  Math.min(
    props.artists.length,
    Math.ceil((currentScrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN
  )
)
const visibleArtists = computed(() =>
  props.artists.slice(startIndex.value, endIndex.value).map((artist, index) => ({
    artist,
    index: startIndex.value + index
  }))
)

function updateViewportHeight(height: number): void {
  if (height > 0) viewportHeight.value = height
}

function applyScrollTop(scrollTop: number): void {
  currentScrollTop.value = scrollTop
  if (viewport.value && viewport.value.scrollTop !== scrollTop) {
    viewport.value.scrollTop = scrollTop
  }
}

function handleScroll(event: Event): void {
  const scrollTop = (event.currentTarget as HTMLElement).scrollTop
  currentScrollTop.value = scrollTop
  emit('update:scrollTop', scrollTop)
}

onMounted(() => {
  if (!viewport.value) return
  applyScrollTop(props.scrollTop)
  updateViewportHeight(viewport.value.clientHeight)
  if (!('ResizeObserver' in globalThis)) return
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) updateViewportHeight(entry.contentRect.height)
  })
  resizeObserver.observe(viewport.value)
})

watch(() => props.scrollTop, applyScrollTop)
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div
    ref="viewport"
    class="virtual-artists"
    data-testid="virtual-artist-list"
    tabindex="0"
    aria-label="艺术家列表"
    @scroll="handleScroll"
  >
    <div class="relative" :style="{ height: `${artists.length * ROW_HEIGHT}px` }">
      <button
        v-for="row in visibleArtists"
        :key="row.artist.id"
        type="button"
        class="virtual-artist-row"
        :style="{ height: `${ROW_HEIGHT}px`, transform: `translateY(${row.index * ROW_HEIGHT}px)` }"
        @click="emit('select', row.artist)"
      >
        <img
          v-if="row.artist.coverUrl"
          :src="row.artist.coverUrl"
          :alt="`${row.artist.name} 封面`"
          loading="lazy"
        />
        <span v-else class="artist-monogram" aria-hidden="true">
          {{ row.artist.name.trim().slice(0, 1).toLocaleUpperCase() || '·' }}
        </span>
        <span class="min-w-0">
          <strong class="block truncate">{{ row.artist.name }}</strong>
          <small class="text-sonavi-muted">{{ row.artist.albumCount }} 张专辑</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.virtual-artists {
  flex: 1 1 480px;
  height: 480px;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--sonavi-border);
  border-radius: var(--sonavi-card-radius);
  background: var(--sonavi-raised);
}

.virtual-artist-row {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
  border: 0;
  border-bottom: 1px solid var(--sonavi-border);
  color: var(--sonavi-ink);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.virtual-artist-row:hover {
  background: color-mix(in srgb, var(--sonavi-accent) 7%, transparent);
}

.virtual-artist-row img,
.artist-monogram {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.virtual-artist-row img {
  object-fit: cover;
}

.artist-monogram {
  display: grid;
  place-items: center;
  color: var(--sonavi-accent);
  background: var(--sonavi-border);
  font-weight: 650;
}
</style>
