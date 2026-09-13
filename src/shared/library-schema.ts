import { z } from 'zod'
import type { AlbumDetail, AlbumSummary, LibraryResult } from './library'

export const SessionIdSchema = z.string().uuid()
export const AlbumIdSchema = z.string().min(1).max(1024)

const MediaUrlSchema = z.string().regex(/^sonavi-media:\/\/media\/[0-9a-f-]+$/i)

export const AlbumSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  artist: z.string(),
  year: z.number().int().optional(),
  songCount: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
  coverUrl: MediaUrlSchema.optional()
}) satisfies z.ZodType<AlbumSummary>

export const AlbumDetailSchema = AlbumSummarySchema.extend({
  tracks: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string(),
      artist: z.string(),
      album: z.string(),
      duration: z.number().nonnegative(),
      track: z.number().int().positive().optional(),
      disc: z.number().int().positive().optional(),
      contentType: z.string().optional(),
      coverUrl: MediaUrlSchema.optional(),
      streamUrl: MediaUrlSchema
    })
  )
}) satisfies z.ZodType<AlbumDetail>

const LibraryErrorSchema = z.object({
  code: z.enum(['not-connected', 'invalid-input', 'network', 'server-response']),
  message: z.string().min(1),
  retryable: z.boolean()
})

export const AlbumListResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: z.array(AlbumSummarySchema) }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<AlbumSummary[]>>

export const AlbumDetailResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: AlbumDetailSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<AlbumDetail>>
