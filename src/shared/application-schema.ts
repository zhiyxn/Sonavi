import { z } from 'zod'
import type { ApplicationInfo, UpdateCheckResult } from './application'

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

export const UpdateCheckResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/),
    downloadAvailable: z.boolean()
  }),
  z.object({ status: z.literal('up-to-date') })
]) satisfies z.ZodType<UpdateCheckResult>
