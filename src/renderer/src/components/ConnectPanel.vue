<script setup lang="ts">
import { ref } from 'vue'
import type { ApplicationInfo } from '../../../shared/application'

defineProps<{
  applicationInfo: ApplicationInfo
}>()

const serverUrl = ref('')
const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const localMessage = ref('')

function inspectInput(): void {
  const hasRequiredInput = serverUrl.value.trim() !== '' && username.value.trim() !== '' && password.value !== ''
  localMessage.value = hasRequiredInput
    ? '输入项已就绪。真实连接与凭据保存将在 P02 实现。'
    : '请填写服务器地址、用户名和密码。'

  password.value = ''
}
</script>

<template>
  <section class="connect-panel" aria-labelledby="connect-title">
    <p class="eyebrow">01 / CONNECT</p>
    <h1 id="connect-title">连接你的音乐空间</h1>
    <p class="intro">添加 Navidrome、Subsonic 或 OpenSubsonic 服务器。Windows 与 macOS 共用此连接流程。</p>

    <form class="connection-form" novalidate @submit.prevent="inspectInput">
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
      <p class="field-note">支持 HTTPS、自定义端口与子路径；P01 不发送网络请求。</p>

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

      <button type="submit">检查连接输入</button>
      <p class="form-status" role="status">{{ localMessage || '服务器连接将在 P02 接入，目前不会保存或发送凭据。' }}</p>
    </form>

    <footer class="security-note">
      <span aria-hidden="true">◇</span>
      renderer 不直接访问 Node.js；凭据不会进入 localStorage 或 Pinia。
    </footer>
  </section>
</template>
