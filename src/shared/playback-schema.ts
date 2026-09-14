import { z } from 'zod'
import { ResourceIdSchema, SessionIdSchema } from './library-schema'
import type {
  LyricsPayload,
  LyricsRequest,
  LyricsVariant,
  PlaybackReportRequest,
  PlaybackReportSuccess,
  PlaybackResult
} from './playback'

const TrackTextSchema = z.string().trim().min(1).max(512)

export const LyricsRequestSchema = z.object({
  sessionId: SessionIdSchema,
  trackId: ResourceIdSchema,
  artist: TrackTextSchema,
  title: TrackTextSchema
}) satisfies z.ZodType<LyricsRequest>

const LyricLineSchema = z.object({
  startMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  value: z.string().max(20_000)
})

export const LyricsVariantSchema = z.object({
  displayArtist: z.string().max(512).optional(),
  displayTitle: z.string().max(512).optional(),
  language: z.string().max(64).optional(),
  offsetMs: z.number().int().min(-86_400_000).max(86_400_000),
  synced: z.boolean(),
  lines: z.array(LyricLineSchema).max(50_000)
}) satisfies z.ZodType<LyricsVariant>

export const LyricsPayloadSchema = z.object({
  source: z.enum(['structured', 'legacy', 'none']),
  variants: z.array(LyricsVariantSchema).max(100)
}) satisfies z.ZodType<LyricsPayload>

export const PlaybackReportRequestSchema = z.object({
  sessionId: SessionIdSchema,
  trackId: ResourceIdSchema,
  submission: z.boolean(),
  playedAtMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}) satisfies z.ZodType<PlaybackReportRequest>

export const PlaybackReportSuccessSchema = z.object({
  reported: z.literal(true)
}) satisfies z.ZodType<PlaybackReportSuccess>

const PlaybackErrorSchema = z.object({
  code: z.enum(['not-connected', 'invalid-input', 'network', 'server-response']),
  message: z.string().min(1),
  retryable: z.boolean()
})

export const LyricsResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: LyricsPayloadSchema }),
  z.object({ ok: z.literal(false), error: PlaybackErrorSchema })
]) satisfies z.ZodType<PlaybackResult<LyricsPayload>>

export const PlaybackReportResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: PlaybackReportSuccessSchema }),
  z.object({ ok: z.literal(false), error: PlaybackErrorSchema })
]) satisfies z.ZodType<PlaybackResult<PlaybackReportSuccess>>
