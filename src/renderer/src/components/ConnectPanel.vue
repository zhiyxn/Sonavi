<script setup lang="ts">
import { ref } from 'vue'
import type { ApplicationInfo } from '../../../shared/application'
import type { ConnectionSuccessResult } from '../../../shared/connection'
import { showErrorToast } from '../lib/notifications'
import { testConnection } from '../services/connection'

defineProps<{
  applicationInfo: ApplicationInfo
}>()

const emit = defineEmits<{
  connected: [result: ConnectionSuccessResult]
}>()

const serverUrl = ref('')
const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const allowInsecureHttp = ref(false)
const statusMessage = ref('请输入服务器连接信息。')
const statusKind = ref<'idle' | 'success' | 'error'>('idle')
const isSubmitting = ref(false)

async function submitConnection(): Promise<void> {
  if (isSubmitting.value) return

  isSubmitting.value = true
  statusKind.value = 'idle'
  statusMessage.value = '正在安全地检查服务器…'

  try {
    const result = await testConnection({
      serverUrl: serverUrl.value,
      username: username.value,
      password: password.value,
      rememberMe: rememberMe.value,
      allowInsecureHttp: allowInsecureHttp.value
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
</script>

<template>
  <section class="connect-panel" aria-labelledby="connect-title">
    <p class="eyebrow">CONNECT</p>
    <h1 id="connect-title">连接你的音乐空间</h1>
    <p class="intro">添加 Navidrome、Subsonic 或 OpenSubsonic 服务器。Windows 与 macOS 共用此连接流程。</p>

    <form class="connection-form" novalidate @submit.prevent="submitConnection">
      <label for="server-url">服务器地址</label>
      <input
        id="server-url"
        v-model="serverUrl"
        name="serverUrl"
        type="url"
        inputmode="url"
        autocomplete="url"
        placeholder="https://music.example.com"
      />
      <p class="field-note">支持 HTTPS、自定义端口与子路径；不会绕过 TLS 证书验证。</p>

      <label for="username">用户名</label>
      <input id="username" v-model="username" name="username" type="text" autocomplete="username" />

      <label for="password">密码</label>
      <input
        id="password"
        v-model="password"
        name="password"
        type="password"
        autocomplete="current-password"
      />

      <label class="remember-row" for="remember-me">
        <input id="remember-me" v-model="rememberMe" name="rememberMe" type="checkbox" />
        <span>在这台 {{ applicationInfo.platformLabel }} 设备上记住我</span>
      </label>

      <label class="remember-row" for="allow-insecure-http">
        <input
          id="allow-insecure-http"
          v-model="allowInsecureHttp"
          name="allowInsecureHttp"
          type="checkbox"
        />
        <span>允许不加密的 HTTP（仅限我了解风险的局域网测试）</span>
      </label>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? '正在测试…' : '测试连接' }}
      </button>
      <p class="form-status" :class="`is-${statusKind}`" role="status">{{ statusMessage }}</p>
    </form>

    <footer class="security-note">
      <span aria-hidden="true">◇</span>
      renderer 不直接访问 Node.js；密码不会进入 localStorage、Pinia 或日志。
    </footer>
  </section>
</template>
