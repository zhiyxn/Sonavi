import type { ApplicationInfo } from '../../../shared/application'
import { ApplicationInfoSchema } from '../../../shared/application-schema'

export async function loadApplicationInfo(): Promise<ApplicationInfo> {
  const rawInfo: unknown = await window.sonavi.application.getInfo()
  return ApplicationInfoSchema.parse(rawInfo)
}
