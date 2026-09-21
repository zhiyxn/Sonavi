<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { ApplicationInfo } from '../../../shared/application'
import type {
  ConnectionSuccessResult,
  SavedConnectionProfile
} from '../../../shared/connection'
import { showErrorToast } from '../lib/notifications'
import {
  connectSavedConnection,
  deleteSavedConnection,
  listSavedConnections,
  testConnection
} from '../services/connection'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import ConfirmationDialog from './ConfirmationDialog.vue'
import { Input } from './ui/input'
import { Label } from './ui/label'

const props = withDefaults(defineProps<{
  applicationInfo: ApplicationInfo
  initialProfile?: SavedConnectionProfile | null
  managementMode?: boolean
  beforeConnect?: (() => Promise<void>) | undefined
}>(), {
  initialProfile: null,
  managementMode: false,
  beforeConnect: undefined
})

const emit = defineEmits<{
  connected: [result: ConnectionSuccessResult]
  cancel: []
}>()

const serverUrl = ref('')
const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const allowInsecureHttp = ref(false)
const statusMessage = ref('请输入服务器连接信息。')
const statusKind = ref<'idle' | 'success' | 'error'>('idle')
const isSubmitting = ref(false)
const isRestoring = ref(false)
const savedProfiles = ref<SavedConnectionProfile[]>([])
const profilesLoading = ref(true)
const profileActionId = ref<string | null>(null)
const deleteCandidate = ref<SavedConnectionProfile | null>(null)

async function refreshProfiles(): Promise<void> {
  profilesLoading.value = true
  try {
    savedProfiles.value = await listSavedConnections()
  } catch {
    showErrorToast('无法读取已保存服务器，请重新启动 Sonavi。', {
      title: '服务器列表读取失败',
      id: 'saved-connections-list-error'
    })
  } finally {
    profilesLoading.value = false
  }
}

async function connectProfile(profile: SavedConnectionProfile): Promise<void> {
  if (isSubmitting.value || isRestoring.value) return
  isRestoring.value = true
  profileActionId.value = profile.id
  statusKind.value = 'idle'
  statusMessage.value = '正在使用系统加密保存的账号连接…'
  try {
    const result = await connectSavedConnection(profile.id)
    if (!result.ok) {
      showErrorToast(result.error.message, {
        title: '已保存服务器连接失败',
        id: 'connection-restore-error'
      })
      statusMessage.value = '已保存账号连接失败。'
      return
    }
    statusKind.value = 'success'
    statusMessage.value = '已使用系统加密保存的账号重新连接。'
    emit('connected', result)
  } catch {
    showErrorToast('无法验证重新连接结果，请重新启动 Sonavi。', {
      title: '重新连接失败',
      id: 'connection-restore-error'
    })
    statusMessage.value = '已保存账号连接失败。'
  } finally {
    isRestoring.value = false
    profileActionId.value = null
  }
}

async function confirmDeleteProfile(): Promise<void> {
  const profile = deleteCandidate.value
  if (!profile || profileActionId.value) return
  profileActionId.value = profile.id
  try {
    if (!(await deleteSavedConnection(profile.id))) throw new Error('delete rejected')
    deleteCandidate.value = null
    await refreshProfiles()
    statusMessage.value = '已删除保存的服务器。'
  } catch {
    showErrorToast('无法删除已保存服务器，请重试。', {
      title: '删除失败',
      id: 'saved-connection-delete-error'
    })
  } finally {
    profileActionId.value = null
  }
}

async function submitConnection(): Promise<void> {
  if (isSubmitting.value) return

  isSubmitting.value = true
  statusKind.value = 'idle'
  statusMessage.value = '正在安全地检查服务器…'

  try {
    await props.beforeConnect?.()
    const result = await testConnection({
      serverUrl: serverUrl.value,
      username: username.value,
      password: password.value,
      rememberMe: rememberMe.value,
      allowInsecureHttp: allowInsecureHttp.value,
      ...(props.initialProfile ? { profileId: props.initialProfile.id } : {})
    })

    if (!result.ok) {
      showErrorToast(result.error.message, {
        title: '连接失败',
        id: 'connection-error'
      })
      statusKind.value = 'idle'
      statusMessage.value = '请检查连接信息后重试。'
      return
    }

    const serverName = result.server.serverType ?? 'Subsonic 服务器'
    const persistenceMessage =
      result.credentialPersistence === 'encrypted'
        ? '凭据已使用系统加密保存。'
        : result.credentialPersistence === 'session-only'
          ? '系统加密存储不可用，本次会话可用，未写入明文。'
          : '凭据仅用于本次会话。'

    statusKind.value = 'success'
    statusMessage.value = `已连接 ${serverName}，发现 ${result.server.musicFolders.length} 个音乐文件夹。${persistenceMessage}`
    emit('connected', result)
  } catch {
    showErrorToast('无法验证应用返回的连接结果，请重新启动 Sonavi。', {
      title: '连接失败',
      id: 'connection-error'
    })
    statusKind.value = 'idle'
    statusMessage.value = '请检查连接信息后重试。'
  } finally {
    password.value = ''
    isSubmitting.value = false
  }
}

watch(
  () => props.initialProfile,
  (profile) => {
    if (!profile) return
    serverUrl.value = profile.serverUrl
    username.value = profile.username
    rememberMe.value = true
    statusMessage.value = '请输入密码以更新这个服务器账号。'
  },
  { immediate: true }
)

onMounted(() => {
  if (!props.managementMode) void refreshProfiles()
})
</script>

<template>
  <section class="connect-panel" aria-labelledby="connect-title">
    <p class="eyebrow">CONNECT</p>
    <h1 id="connect-title">
      {{ props.initialProfile ? '更新服务器账号' : props.managementMode ? '添加服务器' : '连接你的音乐空间' }}
    </h1>
    <p class="intro">添加 Navidrome、Subsonic 或 OpenSubsonic 服务器。已保存账号可直接切换，密码不会回填到 renderer。</p>

    <section
      v-if="!props.managementMode && (profilesLoading || savedProfiles.length)"
      class="saved-connections"
      aria-labelledby="saved-connections-title"
    >
      <div class="saved-connections-heading">
        <h2 id="saved-connections-title">已保存服务器</h2>
        <span>{{ savedProfiles.length }} / 20</span>
      </div>
      <p v-if="profilesLoading" class="field-note">正在读取系统加密保存的账号…</p>
      <ul v-else class="saved-connections-list">
        <li v-for="profile in savedProfiles" :key="profile.id">
          <div class="saved-connection-copy">
            <strong>{{ profile.serverUrl }}</strong>
            <span>{{ profile.username }}<template v-if="profile.isDefault"> · 默认</template></span>
          </div>
          <div class="saved-connection-actions">
            <Button
              type="button"
              size="sm"
              :disabled="isSubmitting || isRestoring"
              :aria-label="`连接 ${profile.serverUrl} · ${profile.username}`"
              @click="connectProfile(profile)"
            >
              {{ profileActionId === profile.id && isRestoring ? '正在连接…' : '连接' }}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              :disabled="isSubmitting || isRestoring || profileActionId !== null"
              :aria-label="`删除 ${profile.serverUrl} · ${profile.username}`"
              @click="deleteCandidate = profile"
            >
              删除
            </Button>
          </div>
        </li>
      </ul>
    </section>

    <form class="connection-form" novalidate @submit.prevent="submitConnection">
      <Label for="server-url">服务器地址</Label>
      <Input
        id="server-url"
        v-model="serverUrl"
        name="serverUrl"
        type="url"
        inputmode="url"
        autocomplete="url"
        placeholder="https://music.example.com"
      />
      <p class="field-note">支持 HTTPS、自定义端口与子路径；不会绕过 TLS 证书验证。</p>

      <Label for="username">用户名</Label>
      <Input id="username" v-model="username" name="username" type="text" autocomplete="username" />

      <Label for="password">密码</Label>
      <Input
        id="password"
        v-model="password"
        name="password"
        type="password"
        autocomplete="current-password"
      />

      <div class="remember-row">
        <Checkbox id="remember-me" v-model="rememberMe" name="rememberMe" />
        <Label for="remember-me">在这台 {{ applicationInfo.platformLabel }} 设备上记住我</Label>
      </div>

      <div class="remember-row">
        <Checkbox
          id="allow-insecure-http"
          v-model="allowInsecureHttp"
          name="allowInsecureHttp"
        />
        <Label for="allow-insecure-http">允许不加密的 HTTP（仅限我了解风险的局域网测试）</Label>
      </div>

      <div class="connection-actions">
        <Button type="submit" :disabled="isSubmitting || isRestoring">
          {{ isSubmitting ? '正在测试…' : props.initialProfile ? '更新并连接' : '测试连接' }}
        </Button>
        <Button
          v-if="props.managementMode"
          type="button"
          variant="outline"
          :disabled="isSubmitting || isRestoring"
          @click="emit('cancel')"
        >
          取消
        </Button>
      </div>
      <p class="form-status" :class="`is-${statusKind}`" role="status">{{ statusMessage }}</p>
    </form>

    <footer class="security-note">
      <span aria-hidden="true">◇</span>
      renderer 不直接访问 Node.js；密码不会进入 localStorage、Pinia 或日志。
    </footer>
    <ConfirmationDialog
      :open="deleteCandidate !== null"
      title="删除已保存服务器？"
      :description="deleteCandidate ? `将删除 ${deleteCandidate.serverUrl} 的系统加密凭据，不会修改服务器数据。` : ''"
      confirm-label="删除服务器"
      :busy="profileActionId !== null"
      @update:open="(open) => { if (!open) deleteCandidate = null }"
      @confirm="confirmDeleteProfile"
    />
  </section>
</template>

<style scoped>
.saved-connections {
  display: grid;
  gap: var(--sonavi-space-3);
  margin: var(--sonavi-space-6) 0;
  padding: var(--sonavi-space-4);
  border: 1px solid var(--sonavi-border);
  border-radius: var(--sonavi-card-radius);
  background: var(--sonavi-subtle);
}

.saved-connections-heading,
.saved-connections-list li,
.saved-connection-actions,
.connection-actions {
  display: flex;
  align-items: center;
}

.saved-connections-heading,
.saved-connections-list li {
  justify-content: space-between;
  gap: var(--sonavi-space-4);
}

.saved-connections-heading h2 {
  font-size: 1rem;
  font-weight: 650;
}

.saved-connections-heading span,
.saved-connection-copy span {
  color: var(--sonavi-text-secondary);
  font-size: 0.82rem;
}

.saved-connections-list {
  display: grid;
  gap: var(--sonavi-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.saved-connections-list li {
  padding: var(--sonavi-space-3);
  border: 1px solid var(--sonavi-border);
  border-radius: var(--sonavi-control-radius);
  background: var(--sonavi-raised);
}

.saved-connection-copy {
  display: grid;
  min-width: 0;
}

.saved-connection-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-connection-actions {
  flex: 0 0 auto;
  gap: var(--sonavi-space-2);
}

.connection-actions {
  gap: var(--sonavi-space-2);
}

@media (max-width: 720px) {
  .saved-connections-list li {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
