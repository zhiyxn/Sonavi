import type { AlbumDetail, AlbumPage, LibraryResult } from '../../shared/library'
import type { ConnectionService } from './connection-service'
import { MediaHandleRegistry } from './media-handle-registry'
import { ConnectionFailure, OpenSubsonicClient } from './opensubsonic/client'

export class LibraryService {
  constructor(
    private readonly connectionService: ConnectionService,
    private readonly client: OpenSubsonicClient,
    private readonly mediaHandles: MediaHandleRegistry
  ) {}

  async listAlbums(
    sessionId: string,
    offset: number,
    size: number
  ): Promise<LibraryResult<AlbumPage>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const albums = await this.client.getAlbumList2(
        serverUrl,
        username,
        password,
        offset,
        size
      )
      return {
        ok: true,
        value: {
          items: albums.map(({ coverArtId, ...album }) => ({
            ...album,
            ...(coverArtId
              ? {
                  coverUrl: this.mediaHandles.create({
                    sessionId,
                    kind: 'cover',
                    resourceId: coverArtId
                  })
                }
              : {})
          })),
          nextOffset: offset + albums.length,
          hasMore: albums.length === size
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async getAlbum(sessionId: string, albumId: string): Promise<LibraryResult<AlbumDetail>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const { coverArtId, tracks, ...album } = await this.client.getAlbum(
        serverUrl,
        username,
        password,
        albumId
      )
      const coverUrl = coverArtId
        ? this.mediaHandles.create({ sessionId, kind: 'cover', resourceId: coverArtId })
        : undefined

      return {
        ok: true,
        value: {
          ...album,
          ...(coverUrl ? { coverUrl } : {}),
          tracks: tracks.map(({ coverArtId: trackCoverArtId, ...track }) => ({
            ...track,
            ...(trackCoverArtId || coverArtId
              ? {
                  coverUrl: this.mediaHandles.create({
                    sessionId,
                    kind: 'cover',
                    resourceId: trackCoverArtId ?? coverArtId ?? ''
                  })
                }
              : {}),
            streamUrl: this.mediaHandles.create({
              sessionId,
              kind: 'audio',
              resourceId: track.id
            })
          }))
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  private notConnected<T>(): LibraryResult<T> {
    return {
      ok: false,
      error: { code: 'not-connected', message: '连接会话已失效，请重新连接服务器。', retryable: false }
    }
  }

  private failure<T>(error: unknown): LibraryResult<T> {
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
      error: { code: 'network', message: '无法读取音乐库，请稍后重试。', retryable: true }
    }
  }
}
