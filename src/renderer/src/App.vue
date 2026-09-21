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
import ServerManagementPanel from './components/ServerManagementPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ConfirmationDialog from './components/ConfirmationDialog.vue'
import { loadApplicationInfo } from './services/application-info'
import {
  connectSavedConnection,
  disconnectConnection,
  forgetConnection,
  restoreConnection
} from './services/connection'
import type { ApplicationInfo } from '../../shared/application'
import type {
  ConnectionSuccessResult,
  SavedConnectionProfile
} from '../../shared/connection'
import { useSessionStore } from './stores/session'
import { usePlayerStore } from './stores/player'
import { usePlaybackReporting } from './composables/use-playback-reporting'
import { usePlaybackBufferDiagnostics } from './composables/use-playback-buffer-diagnostics'
import { useDesktopIntegration } from './composables/use-desktop-integration'
import { useErrorToast } from './lib/notifications'
import { Toaster } from './components/ui/sonner'

const applicationInfo = ref<ApplicationInfo | null>(null)
const loadingError = ref('')
const projectHomepageError = ref('')
const startupPending = ref(true)
const sessionActionError = ref('')
const connectionDraft = ref<SavedConnectionProfile | null>(null)
const serverActionPending = ref(false)
const session = useSessionStore()
const player = usePlayerStore()
const { errorMessage: playbackReportError } = usePlaybackReporting()
usePlaybackBufferDiagnostics()
const queryClient = useQueryClient()
type ApplicationView = 'home' | 'albums' | 'artists' | 'search' | 'favorites' | 'playlists' | 'servers' | 'server-form' | 'settings'
const activeView = ref<ApplicationView>('home')
const homeSelectedAlbumId = ref<string | null>(null)
const albumsSelectedAlbumId = ref<string | null>(null)
const artistsSelectedAlbumId = ref<string | null>(null)
const artistsSelectedArtistId = ref<string | null>(null)
const searchSelectedAlbumId = ref<string | null>(null)
const searchSelectedArtistId = ref<string | null>(null)
const favoritesSelectedAlbumId = ref<string | null>(null)
const favoritesSelectedArtistId = ref<string | null>(null)
const selectedArtistId = computed(() => {
  if (activeView.value === 'artists') return artistsSelectedArtistId.value
  if (activeView.value === 'search') return searchSelectedArtistId.value
  if (activeView.value === 'favorites') return favoritesSelectedArtistId.value
  return null
})
const selectedAlbumId = computed(() => {
  if (activeView.value === 'home') return homeSelectedAlbumId.value
  if (activeView.value === 'albums') return albumsSelectedAlbumId.value
  if (activeView.value === 'artists') return artistsSelectedAlbumId.value
  if (activeView.value === 'search') return searchSelectedAlbumId.value
  if (activeView.value === 'favorites') return favoritesSelectedAlbumId.value
  return null
})
const workspace = ref<HTMLElement | null>(null)
const workspaceScrollPositions = new Map<string, number>()
const artistListScrollTop = ref(0)
const homeAlbumPage = ref(1)
const albumsAlbumPage = ref(1)
const viewCacheRevision = ref(0)
const forgetConfirmationOpen = ref(false)
const forgetActionPending = ref(false)
const { flushPausedQueue, refreshPlaybackQueue } = useDesktopIntegration({
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
const albumBackLabel = computed(() => {
  if (selectedArtistId.value) return '返回艺术家专辑'
  if (activeView.value === 'search') return '返回搜索'
  if (activeView.value === 'favorites') return '返回收藏'
  return '返回专辑'
})
const artistBackLabel = computed(() => {
  if (activeView.value === 'search') return '返回搜索'
  if (activeView.value === 'favorites') return '返回收藏'
  return '返回艺术家'
})

useErrorToast(loadingError, { title: '应用启动失败', id: 'application-startup-error' })
useErrorToast(projectHomepageError, { title: '无法打开项目主页', id: 'project-homepage-error' })
useErrorToast(sessionActionError, { title: '账号操作失败', id: 'session-action-error' })
useErrorToast(playbackReportError, { title: '播放记录同步失败', id: 'playback-report-error' })
useErrorToast(() => player.errorMessage, { title: '播放失败', id: 'player-error' })

onMounted(async () => {
  try {
    applicationInfo.value = await loadApplicationInfo()
    const restored = await restoreConnection()
    if (restored) {
      session.establish(restored)
    }
  } catch {
    loadingError.value = '无法读取受信任的应用信息，请重新启动 Sonavi。'
  } finally {
    startupPending.value = false
  }
})

async function openProjectHomepage(): Promise<void> {
  projectHomepageError.value = ''
  try {
    await window.sonavi.application.openProjectHomepage()
  } catch {
    projectHomepageError.value = '无法调用系统默认浏览器，请稍后重试。'
  }
}

function handleConnected(result: ConnectionSuccessResult): void {
  resetWorkspaceScrollPositions()
  connectionDraft.value = null
  session.establish(result)
  activeView.value = 'home'
}

function handleNetworkChanged(connectionsReset: boolean, playbackChanged: boolean): void {
  if (connectionsReset) {
    player.stop()
    queryClient.clear()
    viewCacheRevision.value += 1
    return
  }
  if (playbackChanged) {
    void refreshPlaybackQueue()
    const mediaQueryRoots = new Set([
      'albums',
      'album',
      'artists',
      'artist',
      'search',
      'starred',
      'playlists',
      'playlist'
    ])
    void queryClient.invalidateQueries({
      predicate: (query) => mediaQueryRoots.has(String(query.queryKey[0])),
      refetchType: 'all'
    })
  }
}

function workspaceScrollKey(): string {
  if (selectedArtistId.value && selectedAlbumId.value) {
    return `${activeView.value}:artist:${selectedArtistId.value}:album:${selectedAlbumId.value}`
  }
  if (selectedAlbumId.value) {
    return `${activeView.value}:album:${selectedAlbumId.value}`
  }
  if (selectedArtistId.value) {
    return `${activeView.value}:artist:${selectedArtistId.value}`
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
  await restoreWorkspaceScroll()
}

async function updateSelectedAlbumId(albumId: string | null): Promise<void> {
  rememberWorkspaceScroll()
  if (activeView.value === 'home') homeSelectedAlbumId.value = albumId
  if (activeView.value === 'albums') albumsSelectedAlbumId.value = albumId
  if (activeView.value === 'artists') artistsSelectedAlbumId.value = albumId
  if (activeView.value === 'search') searchSelectedAlbumId.value = albumId
  if (activeView.value === 'favorites') favoritesSelectedAlbumId.value = albumId
  await restoreWorkspaceScroll()
}

async function updateSelectedArtistId(artistId: string | null): Promise<void> {
  rememberWorkspaceScroll()
  if (activeView.value === 'artists') {
    artistsSelectedArtistId.value = artistId
    if (artistId === null) artistsSelectedAlbumId.value = null
  }
  if (activeView.value === 'search') {
    searchSelectedArtistId.value = artistId
    if (artistId === null) searchSelectedAlbumId.value = null
  }
  if (activeView.value === 'favorites') {
    favoritesSelectedArtistId.value = artistId
    if (artistId === null) favoritesSelectedAlbumId.value = null
  }
  await restoreWorkspaceScroll()
}

async function openAlbum(albumId: string): Promise<void> {
  rememberWorkspaceScroll()
  if (activeView.value === 'search') {
    searchSelectedArtistId.value = null
    searchSelectedAlbumId.value = albumId
  } else if (activeView.value === 'favorites') {
    favoritesSelectedArtistId.value = null
    favoritesSelectedAlbumId.value = albumId
  } else {
    albumsSelectedAlbumId.value = albumId
    activeView.value = 'albums'
  }
  await restoreWorkspaceScroll()
}

async function openAlbumFromArtist(albumId: string): Promise<void> {
  rememberWorkspaceScroll()
  if (activeView.value === 'artists') artistsSelectedAlbumId.value = albumId
  if (activeView.value === 'search') searchSelectedAlbumId.value = albumId
  if (activeView.value === 'favorites') favoritesSelectedAlbumId.value = albumId
  await restoreWorkspaceScroll()
}

async function openArtist(artistId: string): Promise<void> {
  rememberWorkspaceScroll()
  if (activeView.value === 'search') {
    searchSelectedArtistId.value = artistId
    searchSelectedAlbumId.value = null
  } else if (activeView.value === 'favorites') {
    favoritesSelectedArtistId.value = artistId
    favoritesSelectedAlbumId.value = null
  } else {
    artistsSelectedArtistId.value = artistId
    artistsSelectedAlbumId.value = null
    activeView.value = 'artists'
  }
  await restoreWorkspaceScroll()
}

function resetSelections(): void {
  homeSelectedAlbumId.value = null
  albumsSelectedAlbumId.value = null
  artistsSelectedAlbumId.value = null
  artistsSelectedArtistId.value = null
  searchSelectedAlbumId.value = null
  searchSelectedArtistId.value = null
  favoritesSelectedAlbumId.value = null
  favoritesSelectedArtistId.value = null
}

async function disconnectCurrent(nextDraft: SavedConnectionProfile | null): Promise<boolean> {
  const current = session.connection
  if (!current) return false

  sessionActionError.value = ''
  player.pause()
  await flushPausedQueue()
  try {
    if (!(await disconnectConnection(current.sessionId))) throw new Error('session rejected')
    queryClient.clear()
    connectionDraft.value = nextDraft
    session.disconnect()
    player.stop()
    resetSelections()
    activeView.value = 'home'
    resetWorkspaceScrollPositions()
    return true
  } catch {
    sessionActionError.value = '无法安全断开当前会话，请重新启动 Sonavi。'
    return false
  }
}

async function handleDisconnect(): Promise<void> {
  await disconnectCurrent(null)
}

async function handleAddServer(): Promise<void> {
  connectionDraft.value = null
  await navigate('server-form')
}

async function handleEditServer(profile: SavedConnectionProfile): Promise<void> {
  connectionDraft.value = profile
  await navigate('server-form')
}

async function prepareServerReplacement(): Promise<void> {
  await flushPausedQueue()
}

function handleServerConnected(result: ConnectionSuccessResult): void {
  queryClient.clear()
  player.stop()
  resetSelections()
  resetWorkspaceScrollPositions()
  viewCacheRevision.value += 1
  connectionDraft.value = null
  session.establish(result)
  activeView.value = 'home'
}

async function handleSwitchServer(profileId: string): Promise<void> {
  if (serverActionPending.value || !session.connection) return
  serverActionPending.value = true
  sessionActionError.value = ''
  await flushPausedQueue()
  try {
    const result = await connectSavedConnection(profileId)
    if (!result.ok) {
      sessionActionError.value = result.error.message
      return
    }
    handleServerConnected(result)
  } catch {
    sessionActionError.value = '无法验证服务器切换结果，请重新启动 Sonavi。'
  } finally {
    serverActionPending.value = false
  }
}

function handleForget(): void {
  const current = session.connection
  if (!current || forgetActionPending.value) return
  forgetConfirmationOpen.value = true
}

async function confirmForget(): Promise<void> {
  const current = session.connection
  if (!current || forgetActionPending.value) return
  forgetConfirmationOpen.value = false
  forgetActionPending.value = true

  sessionActionError.value = ''
  player.stop()
  try {
    if (!(await forgetConnection(current.sessionId))) throw new Error('session rejected')
    queryClient.clear()
    connectionDraft.value = null
    session.disconnect()
    resetSelections()
    activeView.value = 'home'
    resetWorkspaceScrollPositions()
  } catch {
    sessionActionError.value = '无法删除保存的凭据；当前界面未退出，请重试。'
  } finally {
    forgetActionPending.value = false
  }
}
</script>

<template>
  <main class="application-shell">
    <aside class="sidebar" aria-label="主导航">
      <div>
        <button
          type="button"
          class="brand"
          aria-label="在浏览器中打开 Sonavi GitHub 仓库"
          @click="openProjectHomepage"
        >
          <img class="brand-logo" :src="sonaviLogoUrl" alt="" aria-hidden="true" />
          <span>Sonavi</span>
        </button>
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
          <button class="nav-item" :class="{ active: activeView === 'servers' || activeView === 'server-form' }" @click="navigate('servers')">
            服务器
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
              :key="`library:${activeView}`"
              :selected-album-id="selectedAlbumId"
              :session-id="session.connection.sessionId"
              :server-name="session.connection.server.serverType ?? 'Subsonic 服务器'"
              :server-id="session.connection.server.baseUrl"
              :list-type="activeView === 'home' ? 'newest' : 'alphabeticalByName'"
              :title="activeView === 'home' ? '最近添加' : '全部专辑'"
              :back-label="albumBackLabel"
              :album-list-enabled="activeView === 'home' || activeView === 'albums'"
              :page="activeAlbumPage"
              @update:page="updateAlbumPage"
              @update:selected-album-id="updateSelectedAlbumId"
            />
            <ArtistsPanel
              v-else-if="selectedArtistId || activeView === 'artists'"
              :key="`artists:${activeView}`"
              :artist-list-enabled="activeView === 'artists'"
              :back-label="artistBackLabel"
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
            <ServerManagementPanel
              v-else-if="activeView === 'servers'"
              :connection="session.connection"
              :busy="serverActionPending"
              @add="handleAddServer"
              @edit="handleEditServer"
              @switch="handleSwitchServer"
            />
            <ConnectPanel
              v-else-if="activeView === 'server-form'"
              :application-info="applicationInfo"
              :initial-profile="connectionDraft"
              management-mode
              :before-connect="prepareServerReplacement"
              @cancel="navigate('servers')"
              @connected="handleServerConnected"
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
          :initial-profile="connectionDraft"
          @connected="handleConnected"
        />
        <p v-else-if="loadingError" class="startup-error" role="alert">{{ loadingError }}</p>
        <p v-else class="startup-status" role="status">正在读取应用信息…</p>
      </div>
    </section>

    <PlayerBar />
    <ConfirmationDialog
      v-model:open="forgetConfirmationOpen"
      title="退出并忘记账号？"
      description="将删除这台设备上保存的加密凭据、暂停队列和当前账号封面缓存。"
      confirm-label="退出并删除"
      :busy="forgetActionPending"
      @confirm="confirmForget"
    />
    <Toaster
      position="top-center"
      rich-colors
      close-button
      close-button-position="top-right"
      :visible-toasts="4"
      container-aria-label="Sonavi 通知"
      :toast-options="{
        classes: {
          toast: 'sonavi-toast'
        }
      }"
    />
  </main>
</template>
