import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, session, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  APPLICATION_INFO_CHANNEL,
  OPEN_PROJECT_HOMEPAGE_CHANNEL
} from '../shared/application'
import { ApplicationInfoSchema } from '../shared/application-schema'
import {
  DISCONNECT_CONNECTION_CHANNEL,
  FORGET_CONNECTION_CHANNEL,
  RESTORE_CONNECTION_CHANNEL,
  TEST_CONNECTION_CHANNEL,
  type ConnectionTestResult
} from '../shared/connection'
import {
  ConnectionTestInputSchema,
  ConnectionTestResultSchema,
  RestoredConnectionResultSchema,
  SessionActionResultSchema
} from '../shared/connection-schema'
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
  type AlbumDetail,
  type AlbumPage,
  type ArtistDetail,
  type ArtistLibrary,
  type MutationSuccess,
  type PlaylistDetail,
  type PlaylistSummary,
  type SearchResultPage,
  type StarredLibrary,
  type LibraryResult
} from '../shared/library'
import {
  AlbumDetailResultSchema,
  AlbumIdSchema,
  AlbumListResultSchema,
  AlbumPageRequestSchema,
  ArtistDetailResultSchema,
  ArtistIdSchema,
  ArtistLibraryResultSchema,
  CancelSearchRequestSchema,
  CreatePlaylistRequestSchema,
  DeletePlaylistRequestSchema,
  MutationResultSchema,
  PlaylistDetailResultSchema,
  PlaylistIdSchema,
  PlaylistListResultSchema,
  SearchRequestSchema,
  SearchResultSchema,
  SetStarredRequestSchema,
  SessionIdSchema,
  StarredLibraryResultSchema,
  UpdatePlaylistRequestSchema
} from '../shared/library-schema'
import {
  GET_LYRICS_CHANNEL,
  REPORT_PLAYBACK_CHANNEL,
  type LyricsPayload,
  type PlaybackReportSuccess,
  type PlaybackResult
} from '../shared/playback'
import {
  LyricsRequestSchema,
  LyricsResultSchema,
  PlaybackReportRequestSchema,
  PlaybackReportResultSchema
} from '../shared/playback-schema'
import { getPlatformAdapter } from './platform'
import { assertTrustedIpcSender, isTrustedRendererUrl } from './security/trusted-renderer'
import {
  FileCredentialStore,
  SafeStorageEncryptionProvider
} from './services/credentials/credential-store'
import { ConnectionService } from './services/connection-service'
import { LibraryService } from './services/library-service'
import { MediaHandleRegistry } from './services/media-handle-registry'
import { MediaProtocolService } from './services/media-protocol'
import { OpenSubsonicClient } from './services/opensubsonic/client'
import { ElectronSessionTransport } from './services/opensubsonic/transport'
import { PlaybackService } from './services/playback-service'
import {
  CREATE_TRANSCODE_SEEK_CHANNEL,
  EXPORT_NETWORK_DIAGNOSTICS_CHANNEL,
  GET_NETWORK_SETTINGS_CHANNEL,
  LIST_NETWORK_DIAGNOSTICS_CHANNEL,
  REPORT_PLAYBACK_BUFFER_CHANNEL,
  UPDATE_NETWORK_SETTINGS_CHANNEL,
  type TranscodeSeekResult
} from '../shared/network'
import {
  ExportDiagnosticsResultSchema,
  NetworkDiagnosticsSchema,
  PlaybackBufferDiagnosticRequestSchema,
  NetworkSettingsSchema,
  NetworkSettingsUpdateResultSchema,
  TranscodeSeekRequestSchema,
  TranscodeSeekResultSchema
} from '../shared/network-schema'
import { NetworkDiagnosticRecorder } from './services/network-diagnostics'
import { NetworkPolicyService } from './services/network-policy-service'
import { invalidateNetworkSessionAfterSettingsUpdate } from './services/network-session-invalidation'
import {
  CLEAR_COVER_CACHE_CHANNEL,
  CLEAR_PAUSED_QUEUE_CHANNEL,
  COMPLETE_QUIT_PREPARATION_CHANNEL,
  DESKTOP_COMMAND_CHANNEL,
  GET_COVER_CACHE_INFO_CHANNEL,
  GET_DESKTOP_PREFERENCES_CHANNEL,
  REFRESH_QUEUE_PLAYBACK_CHANNEL,
  RESTART_APPLICATION_CHANNEL,
  RESTORE_PAUSED_QUEUE_CHANNEL,
  SAVE_PAUSED_QUEUE_CHANNEL,
  UPDATE_DESKTOP_PREFERENCES_CHANNEL,
  UPDATE_PLAYBACK_STATUS_CHANNEL,
  type DesktopCommand
} from '../shared/desktop'
import {
  CoverCacheInfoSchema,
  DesktopPlaybackStatusSchema,
  DesktopPreferencesSchema,
  RefreshedQueuePlaybackResultSchema,
  RefreshQueuePlaybackRequestSchema,
  RestoredPausedQueueResultSchema,
  SavePausedQueueRequestSchema
} from '../shared/desktop-schema'
import { CoverCacheService } from './services/cover-cache-service'
import {
  DesktopStateService,
  type PersistedWindowState
} from './services/desktop-state-service'
import { DesktopIntegrationController } from './platform/desktop-integration'

const platformAdapter = getPlatformAdapter(process.platform)
let mainWindow: BrowserWindow | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sonavi-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function registerApplicationIpc(): void {
  ipcMain.handle(APPLICATION_INFO_CHANNEL, (event) => {
    assertTrustedIpcSender(event)

    return ApplicationInfoSchema.parse({
      name: 'Sonavi',
      version: app.getVersion(),
      ...platformAdapter.applicationInfo
    })
  })

  ipcMain.handle(OPEN_PROJECT_HOMEPAGE_CHANNEL, async (event) => {
    assertTrustedIpcSender(event)
    await shell.openExternal('https://github.com/zhiyxn/Sonavi')
    return true
  })
}

function registerConnectionIpc(
  connectionService: ConnectionService,
  mediaHandles: MediaHandleRegistry,
  mediaProtocol: MediaProtocolService,
  libraryService: LibraryService,
  desktopState: DesktopStateService,
  coverCache: CoverCacheService
): void {
  ipcMain.handle(TEST_CONNECTION_CHANNEL, async (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)

    const input = ConnectionTestInputSchema.safeParse(rawInput)
    if (!input.success) {
      const invalidResult: ConnectionTestResult = {
        ok: false,
        error: {
          code: 'invalid-input',
          message: '连接信息不完整或超出允许范围。',
          retryable: false
        }
      }
      return invalidResult
    }

    const previousSessionId = connectionService.getCurrentSessionId()
    const result = ConnectionTestResultSchema.parse(await connectionService.test(input.data))
    if (result.ok && previousSessionId && previousSessionId !== result.sessionId) {
      libraryService.cancelSessionSearches(previousSessionId)
      mediaProtocol.revokeSession(previousSessionId)
      mediaHandles.revokeSession(previousSessionId)
    }
    return result
  })

  ipcMain.handle(RESTORE_CONNECTION_CHANNEL, async (event) => {
    assertTrustedIpcSender(event)
    const previousSessionId = connectionService.getCurrentSessionId()
    const result = RestoredConnectionResultSchema.parse(await connectionService.restore())
    if (result && previousSessionId && previousSessionId !== result.sessionId) {
      libraryService.cancelSessionSearches(previousSessionId)
      mediaProtocol.revokeSession(previousSessionId)
      mediaHandles.revokeSession(previousSessionId)
    }
    return result
  })

  ipcMain.handle(DISCONNECT_CONNECTION_CHANNEL, (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success || !connectionService.getSession(sessionId.data)) return false

    libraryService.cancelSessionSearches(sessionId.data)
    mediaProtocol.revokeSession(sessionId.data)
    mediaHandles.revokeSession(sessionId.data)
    return SessionActionResultSchema.parse(connectionService.disconnect(sessionId.data))
  })

  ipcMain.handle(FORGET_CONNECTION_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success || !connectionService.getSession(sessionId.data)) return false

    const connected = connectionService.getSession(sessionId.data)
    libraryService.cancelSessionSearches(sessionId.data)
    const forgotten = SessionActionResultSchema.parse(
      await connectionService.forget(sessionId.data)
    )
    if (forgotten) {
      mediaProtocol.revokeSession(sessionId.data)
      mediaHandles.revokeSession(sessionId.data)
      await Promise.allSettled([
        desktopState.clearPausedQueue(),
        ...(connected ? [coverCache.clear(connected)] : [])
      ])
    }
    return forgotten
  })
}

function registerLibraryIpc(libraryService: LibraryService): void {
  ipcMain.handle(LIST_ALBUMS_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = AlbumPageRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: LibraryResult<AlbumPage> = {
        ok: false,
        error: { code: 'invalid-input', message: '音乐库会话参数无效。', retryable: false }
      }
      return invalid
    }
    return AlbumListResultSchema.parse(
      await libraryService.listAlbums(
        request.data.sessionId,
        request.data.type,
        request.data.offset,
        request.data.size,
        request.data.attempt
      )
    )
  })

  ipcMain.handle(
    GET_ALBUM_CHANNEL,
    async (event, rawSessionId: unknown, rawAlbumId: unknown) => {
      assertTrustedIpcSender(event)
      const sessionId = SessionIdSchema.safeParse(rawSessionId)
      const albumId = AlbumIdSchema.safeParse(rawAlbumId)
      if (!sessionId.success || !albumId.success) {
        const invalid: LibraryResult<AlbumDetail> = {
          ok: false,
          error: { code: 'invalid-input', message: '专辑请求参数无效。', retryable: false }
        }
        return invalid
      }
      return AlbumDetailResultSchema.parse(await libraryService.getAlbum(sessionId.data, albumId.data))
    }
  )

  ipcMain.handle(LIST_ARTISTS_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success) {
      const invalid: LibraryResult<ArtistLibrary> = {
        ok: false,
        error: { code: 'invalid-input', message: '艺术家列表参数无效。', retryable: false }
      }
      return invalid
    }
    return ArtistLibraryResultSchema.parse(await libraryService.listArtists(sessionId.data))
  })

  ipcMain.handle(
    GET_ARTIST_CHANNEL,
    async (event, rawSessionId: unknown, rawArtistId: unknown) => {
      assertTrustedIpcSender(event)
      const sessionId = SessionIdSchema.safeParse(rawSessionId)
      const artistId = ArtistIdSchema.safeParse(rawArtistId)
      if (!sessionId.success || !artistId.success) {
        const invalid: LibraryResult<ArtistDetail> = {
          ok: false,
          error: { code: 'invalid-input', message: '艺术家请求参数无效。', retryable: false }
        }
        return invalid
      }
      return ArtistDetailResultSchema.parse(
        await libraryService.getArtist(sessionId.data, artistId.data)
      )
    }
  )

  ipcMain.handle(SEARCH_LIBRARY_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = SearchRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: LibraryResult<SearchResultPage> = {
        ok: false,
        error: { code: 'invalid-input', message: '搜索参数无效。', retryable: false }
      }
      return invalid
    }
    return SearchResultSchema.parse(
      await libraryService.search(
        request.data.sessionId,
        request.data.requestId,
        request.data.query,
        request.data.albumOffset,
        request.data.trackOffset,
        request.data.size
      )
    )
  })

  ipcMain.handle(CANCEL_LIBRARY_SEARCH_CHANNEL, (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = CancelSearchRequestSchema.safeParse(rawRequest)
    if (!request.success) return false
    return libraryService.cancelSearch(request.data.sessionId, request.data.requestId)
  })

  ipcMain.handle(LIST_STARRED_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success) {
      const invalid: LibraryResult<StarredLibrary> = {
        ok: false,
        error: { code: 'invalid-input', message: '收藏列表参数无效。', retryable: false }
      }
      return invalid
    }
    return StarredLibraryResultSchema.parse(await libraryService.listStarred(sessionId.data))
  })

  ipcMain.handle(SET_STARRED_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = SetStarredRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: LibraryResult<MutationSuccess> = {
        ok: false,
        error: { code: 'invalid-input', message: '收藏操作参数无效。', retryable: false }
      }
      return invalid
    }
    return MutationResultSchema.parse(
      await libraryService.setStarred(
        request.data.sessionId,
        request.data.targetType,
        request.data.targetId,
        request.data.starred
      )
    )
  })

  ipcMain.handle(LIST_PLAYLISTS_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success) {
      const invalid: LibraryResult<PlaylistSummary[]> = {
        ok: false,
        error: { code: 'invalid-input', message: '歌单列表参数无效。', retryable: false }
      }
      return invalid
    }
    return PlaylistListResultSchema.parse(await libraryService.listPlaylists(sessionId.data))
  })

  ipcMain.handle(
    GET_PLAYLIST_CHANNEL,
    async (event, rawSessionId: unknown, rawPlaylistId: unknown) => {
      assertTrustedIpcSender(event)
      const sessionId = SessionIdSchema.safeParse(rawSessionId)
      const playlistId = PlaylistIdSchema.safeParse(rawPlaylistId)
      if (!sessionId.success || !playlistId.success) {
        const invalid: LibraryResult<PlaylistDetail> = {
          ok: false,
          error: { code: 'invalid-input', message: '歌单详情参数无效。', retryable: false }
        }
        return invalid
      }
      return PlaylistDetailResultSchema.parse(
        await libraryService.getPlaylist(sessionId.data, playlistId.data)
      )
    }
  )

  ipcMain.handle(CREATE_PLAYLIST_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = CreatePlaylistRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: LibraryResult<MutationSuccess> = {
        ok: false,
        error: { code: 'invalid-input', message: '新建歌单参数无效。', retryable: false }
      }
      return invalid
    }
    return MutationResultSchema.parse(
      await libraryService.createPlaylist(
        request.data.sessionId,
        request.data.name,
        request.data.songIds
      )
    )
  })

  ipcMain.handle(UPDATE_PLAYLIST_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = UpdatePlaylistRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: LibraryResult<MutationSuccess> = {
        ok: false,
        error: { code: 'invalid-input', message: '更新歌单参数无效。', retryable: false }
      }
      return invalid
    }
    const { sessionId, playlistId, ...changes } = request.data
    return MutationResultSchema.parse(
      await libraryService.updatePlaylist(sessionId, playlistId, changes)
    )
  })

  ipcMain.handle(DELETE_PLAYLIST_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = DeletePlaylistRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: LibraryResult<MutationSuccess> = {
        ok: false,
        error: { code: 'invalid-input', message: '删除歌单参数无效。', retryable: false }
      }
      return invalid
    }
    return MutationResultSchema.parse(
      await libraryService.deletePlaylist(request.data.sessionId, request.data.playlistId)
    )
  })
}

function registerPlaybackIpc(playbackService: PlaybackService): void {
  ipcMain.handle(GET_LYRICS_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = LyricsRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: PlaybackResult<LyricsPayload> = {
        ok: false,
        error: { code: 'invalid-input', message: '歌词请求参数无效。', retryable: false }
      }
      return invalid
    }
    return LyricsResultSchema.parse(
      await playbackService.getLyrics(
        request.data.sessionId,
        request.data.trackId,
        request.data.artist,
        request.data.title
      )
    )
  })

  ipcMain.handle(REPORT_PLAYBACK_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = PlaybackReportRequestSchema.safeParse(rawRequest)
    if (!request.success) {
      const invalid: PlaybackResult<PlaybackReportSuccess> = {
        ok: false,
        error: { code: 'invalid-input', message: '播放上报参数无效。', retryable: false }
      }
      return invalid
    }
    return PlaybackReportResultSchema.parse(
      await playbackService.report(
        request.data.sessionId,
        request.data.trackId,
        request.data.submission,
        request.data.playedAtMs
      )
    )
  })
}

function registerNetworkIpc(
  networkPolicy: NetworkPolicyService,
  diagnostics: NetworkDiagnosticRecorder,
  connectionService: ConnectionService,
  mediaHandles: MediaHandleRegistry,
  mediaProtocol: MediaProtocolService,
  libraryService: LibraryService
): void {
  ipcMain.handle(GET_NETWORK_SETTINGS_CHANNEL, (event) => {
    assertTrustedIpcSender(event)
    return NetworkSettingsSchema.parse(networkPolicy.getSettings())
  })

  ipcMain.handle(UPDATE_NETWORK_SETTINGS_CHANNEL, async (event, rawSettings: unknown) => {
    assertTrustedIpcSender(event)
    const settings = NetworkSettingsSchema.parse(rawSettings)
    const result = NetworkSettingsUpdateResultSchema.parse(await networkPolicy.update(settings))
    const sessionId = connectionService.getCurrentSessionId()
    invalidateNetworkSessionAfterSettingsUpdate(result.connectionsReset, sessionId, {
      cancelSearches: (id) => libraryService.cancelSessionSearches(id),
      revokeMediaRequests: (id) => mediaProtocol.revokeSession(id),
      revokeMediaHandles: (id) => mediaHandles.revokeSession(id)
    })
    return result
  })

  ipcMain.handle(LIST_NETWORK_DIAGNOSTICS_CHANNEL, (event) => {
    assertTrustedIpcSender(event)
    return NetworkDiagnosticsSchema.parse(diagnostics.list())
  })

  ipcMain.handle(EXPORT_NETWORK_DIAGNOSTICS_CHANNEL, async (event) => {
    assertTrustedIpcSender(event)
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      title: '导出 Sonavi 连接诊断',
      defaultPath: `sonavi-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) {
      return ExportDiagnosticsResultSchema.parse({ exported: false, cancelled: true })
    }
    await writeFile(result.filePath, diagnostics.exportText(), { encoding: 'utf8', mode: 0o600 })
    return ExportDiagnosticsResultSchema.parse({ exported: true, cancelled: false })
  })

  ipcMain.handle(REPORT_PLAYBACK_BUFFER_CHANNEL, (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = PlaybackBufferDiagnosticRequestSchema.parse(rawRequest)
    diagnostics.record({
      stage: 'playback-buffer',
      proxyMode: networkPolicy.getSettings().proxy.mode,
      startedAt: performance.now(),
      event: request.event,
      durationMs: request.durationMs,
      errorCategory: 'none'
    })
  })

  ipcMain.handle(CREATE_TRANSCODE_SEEK_CHANNEL, (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = TranscodeSeekRequestSchema.safeParse(rawRequest)
    let result: TranscodeSeekResult
    if (!request.success) result = { ok: false, message: '转码跳转参数无效。' }
    else {
      const connected = connectionService.getSession(request.data.sessionId)
      const supportsOffset = connected?.server.extensions.some(
        (name) => name.toLowerCase() === 'transcodeoffset'
      )
      if (!connected || !supportsOffset) {
        result = { ok: false, message: '当前服务器未确认支持转码跳转。' }
      } else {
        const settings = networkPolicy.getSettings()
        result = {
          ok: true,
          streamUrl: mediaHandles.create({
            sessionId: request.data.sessionId,
            kind: 'audio',
            resourceId: request.data.trackId,
            streamMode: 'transcode',
            maxBitRate: settings.playback.maxBitRate,
            timeOffset: request.data.timeOffset
          }),
          timelineOffset: request.data.timeOffset
        }
      }
    }
    return TranscodeSeekResultSchema.parse(result)
  })
}

function registerDesktopIpc(
  desktopState: DesktopStateService,
  desktopIntegration: DesktopIntegrationController,
  connectionService: ConnectionService,
  libraryService: LibraryService,
  coverCache: CoverCacheService
): void {
  ipcMain.handle(GET_DESKTOP_PREFERENCES_CHANNEL, (event) => {
    assertTrustedIpcSender(event)
    return DesktopPreferencesSchema.parse(desktopState.getPreferences())
  })

  ipcMain.handle(UPDATE_DESKTOP_PREFERENCES_CHANNEL, async (event, rawPreferences: unknown) => {
    assertTrustedIpcSender(event)
    const preferences = DesktopPreferencesSchema.parse(rawPreferences)
    return DesktopPreferencesSchema.parse(await desktopState.updatePreferences(preferences))
  })

  ipcMain.handle(UPDATE_PLAYBACK_STATUS_CHANNEL, (event, rawStatus: unknown) => {
    assertTrustedIpcSender(event)
    desktopIntegration.updatePlaybackStatus(DesktopPlaybackStatusSchema.parse(rawStatus))
    return true
  })

  ipcMain.handle(SAVE_PAUSED_QUEUE_CHANNEL, async (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = SavePausedQueueRequestSchema.parse(rawRequest)
    const connected = connectionService.getSession(request.sessionId)
    if (!connected) return false
    if (request.tracks.length === 0) await desktopState.clearPausedQueue()
    else await desktopState.savePausedQueue(request, connected)
    return true
  })

  ipcMain.handle(RESTORE_PAUSED_QUEUE_CHANNEL, (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.parse(rawSessionId)
    const connected = connectionService.getSession(sessionId)
    if (!connected) return null
    const restored = desktopState.restorePausedQueue(connected)
    if (!restored) return null
    return RestoredPausedQueueResultSchema.parse({
      ...restored,
      tracks: libraryService.rehydrateTracks(sessionId, restored.tracks)
    })
  })

  ipcMain.handle(REFRESH_QUEUE_PLAYBACK_CHANNEL, (event, rawRequest: unknown) => {
    assertTrustedIpcSender(event)
    const request = RefreshQueuePlaybackRequestSchema.parse(rawRequest)
    if (!connectionService.getSession(request.sessionId)) return null
    return RefreshedQueuePlaybackResultSchema.parse(
      libraryService.rehydrateTracks(request.sessionId, request.tracks)
    )
  })

  ipcMain.handle(CLEAR_PAUSED_QUEUE_CHANNEL, async (event) => {
    assertTrustedIpcSender(event)
    await desktopState.clearPausedQueue()
    return true
  })

  ipcMain.handle(COMPLETE_QUIT_PREPARATION_CHANNEL, (event) => {
    assertTrustedIpcSender(event)
    desktopIntegration.completeQuitPreparation()
    return true
  })

  ipcMain.handle(RESTART_APPLICATION_CHANNEL, (event) => {
    assertTrustedIpcSender(event)
    desktopIntegration.requestRestart()
    return true
  })

  ipcMain.handle(GET_COVER_CACHE_INFO_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.parse(rawSessionId)
    const connected = connectionService.getSession(sessionId)
    if (!connected) return CoverCacheInfoSchema.parse({ itemCount: 0, totalBytes: 0, maxBytes: 128 * 1024 * 1024 })
    return CoverCacheInfoSchema.parse(await coverCache.getInfo(connected))
  })

  ipcMain.handle(CLEAR_COVER_CACHE_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.parse(rawSessionId)
    const connected = connectionService.getSession(sessionId)
    if (!connected) return CoverCacheInfoSchema.parse({ itemCount: 0, totalBytes: 0, maxBytes: 128 * 1024 * 1024 })
    return CoverCacheInfoSchema.parse(await coverCache.clear(connected))
  })
}

function installSecurityPolicies(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler(() => false)
}

function restoreWindowBounds(state: PersistedWindowState | null): Electron.Rectangle | undefined {
  if (!state || state.x === undefined || state.y === undefined) return undefined
  const candidate = { x: state.x, y: state.y, width: state.width, height: state.height }
  const workArea = screen.getDisplayMatching(candidate).workArea
  const width = Math.min(candidate.width, workArea.width)
  const height = Math.min(candidate.height, workArea.height)
  return {
    width,
    height,
    x: Math.min(Math.max(candidate.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(candidate.y, workArea.y), workArea.y + workArea.height - height)
  }
}

function createMainWindow(
  desktopState: DesktopStateService,
  desktopIntegration: DesktopIntegrationController
): BrowserWindow {
  const windowState = desktopState.getWindowState()
  const restoredBounds = restoreWindowBounds(windowState)
  const window = new BrowserWindow({
    width: restoredBounds?.width ?? windowState?.width ?? 1240,
    height: restoredBounds?.height ?? windowState?.height ?? 800,
    ...(restoredBounds ? { x: restoredBounds.x, y: restoredBounds.y } : {}),
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Sonavi',
    frame: true,
    autoHideMenuBar: process.platform === 'win32',
    ...platformAdapter.createWindowOptions(),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      spellcheck: false
    }
  })
  mainWindow = window
  desktopIntegration.attachWindow(window)

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, process.env.ELECTRON_RENDERER_URL)) event.preventDefault()
  })

  window.once('ready-to-show', () => {
    if (windowState?.maximized) window.maximize()
    window.show()
  })
  window.once('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

registerApplicationIpc()

void app.whenReady().then(async () => {
  installSecurityPolicies()
  const diagnostics = new NetworkDiagnosticRecorder()
  const networkPolicy = new NetworkPolicyService(app.getPath('userData'), session.defaultSession)
  await networkPolicy.initialize()
  const desktopState = new DesktopStateService(app.getPath('userData'))
  await desktopState.initialize()
  const client = new OpenSubsonicClient(
    new ElectronSessionTransport(diagnostics, () => networkPolicy.getProxyMode())
  )
  const connectionService = new ConnectionService(
    client,
    new FileCredentialStore(app.getPath('userData'), new SafeStorageEncryptionProvider())
  )
  const mediaHandles = new MediaHandleRegistry()
  const libraryService = new LibraryService(connectionService, client, mediaHandles, networkPolicy)
  const playbackService = new PlaybackService(connectionService, client)
  const coverCache = new CoverCacheService(app.getPath('userData'))
  const mediaProtocol = new MediaProtocolService(
    connectionService,
    mediaHandles,
    (url, init) => session.defaultSession.fetch(url, init),
    diagnostics,
    () => networkPolicy.getProxyMode(),
    coverCache
  )
  const sendDesktopCommand = (command: DesktopCommand): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(DESKTOP_COMMAND_CHANNEL, command)
    }
  }
  const desktopIntegration = new DesktopIntegrationController({
    getWindow: () => mainWindow,
    getPreferences: () => desktopState.getPreferences(),
    saveWindowState: (state) => desktopState.saveWindowState(state),
    sendCommand: sendDesktopCommand,
    relaunchApplication: () => app.relaunch(),
    quitApplication: () => app.quit(),
    recoverNetwork: async () => {
      const sessionId = connectionService.getCurrentSessionId()
      if (sessionId) {
        libraryService.cancelSessionSearches(sessionId)
        mediaProtocol.revokeSession(sessionId)
        mediaHandles.revokeSession(sessionId)
      }
      await session.defaultSession.closeAllConnections()
    }
  })

  protocol.handle('sonavi-media', (request) => mediaProtocol.handle(request))
  registerConnectionIpc(
    connectionService,
    mediaHandles,
    mediaProtocol,
    libraryService,
    desktopState,
    coverCache
  )
  registerLibraryIpc(libraryService)
  registerPlaybackIpc(playbackService)
  registerNetworkIpc(
    networkPolicy,
    diagnostics,
    connectionService,
    mediaHandles,
    mediaProtocol,
    libraryService
  )
  registerDesktopIpc(
    desktopState,
    desktopIntegration,
    connectionService,
    libraryService,
    coverCache
  )
  Menu.setApplicationMenu(Menu.buildFromTemplate(platformAdapter.createMenuTemplate(app.name)))
  desktopIntegration.initialize()
  createMainWindow(desktopState, desktopIntegration)

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow(desktopState, desktopIntegration)
    else desktopIntegration.showWindow()
  })

  app.once('will-quit', () => {
    mediaProtocol.dispose()
    mediaHandles.clear()
    desktopIntegration.dispose()
  })
})

app.on('window-all-closed', () => {
  if (platformAdapter.quitWhenAllWindowsClosed) app.quit()
})
