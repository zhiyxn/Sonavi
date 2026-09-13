import { contextBridge, ipcRenderer } from 'electron'
import { APPLICATION_INFO_CHANNEL, type SonaviApi } from '../shared/application'
import { TEST_CONNECTION_CHANNEL, type ConnectionTestInput } from '../shared/connection'

const sonaviApi: SonaviApi = Object.freeze({
  application: Object.freeze({
    getInfo: () => ipcRenderer.invoke(APPLICATION_INFO_CHANNEL)
  }),
  connection: Object.freeze({
    test: (input: ConnectionTestInput) => ipcRenderer.invoke(TEST_CONNECTION_CHANNEL, input)
  })
})

contextBridge.exposeInMainWorld('sonavi', sonaviApi)
