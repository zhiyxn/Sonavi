<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref } from 'vue'
import ConnectPanel from './components/ConnectPanel.vue'
import LibraryPanel from './components/LibraryPanel.vue'
import PlayerBar from './components/PlayerBar.vue'
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
          type="button"
          class="nav-item"
          :class="{ active: !session.connection }"
          @click="handleDisconnect"
        >
          连接服务器
        </button>
        <span class="nav-item" :class="{ active: session.connection }">音乐库 <small>P03</small></span>
        <span class="nav-item disabled" aria-disabled="true">搜索 <small>P05</small></span>
        <span class="nav-item disabled" aria-disabled="true">歌单 <small>P06</small></span>
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
        <LibraryPanel
          v-if="applicationInfo && !startupPending && session.connection"
          :session-id="session.connection.sessionId"
          :server-name="session.connection.server.serverType ?? 'Subsonic 服务器'"
          @forget="handleForget"
        />
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
