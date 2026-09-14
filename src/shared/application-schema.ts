import { z } from 'zod'
import type { ApplicationInfo } from './application'

export const SupportedPlatformSchema = z.enum(['windows', 'macos', 'unsupported'])

export const ApplicationInfoSchema = z.object({
  name: z.literal('Sonavi'),
  version: z.string().min(1),
  platform: SupportedPlatformSchema,
  platformLabel: z.string().min(1),
  shortcutModifier: z.enum(['Ctrl', 'Cmd']),
  closeBehavior: z.enum(['hide-window', 'quit']),
  canHideToBackground: z.boolean()
}) satisfies z.ZodType<ApplicationInfo>
