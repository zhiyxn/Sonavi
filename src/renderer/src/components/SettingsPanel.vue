<script setup lang="ts">
import type { ApplicationInfo } from '../../../shared/application'
import type { ConnectionSuccessResult } from '../../../shared/connection'
import { Button } from './ui/button'

defineProps<{ applicationInfo: ApplicationInfo; connection: ConnectionSuccessResult }>()
const emit = defineEmits<{ disconnect: []; forget: [] }>()
</script>

<template>
  <section class="min-h-full" aria-labelledby="settings-title">
    <p class="eyebrow">05 / SETTINGS</p>
    <h1 id="settings-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">设置</h1>
    <dl class="settings-list">
      <div><dt>平台</dt><dd>{{ applicationInfo.platformLabel }}</dd></div>
      <div><dt>服务器</dt><dd>{{ connection.server.baseUrl }}</dd></div>
      <div><dt>协议版本</dt><dd>{{ connection.server.protocolVersion }}</dd></div>
      <div><dt>后台播放</dt><dd>按后续托盘 / Dock 阶段实现</dd></div>
    </dl>
    <div class="mt-6 flex flex-wrap gap-3">
      <Button variant="outline" @click="emit('disconnect')">断开连接</Button>
      <Button variant="ghost" @click="emit('forget')">退出并忘记账号</Button>
    </div>
  </section>
</template>
