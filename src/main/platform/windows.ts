import type { PlatformAdapter } from './types'
import { translate } from '../../shared/localization'

export const windowsAdapter: PlatformAdapter = {
  applicationInfo: {
    platform: 'windows',
    platformLabel: 'Windows',
    shortcutModifier: 'Ctrl',
    closeBehavior: 'hide-window',
    canHideToBackground: true
  },
  quitWhenAllWindowsClosed: true,
  createWindowOptions: () => ({
    backgroundColor: '#FAF9F6',
    titleBarStyle: 'default'
  }),
  createMenuTemplate: (_applicationName, language) => [
    {
      label: translate(language, '文件'),
      submenu: [{ role: 'quit', label: translate(language, '退出 Sonavi') }]
    },
    {
      label: translate(language, '编辑'),
      submenu: [
        { role: 'undo', label: translate(language, '撤销') },
        { role: 'redo', label: translate(language, '重做') },
        { type: 'separator' },
        { role: 'cut', label: translate(language, '剪切') },
        { role: 'copy', label: translate(language, '复制') },
        { role: 'paste', label: translate(language, '粘贴') },
        { role: 'selectAll', label: translate(language, '全选') }
      ]
    },
    {
      label: translate(language, '窗口'),
      submenu: [
        { role: 'minimize', label: translate(language, '最小化') },
        { role: 'close', label: translate(language, '关闭窗口') }
      ]
    }
  ]
}
