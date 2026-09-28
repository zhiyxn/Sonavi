import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions } from 'electron'
import type { ApplicationInfo } from '../../shared/application'
import type { AppLanguage } from '../../shared/localization'

export interface PlatformAdapter {
  readonly applicationInfo: Pick<
    ApplicationInfo,
    'platform' | 'platformLabel' | 'shortcutModifier' | 'closeBehavior' | 'canHideToBackground'
  >
  readonly quitWhenAllWindowsClosed: boolean
  createWindowOptions: () => Pick<BrowserWindowConstructorOptions, 'backgroundColor' | 'titleBarStyle'>
  createMenuTemplate: (
    applicationName: string,
    language: AppLanguage
  ) => MenuItemConstructorOptions[]
}
