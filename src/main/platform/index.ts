import type { PlatformAdapter } from './types'
import { macosAdapter } from './macos'
import { windowsAdapter } from './windows'

const unsupportedAdapter: PlatformAdapter = {
  applicationInfo: {
    platform: 'unsupported',
    platformLabel: '未支持的平台',
    shortcutModifier: 'Ctrl',
    closeBehavior: 'quit',
    canHideToBackground: false
  },
  quitWhenAllWindowsClosed: true,
  createWindowOptions: windowsAdapter.createWindowOptions,
  createMenuTemplate: windowsAdapter.createMenuTemplate
}

export function getPlatformAdapter(platform: NodeJS.Platform): PlatformAdapter {
  if (platform === 'darwin') return macosAdapter
  if (platform === 'win32') return windowsAdapter
  return unsupportedAdapter
}
