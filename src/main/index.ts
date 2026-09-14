import { app, BrowserWindow, ipcMain, Menu, protocol, session } from 'electron'
import { join } from 'node:path'
import { APPLICATION_INFO_CHANNEL } from '../shared/application'
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

const platformAdapter = getPlatformAdapter(process.platform)

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
}

function registerConnectionIpc(
  connectionService: ConnectionService,
  mediaHandles: MediaHandleRegistry,
  mediaProtocol: MediaProtocolService,
  libraryService: LibraryService
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

    libraryService.cancelSessionSearches(sessionId.data)
    const forgotten = SessionActionResultSchema.parse(
      await connectionService.forget(sessionId.data)
    )
    if (forgotten) {
      mediaProtocol.revokeSession(sessionId.data)
      mediaHandles.revokeSession(sessionId.data)
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
        request.data.size
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
        request.data.offset,
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

function installSecurityPolicies(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler(() => false)
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 800,
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

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, process.env.ELECTRON_RENDERER_URL)) event.preventDefault()
  })

  window.once('ready-to-show', () => window.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

registerApplicationIpc()

void app.whenReady().then(() => {
  installSecurityPolicies()
  const client = new OpenSubsonicClient(new ElectronSessionTransport())
  const connectionService = new ConnectionService(
    client,
    new FileCredentialStore(app.getPath('userData'), new SafeStorageEncryptionProvider())
  )
  const mediaHandles = new MediaHandleRegistry()
  const libraryService = new LibraryService(connectionService, client, mediaHandles)
  const playbackService = new PlaybackService(connectionService, client)
  const mediaProtocol = new MediaProtocolService(
    connectionService,
    mediaHandles,
    (url, init) => session.defaultSession.fetch(url, init)
  )

  protocol.handle('sonavi-media', (request) => mediaProtocol.handle(request))
  registerConnectionIpc(connectionService, mediaHandles, mediaProtocol, libraryService)
  registerLibraryIpc(libraryService)
  registerPlaybackIpc(playbackService)
  Menu.setApplicationMenu(Menu.buildFromTemplate(platformAdapter.createMenuTemplate(app.name)))
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.once('before-quit', () => {
    mediaProtocol.dispose()
    mediaHandles.clear()
  })
})

app.on('window-all-closed', () => {
  if (platformAdapter.quitWhenAllWindowsClosed) app.quit()
})
