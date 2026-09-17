import type { MaybeRefOrGetter } from 'vue'
import { toValue, watch } from 'vue'
import { toast } from 'vue-sonner'

interface ErrorToastOptions {
  title?: string
  id?: string
}

interface ConfirmationOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
}

export function showErrorToast(
  message: string,
  { title = '操作失败', id }: ErrorToastOptions = {}
): void {
  toast.error(title, {
    description: message,
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

export function requestConfirmation({
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消'
}: ConfirmationOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (confirmed: boolean): void => {
      if (settled) return
      settled = true
      resolve(confirmed)
    }

    toast.warning(title, {
      description,
      duration: Infinity,
      important: true,
      action: {
        label: confirmLabel,
        onClick: () => settle(true)
      },
      cancel: {
        label: cancelLabel,
        onClick: () => settle(false)
      },
      onDismiss: () => settle(false),
      onAutoClose: () => settle(false)
    })
  })
}
