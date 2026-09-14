import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  powerMonitor,
  Tray,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'node:path'
import type {
  DesktopCommand,
  DesktopPlaybackStatus,
  DesktopPreferences
} from '../../shared/desktop'
import type { PersistedWindowState } from '../services/desktop-state-service'

export interface TrayActions {
  showWindow: () => void
  sendCommand: (command: DesktopCommand) => void
  quit: () => void
}

export function createTrayMenuTemplate(
  status: DesktopPlaybackStatus,
  actions: TrayActions
): MenuItemConstructorOptions[] {
  return [
    { label: '显示 Sonavi', click: actions.showWindow },
    { type: 'separator' },
    {
      label: status.isPlaying ? '暂停' : '播放',
      enabled: status.hasTrack,
      click: () => actions.sendCommand('toggle-playback')
    },
    {
      label: '上一首',
      enabled: status.canGoPrevious,
      click: () => actions.sendCommand('previous')
    },
    {
      label: '下一首',
      enabled: status.canGoNext,
      click: () => actions.sendCommand('next')
    },
    { type: 'separator' },
    { label: '真正退出 Sonavi', click: actions.quit }
  ]
}

interface DesktopIntegrationOptions {
  getWindow: () => BrowserWindow | null
  getPreferences: () => DesktopPreferences
  saveWindowState: (state: PersistedWindowState) => Promise<void>
  sendCommand: (command: DesktopCommand) => void
  recoverNetwork: () => Promise<void>
}

const EMPTY_PLAYBACK_STATUS: DesktopPlaybackStatus = {
  hasTrack: false,
  isPlaying: false,
  canGoPrevious: false,
  canGoNext: false
}

export class DesktopIntegrationController {
  private tray: Tray | null = null
  private playbackStatus = { ...EMPTY_PLAYBACK_STATUS }
  private quitting = false
  private saveTimer: NodeJS.Timeout | null = null
  private readonly onBeforeQuit = (): void => {
    this.quitting = true
  }
  private readonly onSuspend = (): void => this.options.sendCommand('pause-for-system')
  private readonly onLockScreen = (): void => this.options.sendCommand('pause-for-system')
  private readonly onResume = (): void => {
    void this.options
      .recoverNetwork()
      .then(() => this.options.sendCommand('network-resumed'))
      .catch(() => undefined)
  }

  constructor(private readonly options: DesktopIntegrationOptions) {}

  initialize(): void {
    app.on('before-quit', this.onBeforeQuit)
    powerMonitor.on('suspend', this.onSuspend)
    powerMonitor.on('lock-screen', this.onLockScreen)
    powerMonitor.on('resume', this.onResume)
    powerMonitor.on('unlock-screen', this.onResume)
    this.createTray()
  }

  attachWindow(window: BrowserWindow): void {
    window.on('close', (event) => {
      this.scheduleWindowStateSave(window, true)
      if (this.quitting) return
      event.preventDefault()
      if (this.options.getPreferences().closeAction === 'hide') window.hide()
      else app.quit()
    })
    window.on('resize', () => this.scheduleWindowStateSave(window))
    window.on('move', () => this.scheduleWindowStateSave(window))
    window.on('maximize', () => this.scheduleWindowStateSave(window))
    window.on('unmaximize', () => this.scheduleWindowStateSave(window))
  }

  showWindow(): void {
    const window = this.options.getWindow()
    if (!window || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  updatePlaybackStatus(status: DesktopPlaybackStatus): void {
    this.playbackStatus = { ...status }
    if (this.tray) this.tray.setContextMenu(this.buildTrayMenu())
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    app.removeListener('before-quit', this.onBeforeQuit)
    powerMonitor.removeListener('suspend', this.onSuspend)
    powerMonitor.removeListener('lock-screen', this.onLockScreen)
    powerMonitor.removeListener('resume', this.onResume)
    powerMonitor.removeListener('unlock-screen', this.onResume)
    this.tray?.destroy()
    this.tray = null
  }

  private createTray(): void {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(app.getAppPath(), 'build', 'icon.png')
    const source = nativeImage.createFromPath(iconPath)
    if (source.isEmpty()) return
    const icon = process.platform === 'darwin' ? source.resize({ width: 18, height: 18 }) : source
    if (process.platform === 'darwin') icon.setTemplateImage(true)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Sonavi')
    this.tray.setContextMenu(this.buildTrayMenu())
    this.tray.on('click', () => this.showWindow())
  }

  private buildTrayMenu(): Menu {
    return Menu.buildFromTemplate(
      createTrayMenuTemplate(this.playbackStatus, {
        showWindow: () => this.showWindow(),
        sendCommand: (command) => this.options.sendCommand(command),
        quit: () => app.quit()
      })
    )
  }

  private scheduleWindowStateSave(window: BrowserWindow, immediately = false): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    const save = (): void => {
      this.saveTimer = null
      if (window.isDestroyed()) return
      const bounds = window.getNormalBounds()
      void this.options.saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized: window.isMaximized()
      })
    }
    if (immediately) save()
    else this.saveTimer = setTimeout(save, 300)
  }
}
