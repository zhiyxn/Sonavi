import { contextBridge, ipcRenderer } from 'electron'
import { APPLICATION_INFO_CHANNEL, type SonaviApi } from '../shared/application'
import {
  DISCONNECT_CONNECTION_CHANNEL,
  FORGET_CONNECTION_CHANNEL,
  RESTORE_CONNECTION_CHANNEL,
  TEST_CONNECTION_CHANNEL,
  type ConnectionTestInput
} from '../shared/connection'
import { GET_ALBUM_CHANNEL, LIST_ALBUMS_CHANNEL } from '../shared/library'

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
    listAlbums: (sessionId: string) => ipcRenderer.invoke(LIST_ALBUMS_CHANNEL, sessionId),
    getAlbum: (sessionId: string, albumId: string) =>
      ipcRenderer.invoke(GET_ALBUM_CHANNEL, sessionId, albumId)
  })
})

contextBridge.exposeInMainWorld('sonavi', sonaviApi)
