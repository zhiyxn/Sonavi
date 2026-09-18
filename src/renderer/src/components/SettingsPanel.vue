<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApplicationInfo } from '../../../shared/application'
import type { ConnectionSuccessResult } from '../../../shared/connection'
import type { NetworkDiagnosticEntry, NetworkSettings } from '../../../shared/network'
import type { CoverCacheInfo, DesktopPreferences } from '../../../shared/desktop'
import { showErrorToast } from '../lib/notifications'
import {
  exportNetworkDiagnostics,
  loadNetworkDiagnostics,
  loadNetworkSettings,
  saveNetworkSettings
} from '../services/network'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { clearCoverCache, loadCoverCacheInfo } from '../services/desktop'
import { useDesktopStore } from '../stores/desktop'
import ConfirmationDialog from './ConfirmationDialog.vue'

const props = defineProps<{
  applicationInfo: ApplicationInfo
  connection: ConnectionSuccessResult
}>()
const emit = defineEmits<{
  disconnect: []
  forget: []
  networkChanged: [connectionsReset: boolean]
}>()

const settings = ref<NetworkSettings | null>(null)
const diagnostics = ref<NetworkDiagnosticEntry[]>([])
const statusMessage = ref('')
const saving = ref(false)
const savingDesktop = ref(false)
const clearingCache = ref(false)
const cacheConfirmationOpen = ref(false)
const disconnectConfirmationOpen = ref(false)
const desktopSettings = ref<DesktopPreferences | null>(null)
const cacheInfo = ref<CoverCacheInfo | null>(null)
const desktop = useDesktopStore()
const supportsTranscodeOffset = computed(() =>
  props.connection.server.extensions.some((name) => name.toLowerCase() === 'transcodeoffset')
)

const closeActionOptions = [
  { value: 'hide', label: '隐藏窗口并继续播放（默认）' },
  { value: 'quit', label: '退出 Sonavi' }
] as const
const themeOptions = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
] as const
const playbackModeOptions = [
  { value: 'automatic', label: '自动（已知格式优先原始，否则兼容转码）' },
  { value: 'original', label: '仅原始音频' },
  { value: 'compatible', label: 'MP3 兼容转码' }
] as const
const bitRateOptions = [128, 192, 256, 320].map((value) => ({ value, label: `${value} kbps` }))
const proxyModeOptions = [
  { value: 'system', label: '跟随系统代理' },
  { value: 'direct', label: '直接连接' },
  { value: 'manual', label: '手动代理' }
] as const

const stageLabels = {
  api: 'API',
  cover: '封面',
  'audio-original': '原始音频',
  'audio-transcode': '转码音频',
  'playback-buffer': '播放缓冲'
} as const

onMounted(async () => {
  try {
    await desktop.initialize()
    desktopSettings.value = { ...desktop.preferences }
    ;[settings.value, cacheInfo.value] = await Promise.all([
      loadNetworkSettings(),
      loadCoverCacheInfo(props.connection.sessionId)
    ])
    await refreshDiagnostics()
  } catch {
    showErrorToast('无法读取网络与播放设置。', {
      title: '设置加载失败',
      id: 'settings-load-error'
    })
  }
})

async function saveDesktopSettings(): Promise<void> {
  if (!desktopSettings.value || savingDesktop.value) return
  savingDesktop.value = true
  statusMessage.value = ''
  try {
    const saved = await desktop.update(desktopSettings.value)
    desktopSettings.value = { ...saved }
    statusMessage.value = '桌面设置已保存。关闭窗口时将按新规则执行。'
  } catch {
    showErrorToast('桌面设置保存失败。', {
      title: '设置保存失败',
      id: 'desktop-settings-error'
    })
  } finally {
    savingDesktop.value = false
  }
}

async function clearCache(): Promise<void> {
  if (clearingCache.value) return
  clearingCache.value = true
  try {
    cacheInfo.value = await clearCoverCache(props.connection.sessionId)
    statusMessage.value = '当前账号的封面缓存已清空；音频从未写入离线缓存。'
  } catch {
    showErrorToast('封面缓存清理失败。', {
      title: '缓存清理失败',
      id: 'cover-cache-error'
    })
  } finally {
    clearingCache.value = false
    cacheConfirmationOpen.value = false
  }
}

function requestClearCache(): void {
  if (!clearingCache.value) cacheConfirmationOpen.value = true
}

function confirmDisconnect(): void {
  disconnectConfirmationOpen.value = false
  emit('disconnect')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

async function saveSettings(): Promise<void> {
  if (!settings.value || saving.value) return
  saving.value = true
  statusMessage.value = ''
  try {
    const request: NetworkSettings = {
      playback: { ...settings.value.playback },
      proxy:
        settings.value.proxy.mode === 'manual'
          ? { mode: 'manual', manualUrl: settings.value.proxy.manualUrl }
          : { mode: settings.value.proxy.mode }
    }
    const result = await saveNetworkSettings(request)
    settings.value = result.settings
    emit('networkChanged', result.connectionsReset)
    statusMessage.value = result.connectionsReset
      ? '设置已保存；代理已切换，旧连接和当前播放已安全停止。'
      : '播放设置已保存；当前队列与播放保持不变。'
  } catch {
    showErrorToast('请检查代理地址、端口和网络状态。', {
      title: '网络设置保存失败',
      id: 'network-settings-error'
    })
  } finally {
    saving.value = false
  }
}

async function refreshDiagnostics(): Promise<void> {
  diagnostics.value = await loadNetworkDiagnostics()
}

async function exportDiagnostics(): Promise<void> {
  try {
    const result = await exportNetworkDiagnostics()
    if (result.exported) statusMessage.value = '已导出脱敏且限量的诊断日志。'
  } catch {
    showErrorToast('诊断日志导出失败。', {
      title: '导出失败',
      id: 'diagnostics-export-error'
    })
  }
}
</script>

<template>
  <section class="min-h-full" aria-labelledby="settings-title">
    <p class="eyebrow">SETTINGS</p>
    <h1 id="settings-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">设置</h1>
    <dl class="settings-list">
      <div><dt>平台</dt><dd>{{ applicationInfo.platformLabel }}</dd></div>
      <div><dt>服务器</dt><dd>{{ connection.server.baseUrl }}</dd></div>
      <div><dt>协议版本</dt><dd>{{ connection.server.protocolVersion }}</dd></div>
      <div>
        <dt>转码跳转</dt>
        <dd>{{ supportsTranscodeOffset ? '服务器已声明 transcodeOffset' : '未确认支持，将禁用转码进度跳转' }}</dd>
      </div>
      <div><dt>后台播放</dt><dd>托盘 / 菜单栏驻留；选择“退出 Sonavi”才停止播放宿主</dd></div>
    </dl>

    <form v-if="desktopSettings" class="settings-form" @submit.prevent="saveDesktopSettings">
      <fieldset>
        <legend>桌面行为</legend>
        <div class="settings-control-row">
          <Label for="close-action">关闭窗口时</Label>
          <Select v-model="desktopSettings.closeAction">
            <SelectTrigger id="close-action" class="w-full" aria-label="关闭窗口时">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in closeActionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="settings-control-row">
          <Label for="appearance-theme">外观</Label>
          <Select v-model="desktopSettings.theme">
            <SelectTrigger id="appearance-theme" class="w-full" aria-label="外观">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in themeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p class="settings-help">
          最小化始终保留播放。隐藏后可从 Windows 托盘或 macOS 菜单栏重新显示；托盘菜单中的“退出 Sonavi”会停止播放并退出进程。
        </p>
      </fieldset>
      <Button type="submit" :disabled="savingDesktop">
        {{ savingDesktop ? '正在保存…' : '保存桌面设置' }}
      </Button>
    </form>

    <form v-if="settings" class="settings-form" @submit.prevent="saveSettings">
      <fieldset>
        <legend>播放策略</legend>
        <div class="settings-control-row">
          <Label for="playback-mode">模式</Label>
          <Select v-model="settings.playback.mode">
            <SelectTrigger id="playback-mode" class="w-full" aria-label="播放模式">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in playbackModeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="settings-control-row">
          <Label for="max-bitrate">转码最高码率</Label>
          <Select v-model="settings.playback.maxBitRate">
            <SelectTrigger id="max-bitrate" class="w-full" aria-label="转码最高码率">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in bitRateOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p class="settings-help">
          自动模式的原始音频若发生浏览器解码错误，只尝试一次兼容转码；不会无限重试。
        </p>
      </fieldset>

      <fieldset>
        <legend>网络代理</legend>
        <div class="settings-control-row">
          <Label for="proxy-mode">模式</Label>
          <Select v-model="settings.proxy.mode">
            <SelectTrigger id="proxy-mode" class="w-full" aria-label="代理模式">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in proxyModeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="settings.proxy.mode === 'manual'" class="settings-control-row">
          <Label for="manual-proxy-url">代理地址</Label>
          <Input
            id="manual-proxy-url"
            :model-value="settings.proxy.manualUrl ?? ''"
            type="text"
            required
            placeholder="http://127.0.0.1:7890"
            autocomplete="off"
            spellcheck="false"
            @update:model-value="settings.proxy.manualUrl = String($event).trim()"
          />
        </div>
        <p class="settings-help">
          API、封面和音频共用此策略。切换代理会关闭旧连接；失败时不会静默改为直连。
        </p>
      </fieldset>

      <Button type="submit" :disabled="saving">{{ saving ? '正在保存…' : '保存播放与网络设置' }}</Button>
    </form>

    <section class="diagnostics-card" aria-labelledby="diagnostics-title">
      <header>
        <div>
          <h2 id="diagnostics-title">连接诊断</h2>
          <p>仅记录阶段、端点名、状态、类型、分类、耗时与脱敏后的错误文本，不记录 URL、账号、token、资源 ID 或响应正文。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="refreshDiagnostics">刷新</Button>
          <Button variant="ghost" size="sm" @click="exportDiagnostics">导出</Button>
        </div>
      </header>
      <p v-if="diagnostics.length === 0" class="settings-help">暂无请求记录；使用音乐库或播放后再刷新。</p>
      <ol v-else class="diagnostics-list">
        <li v-for="entry in diagnostics.slice(0, 20)" :key="entry.id">
          <strong>{{ stageLabels[entry.stage] }}</strong>
          <span>{{ entry.event || entry.operation || '—' }}<template v-if="entry.requestContext"> · {{ entry.requestContext }}</template><template v-if="entry.attempt"> · 第 {{ entry.attempt }} 次</template> · {{ entry.status ?? '—' }} · {{ entry.contentType || '无类型' }} · {{ entry.durationMs }} ms</span>
          <span>{{ entry.errorCategory }} · {{ entry.recommendation }}</span>
          <span v-if="entry.errorDetail">{{ entry.errorName || 'Error' }}: {{ entry.errorDetail }}</span>
        </li>
      </ol>
    </section>

    <section class="diagnostics-card" aria-labelledby="cache-title">
      <header>
        <div>
          <h2 id="cache-title">封面缓存</h2>
          <p>按账号隔离、最近最少使用淘汰，单账号上限 128 MiB；不缓存音频，不提供离线下载。</p>
        </div>
        <Button variant="outline" size="sm" :disabled="clearingCache" @click="requestClearCache">
          {{ clearingCache ? '正在清理…' : '清空当前账号缓存' }}
        </Button>
      </header>
      <p v-if="cacheInfo" class="settings-help">
        {{ cacheInfo.itemCount }} 项 · {{ formatBytes(cacheInfo.totalBytes) }} / {{ formatBytes(cacheInfo.maxBytes) }}
      </p>
    </section>

    <p v-if="statusMessage" class="settings-status" role="status">{{ statusMessage }}</p>
    <div class="mt-6 flex flex-wrap gap-3">
      <Button variant="outline" @click="disconnectConfirmationOpen = true">断开连接</Button>
      <Button variant="ghost" @click="emit('forget')">退出并忘记账号</Button>
    </div>

    <ConfirmationDialog
      v-model:open="cacheConfirmationOpen"
      title="清空当前账号的封面缓存？"
      description="将删除当前账号在本机的所有封面缓存，不会删除服务器上的音乐。之后浏览时需重新下载封面。"
      confirm-label="清空缓存"
      :busy="clearingCache"
      @confirm="clearCache"
    />
    <ConfirmationDialog
      v-model:open="disconnectConfirmationOpen"
      title="断开当前连接？"
      description="将停止当前播放并退出此会话。已保存的加密凭据会保留，下次启动时仍可自动恢复。"
      confirm-label="确认断开"
      @confirm="confirmDisconnect"
    />
  </section>
</template>
