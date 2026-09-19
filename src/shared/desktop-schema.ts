import { z } from 'zod'
import type {
  CoverCacheInfo,
  DesktopCommand,
  DesktopPlaybackStatus,
  DesktopPreferences,
  RefreshQueuePlaybackRequest,
  RestoredPausedQueue,
  SavePausedQueueRequest
} from './desktop'
import { AlbumDetailSchema, ResourceIdSchema, SessionIdSchema } from './library-schema'

export const DesktopCommandSchema = z.enum([
  'toggle-playback',
  'next',
  'previous',
  'pause-for-system',
  'network-resumed'
]) satisfies z.ZodType<DesktopCommand>

export const DesktopPreferencesSchema = z.object({
  closeAction: z.enum(['hide', 'quit']),
  theme: z.enum(['system', 'light', 'dark']),
  volume: z.number().finite().min(0).max(1)
}) satisfies z.ZodType<DesktopPreferences>

export const DesktopPlaybackStatusSchema = z.object({
  hasTrack: z.boolean(),
  isPlaying: z.boolean(),
  canGoPrevious: z.boolean(),
  canGoNext: z.boolean(),
  title: z.string().max(500).optional(),
  artist: z.string().max(500).optional(),
  album: z.string().max(500).optional()
}) satisfies z.ZodType<DesktopPlaybackStatus>

export const PausedQueueTrackSchema = z.object({
  id: ResourceIdSchema,
  title: z.string().max(500),
  artist: z.string().max(500),
  album: z.string().max(500),
  duration: z.number().finite().nonnegative().max(86_400),
  track: z.number().int().positive().optional(),
  disc: z.number().int().positive().optional(),
  contentType: z.string().max(200).optional(),
  coverArtId: ResourceIdSchema.optional(),
  starred: z.boolean()
})

export const SavePausedQueueRequestSchema = z.object({
  sessionId: SessionIdSchema,
  tracks: z.array(PausedQueueTrackSchema).max(1_000),
  currentIndex: z.number().int().min(0).max(999),
  playbackOrder: z.enum(['sequential', 'shuffle']),
  repeatMode: z.enum(['off', 'all', 'one'])
}) satisfies z.ZodType<SavePausedQueueRequest>

export const RestoredPausedQueueSchema = z.object({
  tracks: AlbumDetailSchema.shape.tracks,
  currentIndex: z.number().int().nonnegative(),
  playbackOrder: z.enum(['sequential', 'shuffle']),
  repeatMode: z.enum(['off', 'all', 'one'])
}) satisfies z.ZodType<RestoredPausedQueue>

export const RestoredPausedQueueResultSchema = RestoredPausedQueueSchema.nullable()

export const RefreshQueuePlaybackRequestSchema = z.object({
  sessionId: SessionIdSchema,
  tracks: z.array(PausedQueueTrackSchema).min(1).max(1_000)
}) satisfies z.ZodType<RefreshQueuePlaybackRequest>

export const RefreshedQueuePlaybackResultSchema = AlbumDetailSchema.shape.tracks.nullable()

export const CoverCacheInfoSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  maxBytes: z.number().int().positive()
}) satisfies z.ZodType<CoverCacheInfo>
