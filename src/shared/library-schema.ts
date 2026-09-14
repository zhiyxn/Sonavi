import { z } from 'zod'
import type {
  AlbumDetail,
  AlbumPage,
  AlbumPageRequest,
  AlbumSummary,
  ArtistDetail,
  ArtistLibrary,
  ArtistSummary,
  CancelSearchRequest,
  SearchRequest,
  SearchResultPage,
  LibraryResult
} from './library'

export const SessionIdSchema = z.string().uuid()
export const AlbumIdSchema = z.string().min(1).max(1024)
export const AlbumPageRequestSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.enum(['newest', 'alphabeticalByName']),
  offset: z.number().int().min(0).max(10_000_000),
  size: z.number().int().min(1).max(100)
}) satisfies z.ZodType<AlbumPageRequest>

export const ArtistIdSchema = z.string().min(1).max(1024)
export const RequestIdSchema = z.string().uuid()
export const SearchRequestSchema = z.object({
  sessionId: SessionIdSchema,
  requestId: RequestIdSchema,
  query: z.string().trim().min(1).max(200),
  offset: z.number().int().min(0).max(10_000_000),
  size: z.number().int().min(1).max(50)
}) satisfies z.ZodType<SearchRequest>

export const CancelSearchRequestSchema = z.object({
  sessionId: SessionIdSchema,
  requestId: RequestIdSchema
}) satisfies z.ZodType<CancelSearchRequest>

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

export const ArtistSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  albumCount: z.number().int().nonnegative(),
  coverUrl: MediaUrlSchema.optional()
}) satisfies z.ZodType<ArtistSummary>

export const ArtistLibrarySchema = z.object({
  indexes: z.array(
    z.object({
      name: z.string(),
      artists: z.array(ArtistSummarySchema)
    })
  )
}) satisfies z.ZodType<ArtistLibrary>

export const ArtistDetailSchema = ArtistSummarySchema.extend({
  albums: z.array(AlbumSummarySchema)
}) satisfies z.ZodType<ArtistDetail>

export const SearchResultPageSchema = z.object({
  artists: z.array(ArtistSummarySchema),
  albums: z.array(AlbumSummarySchema),
  tracks: AlbumDetailSchema.shape.tracks,
  nextOffset: z.number().int().nonnegative(),
  hasMore: z.boolean()
}) satisfies z.ZodType<SearchResultPage>

const LibraryErrorSchema = z.object({
  code: z.enum(['not-connected', 'invalid-input', 'network', 'server-response']),
  message: z.string().min(1),
  retryable: z.boolean()
})

export const AlbumPageSchema = z.object({
  items: z.array(AlbumSummarySchema),
  nextOffset: z.number().int().nonnegative(),
  hasMore: z.boolean()
}) satisfies z.ZodType<AlbumPage>

export const AlbumListResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: AlbumPageSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<AlbumPage>>

export const AlbumDetailResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: AlbumDetailSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<AlbumDetail>>

export const ArtistLibraryResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ArtistLibrarySchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<ArtistLibrary>>

export const ArtistDetailResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ArtistDetailSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<ArtistDetail>>

export const SearchResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: SearchResultPageSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<SearchResultPage>>
