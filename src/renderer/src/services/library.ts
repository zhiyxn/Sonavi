import type {
  AlbumDetail,
  AlbumPage,
  AlbumPageRequest,
  ArtistDetail,
  ArtistLibrary,
  LibraryResult,
  SearchResultPage
} from '../../../shared/library'
import {
  AlbumDetailResultSchema,
  AlbumListResultSchema,
  ArtistDetailResultSchema,
  ArtistLibraryResultSchema,
  SearchResultSchema
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
  sessionId: string,
  query: string,
  offset: number,
  size: number,
  signal?: AbortSignal
): Promise<SearchResultPage> {
  const requestId = crypto.randomUUID()
  const cancel = (): void => {
    void window.sonavi.library.cancelSearch({ sessionId, requestId })
  }
  signal?.addEventListener('abort', cancel, { once: true })

  try {
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    const result = SearchResultSchema.parse(
      await window.sonavi.library.search({ sessionId, requestId, query, offset, size })
    )
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    return unwrap(result)
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
