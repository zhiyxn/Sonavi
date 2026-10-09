import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UpdateCheckResult } from '../../../shared/application'
import { checkForUpdates } from '../services/application-info'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error'

export const useUpdateStore = defineStore('update', () => {
  const status = ref<UpdateStatus>('idle')
  const availableVersion = ref('')
  const downloadAvailable = ref(false)
  let pending: Promise<UpdateCheckResult> | null = null

  function check(): Promise<UpdateCheckResult> {
    if (pending) return pending
    status.value = 'checking'
    availableVersion.value = ''
    downloadAvailable.value = false
    const request = checkForUpdates().then((result) => {
      status.value = result.status
      if (result.status === 'available') {
        availableVersion.value = result.version
        downloadAvailable.value = result.downloadAvailable
      }
      return result
    }).catch((error: unknown) => {
      status.value = 'error'
      throw error
    })
    pending = request
    void request.finally(() => { pending = null }).catch(() => undefined)
    return request
  }

  return { status, availableVersion, downloadAvailable, check }
})
