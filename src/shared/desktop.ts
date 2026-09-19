export const GET_DESKTOP_PREFERENCES_CHANNEL = 'sonavi:desktop:get-preferences' as const
export const UPDATE_DESKTOP_PREFERENCES_CHANNEL = 'sonavi:desktop:update-preferences' as const
export const UPDATE_PLAYBACK_STATUS_CHANNEL = 'sonavi:desktop:update-playback-status' as const
export const DESKTOP_COMMAND_CHANNEL = 'sonavi:desktop:command' as const
export const SAVE_PAUSED_QUEUE_CHANNEL = 'sonavi:desktop:save-paused-queue' as const
export const RESTORE_PAUSED_QUEUE_CHANNEL = 'sonavi:desktop:restore-paused-queue' as const
export const REFRESH_QUEUE_PLAYBACK_CHANNEL = 'sonavi:desktop:refresh-queue-playback' as const
export const CLEAR_PAUSED_QUEUE_CHANNEL = 'sonavi:desktop:clear-paused-queue' as const
export const COMPLETE_QUIT_PREPARATION_CHANNEL = 'sonavi:desktop:complete-quit-preparation' as const
export const RESTART_APPLICATION_CHANNEL = 'sonavi:desktop:restart-application' as const
export const GET_COVER_CACHE_INFO_CHANNEL = 'sonavi:desktop:get-cover-cache-info' as const
export const CLEAR_COVER_CACHE_CHANNEL = 'sonavi:desktop:clear-cover-cache' as const

export type CloseAction = 'hide' | 'quit'
export type ThemePreference = 'system' | 'light' | 'dark'
export type DesktopCommand =
  | 'toggle-playback'
  | 'next'
  | 'previous'
  | 'pause-for-system'
  | 'network-resumed'
  | 'prepare-to-quit'

export interface DesktopPreferences {
  closeAction: CloseAction
  theme: ThemePreference
  volume: number
}

export interface DesktopPlaybackStatus {
  hasTrack: boolean
  isPlaying: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  title?: string | undefined
  artist?: string | undefined
  album?: string | undefined
}

export interface PausedQueueTrack {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  track?: number | undefined
  disc?: number | undefined
  contentType?: string | undefined
  coverArtId?: string | undefined
  starred: boolean
}

export interface SavePausedQueueRequest {
  sessionId: string
  tracks: PausedQueueTrack[]
  currentIndex: number
  playbackOrder: 'sequential' | 'shuffle'
  repeatMode: 'off' | 'all' | 'one'
}

export interface RestoredPausedQueue {
  tracks: import('./library').TrackSummary[]
  currentIndex: number
  playbackOrder: 'sequential' | 'shuffle'
  repeatMode: 'off' | 'all' | 'one'
}

export interface RefreshQueuePlaybackRequest {
  sessionId: string
  tracks: PausedQueueTrack[]
}

export interface CoverCacheInfo {
  itemCount: number
  totalBytes: number
  maxBytes: number
}

export interface DesktopApi {
  getPreferences: () => Promise<DesktopPreferences>
  updatePreferences: (preferences: DesktopPreferences) => Promise<DesktopPreferences>
  updatePlaybackStatus: (status: DesktopPlaybackStatus) => Promise<boolean>
  onCommand: (listener: (command: DesktopCommand) => void) => () => void
  savePausedQueue: (request: SavePausedQueueRequest) => Promise<boolean>
  restorePausedQueue: (sessionId: string) => Promise<RestoredPausedQueue | null>
  refreshQueuePlayback: (
    request: RefreshQueuePlaybackRequest
  ) => Promise<import('./library').TrackSummary[] | null>
  clearPausedQueue: () => Promise<boolean>
  completeQuitPreparation: () => Promise<boolean>
  restartApplication: () => Promise<boolean>
  getCoverCacheInfo: (sessionId: string) => Promise<CoverCacheInfo>
  clearCoverCache: (sessionId: string) => Promise<CoverCacheInfo>
}
