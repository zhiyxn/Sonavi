import type { ConnectionApi } from './connection'
import type { LibraryApi } from './library'
import type { PlaybackApi } from './playback'
import type { NetworkApi } from './network'
import type { DesktopApi } from './desktop'

export const APPLICATION_INFO_CHANNEL = 'sonavi:application:get-info' as const

export type SupportedPlatform = 'windows' | 'macos' | 'unsupported'

export interface ApplicationInfo {
  name: 'Sonavi'
  version: string
  platform: SupportedPlatform
  platformLabel: string
  shortcutModifier: 'Ctrl' | 'Cmd'
  closeBehavior: 'hide-window' | 'quit'
  canHideToBackground: boolean
}

export interface SonaviApi {
  application: {
    getInfo: () => Promise<ApplicationInfo>
  }
  connection: ConnectionApi
  library: LibraryApi
  playback: PlaybackApi
  network: NetworkApi
  desktop: DesktopApi
}
