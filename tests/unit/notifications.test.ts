import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sonner = vi.hoisted(() => ({
  error: vi.fn()
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: sonner.error
  }
}))

import {
  showErrorToast,
  useErrorToast
} from '../../src/renderer/src/lib/notifications'

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
})
