<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, onMounted, ref } from 'vue'
import 'vue-sonner/style.css'
import sonaviLogoUrl from './assets/sonavi-logo.png'
import ConnectPanel from './components/ConnectPanel.vue'
import FavoritesPanel from './components/FavoritesPanel.vue'
import ArtistsPanel from './components/ArtistsPanel.vue'
import LibraryPanel from './components/LibraryPanel.vue'
import PlayerBar from './components/PlayerBar.vue'
import PlaylistsPanel from './components/PlaylistsPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { loadApplicationInfo } from './services/application-info'
import { disconnectConnection, forgetConnection, restoreConnection } from './services/connection'
import type { ApplicationInfo } from '../../shared/application'
import type { ConnectionSuccessResult } from '../../shared/connection'
import { useSessionStore } from './stores/session'
import { usePlayerStore } from './stores/player'
import { usePlaybackReporting } from './composables/use-playback-reporting'
import { useDesktopIntegration } from './composables/use-desktop-integration'
import { requestConfirmation, useErrorToast } from './lib/notifications'
import { Toaster } from './components/ui/sonner'

const applicationInfo = ref<ApplicationInfo | null>(null)
const loadingError = ref('')
const startupPending = ref(true)
const sessionActionError = ref('')
const session = useSessionStore()
const player = usePlayerStore()
const { errorMessage: playbackReportError } = usePlaybackReporting()
const queryClient = useQueryClient()
type ApplicationView = 'home' | 'albums' | 'artists' | 'search' | 'favorites' | 'playlists' | 'settings'
const activeView = ref<ApplicationView>('home')
const selectedAlbumId = ref<string | null>(null)
const selectedArtistId = ref<string | null>(null)
const workspace = ref<HTMLElement | null>(null)
const workspaceScrollPositions = new Map<string, number>()
const artistListScrollTop = ref(0)
const homeAlbumPage = ref(1)
const albumsAlbumPage = ref(1)
const viewCacheRevision = ref(0)
const forgetConfirmationPending = ref(false)
const { flushPausedQueue } = useDesktopIntegration({
  getShortcutModifier: () => applicationInfo.value?.shortcutModifier,
  openSettings: () => {
    if (session.connection) navigate('settings')
  }
})

const shortcutHint = computed(() =>
  applicationInfo.value ? `${applicationInfo.value.shortcutModifier}+,` : '…'
)
const activeAlbumPage = computed(() => {
  if (activeView.value === 'home') return homeAlbumPage.value
  if (activeView.value === 'albums') return albumsAlbumPage.value
  return 1
})

useErrorToast(loadingError, { title: '应用启动失败', id: 'application-startup-error' })
useErrorToast(sessionActionError, { title: '账号操作失败', id: 'session-action-error' })
useErrorToast(playbackReportError, { title: '播放记录同步失败', id: 'playback-report-error' })
useErrorToast(() => player.errorMessage, { title: '播放失败', id: 'player-error' })

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
  resetWorkspaceScrollPositions()
  session.establish(result)
  activeView.value = 'home'
}

function handleNetworkChanged(): void {
  player.stop()
  queryClient.clear()
  viewCacheRevision.value += 1
}

function workspaceScrollKey(): string {
  if (activeView.value === 'artists' && selectedArtistId.value && selectedAlbumId.value) {
    return `artists:artist:${selectedArtistId.value}:album:${selectedAlbumId.value}`
  }
  if ((activeView.value === 'home' || activeView.value === 'albums') && selectedAlbumId.value) {
    return `${activeView.value}:album:${selectedAlbumId.value}`
  }
  if (activeView.value === 'artists' && selectedArtistId.value) {
    return `artists:artist:${selectedArtistId.value}`
  }
  return activeView.value
}

function rememberWorkspaceScroll(): void {
  if (workspace.value && activeView.value !== 'settings') {
    workspaceScrollPositions.set(workspaceScrollKey(), workspace.value.scrollTop)
  }
}

function resetWorkspaceScrollPositions(): void {
  workspaceScrollPositions.clear()
  artistListScrollTop.value = 0
  homeAlbumPage.value = 1
  albumsAlbumPage.value = 1
  if (workspace.value) workspace.value.scrollTop = 0
}

async function restoreWorkspaceScroll(): Promise<void> {
  await nextTick()
  if (workspace.value) {
    workspace.value.scrollTop = activeView.value === 'settings'
      ? 0
      : (workspaceScrollPositions.get(workspaceScrollKey()) ?? 0)
  }
}

function updateArtistListScrollTop(scrollTop: number): void {
  artistListScrollTop.value = scrollTop
}

function updateAlbumPage(page: number): void {
  if (activeView.value === 'home') homeAlbumPage.value = page
  if (activeView.value === 'albums') albumsAlbumPage.value = page
}

async function navigate(view: ApplicationView): Promise<void> {
  rememberWorkspaceScroll()
  activeView.value = view
  if (view !== 'albums' && view !== 'home') selectedAlbumId.value = null
  if (view !== 'artists') selectedArtistId.value = null
  await restoreWorkspaceScroll()
}

async function updateSelectedAlbumId(albumId: string | null): Promise<void> {
  rememberWorkspaceScroll()
  selectedAlbumId.value = albumId
  await restoreWorkspaceScroll()
}

async function updateSelectedArtistId(artistId: string | null): Promise<void> {
  rememberWorkspaceScroll()
  selectedArtistId.value = artistId
  await restoreWorkspaceScroll()
}

async function openAlbum(albumId: string): Promise<void> {
  rememberWorkspaceScroll()
  selectedAlbumId.value = albumId
  selectedArtistId.value = null
  activeView.value = 'albums'
  await restoreWorkspaceScroll()
}

async function openAlbumFromArtist(albumId: string): Promise<void> {
  rememberWorkspaceScroll()
  selectedAlbumId.value = albumId
  await restoreWorkspaceScroll()
}

async function openArtist(artistId: string): Promise<void> {
  rememberWorkspaceScroll()
  selectedArtistId.value = artistId
  selectedAlbumId.value = null
  activeView.value = 'artists'
  await restoreWorkspaceScroll()
}

async function handleDisconnect(): Promise<void> {
  const current = session.connection
  if (!current) return

  sessionActionError.value = ''
  player.pause()
  await flushPausedQueue()
  try {
    if (!(await disconnectConnection(current.sessionId))) throw new Error('session rejected')
    queryClient.clear()
    session.disconnect()
    player.stop()
    selectedAlbumId.value = null
    selectedArtistId.value = null
    activeView.value = 'home'
    resetWorkspaceScrollPositions()
  } catch {
    sessionActionError.value = '无法安全断开当前会话，请重新启动 Sonavi。'
  }
}

async function handleForget(): Promise<void> {
  const current = session.connection
  if (!current || forgetConfirmationPending.value) return
  forgetConfirmationPending.value = true
  let confirmed: boolean
  try {
    confirmed = await requestConfirmation({
      title: '退出并忘记账号？',
      description: '将删除这台设备上保存的加密凭据、暂停队列和当前账号封面缓存。',
      confirmLabel: '退出并删除'
    })
  } finally {
    forgetConfirmationPending.value = false
  }
  if (!confirmed) return

  sessionActionError.value = ''
  player.stop()
  try {
    if (!(await forgetConnection(current.sessionId))) throw new Error('session rejected')
    queryClient.clear()
    session.disconnect()
    selectedAlbumId.value = null
    selectedArtistId.value = null
    activeView.value = 'home'
    resetWorkspaceScrollPositions()
  } catch {
    sessionActionError.value = '无法删除保存的凭据；当前界面未退出，请重试。'
  }
}
</script>

<template>
  <main class="application-shell">
    <aside class="sidebar" aria-label="主导航">
      <div>
        <a class="brand" href="#main-content" aria-label="Sonavi 首页">
          <img class="brand-logo" :src="sonaviLogoUrl" alt="" aria-hidden="true" />
          <span>Sonavi</span>
        </a>
        <p class="brand-caption">YOUR MUSIC. YOUR SPACE.</p>
      </div>

      <nav>
        <span
          v-if="!session.connection"
          class="nav-item"
          :class="{ active: !session.connection }"
          aria-current="page"
        >
          连接服务器
        </span>
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
          <button class="nav-item" :class="{ active: activeView === 'favorites' }" @click="navigate('favorites')">
            收藏
          </button>
          <button class="nav-item" :class="{ active: activeView === 'playlists' }" @click="navigate('playlists')">
            歌单
          </button>
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

    <section
      id="main-content"
      ref="workspace"
      class="workspace"
      :class="{
        'workspace-album-detail': selectedAlbumId,
        'workspace-artists-list': activeView === 'artists' && !selectedArtistId && !selectedAlbumId
      }"
      @scroll.passive="rememberWorkspaceScroll"
    >
      <div id="connect" class="content-frame">
        <template v-if="applicationInfo && !startupPending && session.connection">
          <KeepAlive :key="viewCacheRevision">
            <LibraryPanel
              v-if="selectedAlbumId || activeView === 'home' || activeView === 'albums'"
              :key="activeView"
              :selected-album-id="selectedAlbumId"
              :session-id="session.connection.sessionId"
              :server-name="session.connection.server.serverType ?? 'Subsonic 服务器'"
              :server-id="session.connection.server.baseUrl"
              :list-type="activeView === 'home' ? 'newest' : 'alphabeticalByName'"
              :title="activeView === 'home' ? '最近添加' : '全部专辑'"
              :back-label="activeView === 'artists' ? '返回艺术家详情' : '返回专辑'"
              :album-list-enabled="activeView !== 'artists'"
              :page="activeAlbumPage"
              @update:page="updateAlbumPage"
              @update:selected-album-id="updateSelectedAlbumId"
            />
            <ArtistsPanel
              v-else-if="activeView === 'artists'"
              :list-scroll-top="artistListScrollTop"
              :selected-artist-id="selectedArtistId"
              :session-id="session.connection.sessionId"
              @update:list-scroll-top="updateArtistListScrollTop"
              @update:selected-artist-id="updateSelectedArtistId"
              @open-album="openAlbumFromArtist"
            />
            <SearchPanel
              v-else-if="activeView === 'search'"
              :session-id="session.connection.sessionId"
              :server-id="session.connection.server.baseUrl"
              @open-album="openAlbum"
              @open-artist="openArtist"
            />
            <FavoritesPanel
              v-else-if="activeView === 'favorites'"
              :session-id="session.connection.sessionId"
              :server-id="session.connection.server.baseUrl"
              @open-album="openAlbum"
              @open-artist="openArtist"
            />
            <PlaylistsPanel
              v-else-if="activeView === 'playlists'"
              :session-id="session.connection.sessionId"
              :server-id="session.connection.server.baseUrl"
            />
          </KeepAlive>
          <SettingsPanel
            v-if="activeView === 'settings'"
            :application-info="applicationInfo"
            :connection="session.connection"
            @disconnect="handleDisconnect"
            @forget="handleForget"
            @network-changed="handleNetworkChanged"
          />
        </template>
        <ConnectPanel
          v-else-if="applicationInfo && !startupPending"
          :application-info="applicationInfo"
          @connected="handleConnected"
        />
        <p v-else-if="loadingError" class="startup-error" role="alert">{{ loadingError }}</p>
        <p v-else class="startup-status" role="status">正在读取应用信息…</p>
      </div>
    </section>

    <PlayerBar />
    <Toaster
      position="top-center"
      rich-colors
      close-button
      :visible-toasts="4"
      container-aria-label="Sonavi 通知"
      :toast-options="{
        classes: {
          toast: 'sonavi-toast',
          actionButton: 'sonavi-toast-action',
          cancelButton: 'sonavi-toast-cancel'
        }
      }"
    />
  </main>
</template>
