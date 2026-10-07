import type { ConnectionApi } from './connection'
import type { LibraryApi } from './library'
import type { PlaybackApi } from './playback'
import type { NetworkApi } from './network'
import type { DesktopApi } from './desktop'

export const APPLICATION_INFO_CHANNEL = 'sonavi:application:get-info' as const
export const OPEN_PROJECT_HOMEPAGE_CHANNEL = 'sonavi:application:open-project-homepage' as const
export const CHECK_FOR_UPDATES_CHANNEL = 'sonavi:application:check-for-updates' as const
export const OPEN_RELEASES_PAGE_CHANNEL = 'sonavi:application:open-releases-page' as const
export const DOWNLOAD_UPDATE_CHANNEL = 'sonavi:application:download-update' as const

export type UpdateCheckResult =
  | { status: 'available'; version: string; downloadAvailable: boolean }
  | { status: 'up-to-date' }

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
    openProjectHomepage: () => Promise<boolean>
    checkForUpdates: () => Promise<UpdateCheckResult>
    openReleasesPage: () => Promise<boolean>
    downloadUpdate: () => Promise<boolean>
  }
  connection: ConnectionApi
  library: LibraryApi
  playback: PlaybackApi
  network: NetworkApi
  desktop: DesktopApi
}
