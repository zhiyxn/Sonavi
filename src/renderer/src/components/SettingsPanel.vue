<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApplicationInfo } from '../../../shared/application'
import type { ConnectionSuccessResult } from '../../../shared/connection'
import type { NetworkDiagnosticEntry, NetworkSettings } from '../../../shared/network'
import type { CoverCacheInfo, DesktopPreferences } from '../../../shared/desktop'
import { checkForUpdates, downloadUpdate, openReleasesPage } from '../services/application-info'
import { showErrorToast } from '../lib/notifications'
import {
  exportNetworkDiagnostics,
  loadNetworkDiagnostics,
  loadNetworkSettings,
  saveNetworkSettings
} from '../services/network'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { clearCoverCache, loadCoverCacheInfo, restartApplication } from '../services/desktop'
import { useDesktopStore } from '../stores/desktop'
import ConfirmationDialog from './ConfirmationDialog.vue'
import { t } from '../i18n'

const props = defineProps<{
  applicationInfo: ApplicationInfo
  connection: ConnectionSuccessResult
}>()
const emit = defineEmits<{
  disconnect: []
  forget: []
  networkChanged: [connectionsReset: boolean, playbackChanged: boolean]
}>()

const settings = ref<NetworkSettings | null>(null)
const diagnostics = ref<NetworkDiagnosticEntry[]>([])
const statusMessage = ref('')
const saving = ref(false)
const savingDesktop = ref(false)
const clearingCache = ref(false)
const cacheConfirmationOpen = ref(false)
const disconnectConfirmationOpen = ref(false)
const restartConfirmationOpen = ref(false)
const restarting = ref(false)
const desktopSettings = ref<DesktopPreferences | null>(null)
const updateStatus = ref<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle')
const availableVersion = ref('')
const downloadAvailable = ref(false)
const openingDownload = ref(false)
const downloadMessage = ref('')
const cacheInfo = ref<CoverCacheInfo | null>(null)
const desktop = useDesktopStore()
const supportsTranscodeOffset = computed(() =>
  props.connection.server.extensions.some((name) => name.toLowerCase() === 'transcodeoffset')
)

const closeActionOptions = computed(() => [
  { value: 'hide', label: t('隐藏窗口并继续播放（默认）') },
  { value: 'quit', label: t('退出 Sonavi') }
] as const)
const themeOptions = computed(() => [
  { value: 'system', label: t('跟随系统') },
  { value: 'light', label: t('浅色') },
  { value: 'dark', label: t('深色') }
] as const)
const languageOptions = computed(() => [
  { value: 'zh-CN', label: t('简体中文') },
  { value: 'en-US', label: t('英文') }
] as const)
const selectedCloseActionLabel = computed(() =>
  closeActionOptions.value.find((option) => option.value === desktopSettings.value?.closeAction)?.label ?? ''
)
const selectedThemeLabel = computed(() =>
  themeOptions.value.find((option) => option.value === desktopSettings.value?.theme)?.label ?? ''
)
const selectedLanguageLabel = computed(() =>
  languageOptions.value.find((option) => option.value === desktopSettings.value?.language)?.label ?? ''
)
const playbackModeOptions = computed(() => [
  { value: 'automatic', label: t('自动（已知格式优先原始，否则兼容转码）') },
  { value: 'original', label: t('仅原始音频') },
  { value: 'compatible', label: t('MP3 兼容转码') }
] as const)
const bitRateOptions = [128, 192, 256, 320].map((value) => ({ value, label: `${value} kbps` }))
const proxyModeOptions = computed(() => [
  { value: 'system', label: t('跟随系统代理') },
  { value: 'direct', label: t('直接连接') },
  { value: 'manual', label: t('手动代理') }
] as const)
const selectedPlaybackModeLabel = computed(() =>
  playbackModeOptions.value.find((option) => option.value === settings.value?.playback.mode)?.label ?? ''
)
const selectedBitRateLabel = computed(() =>
  bitRateOptions.find((option) => option.value === settings.value?.playback.maxBitRate)?.label ?? ''
)
const selectedProxyModeLabel = computed(() =>
  proxyModeOptions.value.find((option) => option.value === settings.value?.proxy.mode)?.label ?? ''
)

const stageLabels = computed(() => ({
  api: 'API',
  cover: t('封面'),
  'audio-original': t('原始音频'),
  'audio-transcode': t('转码音频'),
  'playback-buffer': t('播放缓冲')
} as const))

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
    statusMessage.value = t('桌面设置已保存。关闭窗口时将按新规则执行。')
  } catch {
    showErrorToast('桌面设置保存失败。', {
      title: '设置保存失败',
      id: 'desktop-settings-error'
    })
  } finally {
    savingDesktop.value = false
  }
}

async function checkUpdates(): Promise<void> {
  if (updateStatus.value === 'checking') return
  updateStatus.value = 'checking'
  availableVersion.value = ''
  downloadAvailable.value = false
  downloadMessage.value = ''
  try {
    const result = await checkForUpdates()
    updateStatus.value = result.status
    if (result.status === 'available') {
      availableVersion.value = result.version
      downloadAvailable.value = result.downloadAvailable
    }
  } catch {
    updateStatus.value = 'error'
  }
}

async function downloadInstaller(): Promise<void> {
  if (openingDownload.value) return
  openingDownload.value = true
  try {
    await downloadUpdate()
    downloadMessage.value = t('已在默认浏览器中打开下载链接。')
  } catch {
    showErrorToast('无法打开安装包下载链接，请稍后重试或查看发布页。', {
      title: '下载入口打开失败',
      id: 'download-update-error'
    })
  } finally {
    openingDownload.value = false
  }
}

async function openReleaseListing(): Promise<void> {
  try {
    await openReleasesPage()
  } catch {
    showErrorToast('无法调用系统默认浏览器，请稍后重试。', {
      title: '无法打开发布页',
      id: 'open-releases-error'
    })
  }
}

async function clearCache(): Promise<void> {
  if (clearingCache.value) return
  clearingCache.value = true
  try {
    cacheInfo.value = await clearCoverCache(props.connection.sessionId)
    statusMessage.value = t('当前账号的封面缓存已清空；音频从未写入离线缓存。')
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

async function confirmRestart(): Promise<void> {
  if (restarting.value) return
  restarting.value = true
  try {
    await restartApplication()
  } catch {
    showErrorToast('无法请求重启，请先保存工作后手动退出并重新打开 Sonavi。', {
      title: '重启失败',
      id: 'restart-application-error'
    })
  } finally {
    restarting.value = false
    restartConfirmationOpen.value = false
  }
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
    emit('networkChanged', result.connectionsReset, result.playbackChanged)
    statusMessage.value = result.connectionsReset
      ? t('设置已保存；代理已切换，旧连接和当前播放已安全停止。')
      : result.playbackChanged
        ? t('播放设置已保存；当前歌曲会尽量从原进度切换，否则下一曲生效。')
        : t('设置已保存；当前队列与播放保持不变。')
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
    if (result.exported) statusMessage.value = t('已导出脱敏且限量的诊断日志。')
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
    <h1 id="settings-title" class="mt-4 text-4xl font-medium tracking-[-0.04em]">{{ t('设置') }}</h1>
    <dl class="settings-list">
      <div><dt>{{ t('平台') }}</dt><dd>{{ applicationInfo.platformLabel }}</dd></div>
      <div><dt>{{ t('服务器') }}</dt><dd>{{ connection.server.baseUrl }}</dd></div>
      <div><dt>{{ t('协议版本') }}</dt><dd>{{ connection.server.protocolVersion }}</dd></div>
      <div>
        <dt>{{ t('转码跳转') }}</dt>
        <dd>{{ t(supportsTranscodeOffset ? '服务器已声明 transcodeOffset' : '未确认支持，将禁用转码进度跳转') }}</dd>
      </div>
      <div><dt>{{ t('后台播放') }}</dt><dd>{{ t('托盘 / 菜单栏驻留；选择“退出 Sonavi”才停止播放宿主') }}</dd></div>
    </dl>

    <form v-if="desktopSettings" class="settings-form" @submit.prevent="saveDesktopSettings">
      <fieldset>
        <legend>{{ t('桌面行为') }}</legend>
        <div class="settings-control-row">
          <Label for="close-action">{{ t('关闭窗口时') }}</Label>
          <Select v-model="desktopSettings.closeAction">
            <SelectTrigger id="close-action" class="w-full" :aria-label="t('关闭窗口时')">
              <SelectValue>{{ selectedCloseActionLabel }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in closeActionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="settings-control-row">
          <Label for="appearance-theme">{{ t('外观') }}</Label>
          <Select v-model="desktopSettings.theme">
            <SelectTrigger id="appearance-theme" class="w-full" :aria-label="t('外观')">
              <SelectValue>{{ selectedThemeLabel }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in themeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="settings-control-row">
          <Label for="interface-language">{{ t('界面语言') }}</Label>
          <Select v-model="desktopSettings.language">
            <SelectTrigger id="interface-language" class="w-full" :aria-label="t('界面语言')">
              <SelectValue>{{ selectedLanguageLabel }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in languageOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="settings-control-row">
          <Label for="check-updates-on-startup">{{ t('启动时检查更新') }}</Label>
          <Checkbox id="check-updates-on-startup" v-model="desktopSettings.checkUpdatesOnStartup" />
        </div>
        <p class="settings-help">
          {{ t('最小化始终保留播放。隐藏后可从 Windows 托盘或 macOS 菜单栏重新显示；托盘菜单中的“退出 Sonavi”会停止播放并退出进程。') }}
        </p>
      </fieldset>
      <Button type="submit" :disabled="savingDesktop">
        {{ t(savingDesktop ? '正在保存…' : '保存桌面设置') }}
      </Button>
    </form>

    <fieldset class="diagnostics-card">
      <legend>{{ t('检查更新') }}</legend>
      <header>
        <div>
          <p>{{ t('当前版本：v{version}', { version: applicationInfo.version }) }}</p>
        </div>
        <Button variant="outline" :disabled="updateStatus === 'checking'" @click="checkUpdates">
          {{ t(updateStatus === 'checking' ? '正在检查…' : '检查更新') }}
        </Button>
      </header>
      <p v-if="updateStatus !== 'idle'" class="settings-help" role="status">
        <template v-if="updateStatus === 'checking'">{{ t('正在查询公开发布版本…') }}</template>
        <template v-else-if="updateStatus === 'available'">{{ t('发现新版本：{version}', { version: availableVersion }) }}</template>
        <template v-else-if="updateStatus === 'up-to-date'">{{ t('当前已是最新版本。') }}</template>
        <template v-else>{{ t('检查更新失败，请检查网络或稍后重试。') }}</template>
      </p>
      <div v-if="updateStatus === 'available'" class="flex flex-wrap gap-2">
        <Button v-if="downloadAvailable" :disabled="openingDownload" @click="downloadInstaller">
          {{ t('下载当前系统安装包') }}
        </Button>
        <Button variant="ghost" size="sm" @click="openReleaseListing">{{ t('查看发布页') }}</Button>
      </div>
      <p v-if="downloadMessage" class="settings-help" role="status">{{ downloadMessage }}</p>
    </fieldset>

    <form v-if="settings" class="settings-form" @submit.prevent="saveSettings">
      <fieldset>
        <legend>{{ t('播放策略') }}</legend>
        <div class="settings-control-row">
          <Label for="playback-mode">{{ t('模式') }}</Label>
          <Select v-model="settings.playback.mode">
            <SelectTrigger id="playback-mode" class="w-full" :aria-label="t('播放模式')">
              <SelectValue>{{ selectedPlaybackModeLabel }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in playbackModeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="settings-control-row">
          <Label for="max-bitrate">{{ t('转码最高码率') }}</Label>
          <Select v-model="settings.playback.maxBitRate">
            <SelectTrigger id="max-bitrate" class="w-full" :aria-label="t('转码最高码率')">
              <SelectValue>{{ selectedBitRateLabel }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in bitRateOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p class="settings-help">
          {{ t('自动模式的原始音频若发生浏览器解码错误，只尝试一次兼容转码；不会无限重试。') }}
        </p>
      </fieldset>

      <fieldset>
        <legend>{{ t('网络代理') }}</legend>
        <div class="settings-control-row">
          <Label for="proxy-mode">{{ t('模式') }}</Label>
          <Select v-model="settings.proxy.mode">
            <SelectTrigger id="proxy-mode" class="w-full" :aria-label="t('代理模式')">
              <SelectValue>{{ selectedProxyModeLabel }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in proxyModeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="settings.proxy.mode === 'manual'" class="settings-control-row">
          <Label for="manual-proxy-url">{{ t('代理地址') }}</Label>
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
          {{ t('API、封面和音频共用此策略。切换代理会关闭旧连接；失败时不会静默改为直连。') }}
        </p>
      </fieldset>

      <Button type="submit" :disabled="saving">{{ t(saving ? '正在保存…' : '保存播放与网络设置') }}</Button>
    </form>

    <fieldset class="diagnostics-card">
      <legend>{{ t('连接诊断') }}</legend>
      <header>
        <div>
          <p>{{ t('仅记录阶段、端点名、状态、类型、分类、耗时与脱敏后的错误文本，不记录 URL、账号、token、资源 ID 或响应正文。') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="refreshDiagnostics">{{ t('刷新') }}</Button>
          <Button variant="ghost" size="sm" @click="exportDiagnostics">{{ t('导出') }}</Button>
        </div>
      </header>
      <p v-if="diagnostics.length === 0" class="settings-help">{{ t('暂无请求记录；使用音乐库或播放后再刷新。') }}</p>
      <ol v-else class="diagnostics-list">
        <li v-for="entry in diagnostics.slice(0, 20)" :key="entry.id">
          <strong>{{ stageLabels[entry.stage] }}</strong>
          <span>
            {{ entry.event || entry.operation || '—' }}<template v-if="entry.requestContext"> · {{ entry.requestContext }}</template><template v-if="entry.attempt"> · {{ t('第 {attempt} 次', { attempt: entry.attempt }) }}</template> · {{ entry.status ?? '—' }} · {{ entry.contentType || t('无类型') }} · {{ entry.durationMs }} ms<template v-if="entry.queueMs !== undefined"> · {{ t('排队 {duration} ms', { duration: entry.queueMs }) }}</template><template v-if="entry.upstreamMs !== undefined"> · {{ t('上游 {duration} ms', { duration: entry.upstreamMs }) }}</template><template v-if="entry.responseHeadersMs !== undefined"> · {{ t('响应头 {duration} ms', { duration: entry.responseHeadersMs }) }}</template><template v-if="entry.responseBytes !== undefined"> · {{ t('已读 {size}', { size: formatBytes(entry.responseBytes) }) }}</template>
          </span>
          <span>{{ entry.errorCategory }} · {{ t(entry.recommendation) }}</span>
          <span v-if="entry.errorDetail">{{ entry.errorName || 'Error' }}: {{ t(entry.errorDetail) }}</span>
        </li>
      </ol>
    </fieldset>

    <fieldset class="diagnostics-card">
      <legend>{{ t('封面缓存') }}</legend>
      <header>
        <div>
          <p>{{ t('按账号隔离、最近最少使用淘汰，单账号上限 128 MiB；不缓存音频，不提供离线下载。') }}</p>
        </div>
        <Button variant="outline" size="sm" :disabled="clearingCache" @click="requestClearCache">
          {{ t(clearingCache ? '正在清理…' : '清空当前账号缓存') }}
        </Button>
      </header>
      <p v-if="cacheInfo" class="settings-help">
        {{ t('{count} 项', { count: cacheInfo.itemCount }) }} · {{ formatBytes(cacheInfo.totalBytes) }} / {{ formatBytes(cacheInfo.maxBytes) }}
      </p>
    </fieldset>

    <fieldset class="diagnostics-card">
      <legend>{{ t('应用恢复') }}</legend>
      <header>
        <div>
          <p>{{ t('界面或播放状态异常时，可关闭当前进程并重新打开 Sonavi。当前队列会按既有退出流程保存，并在重启后以暂停状态恢复；若整个应用已无法响应，仍需使用系统强制退出。') }}</p>
        </div>
        <Button variant="outline" :disabled="restarting" @click="restartConfirmationOpen = true">
          {{ t(restarting ? '正在重启…' : '重启 Sonavi') }}
        </Button>
      </header>
    </fieldset>

    <p v-if="statusMessage" class="settings-status" role="status">{{ statusMessage }}</p>
    <div class="mt-6 flex flex-wrap gap-3">
      <Button variant="outline" @click="disconnectConfirmationOpen = true">{{ t('断开连接') }}</Button>
      <Button variant="ghost" @click="emit('forget')">{{ t('退出并忘记账号') }}</Button>
    </div>

    <ConfirmationDialog
      v-model:open="cacheConfirmationOpen"
      :title="t('清空当前账号的封面缓存？')"
      :description="t('将删除当前账号在本机的所有封面缓存，不会删除服务器上的音乐。之后浏览时需重新下载封面。')"
      :confirm-label="t('清空缓存')"
      :busy="clearingCache"
      @confirm="clearCache"
    />
    <ConfirmationDialog
      v-model:open="disconnectConfirmationOpen"
      :title="t('断开当前连接？')"
      :description="t('将停止当前播放并退出此会话。已保存的加密凭据会保留，下次启动时仍可自动恢复。')"
      :confirm-label="t('确认断开')"
      @confirm="confirmDisconnect"
    />
    <ConfirmationDialog
      v-model:open="restartConfirmationOpen"
      :title="t('重启 Sonavi？')"
      :description="t('当前播放会停止，队列将保存并在新进程中以暂停状态恢复。尚未保存的设置修改不会保留。')"
      :confirm-label="t('确认重启')"
      :busy="restarting"
      @confirm="confirmRestart"
    />
  </section>
</template>
