import { app, BrowserWindow, ipcMain, Menu, session } from 'electron'
import { join } from 'node:path'
import { APPLICATION_INFO_CHANNEL } from '../shared/application'
import { ApplicationInfoSchema } from '../shared/application-schema'
import { getPlatformAdapter } from './platform'
import { assertTrustedIpcSender, isTrustedRendererUrl } from './security/trusted-renderer'

const platformAdapter = getPlatformAdapter(process.platform)

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
  Menu.setApplicationMenu(Menu.buildFromTemplate(platformAdapter.createMenuTemplate(app.name)))
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (platformAdapter.quitWhenAllWindowsClosed) app.quit()
})
