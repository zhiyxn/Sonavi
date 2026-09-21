<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type {
  ConnectionSuccessResult,
  SavedConnectionProfile
} from '../../../shared/connection'
import {
  deleteSavedConnection,
  listSavedConnections
} from '../services/connection'
import { showErrorToast } from '../lib/notifications'
import ConfirmationDialog from './ConfirmationDialog.vue'
import { Button } from './ui/button'

const props = withDefaults(defineProps<{
  connection: ConnectionSuccessResult
  busy?: boolean
}>(), {
  busy: false
})

const emit = defineEmits<{
  add: []
  edit: [profile: SavedConnectionProfile]
  switch: [profileId: string]
}>()

const profiles = ref<SavedConnectionProfile[]>([])
const loading = ref(true)
const deletingId = ref<string | null>(null)
const switchCandidate = ref<SavedConnectionProfile | null>(null)
const deleteCandidate = ref<SavedConnectionProfile | null>(null)

async function refreshProfiles(): Promise<void> {
  loading.value = true
  try {
    profiles.value = await listSavedConnections()
  } catch {
    showErrorToast('无法读取已保存服务器，请重新启动 Sonavi。', {
      title: '服务器列表读取失败',
      id: 'server-management-list-error'
    })
  } finally {
    loading.value = false
  }
}

async function confirmDelete(): Promise<void> {
  const profile = deleteCandidate.value
  if (!profile || deletingId.value || profile.id === props.connection.profileId) return
  deletingId.value = profile.id
  try {
    if (!(await deleteSavedConnection(profile.id))) throw new Error('delete rejected')
    deleteCandidate.value = null
    await refreshProfiles()
  } catch {
    showErrorToast('无法删除已保存服务器；当前连接不能从这里删除。', {
      title: '删除失败',
      id: 'server-management-delete-error'
    })
  } finally {
    deletingId.value = null
  }
}

function confirmSwitch(): void {
  const profile = switchCandidate.value
  if (!profile || props.busy || profile.id === props.connection.profileId) return
  switchCandidate.value = null
  emit('switch', profile.id)
}

watch(() => props.connection.sessionId, () => { void refreshProfiles() })
onMounted(() => { void refreshProfiles() })
</script>

<template>
  <section class="server-management" aria-labelledby="server-management-title">
    <header class="server-management-header">
      <div>
        <p class="eyebrow">SERVERS</p>
        <h1 id="server-management-title">服务器管理</h1>
        <p>保存最多 20 个系统加密账号，并在同一个播放宿主中安全切换。</p>
      </div>
      <Button :disabled="props.busy" @click="emit('add')">添加服务器</Button>
    </header>

    <section class="current-server" aria-labelledby="current-server-title">
      <div>
        <span class="server-status">当前连接</span>
        <h2 id="current-server-title">{{ props.connection.server.baseUrl }}</h2>
        <p>
          {{ props.connection.server.serverType ?? 'Subsonic 服务器' }}
          <template v-if="!props.connection.profileId"> · 本次会话未保存</template>
        </p>
      </div>
    </section>

    <p v-if="loading" class="server-empty">正在读取已保存服务器…</p>
    <p v-else-if="profiles.length === 0" class="server-empty">
      尚未保存服务器。点击“添加服务器”并勾选“记住我”。
    </p>
    <ul v-else class="server-list">
      <li v-for="profile in profiles" :key="profile.id">
        <div class="server-copy">
          <div class="server-title-row">
            <strong>{{ profile.serverUrl }}</strong>
            <span v-if="profile.id === props.connection.profileId" class="server-status">当前</span>
            <span v-else-if="profile.isDefault" class="server-status is-muted">默认</span>
          </div>
          <span>{{ profile.username }}</span>
        </div>
        <div class="server-actions">
          <Button
            variant="outline"
            size="sm"
            :disabled="props.busy"
            :aria-label="`编辑 ${profile.serverUrl} · ${profile.username}`"
            @click="emit('edit', profile)"
          >
            更新凭据
          </Button>
          <Button
            v-if="profile.id !== props.connection.profileId"
            size="sm"
            :disabled="props.busy"
            :aria-label="`切换到 ${profile.serverUrl} · ${profile.username}`"
            @click="switchCandidate = profile"
          >
            切换
          </Button>
          <Button
            v-if="profile.id !== props.connection.profileId"
            variant="ghost"
            size="sm"
            :disabled="props.busy || deletingId !== null"
            :aria-label="`删除 ${profile.serverUrl} · ${profile.username}`"
            @click="deleteCandidate = profile"
          >
            删除
          </Button>
        </div>
      </li>
    </ul>

    <p class="server-note">
      切换成功后旧连接、媒体句柄和查询缓存会失效；连接失败时仍保留当前会话。删除只作用于本机加密凭据，不修改服务器数据。
    </p>

    <ConfirmationDialog
      :open="switchCandidate !== null"
      title="切换服务器？"
      :description="switchCandidate ? `将切换到 ${switchCandidate.serverUrl}（${switchCandidate.username}）。成功后会停止当前播放并加载目标服务器；连接失败时保留当前会话。` : ''"
      confirm-label="确认切换"
      :busy="props.busy"
      @update:open="(open) => { if (!open) switchCandidate = null }"
      @confirm="confirmSwitch"
    />
    <ConfirmationDialog
      :open="deleteCandidate !== null"
      title="删除已保存服务器？"
      :description="deleteCandidate ? `将删除 ${deleteCandidate.serverUrl} 的系统加密凭据，不会修改服务器数据。` : ''"
      confirm-label="删除服务器"
      :busy="deletingId !== null"
      @update:open="(open) => { if (!open) deleteCandidate = null }"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.server-management {
  display: grid;
  gap: var(--sonavi-space-6);
  max-width: 980px;
  margin: 0 auto;
}

.server-management-header,
.server-list li,
.server-actions,
.server-title-row {
  display: flex;
  align-items: center;
}

.server-management-header,
.server-list li {
  justify-content: space-between;
  gap: var(--sonavi-space-6);
}

.server-management-header h1 {
  margin: var(--sonavi-space-1) 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
}

.server-management-header p,
.current-server p,
.server-copy > span,
.server-note,
.server-empty {
  color: var(--sonavi-text-secondary);
}

.current-server,
.server-list li {
  padding: var(--sonavi-space-4);
  border: 1px solid var(--sonavi-border);
  border-radius: var(--sonavi-card-radius);
  background: var(--sonavi-raised);
}

.current-server {
  border-color: var(--sonavi-accent);
  background: var(--sonavi-accent-subtle);
}

.current-server h2 {
  margin: var(--sonavi-space-2) 0;
  overflow-wrap: anywhere;
  font-size: 1.1rem;
}

.server-list {
  display: grid;
  gap: var(--sonavi-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.server-copy {
  display: grid;
  min-width: 0;
  gap: var(--sonavi-space-1);
}

.server-title-row {
  min-width: 0;
  gap: var(--sonavi-space-2);
}

.server-title-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-status {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--sonavi-accent);
  background: var(--sonavi-accent-subtle);
  font-size: 0.75rem;
  font-weight: 650;
}

.server-status.is-muted {
  color: var(--sonavi-text-secondary);
  background: var(--sonavi-subtle);
}

.server-actions {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sonavi-space-2);
}

.server-note {
  font-size: 0.85rem;
  line-height: 1.65;
}

@media (max-width: 760px) {
  .server-management-header,
  .server-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .server-actions {
    justify-content: flex-start;
  }
}
</style>
