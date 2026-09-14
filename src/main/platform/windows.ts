import type { PlatformAdapter } from './types'

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
  createMenuTemplate: () => [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出 Sonavi' }]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize', label: '最小化' }, { role: 'close', label: '关闭窗口' }]
    }
  ]
}
