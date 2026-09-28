import { ref } from 'vue'
import type { AppLanguage, TranslationValues } from '../../shared/localization'
import { translate } from '../../shared/localization'

const activeLanguage = ref<AppLanguage>('zh-CN')

export function setActiveLanguage(language: AppLanguage): void {
  activeLanguage.value = language
  document.documentElement.lang = language
}

export function t(source: string, values?: TranslationValues): string {
  return translate(activeLanguage.value, source, values)
}

export function getActiveLanguage(): AppLanguage {
  return activeLanguage.value
}
