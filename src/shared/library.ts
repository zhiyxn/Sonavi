export const LIST_ALBUMS_CHANNEL = 'sonavi:library:list-albums' as const
export const GET_ALBUM_CHANNEL = 'sonavi:library:get-album' as const

export interface AlbumPageRequest {
  sessionId: string
  offset: number
  size: number
}

export interface AlbumSummary {
  id: string
  name: string
  artist: string
  year?: number | undefined
  songCount: number
  duration: number
  coverUrl?: string | undefined
}

export interface TrackSummary {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  track?: number | undefined
  disc?: number | undefined
  contentType?: string | undefined
  coverUrl?: string | undefined
  streamUrl: string
}

export interface AlbumDetail extends AlbumSummary {
  tracks: TrackSummary[]
}

export interface AlbumPage {
  items: AlbumSummary[]
  nextOffset: number
  hasMore: boolean
}

export type LibraryErrorCode =
  | 'not-connected'
  | 'invalid-input'
  | 'network'
  | 'server-response'

export type LibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: LibraryErrorCode; message: string; retryable: boolean } }

export interface LibraryApi {
  listAlbums: (request: AlbumPageRequest) => Promise<LibraryResult<AlbumPage>>
  getAlbum: (sessionId: string, albumId: string) => Promise<LibraryResult<AlbumDetail>>
}
