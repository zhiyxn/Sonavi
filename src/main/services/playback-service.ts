import type {
  LyricsPayload,
  PlaybackReportSuccess,
  PlaybackResult
} from '../../shared/playback'
import type { ConnectionService } from './connection-service'
import { ConnectionFailure, OpenSubsonicClient } from './opensubsonic/client'

export class PlaybackService {
  constructor(
    private readonly connectionService: ConnectionService,
    private readonly client: OpenSubsonicClient
  ) {}

  async getLyrics(
    sessionId: string,
    trackId: string,
    artist: string,
    title: string
  ): Promise<PlaybackResult<LyricsPayload>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const lyrics = session.server.extensions.includes('songLyrics')
        ? await this.client.getLyricsBySongId(serverUrl, username, password, trackId)
        : await this.client.getLyrics(serverUrl, username, password, artist, title)
      return { ok: true, value: lyrics }
    } catch (error) {
      return this.failure(error, '无法读取歌词，请稍后重试。')
    }
  }

  async report(
    sessionId: string,
    trackId: string,
    submission: boolean,
    playedAtMs: number
  ): Promise<PlaybackResult<PlaybackReportSuccess>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      await this.client.scrobble(
        serverUrl,
        username,
        password,
        trackId,
        submission,
        playedAtMs
      )
      return { ok: true, value: { reported: true } }
    } catch (error) {
      return this.failure(error, '播放记录暂时无法同步。')
    }
  }

  private notConnected<T>(): PlaybackResult<T> {
    return {
      ok: false,
      error: { code: 'not-connected', message: '连接会话已失效，请重新连接服务器。', retryable: false }
    }
  }

  private failure<T>(error: unknown, fallbackMessage: string): PlaybackResult<T> {
    if (error instanceof ConnectionFailure) {
      return {
        ok: false,
        error: {
          code: error.code === 'network' || error.retryable ? 'network' : 'server-response',
          message: error.message,
          retryable: error.retryable
        }
      }
    }

    return {
      ok: false,
      error: { code: 'network', message: fallbackMessage, retryable: true }
    }
  }
}
