import type { PlatformAdapter } from './types'
import { translate } from '../../shared/localization'

export const macosAdapter: PlatformAdapter = {
  applicationInfo: {
    platform: 'macos',
    platformLabel: 'macOS',
    shortcutModifier: 'Cmd',
    closeBehavior: 'hide-window',
    canHideToBackground: true
  },
  quitWhenAllWindowsClosed: false,
  createWindowOptions: () => ({
    backgroundColor: '#FAF9F6',
    titleBarStyle: 'default'
  }),
  createMenuTemplate: (applicationName, language) => [
    {
      label: applicationName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: translate(language, '编辑'),
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: translate(language, '窗口'),
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
    }
  ]
}
