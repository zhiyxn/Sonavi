import { contextBridge, ipcRenderer } from 'electron'
import { APPLICATION_INFO_CHANNEL, type SonaviApi } from '../shared/application'

const sonaviApi: SonaviApi = Object.freeze({
  application: Object.freeze({
    getInfo: () => ipcRenderer.invoke(APPLICATION_INFO_CHANNEL)
  })
})

contextBridge.exposeInMainWorld('sonavi', sonaviApi)
