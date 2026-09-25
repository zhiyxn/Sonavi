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
  CreatePlaylistRequest,
  DeletePlaylistRequest,
  MutationSuccess,
  PlaylistDetail,
  PlaylistSummary,
  SearchRequest,
  SearchResultPage,
  SetStarredRequest,
  StarredLibrary,
  UpdatePlaylistRequest,
  LibraryResult
} from './library'

export const SessionIdSchema = z.string().uuid()
export const AlbumIdSchema = z.string().min(1).max(1024)
export const AlbumPageRequestSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.enum(['newest', 'alphabeticalByName']),
  offset: z.number().int().min(0).max(10_000_000),
  size: z.number().int().min(1).max(100),
  attempt: z.number().int().min(1).max(20).optional()
}) satisfies z.ZodType<AlbumPageRequest>

export const ArtistIdSchema = z.string().min(1).max(1024)
export const ResourceIdSchema = z.string().min(1).max(1024)
export const PlaylistIdSchema = ResourceIdSchema
export const RequestIdSchema = z.string().uuid()
export const SearchRequestSchema = z.object({
  sessionId: SessionIdSchema,
  requestId: RequestIdSchema,
  query: z.string().trim().max(200),
  artistOffset: z.number().int().min(0).max(10_000_000),
  albumOffset: z.number().int().min(0).max(10_000_000),
  trackOffset: z.number().int().min(0).max(10_000_000),
  artistCount: z.number().int().min(0).max(50),
  albumCount: z.number().int().min(0).max(50),
  trackCount: z.number().int().min(0).max(50)
}).refine(
  ({ artistCount, albumCount, trackCount }) => artistCount + albumCount + trackCount > 0,
  { message: '至少需要请求一种音乐库实体。' }
) satisfies z.ZodType<SearchRequest>

export const CancelSearchRequestSchema = z.object({
  sessionId: SessionIdSchema,
  requestId: RequestIdSchema
}) satisfies z.ZodType<CancelSearchRequest>

export const MediaUrlSchema = z.string().regex(/^sonavi-media:\/\/media\/[a-z0-9_-]+$/i)

export const AlbumSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  artist: z.string(),
  year: z.number().int().optional(),
  songCount: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
  coverUrl: MediaUrlSchema.optional(),
  starred: z.boolean()
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
      streamUrl: MediaUrlSchema,
      fallbackStreamUrl: MediaUrlSchema.optional(),
      playback: z.object({
        streamMode: z.enum(['original', 'transcode']),
        seekMode: z.enum(['native', 'transcode-offset', 'unavailable']),
        reason: z.string().min(1).max(500)
      }),
      starred: z.boolean()
    })
  )
}) satisfies z.ZodType<AlbumDetail>

export const ArtistSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  albumCount: z.number().int().nonnegative(),
  coverUrl: MediaUrlSchema.optional(),
  starred: z.boolean()
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
  artistNextOffset: z.number().int().nonnegative(),
  albumNextOffset: z.number().int().nonnegative(),
  trackNextOffset: z.number().int().nonnegative(),
  artistHasMore: z.boolean(),
  albumHasMore: z.boolean(),
  trackHasMore: z.boolean()
}) satisfies z.ZodType<SearchResultPage>

export const SetStarredRequestSchema = z.object({
  sessionId: SessionIdSchema,
  targetType: z.enum(['track', 'album', 'artist']),
  targetId: ResourceIdSchema,
  starred: z.boolean()
}) satisfies z.ZodType<SetStarredRequest>

export const StarredLibrarySchema = z.object({
  artists: z.array(ArtistSummarySchema),
  albums: z.array(AlbumSummarySchema),
  tracks: AlbumDetailSchema.shape.tracks
}) satisfies z.ZodType<StarredLibrary>

export const PlaylistSummarySchema = z.object({
  id: ResourceIdSchema,
  name: z.string(),
  owner: z.string(),
  public: z.boolean(),
  songCount: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
  comment: z.string().optional(),
  created: z.string().optional(),
  changed: z.string().optional()
}) satisfies z.ZodType<PlaylistSummary>

export const PlaylistDetailSchema = PlaylistSummarySchema.extend({
  tracks: AlbumDetailSchema.shape.tracks
}) satisfies z.ZodType<PlaylistDetail>

const PlaylistNameSchema = z.string().trim().min(1).max(200)
const PlaylistCommentSchema = z.string().max(2_000)
const SongIdsSchema = z.array(ResourceIdSchema).max(1_000)

export const CreatePlaylistRequestSchema = z.object({
  sessionId: SessionIdSchema,
  name: PlaylistNameSchema,
  songIds: SongIdsSchema
}) satisfies z.ZodType<CreatePlaylistRequest>

export const UpdatePlaylistRequestSchema = z
  .object({
    sessionId: SessionIdSchema,
    playlistId: PlaylistIdSchema,
    name: PlaylistNameSchema.optional(),
    comment: PlaylistCommentSchema.optional(),
    public: z.boolean().optional(),
    songIdsToAdd: SongIdsSchema.optional(),
    songIndexesToRemove: z.array(z.number().int().nonnegative().max(1_000_000)).max(1_000).optional()
  })
  .refine(
    ({ name, comment, public: isPublic, songIdsToAdd, songIndexesToRemove }) =>
      name !== undefined ||
      comment !== undefined ||
      isPublic !== undefined ||
      (songIdsToAdd?.length ?? 0) > 0 ||
      (songIndexesToRemove?.length ?? 0) > 0,
    { message: '歌单更新至少需要一个变更。' }
  ) satisfies z.ZodType<UpdatePlaylistRequest>

export const DeletePlaylistRequestSchema = z.object({
  sessionId: SessionIdSchema,
  playlistId: PlaylistIdSchema
}) satisfies z.ZodType<DeletePlaylistRequest>

export const MutationSuccessSchema = z.object({ changed: z.literal(true) }) satisfies z.ZodType<MutationSuccess>

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

export const StarredLibraryResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: StarredLibrarySchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<StarredLibrary>>

export const PlaylistListResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: z.array(PlaylistSummarySchema) }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<PlaylistSummary[]>>

export const PlaylistDetailResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: PlaylistDetailSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<PlaylistDetail>>

export const MutationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: MutationSuccessSchema }),
  z.object({ ok: z.literal(false), error: LibraryErrorSchema })
]) satisfies z.ZodType<LibraryResult<MutationSuccess>>
