import { contextBridge, ipcRenderer } from 'electron'
import { APPLICATION_INFO_CHANNEL, type SonaviApi } from '../shared/application'
import {
  DISCONNECT_CONNECTION_CHANNEL,
  FORGET_CONNECTION_CHANNEL,
  RESTORE_CONNECTION_CHANNEL,
  TEST_CONNECTION_CHANNEL,
  type ConnectionTestInput
} from '../shared/connection'
import {
  CANCEL_LIBRARY_SEARCH_CHANNEL,
  GET_ALBUM_CHANNEL,
  GET_ARTIST_CHANNEL,
  LIST_ALBUMS_CHANNEL,
  LIST_ARTISTS_CHANNEL,
  SEARCH_LIBRARY_CHANNEL,
  type AlbumPageRequest,
  type CancelSearchRequest,
  type SearchRequest
} from '../shared/library'

const sonaviApi: SonaviApi = Object.freeze({
  application: Object.freeze({
    getInfo: () => ipcRenderer.invoke(APPLICATION_INFO_CHANNEL)
  }),
  connection: Object.freeze({
    test: (input: ConnectionTestInput) => ipcRenderer.invoke(TEST_CONNECTION_CHANNEL, input),
    restore: () => ipcRenderer.invoke(RESTORE_CONNECTION_CHANNEL),
    disconnect: (sessionId: string) =>
      ipcRenderer.invoke(DISCONNECT_CONNECTION_CHANNEL, sessionId),
    forget: (sessionId: string) => ipcRenderer.invoke(FORGET_CONNECTION_CHANNEL, sessionId)
  }),
  library: Object.freeze({
    listAlbums: (request: AlbumPageRequest) => ipcRenderer.invoke(LIST_ALBUMS_CHANNEL, request),
    getAlbum: (sessionId: string, albumId: string) =>
      ipcRenderer.invoke(GET_ALBUM_CHANNEL, sessionId, albumId),
    listArtists: (sessionId: string) => ipcRenderer.invoke(LIST_ARTISTS_CHANNEL, sessionId),
    getArtist: (sessionId: string, artistId: string) =>
      ipcRenderer.invoke(GET_ARTIST_CHANNEL, sessionId, artistId),
    search: (request: SearchRequest) => ipcRenderer.invoke(SEARCH_LIBRARY_CHANNEL, request),
    cancelSearch: (request: CancelSearchRequest) =>
      ipcRenderer.invoke(CANCEL_LIBRARY_SEARCH_CHANNEL, request)
  })
})

contextBridge.exposeInMainWorld('sonavi', sonaviApi)
