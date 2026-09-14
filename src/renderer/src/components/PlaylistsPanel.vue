<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  updatePlaylist
} from '../services/library'
import { usePlayerStore } from '../stores/player'
import { Button } from './ui/button'

const props = defineProps<{ sessionId: string; serverId: string }>()
const queryClient = useQueryClient()
const player = usePlayerStore()
const selectedPlaylistId = ref<string | null>(null)
const newName = ref('')
const includeQueue = ref(false)
const editName = ref('')
const editPublic = ref(false)
const mutationError = ref('')
const mutationStatus = ref('')
const busy = ref(false)

const playlistsQuery = useQuery({
  queryKey: computed(() => ['playlists', props.sessionId]),
  queryFn: () => listPlaylists(props.sessionId),
  staleTime: 15_000
})
const playlistQuery = useQuery({
  queryKey: computed(() => ['playlist', props.sessionId, selectedPlaylistId.value]),
  queryFn: () => getPlaylist(props.sessionId, selectedPlaylistId.value ?? ''),
  enabled: computed(() => selectedPlaylistId.value !== null),
  staleTime: 10_000
})

watch(
  () => playlistQuery.data.value,
  (playlist) => {
    if (!playlist) return
    editName.value = playlist.name
    editPublic.value = playlist.public
  },
  { immediate: true }
)

async function refreshPlaylists(includeDetail = true): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['playlists', props.sessionId] })
  if (includeDetail && selectedPlaylistId.value) {
    await queryClient.invalidateQueries({
      queryKey: ['playlist', props.sessionId, selectedPlaylistId.value]
    })
  }
}

async function runMutation(action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
  busy.value = true
  mutationError.value = ''
  mutationStatus.value = ''
  try {
    await action()
    mutationStatus.value = successMessage
    return true
  } catch (error) {
    mutationError.value = error instanceof Error ? error.message : '歌单操作失败。'
    return false
  } finally {
    busy.value = false
  }
}

async function handleCreate(): Promise<void> {
  const name = newName.value.trim()
  if (!name) return
  const songIds = includeQueue.value ? player.queue.map((entry) => entry.trackId) : []
  if (
    await runMutation(
      () => createPlaylist({ sessionId: props.sessionId, name, songIds }),
      '歌单已创建。'
    )
  ) {
    newName.value = ''
    includeQueue.value = false
    await refreshPlaylists(false)
  }
}

async function handleSaveMetadata(): Promise<void> {
  if (!selectedPlaylistId.value || !editName.value.trim()) return
  if (
    await runMutation(
      () =>
        updatePlaylist({
          sessionId: props.sessionId,
          playlistId: selectedPlaylistId.value!,
          name: editName.value.trim(),
          public: editPublic.value
        }),
      '歌单信息已更新。'
    )
  ) await refreshPlaylists()
}

async function handleAppendQueue(): Promise<void> {
  if (!selectedPlaylistId.value || player.queue.length === 0) return
  if (
    await runMutation(
      () =>
        updatePlaylist({
          sessionId: props.sessionId,
          playlistId: selectedPlaylistId.value!,
          songIdsToAdd: player.queue.map((entry) => entry.trackId)
        }),
      `已追加 ${player.queue.length} 首歌曲。`
    )
  ) await refreshPlaylists()
}

async function handleRemove(index: number): Promise<void> {
  if (!selectedPlaylistId.value) return
  if (
    await runMutation(
      () =>
        updatePlaylist({
          sessionId: props.sessionId,
          playlistId: selectedPlaylistId.value!,
          songIndexesToRemove: [index]
        }),
      '歌曲已从歌单移除。'
    )
  ) await refreshPlaylists()
}

async function handleDelete(): Promise<void> {
  const playlist = playlistQuery.data.value
  if (!selectedPlaylistId.value || !playlist) return
  if (!window.confirm(`确定删除歌单“${playlist.name}”？此操作会同步到服务器。`)) return
  if (
    await runMutation(
      () => deletePlaylist({ sessionId: props.sessionId, playlistId: selectedPlaylistId.value! }),
      '歌单已删除。'
    )
  ) {
    selectedPlaylistId.value = null
    await refreshPlaylists(false)
  }
}

function playPlaylist(): void {
  const tracks = playlistQuery.data.value?.tracks ?? []
  void player.replaceQueue(
    tracks,
    0,
    { sessionId: props.sessionId, serverId: props.serverId, accountId: props.sessionId },
    true
  )
}
</script>

<template>
  <section class="min-h-full" aria-labelledby="playlists-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">06 / PLAYLISTS</p>
        <h1 id="playlists-title">{{ selectedPlaylistId ? '歌单详情' : '歌单' }}</h1>
        <p>所有写操作直接同步服务器；权限不足时不会修改本地显示。</p>
      </div>
      <Button v-if="selectedPlaylistId" variant="outline" @click="selectedPlaylistId = null">返回歌单</Button>
    </div>

    <template v-if="!selectedPlaylistId">
      <form class="playlist-create" @submit.prevent="handleCreate">
        <label>
          <span>新歌单名称</span>
          <input v-model="newName" maxlength="200" placeholder="例如：夜间聆听" />
        </label>
        <label class="remember-row">
          <input v-model="includeQueue" type="checkbox" :disabled="player.queue.length === 0" />
          包含当前队列（{{ player.queue.length }} 首，重复歌曲会保留）
        </label>
        <Button type="submit" :disabled="busy || !newName.trim()">创建歌单</Button>
      </form>

      <p v-if="playlistsQuery.isPending.value" class="mt-8" role="status">正在读取歌单…</p>
      <div v-else-if="playlistsQuery.isError.value" class="state-card" role="alert">
        <p>{{ playlistsQuery.error.value?.message ?? '歌单加载失败。' }}</p>
        <Button class="mt-4" size="sm" @click="playlistsQuery.refetch()">重试</Button>
      </div>
      <p v-else-if="playlistsQuery.data.value?.length === 0" class="mt-8 text-sonavi-muted">服务器中暂无歌单。</p>
      <div v-else class="playlist-grid">
        <button
          v-for="playlist in playlistsQuery.data.value"
          :key="playlist.id"
          type="button"
          @click="selectedPlaylistId = playlist.id"
        >
          <strong>{{ playlist.name }}</strong>
          <span>{{ playlist.songCount }} 首 · {{ playlist.public ? '公开' : '私有' }}</span>
          <small>{{ playlist.owner || '当前账号' }}</small>
        </button>
      </div>
    </template>

    <template v-else>
      <p v-if="playlistQuery.isPending.value" role="status">正在读取歌单详情…</p>
      <div v-else-if="playlistQuery.isError.value" class="state-card" role="alert">
        <p>{{ playlistQuery.error.value?.message ?? '歌单详情加载失败。' }}</p>
        <Button class="mt-4" size="sm" @click="playlistQuery.refetch()">重试</Button>
      </div>
      <template v-else-if="playlistQuery.data.value">
        <form class="playlist-editor" @submit.prevent="handleSaveMetadata">
          <label>
            <span>名称</span>
            <input v-model="editName" maxlength="200" />
          </label>
          <label class="remember-row">
            <input v-model="editPublic" type="checkbox" />
            对服务器上的其他用户公开
          </label>
          <div class="flex flex-wrap gap-2">
            <Button type="submit" :disabled="busy || !editName.trim()">保存信息</Button>
            <Button type="button" variant="outline" :disabled="playlistQuery.data.value.tracks.length === 0" @click="playPlaylist">播放全部</Button>
            <Button type="button" variant="outline" :disabled="busy || player.queue.length === 0" @click="handleAppendQueue">追加当前队列</Button>
            <Button type="button" variant="ghost" :disabled="busy" @click="handleDelete">删除歌单</Button>
          </div>
        </form>

        <p v-if="playlistQuery.data.value.tracks.length === 0" class="mt-8 text-sonavi-muted">这个歌单还没有歌曲。</p>
        <ol v-else class="track-results mt-8">
          <li v-for="(track, index) in playlistQuery.data.value.tracks" :key="`${index}:${track.id}`">
            <span class="min-w-0">
              <strong>{{ track.title }}</strong>
              <small>{{ track.artist }} · {{ track.album }}</small>
            </span>
            <Button variant="ghost" size="sm" :disabled="busy" @click="handleRemove(index)">移除</Button>
          </li>
        </ol>
      </template>
    </template>

    <p v-if="mutationStatus" class="mutation-status" role="status">{{ mutationStatus }}</p>
    <p v-if="mutationError" class="mutation-error" role="alert">{{ mutationError }}</p>
  </section>
</template>
