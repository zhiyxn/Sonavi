import type { MaybeRefOrGetter } from 'vue'
import { toValue, watch } from 'vue'
import { toast } from 'vue-sonner'
import { t } from '../i18n'

interface ErrorToastOptions {
  title?: string
  id?: string
}

export function showErrorToast(
  message: string,
  { title = '操作失败', id }: ErrorToastOptions = {}
): void {
  toast.error(t(title), {
    description: t(message),
    ...(id ? { id } : {})
  })
}

export function useErrorToast(
  source: MaybeRefOrGetter<string | null | undefined>,
  options: ErrorToastOptions = {}
): void {
  watch(
    () => toValue(source),
    (message) => {
      if (message) showErrorToast(message, options)
    },
    { immediate: true }
  )
}
