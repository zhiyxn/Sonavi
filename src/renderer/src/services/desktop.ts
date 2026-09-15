import type {
  CoverCacheInfo,
  DesktopPlaybackStatus,
  DesktopPreferences,
  RestoredPausedQueue,
  SavePausedQueueRequest
} from '../../../shared/desktop'
import {
  CoverCacheInfoSchema,
  DesktopPreferencesSchema,
  RestoredPausedQueueResultSchema
} from '../../../shared/desktop-schema'

export async function loadDesktopPreferences(): Promise<DesktopPreferences> {
  return DesktopPreferencesSchema.parse(await window.sonavi.desktop.getPreferences())
}

export async function saveDesktopPreferences(
  preferences: DesktopPreferences
): Promise<DesktopPreferences> {
  return DesktopPreferencesSchema.parse(await window.sonavi.desktop.updatePreferences(preferences))
}

export function updateDesktopPlaybackStatus(status: DesktopPlaybackStatus): Promise<boolean> {
  return window.sonavi.desktop.updatePlaybackStatus(status)
}

export function savePausedQueue(request: SavePausedQueueRequest): Promise<boolean> {
  return window.sonavi.desktop.savePausedQueue(request)
}

export async function restorePausedQueue(sessionId: string): Promise<RestoredPausedQueue | null> {
  return RestoredPausedQueueResultSchema.parse(
    await window.sonavi.desktop.restorePausedQueue(sessionId)
  )
}

export function clearPausedQueue(): Promise<boolean> {
  return window.sonavi.desktop.clearPausedQueue()
}

export function completeQuitPreparation(): Promise<boolean> {
  return window.sonavi.desktop.completeQuitPreparation()
}

export async function loadCoverCacheInfo(sessionId: string): Promise<CoverCacheInfo> {
  return CoverCacheInfoSchema.parse(await window.sonavi.desktop.getCoverCacheInfo(sessionId))
}

export async function clearCoverCache(sessionId: string): Promise<CoverCacheInfo> {
  return CoverCacheInfoSchema.parse(await window.sonavi.desktop.clearCoverCache(sessionId))
}
