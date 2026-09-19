import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Session } from 'electron'
import type {
  NetworkSettings,
  NetworkSettingsUpdateResult,
  PlaybackSeekMode,
  PlaybackStreamMode,
  ProxyMode
} from '../../shared/network'
import { NetworkSettingsSchema } from '../../shared/network-schema'

const DEFAULT_SETTINGS: NetworkSettings = {
  playback: { mode: 'automatic', maxBitRate: 320 },
  proxy: { mode: 'system' }
}

const DIRECT_PLAYBACK_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-flac',
  'audio/x-wav'
])

export interface PlaybackPlan {
  streamMode: PlaybackStreamMode
  seekMode: PlaybackSeekMode
  reason: string
  maxBitRate?: number | undefined
  fallbackToTranscode: boolean
}

function normalizeManualProxy(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('手动代理地址不是有效 URL。')
  }
  if (!['http:', 'https:', 'socks:', 'socks4:', 'socks5:'].includes(url.protocol)) {
    throw new Error('手动代理仅支持 HTTP、HTTPS、SOCKS4 或 SOCKS5。')
  }
  if (url.username || url.password) throw new Error('手动代理暂不接受 URL 内嵌账号或密码。')
  if (!url.hostname || !url.port || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('手动代理必须包含主机和端口，且不能包含路径。')
  }
  if (url.search || url.hash) throw new Error('手动代理不能包含查询参数或片段。')
  return `${url.protocol}//${url.hostname}:${url.port}`
}

function sameProxy(left: NetworkSettings['proxy'], right: NetworkSettings['proxy']): boolean {
  return left.mode === right.mode && left.manualUrl === right.manualUrl
}

function samePlayback(
  left: NetworkSettings['playback'],
  right: NetworkSettings['playback']
): boolean {
  return left.mode === right.mode && left.maxBitRate === right.maxBitRate
}

export class NetworkPolicyService {
  private settings: NetworkSettings = structuredClone(DEFAULT_SETTINGS)
  private readonly settingsPath: string

  constructor(
    userDataPath: string,
    private readonly electronSession: Session
  ) {
    this.settingsPath = join(userDataPath, 'network-settings.json')
  }

  async initialize(): Promise<void> {
    try {
      const stored = NetworkSettingsSchema.parse(JSON.parse(await readFile(this.settingsPath, 'utf8')))
      this.settings = this.normalize(stored)
    } catch {
      this.settings = structuredClone(DEFAULT_SETTINGS)
    }
    await this.applyProxy(this.settings.proxy)
  }

  getSettings(): NetworkSettings {
    return structuredClone(this.settings)
  }

  getProxyMode(): ProxyMode {
    return this.settings.proxy.mode
  }

  createPlaybackPlan(contentType: string | undefined, supportsTranscodeOffset: boolean): PlaybackPlan {
    const { mode, maxBitRate } = this.settings.playback
    if (mode === 'original') {
      return {
        streamMode: 'original',
        seekMode: 'native',
        reason: '按设置请求原始音频，不进行转码。',
        fallbackToTranscode: false
      }
    }

    const transcodePlan = (reason: string): PlaybackPlan => ({
      streamMode: 'transcode',
      seekMode: supportsTranscodeOffset ? 'transcode-offset' : 'unavailable',
      reason,
      maxBitRate,
      fallbackToTranscode: false
    })
    if (mode === 'compatible') {
      return transcodePlan(`请求 MP3 兼容转码，最高 ${maxBitRate} kbps。`)
    }

    const normalizedType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
    if (!normalizedType || !DIRECT_PLAYBACK_TYPES.has(normalizedType)) {
      return transcodePlan(
        `自动策略未确认该格式可直接播放，使用 MP3 兼容转码，最高 ${maxBitRate} kbps。`
      )
    }
    return {
      streamMode: 'original',
      seekMode: 'native',
      reason: '自动策略优先使用已知媒体类型的原始音频；解码失败时仅重试一次兼容转码。',
      maxBitRate,
      fallbackToTranscode: true
    }
  }

  async update(rawSettings: NetworkSettings): Promise<NetworkSettingsUpdateResult> {
    const next = this.normalize(NetworkSettingsSchema.parse(rawSettings))
    const previous = this.settings
    const connectionsReset = !sameProxy(previous.proxy, next.proxy)
    const playbackChanged = !samePlayback(previous.playback, next.playback)
    if (connectionsReset) await this.applyProxy(next.proxy)
    this.settings = next
    try {
      await this.persist()
    } catch (error) {
      this.settings = previous
      if (connectionsReset) await this.applyProxy(previous.proxy)
      throw error
    }
    return { settings: this.getSettings(), connectionsReset, playbackChanged }
  }

  private normalize(settings: NetworkSettings): NetworkSettings {
    if (settings.proxy.mode !== 'manual') {
      return { playback: { ...settings.playback }, proxy: { mode: settings.proxy.mode } }
    }
    return {
      playback: { ...settings.playback },
      proxy: { mode: 'manual', manualUrl: normalizeManualProxy(settings.proxy.manualUrl!) }
    }
  }

  private async applyProxy(proxy: NetworkSettings['proxy']): Promise<void> {
    if (proxy.mode === 'system') await this.electronSession.setProxy({ mode: 'system' })
    else if (proxy.mode === 'direct') await this.electronSession.setProxy({ mode: 'direct' })
    else {
      await this.electronSession.setProxy({
        mode: 'fixed_servers',
        proxyRules: normalizeManualProxy(proxy.manualUrl!)
      })
    }
    await this.electronSession.closeAllConnections()
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.settingsPath), { recursive: true })
    const temporaryPath = `${this.settingsPath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(this.settings, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    })
    await rename(temporaryPath, this.settingsPath)
  }
}
