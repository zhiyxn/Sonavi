import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DesktopPreferences } from '../../../shared/desktop'
import { loadDesktopPreferences, saveDesktopPreferences } from '../services/desktop'

export const useDesktopStore = defineStore('desktop', () => {
  const preferences = ref<DesktopPreferences>({ closeAction: 'hide', theme: 'system', volume: 1 })
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  function initialize(): Promise<void> {
    initialization ??= loadDesktopPreferences().then((loaded) => {
      preferences.value = loaded
      initialized.value = true
    })
    return initialization
  }

  async function update(patch: Partial<DesktopPreferences>): Promise<DesktopPreferences> {
    if (!initialized.value) await initialize()
    const saved = await saveDesktopPreferences({ ...preferences.value, ...patch })
    preferences.value = saved
    return saved
  }

  return { preferences, initialized, initialize, update }
})
