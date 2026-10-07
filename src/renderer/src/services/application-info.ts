import type { ApplicationInfo, UpdateCheckResult } from '../../../shared/application'
import { ApplicationInfoSchema, UpdateCheckResultSchema } from '../../../shared/application-schema'

export async function loadApplicationInfo(): Promise<ApplicationInfo> {
  const rawInfo: unknown = await window.sonavi.application.getInfo()
  return ApplicationInfoSchema.parse(rawInfo)
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  return UpdateCheckResultSchema.parse(await window.sonavi.application.checkForUpdates())
}

export function openReleasesPage(): Promise<boolean> {
  return window.sonavi.application.openReleasesPage()
}

export function downloadUpdate(): Promise<boolean> {
  return window.sonavi.application.downloadUpdate()
}
