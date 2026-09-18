import type {
  NetworkSettings,
  NetworkSettingsUpdateResult,
  PlaybackBufferDiagnosticRequest,
  TranscodeSeekRequest,
  TranscodeSeekResult
} from '../../../shared/network'
import {
  ExportDiagnosticsResultSchema,
  NetworkDiagnosticsSchema,
  NetworkSettingsSchema,
  NetworkSettingsUpdateResultSchema,
  TranscodeSeekResultSchema
} from '../../../shared/network-schema'

export async function loadNetworkSettings(): Promise<NetworkSettings> {
  return NetworkSettingsSchema.parse(await window.sonavi.network.getSettings())
}

export async function saveNetworkSettings(
  settings: NetworkSettings
): Promise<NetworkSettingsUpdateResult> {
  return NetworkSettingsUpdateResultSchema.parse(
    await window.sonavi.network.updateSettings(settings)
  )
}

export async function loadNetworkDiagnostics() {
  return NetworkDiagnosticsSchema.parse(await window.sonavi.network.listDiagnostics())
}

export async function exportNetworkDiagnostics() {
  return ExportDiagnosticsResultSchema.parse(await window.sonavi.network.exportDiagnostics())
}

export async function reportPlaybackBuffer(
  request: PlaybackBufferDiagnosticRequest
): Promise<void> {
  await window.sonavi.network.reportPlaybackBuffer(request)
}

export async function createTranscodeSeek(
  request: TranscodeSeekRequest
): Promise<TranscodeSeekResult> {
  return TranscodeSeekResultSchema.parse(
    await window.sonavi.network.createTranscodeSeek(request)
  )
}
