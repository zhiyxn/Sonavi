<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref } from 'vue'
import ConnectPanel from './components/ConnectPanel.vue'
import ArtistsPanel from './components/ArtistsPanel.vue'
import LibraryPanel from './components/LibraryPanel.vue'
import PlayerBar from './components/PlayerBar.vue'
import SearchPanel from './components/SearchPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { loadApplicationInfo } from './services/application-info'
import { disconnectConnection, forgetConnection, restoreConnection } from './services/connection'
import type { ApplicationInfo } from '../../shared/application'
import type { ConnectionSuccessResult } from '../../shared/connection'
import { useSessionStore } from './stores/session'
import { usePlayerStore } from './stores/player'

const applicationInfo = ref<ApplicationInfo | null>(null)
const loadingError = ref('')
const startupPending = ref(true)
const sessionActionError = ref('')
const session = useSessionStore()
const player = usePlayerStore()
const queryClient = useQueryClient()
type ApplicationView = 'home' | 'albums' | 'artists' | 'search' | 'settings'
const activeView = ref<ApplicationView>('home')
const selectedAlbumId = ref<string | null>(null)
const selectedArtistId = ref<string | null>(null)

const shortcutHint = computed(() =>
  applicationInfo.value ? `${applicationInfo.value.shortcutModifier}+,` : '…'
)

onMounted(async () => {
  try {
    applicationInfo.value = await loadApplicationInfo()
    const restored = await restoreConnection()
    if (restored) session.establish(restored)
  } catch {
    loadingError.value = '无法读取受信任的应用信息，请重新启动 Sonavi。'
  } finally {
    startupPending.value = false
  }
})

function handleConnected(result: ConnectionSuccessResult): void {
  session.establish(result)
  activeView.value = 'home'
}

function navigate(view: ApplicationView): void {
  activeView.value = view
  if (view !== 'albums' && view !== 'home') selectedAlbumId.value = null
  if (view !== 'artists') selectedArtistId.value = null
}

function openAlbum(albumId: string): void {
  selectedAlbumId.value = albumId
  selectedArtistId.value = null
  activeView.value = 'albums'
}

function openArtist(artistId: string): void {
  selectedArtistId.value = artistId
  selectedAlbumId.value = null
  activeView.value = 'artists'
}

async function handleDisconnect(): Promise<void> {
  const current = session.connection
  if (!current) return

  sessionActionError.value = ''
  player.stop()
  try {
    if (!(await disconnectConnection(current.sessionId))) throw new Error('session rejected')
    queryClient.clear()
    session.disconnect()
    selectedAlbumId.value = null
    selectedArtistId.value = null
    activeView.value = 'home'
  } catch {
    sessionActionError.value = '无法安全断开当前会话，请重新启动 Sonavi。'
  }
}

async function handleForget(): Promise<void> {
  const current = session.connection
  if (!current || !window.confirm('退出当前账号并删除这台设备上保存的加密凭据？')) return

  sessionActionError.value = ''
  player.stop()
  try {
    if (!(await forgetConnection(current.sessionId))) throw new Error('session rejected')
    queryClient.clear()
    session.disconnect()
    selectedAlbumId.value = null
    selectedArtistId.value = null
    activeView.value = 'home'
  } catch {
    sessionActionError.value = '无法删除保存的凭据；当前界面未退出，请重试。'
  }
}
</script>

<template>
  <main class="application-shell">
    <aside class="sidebar" aria-label="主导航">
      <div>
        <a class="brand" href="#main-content" aria-label="Sonavi 首页">Sonavi</a>
        <p class="brand-caption">YOUR MUSIC. YOUR SPACE.</p>
      </div>

      <nav>
        <button
          v-if="!session.connection"
          type="button"
          class="nav-item"
          :class="{ active: !session.connection }"
        >
          连接服务器
        </button>
        <template v-else>
          <button class="nav-item" :class="{ active: activeView === 'home' }" @click="navigate('home')">
            首页
          </button>
          <button class="nav-item" :class="{ active: activeView === 'albums' }" @click="navigate('albums')">
            专辑
          </button>
          <button class="nav-item" :class="{ active: activeView === 'artists' }" @click="navigate('artists')">
            艺术家
          </button>
          <button class="nav-item" :class="{ active: activeView === 'search' }" @click="navigate('search')">
            搜索
          </button>
          <span class="nav-item disabled" aria-disabled="true">收藏 <small>P06</small></span>
          <span class="nav-item disabled" aria-disabled="true">歌单 <small>P06</small></span>
          <button class="nav-item" :class="{ active: activeView === 'settings' }" @click="navigate('settings')">
            设置
          </button>
        </template>
      </nav>

      <div class="sidebar-meta">
        <span v-if="applicationInfo" data-testid="platform-label">
          {{ applicationInfo.platformLabel }} · v{{ applicationInfo.version }}
        </span>
        <span>设置快捷键 {{ shortcutHint }}</span>
      </div>
    </aside>

    <section id="main-content" class="workspace">
      <div id="connect" class="content-frame">
        <template v-if="applicationInfo && !startupPending && session.connection">
          <LibraryPanel
            v-if="activeView === 'home' || activeView === 'albums'"
            v-model:selected-album-id="selectedAlbumId"
            :session-id="session.connection.sessionId"
            :server-name="session.connection.server.serverType ?? 'Subsonic 服务器'"
            :server-id="session.connection.server.baseUrl"
            :list-type="activeView === 'home' ? 'newest' : 'alphabeticalByName'"
            :title="activeView === 'home' ? '最近添加' : '全部专辑'"
            @forget="handleForget"
          />
          <ArtistsPanel
            v-else-if="activeView === 'artists'"
            v-model:selected-artist-id="selectedArtistId"
            :session-id="session.connection.sessionId"
            @open-album="openAlbum"
          />
          <SearchPanel
            v-else-if="activeView === 'search'"
            :session-id="session.connection.sessionId"
            :server-id="session.connection.server.baseUrl"
            @open-album="openAlbum"
            @open-artist="openArtist"
          />
          <SettingsPanel
            v-else
            :application-info="applicationInfo"
            :connection="session.connection"
            @disconnect="handleDisconnect"
            @forget="handleForget"
          />
        </template>
        <ConnectPanel
          v-else-if="applicationInfo && !startupPending"
          :application-info="applicationInfo"
          @connected="handleConnected"
        />
        <p v-else-if="loadingError" class="startup-error" role="alert">{{ loadingError }}</p>
        <p v-else class="startup-status" role="status">正在读取应用信息…</p>
        <p v-if="sessionActionError" class="startup-error" role="alert">
          {{ sessionActionError }}
        </p>
      </div>
    </section>

    <PlayerBar />
  </main>
</template>
