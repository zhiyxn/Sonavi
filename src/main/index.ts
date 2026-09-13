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
  GET_ALBUM_CHANNEL,
  LIST_ALBUMS_CHANNEL,
  type AlbumDetail,
  type AlbumSummary,
  type LibraryResult
} from '../shared/library'
import {
  AlbumDetailResultSchema,
  AlbumIdSchema,
  AlbumListResultSchema,
  SessionIdSchema
} from '../shared/library-schema'
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
  mediaProtocol: MediaProtocolService
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
      mediaProtocol.revokeSession(previousSessionId)
      mediaHandles.revokeSession(previousSessionId)
    }
    return result
  })

  ipcMain.handle(DISCONNECT_CONNECTION_CHANNEL, (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success || !connectionService.getSession(sessionId.data)) return false

    mediaProtocol.revokeSession(sessionId.data)
    mediaHandles.revokeSession(sessionId.data)
    return SessionActionResultSchema.parse(connectionService.disconnect(sessionId.data))
  })

  ipcMain.handle(FORGET_CONNECTION_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success || !connectionService.getSession(sessionId.data)) return false

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
  ipcMain.handle(LIST_ALBUMS_CHANNEL, async (event, rawSessionId: unknown) => {
    assertTrustedIpcSender(event)
    const sessionId = SessionIdSchema.safeParse(rawSessionId)
    if (!sessionId.success) {
      const invalid: LibraryResult<AlbumSummary[]> = {
        ok: false,
        error: { code: 'invalid-input', message: '音乐库会话参数无效。', retryable: false }
      }
      return invalid
    }
    return AlbumListResultSchema.parse(await libraryService.listAlbums(sessionId.data))
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
  const mediaProtocol = new MediaProtocolService(
    connectionService,
    mediaHandles,
    (url, init) => session.defaultSession.fetch(url, init)
  )

  protocol.handle('sonavi-media', (request) => mediaProtocol.handle(request))
  registerConnectionIpc(connectionService, mediaHandles, mediaProtocol)
  registerLibraryIpc(libraryService)
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
