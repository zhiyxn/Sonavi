export const LIST_ALBUMS_CHANNEL = 'sonavi:library:list-albums' as const
export const GET_ALBUM_CHANNEL = 'sonavi:library:get-album' as const
export const LIST_ARTISTS_CHANNEL = 'sonavi:library:list-artists' as const
export const GET_ARTIST_CHANNEL = 'sonavi:library:get-artist' as const
export const SEARCH_LIBRARY_CHANNEL = 'sonavi:library:search' as const
export const CANCEL_LIBRARY_SEARCH_CHANNEL = 'sonavi:library:cancel-search' as const
export const LIST_STARRED_CHANNEL = 'sonavi:library:list-starred' as const
export const SET_STARRED_CHANNEL = 'sonavi:library:set-starred' as const
export const LIST_PLAYLISTS_CHANNEL = 'sonavi:library:list-playlists' as const
export const GET_PLAYLIST_CHANNEL = 'sonavi:library:get-playlist' as const
export const CREATE_PLAYLIST_CHANNEL = 'sonavi:library:create-playlist' as const
export const UPDATE_PLAYLIST_CHANNEL = 'sonavi:library:update-playlist' as const
export const DELETE_PLAYLIST_CHANNEL = 'sonavi:library:delete-playlist' as const

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
  starred: boolean
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
  starred: boolean
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
  starred: boolean
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

export type StarTargetType = 'track' | 'album' | 'artist'

export interface StarredLibrary {
  artists: ArtistSummary[]
  albums: AlbumSummary[]
  tracks: TrackSummary[]
}

export interface SetStarredRequest {
  sessionId: string
  targetType: StarTargetType
  targetId: string
  starred: boolean
}

export interface PlaylistSummary {
  id: string
  name: string
  owner: string
  public: boolean
  songCount: number
  duration: number
  comment?: string | undefined
  created?: string | undefined
  changed?: string | undefined
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: TrackSummary[]
}

export interface CreatePlaylistRequest {
  sessionId: string
  name: string
  songIds: string[]
}

export interface UpdatePlaylistRequest {
  sessionId: string
  playlistId: string
  name?: string | undefined
  comment?: string | undefined
  public?: boolean | undefined
  songIdsToAdd?: string[] | undefined
  songIndexesToRemove?: number[] | undefined
}

export interface DeletePlaylistRequest {
  sessionId: string
  playlistId: string
}

export interface MutationSuccess {
  changed: true
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
  listStarred: (sessionId: string) => Promise<LibraryResult<StarredLibrary>>
  setStarred: (request: SetStarredRequest) => Promise<LibraryResult<MutationSuccess>>
  listPlaylists: (sessionId: string) => Promise<LibraryResult<PlaylistSummary[]>>
  getPlaylist: (sessionId: string, playlistId: string) => Promise<LibraryResult<PlaylistDetail>>
  createPlaylist: (request: CreatePlaylistRequest) => Promise<LibraryResult<MutationSuccess>>
  updatePlaylist: (request: UpdatePlaylistRequest) => Promise<LibraryResult<MutationSuccess>>
  deletePlaylist: (request: DeletePlaylistRequest) => Promise<LibraryResult<MutationSuccess>>
}
