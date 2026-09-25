<script setup lang="ts">
import type { ArtistSummary } from '../../../shared/library'

defineProps<{ artists: ArtistSummary[] }>()
const emit = defineEmits<{ select: [artist: ArtistSummary] }>()
</script>

<template>
  <ul class="artist-list" data-testid="artist-list" aria-label="艺术家列表">
    <li v-for="artist in artists" :key="artist.id">
      <button type="button" class="artist-list-row" @click="emit('select', artist)">
        <img
          v-if="artist.coverUrl"
          :src="artist.coverUrl"
          :alt="`${artist.name} 封面`"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        />
        <span v-else class="artist-monogram" aria-hidden="true">
          {{ artist.name.trim().slice(0, 1).toLocaleUpperCase() || '·' }}
        </span>
        <span class="min-w-0">
          <strong class="block truncate">{{ artist.name }}</strong>
          <small class="text-sonavi-muted">{{ artist.albumCount }} 张专辑</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.artist-list {
  overflow: visible;
  margin: 0;
  padding: 0;
  border: 1px solid var(--sonavi-border);
  border-radius: var(--sonavi-card-radius);
  background: var(--sonavi-raised);
  list-style: none;
}

.artist-list-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  min-height: 72px;
  padding: 8px 16px;
  border: 0;
  border-bottom: 1px solid var(--sonavi-border);
  color: var(--sonavi-ink);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.artist-list li:last-child .artist-list-row {
  border-bottom: 0;
}

.artist-list-row:hover {
  background: color-mix(in srgb, var(--sonavi-accent) 7%, transparent);
}

.artist-list-row img,
.artist-monogram {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.artist-list-row img {
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
