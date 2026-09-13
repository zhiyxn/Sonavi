import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ConnectionSuccessResult } from '../../../shared/connection'

export const useSessionStore = defineStore('session', () => {
  const connection = ref<ConnectionSuccessResult | null>(null)

  function establish(result: ConnectionSuccessResult): void {
    connection.value = result
  }

  function disconnect(): void {
    connection.value = null
  }

  return { connection, establish, disconnect }
})
