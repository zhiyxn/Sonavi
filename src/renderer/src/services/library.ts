import type {
  AlbumDetail,
  AlbumPage,
  AlbumPageRequest,
  ArtistDetail,
  ArtistLibrary,
  CreatePlaylistRequest,
  DeletePlaylistRequest,
  LibraryResult,
  MutationSuccess,
  PlaylistDetail,
  PlaylistSummary,
  SearchRequest,
  SearchResultPage,
  SetStarredRequest,
  StarredLibrary,
  UpdatePlaylistRequest
} from '../../../shared/library'
import {
  AlbumDetailResultSchema,
  AlbumListResultSchema,
  ArtistDetailResultSchema,
  ArtistLibraryResultSchema,
  MutationResultSchema,
  PlaylistDetailResultSchema,
  PlaylistListResultSchema,
  SearchResultSchema,
  StarredLibraryResultSchema
} from '../../../shared/library-schema'

function unwrap<T>(result: LibraryResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

export async function listAlbums(request: AlbumPageRequest): Promise<AlbumPage> {
  const result = AlbumListResultSchema.parse(await window.sonavi.library.listAlbums(request))
  return unwrap(result)
}

export async function getAlbum(sessionId: string, albumId: string): Promise<AlbumDetail> {
  const result = AlbumDetailResultSchema.parse(
    await window.sonavi.library.getAlbum(sessionId, albumId)
  )
  return unwrap(result)
}

export async function listArtists(sessionId: string): Promise<ArtistLibrary> {
  const result = ArtistLibraryResultSchema.parse(await window.sonavi.library.listArtists(sessionId))
  return unwrap(result)
}

export async function getArtist(sessionId: string, artistId: string): Promise<ArtistDetail> {
  const result = ArtistDetailResultSchema.parse(
    await window.sonavi.library.getArtist(sessionId, artistId)
  )
  return unwrap(result)
}

export async function searchLibrary(
  request: Omit<SearchRequest, 'requestId'>,
  signal?: AbortSignal
): Promise<SearchResultPage> {
  const requestId = crypto.randomUUID()
  const cancel = (): void => {
    void window.sonavi.library.cancelSearch({ sessionId: request.sessionId, requestId })
  }
  signal?.addEventListener('abort', cancel, { once: true })

  try {
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    const result = SearchResultSchema.parse(
      await window.sonavi.library.search({
        ...request,
        requestId,
      })
    )
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    return unwrap(result)
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}

export async function listStarred(sessionId: string): Promise<StarredLibrary> {
  const result = StarredLibraryResultSchema.parse(
    await window.sonavi.library.listStarred(sessionId)
  )
  return unwrap(result)
}

export async function setStarred(request: SetStarredRequest): Promise<MutationSuccess> {
  const result = MutationResultSchema.parse(await window.sonavi.library.setStarred(request))
  return unwrap(result)
}

export async function listPlaylists(sessionId: string): Promise<PlaylistSummary[]> {
  const result = PlaylistListResultSchema.parse(
    await window.sonavi.library.listPlaylists(sessionId)
  )
  return unwrap(result)
}

export async function getPlaylist(
  sessionId: string,
  playlistId: string
): Promise<PlaylistDetail> {
  const result = PlaylistDetailResultSchema.parse(
    await window.sonavi.library.getPlaylist(sessionId, playlistId)
  )
  return unwrap(result)
}

export async function createPlaylist(request: CreatePlaylistRequest): Promise<MutationSuccess> {
  const result = MutationResultSchema.parse(await window.sonavi.library.createPlaylist(request))
  return unwrap(result)
}

export async function updatePlaylist(request: UpdatePlaylistRequest): Promise<MutationSuccess> {
  const result = MutationResultSchema.parse(await window.sonavi.library.updatePlaylist(request))
  return unwrap(result)
}

export async function deletePlaylist(request: DeletePlaylistRequest): Promise<MutationSuccess> {
  const result = MutationResultSchema.parse(await window.sonavi.library.deletePlaylist(request))
  return unwrap(result)
}
