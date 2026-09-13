import type {
  AlbumDetail,
  AlbumPage,
  AlbumPageRequest,
  LibraryResult
} from '../../../shared/library'
import {
  AlbumDetailResultSchema,
  AlbumListResultSchema
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
