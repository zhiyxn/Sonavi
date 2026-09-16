import { z } from 'zod'
import type {
  ExportDiagnosticsResult,
  NetworkDiagnosticEntry,
  NetworkSettings,
  NetworkSettingsUpdateResult,
  TranscodeSeekRequest,
  TranscodeSeekResult
} from './network'
import { MediaUrlSchema, ResourceIdSchema, SessionIdSchema } from './library-schema'

export const PlaybackPolicySchema = z.object({
  mode: z.enum(['original', 'compatible', 'automatic']),
  maxBitRate: z.union([z.literal(128), z.literal(192), z.literal(256), z.literal(320)])
})

export const ProxyPolicySchema = z
  .object({
    mode: z.enum(['system', 'direct', 'manual']),
    manualUrl: z.string().trim().max(2048).optional()
  })
  .superRefine(({ mode, manualUrl }, context) => {
    if (mode === 'manual' && !manualUrl) {
      context.addIssue({ code: 'custom', path: ['manualUrl'], message: '手动代理需要地址。' })
    }
  })

export const NetworkSettingsSchema = z.object({
  playback: PlaybackPolicySchema,
  proxy: ProxyPolicySchema
}) satisfies z.ZodType<NetworkSettings>

export const NetworkSettingsUpdateResultSchema = z.object({
  settings: NetworkSettingsSchema,
  connectionsReset: z.boolean()
}) satisfies z.ZodType<NetworkSettingsUpdateResult>

export const NetworkDiagnosticEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  stage: z.enum(['api', 'cover', 'audio-original', 'audio-transcode']),
  proxyMode: z.enum(['system', 'direct', 'manual']),
  operation: z.string().min(1).max(64).optional(),
  status: z.number().int().min(100).max(599).optional(),
  contentType: z.string().max(200).optional(),
  errorCategory: z.enum([
    'none',
    'network',
    'certificate',
    'http-authentication',
    'http-forbidden',
    'http-status',
    'server-response',
    'unexpected-content',
    'broken-stream',
    'cancelled',
    'timeout'
  ]),
  errorName: z.string().max(64).optional(),
  errorDetail: z.string().max(200).optional(),
  durationMs: z.number().int().nonnegative(),
  recommendation: z.string().min(1).max(500)
}) satisfies z.ZodType<NetworkDiagnosticEntry>

export const NetworkDiagnosticsSchema = z.array(NetworkDiagnosticEntrySchema).max(200)

export const ExportDiagnosticsResultSchema = z.object({
  exported: z.boolean(),
  cancelled: z.boolean()
}) satisfies z.ZodType<ExportDiagnosticsResult>

export const TranscodeSeekRequestSchema = z.object({
  sessionId: SessionIdSchema,
  trackId: ResourceIdSchema,
  timeOffset: z.number().finite().int().min(0).max(86_400)
}) satisfies z.ZodType<TranscodeSeekRequest>

export const TranscodeSeekResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), streamUrl: MediaUrlSchema, timelineOffset: z.number().nonnegative() }),
  z.object({ ok: z.literal(false), message: z.string().min(1).max(500) })
]) satisfies z.ZodType<TranscodeSeekResult>
