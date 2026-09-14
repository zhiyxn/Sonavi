import type { ConnectionApi } from './connection'
import type { LibraryApi } from './library'
import type { PlaybackApi } from './playback'

export const APPLICATION_INFO_CHANNEL = 'sonavi:application:get-info' as const

export type SupportedPlatform = 'windows' | 'macos' | 'unsupported'

export interface ApplicationInfo {
  name: 'Sonavi'
  version: string
  platform: SupportedPlatform
  platformLabel: string
  shortcutModifier: 'Ctrl' | 'Cmd'
  closeBehavior: 'quit' | 'close-window'
  canHideToBackground: boolean
}

export interface SonaviApi {
  application: {
    getInfo: () => Promise<ApplicationInfo>
  }
  connection: ConnectionApi
  library: LibraryApi
  playback: PlaybackApi
}
