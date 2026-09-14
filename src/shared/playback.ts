export const GET_LYRICS_CHANNEL = 'sonavi:playback:get-lyrics' as const
export const REPORT_PLAYBACK_CHANNEL = 'sonavi:playback:report' as const

export interface LyricsRequest {
  sessionId: string
  trackId: string
  artist: string
  title: string
}

export interface LyricLine {
  startMs?: number | undefined
  value: string
}

export interface LyricsVariant {
  displayArtist?: string | undefined
  displayTitle?: string | undefined
  language?: string | undefined
  offsetMs: number
  synced: boolean
  lines: LyricLine[]
}

export interface LyricsPayload {
  source: 'structured' | 'legacy' | 'none'
  variants: LyricsVariant[]
}

export interface PlaybackReportRequest {
  sessionId: string
  trackId: string
  submission: boolean
  playedAtMs: number
}

export interface PlaybackReportSuccess {
  reported: true
}

export type PlaybackErrorCode =
  | 'not-connected'
  | 'invalid-input'
  | 'network'
  | 'server-response'

export type PlaybackResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: PlaybackErrorCode; message: string; retryable: boolean } }

export interface PlaybackApi {
  getLyrics: (request: LyricsRequest) => Promise<PlaybackResult<LyricsPayload>>
  report: (request: PlaybackReportRequest) => Promise<PlaybackResult<PlaybackReportSuccess>>
}
