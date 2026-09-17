import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sonner = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn()
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: sonner.error,
    warning: sonner.warning
  }
}))

import {
  requestConfirmation,
  showErrorToast,
  useErrorToast
} from '../../src/renderer/src/lib/notifications'

interface ConfirmationToastOptions {
  duration: number
  important: boolean
  action: { label: string; onClick: (event: MouseEvent) => void }
  cancel: { label: string; onClick: (event: MouseEvent) => void }
  onDismiss: () => void
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Sonner 通知', () => {
  it('使用带标题、说明和稳定 ID 的错误 toast', () => {
    showErrorToast('服务器暂时不可用。', { title: '连接失败', id: 'connection-error' })

    expect(sonner.error).toHaveBeenCalledWith('连接失败', {
      description: '服务器暂时不可用。',
      id: 'connection-error'
    })
  })

  it('响应式错误只在出现消息时调用 Sonner', async () => {
    const message = ref('')
    const scope = effectScope()
    scope.run(() => useErrorToast(message, { title: '加载失败' }))

    message.value = '请求超时。'
    await nextTick()

    expect(sonner.error).toHaveBeenCalledWith('加载失败', {
      description: '请求超时。'
    })
    scope.stop()
  })

  it('二次确认使用持久 Sonner，并分别解析确认和取消', async () => {
    const confirmed = requestConfirmation({
      title: '删除歌单？',
      description: '此操作无法撤销。',
      confirmLabel: '删除'
    })
    const confirmOptions = sonner.warning.mock.calls[0]?.[1] as ConfirmationToastOptions

    expect(confirmOptions.duration).toBe(Infinity)
    expect(confirmOptions.important).toBe(true)
    expect(confirmOptions.action.label).toBe('删除')
    expect(confirmOptions.cancel.label).toBe('取消')
    confirmOptions.action.onClick(new MouseEvent('click'))
    await expect(confirmed).resolves.toBe(true)

    const cancelled = requestConfirmation({
      title: '退出账号？',
      description: '将删除本机凭据。'
    })
    const cancelOptions = sonner.warning.mock.calls[1]?.[1] as ConfirmationToastOptions
    cancelOptions.onDismiss()
    await expect(cancelled).resolves.toBe(false)
  })
})
