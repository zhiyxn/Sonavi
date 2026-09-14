import type {
  LyricsPayload,
  LyricsRequest,
  PlaybackReportRequest,
  PlaybackReportSuccess,
  PlaybackResult
} from '../../../shared/playback'
import { LyricsResultSchema, PlaybackReportResultSchema } from '../../../shared/playback-schema'

function unwrap<T>(result: PlaybackResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

export async function getLyrics(request: LyricsRequest): Promise<LyricsPayload> {
  return unwrap(LyricsResultSchema.parse(await window.sonavi.playback.getLyrics(request)))
}

export async function reportPlayback(
  request: PlaybackReportRequest
): Promise<PlaybackReportSuccess> {
  return unwrap(PlaybackReportResultSchema.parse(await window.sonavi.playback.report(request)))
}
