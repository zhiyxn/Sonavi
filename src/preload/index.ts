import { contextBridge, ipcRenderer } from 'electron'
import {
  APPLICATION_INFO_CHANNEL,
  OPEN_PROJECT_HOMEPAGE_CHANNEL,
  type SonaviApi
} from '../shared/application'
import {
  DISCONNECT_CONNECTION_CHANNEL,
  FORGET_CONNECTION_CHANNEL,
  RESTORE_CONNECTION_CHANNEL,
  TEST_CONNECTION_CHANNEL,
  type ConnectionTestInput
} from '../shared/connection'
import {
  CANCEL_LIBRARY_SEARCH_CHANNEL,
  CREATE_PLAYLIST_CHANNEL,
  DELETE_PLAYLIST_CHANNEL,
  GET_ALBUM_CHANNEL,
  GET_ARTIST_CHANNEL,
  GET_PLAYLIST_CHANNEL,
  LIST_ALBUMS_CHANNEL,
  LIST_ARTISTS_CHANNEL,
  LIST_PLAYLISTS_CHANNEL,
  LIST_STARRED_CHANNEL,
  SEARCH_LIBRARY_CHANNEL,
  SET_STARRED_CHANNEL,
  UPDATE_PLAYLIST_CHANNEL,
  type AlbumPageRequest,
  type CancelSearchRequest,
  type CreatePlaylistRequest,
  type DeletePlaylistRequest,
  type SearchRequest,
  type SetStarredRequest,
  type UpdatePlaylistRequest
} from '../shared/library'
import {
  GET_LYRICS_CHANNEL,
  REPORT_PLAYBACK_CHANNEL,
  type LyricsRequest,
  type PlaybackReportRequest
} from '../shared/playback'
import {
  CREATE_TRANSCODE_SEEK_CHANNEL,
  EXPORT_NETWORK_DIAGNOSTICS_CHANNEL,
  GET_NETWORK_SETTINGS_CHANNEL,
  LIST_NETWORK_DIAGNOSTICS_CHANNEL,
  REPORT_PLAYBACK_BUFFER_CHANNEL,
  UPDATE_NETWORK_SETTINGS_CHANNEL,
  type NetworkSettings,
  type PlaybackBufferDiagnosticRequest,
  type TranscodeSeekRequest
} from '../shared/network'
import {
  CLEAR_COVER_CACHE_CHANNEL,
  CLEAR_PAUSED_QUEUE_CHANNEL,
  COMPLETE_QUIT_PREPARATION_CHANNEL,
  DESKTOP_COMMAND_CHANNEL,
  GET_COVER_CACHE_INFO_CHANNEL,
  GET_DESKTOP_PREFERENCES_CHANNEL,
  REFRESH_QUEUE_PLAYBACK_CHANNEL,
  RESTORE_PAUSED_QUEUE_CHANNEL,
  SAVE_PAUSED_QUEUE_CHANNEL,
  UPDATE_DESKTOP_PREFERENCES_CHANNEL,
  UPDATE_PLAYBACK_STATUS_CHANNEL,
  type DesktopPlaybackStatus,
  type DesktopPreferences,
  type DesktopCommand,
  type RefreshQueuePlaybackRequest,
  type SavePausedQueueRequest
} from '../shared/desktop'

const DESKTOP_COMMANDS = new Set<DesktopCommand>([
  'toggle-playback',
  'next',
  'previous',
  'pause-for-system',
  'network-resumed',
  'prepare-to-quit'
])

const sonaviApi: SonaviApi = Object.freeze({
  application: Object.freeze({
    getInfo: () => ipcRenderer.invoke(APPLICATION_INFO_CHANNEL),
    openProjectHomepage: () => ipcRenderer.invoke(OPEN_PROJECT_HOMEPAGE_CHANNEL)
  }),
  connection: Object.freeze({
    test: (input: ConnectionTestInput) => ipcRenderer.invoke(TEST_CONNECTION_CHANNEL, input),
    restore: () => ipcRenderer.invoke(RESTORE_CONNECTION_CHANNEL),
    disconnect: (sessionId: string) =>
      ipcRenderer.invoke(DISCONNECT_CONNECTION_CHANNEL, sessionId),
    forget: (sessionId: string) => ipcRenderer.invoke(FORGET_CONNECTION_CHANNEL, sessionId)
  }),
  library: Object.freeze({
    listAlbums: (request: AlbumPageRequest) => ipcRenderer.invoke(LIST_ALBUMS_CHANNEL, request),
    getAlbum: (sessionId: string, albumId: string) =>
      ipcRenderer.invoke(GET_ALBUM_CHANNEL, sessionId, albumId),
    listArtists: (sessionId: string) => ipcRenderer.invoke(LIST_ARTISTS_CHANNEL, sessionId),
    getArtist: (sessionId: string, artistId: string) =>
      ipcRenderer.invoke(GET_ARTIST_CHANNEL, sessionId, artistId),
    search: (request: SearchRequest) => ipcRenderer.invoke(SEARCH_LIBRARY_CHANNEL, request),
    cancelSearch: (request: CancelSearchRequest) =>
      ipcRenderer.invoke(CANCEL_LIBRARY_SEARCH_CHANNEL, request),
    listStarred: (sessionId: string) => ipcRenderer.invoke(LIST_STARRED_CHANNEL, sessionId),
    setStarred: (request: SetStarredRequest) => ipcRenderer.invoke(SET_STARRED_CHANNEL, request),
    listPlaylists: (sessionId: string) => ipcRenderer.invoke(LIST_PLAYLISTS_CHANNEL, sessionId),
    getPlaylist: (sessionId: string, playlistId: string) =>
      ipcRenderer.invoke(GET_PLAYLIST_CHANNEL, sessionId, playlistId),
    createPlaylist: (request: CreatePlaylistRequest) =>
      ipcRenderer.invoke(CREATE_PLAYLIST_CHANNEL, request),
    updatePlaylist: (request: UpdatePlaylistRequest) =>
      ipcRenderer.invoke(UPDATE_PLAYLIST_CHANNEL, request),
    deletePlaylist: (request: DeletePlaylistRequest) =>
      ipcRenderer.invoke(DELETE_PLAYLIST_CHANNEL, request)
  }),
  playback: Object.freeze({
    getLyrics: (request: LyricsRequest) => ipcRenderer.invoke(GET_LYRICS_CHANNEL, request),
    report: (request: PlaybackReportRequest) => ipcRenderer.invoke(REPORT_PLAYBACK_CHANNEL, request)
  }),
  network: Object.freeze({
    getSettings: () => ipcRenderer.invoke(GET_NETWORK_SETTINGS_CHANNEL),
    updateSettings: (settings: NetworkSettings) =>
      ipcRenderer.invoke(UPDATE_NETWORK_SETTINGS_CHANNEL, settings),
    listDiagnostics: () => ipcRenderer.invoke(LIST_NETWORK_DIAGNOSTICS_CHANNEL),
    exportDiagnostics: () => ipcRenderer.invoke(EXPORT_NETWORK_DIAGNOSTICS_CHANNEL),
    reportPlaybackBuffer: (request: PlaybackBufferDiagnosticRequest) =>
      ipcRenderer.invoke(REPORT_PLAYBACK_BUFFER_CHANNEL, request),
    createTranscodeSeek: (request: TranscodeSeekRequest) =>
      ipcRenderer.invoke(CREATE_TRANSCODE_SEEK_CHANNEL, request)
  }),
  desktop: Object.freeze({
    getPreferences: () => ipcRenderer.invoke(GET_DESKTOP_PREFERENCES_CHANNEL),
    updatePreferences: (preferences: DesktopPreferences) =>
      ipcRenderer.invoke(UPDATE_DESKTOP_PREFERENCES_CHANNEL, preferences),
    updatePlaybackStatus: (status: DesktopPlaybackStatus) =>
      ipcRenderer.invoke(UPDATE_PLAYBACK_STATUS_CHANNEL, status),
    onCommand: (listener: (command: DesktopCommand) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, rawCommand: unknown): void => {
        if (typeof rawCommand === 'string' && DESKTOP_COMMANDS.has(rawCommand as DesktopCommand)) {
          listener(rawCommand as DesktopCommand)
        }
      }
      ipcRenderer.on(DESKTOP_COMMAND_CHANNEL, wrapped)
      return () => ipcRenderer.removeListener(DESKTOP_COMMAND_CHANNEL, wrapped)
    },
    savePausedQueue: (request: SavePausedQueueRequest) =>
      ipcRenderer.invoke(SAVE_PAUSED_QUEUE_CHANNEL, request),
    restorePausedQueue: (sessionId: string) =>
      ipcRenderer.invoke(RESTORE_PAUSED_QUEUE_CHANNEL, sessionId),
    refreshQueuePlayback: (request: RefreshQueuePlaybackRequest) =>
      ipcRenderer.invoke(REFRESH_QUEUE_PLAYBACK_CHANNEL, request),
    clearPausedQueue: () => ipcRenderer.invoke(CLEAR_PAUSED_QUEUE_CHANNEL),
    completeQuitPreparation: () => ipcRenderer.invoke(COMPLETE_QUIT_PREPARATION_CHANNEL),
    getCoverCacheInfo: (sessionId: string) =>
      ipcRenderer.invoke(GET_COVER_CACHE_INFO_CHANNEL, sessionId),
    clearCoverCache: (sessionId: string) =>
      ipcRenderer.invoke(CLEAR_COVER_CACHE_CHANNEL, sessionId)
  })
})

contextBridge.exposeInMainWorld('sonavi', sonaviApi)
