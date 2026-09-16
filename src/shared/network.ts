export const GET_NETWORK_SETTINGS_CHANNEL = 'sonavi:network:get-settings' as const
export const UPDATE_NETWORK_SETTINGS_CHANNEL = 'sonavi:network:update-settings' as const
export const LIST_NETWORK_DIAGNOSTICS_CHANNEL = 'sonavi:network:list-diagnostics' as const
export const EXPORT_NETWORK_DIAGNOSTICS_CHANNEL = 'sonavi:network:export-diagnostics' as const
export const CREATE_TRANSCODE_SEEK_CHANNEL = 'sonavi:network:create-transcode-seek' as const

export type PlaybackPolicyMode = 'original' | 'compatible' | 'automatic'
export type ProxyMode = 'system' | 'direct' | 'manual'
export type PlaybackStreamMode = 'original' | 'transcode'
export type PlaybackSeekMode = 'native' | 'transcode-offset' | 'unavailable'

export interface PlaybackPolicy {
  mode: PlaybackPolicyMode
  maxBitRate: 128 | 192 | 256 | 320
}

export interface ProxyPolicy {
  mode: ProxyMode
  manualUrl?: string | undefined
}

export interface NetworkSettings {
  playback: PlaybackPolicy
  proxy: ProxyPolicy
}

export interface NetworkSettingsUpdateResult {
  settings: NetworkSettings
  connectionsReset: boolean
}

export type DiagnosticStage = 'api' | 'cover' | 'audio-original' | 'audio-transcode'
export type DiagnosticErrorCategory =
  | 'none'
  | 'network'
  | 'certificate'
  | 'http-authentication'
  | 'http-forbidden'
  | 'http-status'
  | 'server-response'
  | 'unexpected-content'
  | 'broken-stream'
  | 'cancelled'
  | 'timeout'

export interface NetworkDiagnosticEntry {
  id: string
  timestamp: string
  stage: DiagnosticStage
  proxyMode: ProxyMode
  /** 请求的协议端点名（如 getArtists、stream），不含 URL 与参数。 */
  operation?: string | undefined
  status?: number | undefined
  contentType?: string | undefined
  errorCategory: DiagnosticErrorCategory
  errorName?: string | undefined
  errorDetail?: string | undefined
  durationMs: number
  recommendation: string
}

export interface ExportDiagnosticsResult {
  exported: boolean
  cancelled: boolean
}

export interface TranscodeSeekRequest {
  sessionId: string
  trackId: string
  timeOffset: number
}

export type TranscodeSeekResult =
  | { ok: true; streamUrl: string; timelineOffset: number }
  | { ok: false; message: string }

export interface NetworkApi {
  getSettings: () => Promise<NetworkSettings>
  updateSettings: (settings: NetworkSettings) => Promise<NetworkSettingsUpdateResult>
  listDiagnostics: () => Promise<NetworkDiagnosticEntry[]>
  exportDiagnostics: () => Promise<ExportDiagnosticsResult>
  createTranscodeSeek: (request: TranscodeSeekRequest) => Promise<TranscodeSeekResult>
}
