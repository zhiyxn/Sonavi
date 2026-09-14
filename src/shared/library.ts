export const LIST_ALBUMS_CHANNEL = 'sonavi:library:list-albums' as const
export const GET_ALBUM_CHANNEL = 'sonavi:library:get-album' as const
export const LIST_ARTISTS_CHANNEL = 'sonavi:library:list-artists' as const
export const GET_ARTIST_CHANNEL = 'sonavi:library:get-artist' as const
export const SEARCH_LIBRARY_CHANNEL = 'sonavi:library:search' as const
export const CANCEL_LIBRARY_SEARCH_CHANNEL = 'sonavi:library:cancel-search' as const

export type AlbumListType = 'newest' | 'alphabeticalByName'

export interface AlbumPageRequest {
  sessionId: string
  type: AlbumListType
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

export interface ArtistSummary {
  id: string
  name: string
  albumCount: number
  coverUrl?: string | undefined
}

export interface ArtistIndex {
  name: string
  artists: ArtistSummary[]
}

export interface ArtistLibrary {
  indexes: ArtistIndex[]
}

export interface ArtistDetail extends ArtistSummary {
  albums: AlbumSummary[]
}

export interface SearchRequest {
  sessionId: string
  requestId: string
  query: string
  offset: number
  size: number
}

export interface CancelSearchRequest {
  sessionId: string
  requestId: string
}

export interface SearchResultPage {
  artists: ArtistSummary[]
  albums: AlbumSummary[]
  tracks: TrackSummary[]
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
  listArtists: (sessionId: string) => Promise<LibraryResult<ArtistLibrary>>
  getArtist: (sessionId: string, artistId: string) => Promise<LibraryResult<ArtistDetail>>
  search: (request: SearchRequest) => Promise<LibraryResult<SearchResultPage>>
  cancelSearch: (request: CancelSearchRequest) => Promise<boolean>
}
