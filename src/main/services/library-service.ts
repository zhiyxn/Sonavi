import type {
  AlbumDetail,
  AlbumListType,
  AlbumPage,
  AlbumSummary,
  ArtistDetail,
  ArtistLibrary,
  ArtistSummary,
  LibraryResult,
  MutationSuccess,
  PlaylistDetail,
  PlaylistSummary,
  SearchResultPage,
  StarredLibrary,
  StarTargetType,
  TrackSummary
} from '../../shared/library'
import type { ConnectionService } from './connection-service'
import { MediaHandleRegistry } from './media-handle-registry'
import { ConnectionFailure, OpenSubsonicClient } from './opensubsonic/client'

export class LibraryService {
  private readonly searchControllers = new Map<
    string,
    { sessionId: string; controller: AbortController }
  >()

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly client: OpenSubsonicClient,
    private readonly mediaHandles: MediaHandleRegistry
  ) {}

  async listAlbums(
    sessionId: string,
    type: AlbumListType,
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
        size,
        type
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
        ? this.createCoverUrl(sessionId, coverArtId)
        : undefined

      return {
        ok: true,
        value: {
          ...album,
          ...(coverUrl ? { coverUrl } : {}),
          tracks: tracks.map((track) => this.withTrackHandles(sessionId, track, coverArtId))
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async listArtists(sessionId: string): Promise<LibraryResult<ArtistLibrary>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const indexes = await this.client.getArtists(serverUrl, username, password)
      return {
        ok: true,
        value: {
          indexes: indexes.map((index) => ({
            name: index.name,
            artists: index.artists.map((artist) => this.withArtistCover(sessionId, artist))
          }))
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async getArtist(sessionId: string, artistId: string): Promise<LibraryResult<ArtistDetail>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const { coverArtId, albums, ...artist } = await this.client.getArtist(
        serverUrl,
        username,
        password,
        artistId
      )
      return {
        ok: true,
        value: {
          ...artist,
          ...(coverArtId ? { coverUrl: this.createCoverUrl(sessionId, coverArtId) } : {}),
          albums: albums.map((album) => this.withAlbumCover(sessionId, album))
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async listStarred(sessionId: string): Promise<LibraryResult<StarredLibrary>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const result = await this.client.getStarred2(serverUrl, username, password)
      return {
        ok: true,
        value: {
          artists: result.artists.map((artist) => this.withArtistCover(sessionId, artist)),
          albums: result.albums.map((album) => this.withAlbumCover(sessionId, album)),
          tracks: result.tracks.map((track) => this.withTrackHandles(sessionId, track))
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async setStarred(
    sessionId: string,
    targetType: StarTargetType,
    targetId: string,
    starred: boolean
  ): Promise<LibraryResult<MutationSuccess>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      await this.client.setStarred(
        serverUrl,
        username,
        password,
        targetType,
        targetId,
        starred
      )
      return { ok: true, value: { changed: true } }
    } catch (error) {
      return this.failure(error)
    }
  }

  async listPlaylists(sessionId: string): Promise<LibraryResult<PlaylistSummary[]>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      return { ok: true, value: await this.client.getPlaylists(serverUrl, username, password) }
    } catch (error) {
      return this.failure(error)
    }
  }

  async getPlaylist(
    sessionId: string,
    playlistId: string
  ): Promise<LibraryResult<PlaylistDetail>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      const playlist = await this.client.getPlaylist(
        serverUrl,
        username,
        password,
        playlistId
      )
      return {
        ok: true,
        value: {
          ...playlist,
          tracks: playlist.tracks.map((track) => this.withTrackHandles(sessionId, track))
        }
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async createPlaylist(
    sessionId: string,
    name: string,
    songIds: string[]
  ): Promise<LibraryResult<MutationSuccess>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      await this.client.createPlaylist(serverUrl, username, password, name, songIds)
      return { ok: true, value: { changed: true } }
    } catch (error) {
      return this.failure(error)
    }
  }

  async updatePlaylist(
    sessionId: string,
    playlistId: string,
    changes: {
      name?: string | undefined
      comment?: string | undefined
      public?: boolean | undefined
      songIdsToAdd?: string[] | undefined
      songIndexesToRemove?: number[] | undefined
    }
  ): Promise<LibraryResult<MutationSuccess>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      await this.client.updatePlaylist(
        serverUrl,
        username,
        password,
        playlistId,
        changes
      )
      return { ok: true, value: { changed: true } }
    } catch (error) {
      return this.failure(error)
    }
  }

  async deletePlaylist(
    sessionId: string,
    playlistId: string
  ): Promise<LibraryResult<MutationSuccess>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    try {
      const { serverUrl, username, password } = session.credential
      await this.client.deletePlaylist(serverUrl, username, password, playlistId)
      return { ok: true, value: { changed: true } }
    } catch (error) {
      return this.failure(error)
    }
  }

  async search(
    sessionId: string,
    requestId: string,
    query: string,
    offset: number,
    size: number
  ): Promise<LibraryResult<SearchResultPage>> {
    const session = this.connectionService.getSession(sessionId)
    if (!session) return this.notConnected()

    const controller = new AbortController()
    this.searchControllers.get(requestId)?.controller.abort()
    this.searchControllers.set(requestId, { sessionId, controller })

    try {
      const { serverUrl, username, password } = session.credential
      const result = await this.client.search3(
        serverUrl,
        username,
        password,
        query,
        offset,
        size,
        controller.signal
      )
      return {
        ok: true,
        value: {
          artists: result.artists.map((artist) => this.withArtistCover(sessionId, artist)),
          albums: result.albums.map((album) => this.withAlbumCover(sessionId, album)),
          tracks: result.tracks.map((track) => this.withTrackHandles(sessionId, track)),
          nextOffset: offset + size,
          hasMore:
            result.artists.length === size ||
            result.albums.length === size ||
            result.tracks.length === size
        }
      }
    } catch (error) {
      return this.failure(error)
    } finally {
      if (this.searchControllers.get(requestId)?.controller === controller) {
        this.searchControllers.delete(requestId)
      }
    }
  }

  cancelSearch(sessionId: string, requestId: string): boolean {
    if (!this.connectionService.getSession(sessionId)) return false
    const activeSearch = this.searchControllers.get(requestId)
    if (!activeSearch || activeSearch.sessionId !== sessionId) return false
    activeSearch.controller.abort()
    this.searchControllers.delete(requestId)
    return true
  }

  cancelSessionSearches(sessionId: string): void {
    for (const [requestId, activeSearch] of this.searchControllers.entries()) {
      if (activeSearch.sessionId !== sessionId) continue
      activeSearch.controller.abort()
      this.searchControllers.delete(requestId)
    }
  }

  private createCoverUrl(sessionId: string, resourceId: string): string {
    return this.mediaHandles.create({ sessionId, kind: 'cover', resourceId })
  }

  private withAlbumCover<T extends AlbumSummary & { coverArtId?: string | undefined }>(
    sessionId: string,
    album: T
  ): AlbumSummary {
    const { coverArtId, ...summary } = album
    return {
      ...summary,
      ...(coverArtId ? { coverUrl: this.createCoverUrl(sessionId, coverArtId) } : {})
    }
  }

  private withArtistCover<T extends ArtistSummary & { coverArtId?: string | undefined }>(
    sessionId: string,
    artist: T
  ): ArtistSummary {
    const { coverArtId, ...summary } = artist
    return {
      ...summary,
      ...(coverArtId ? { coverUrl: this.createCoverUrl(sessionId, coverArtId) } : {})
    }
  }

  private withTrackHandles<
    T extends Omit<TrackSummary, 'coverUrl' | 'streamUrl'> & { coverArtId?: string | undefined }
  >(sessionId: string, track: T, fallbackCoverArtId?: string): TrackSummary {
    const { coverArtId, ...summary } = track
    const resolvedCoverArtId = coverArtId ?? fallbackCoverArtId
    return {
      ...summary,
      ...(resolvedCoverArtId
        ? { coverUrl: this.createCoverUrl(sessionId, resolvedCoverArtId) }
        : {}),
      streamUrl: this.mediaHandles.create({
        sessionId,
        kind: 'audio',
        resourceId: track.id
      })
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
