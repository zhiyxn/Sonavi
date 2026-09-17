import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import type { StarTargetType } from '../../../shared/library'
import { showErrorToast } from '../lib/notifications'
import { setStarred } from '../services/library'

export function useStarredMutation(sessionId: () => string): {
  pendingKey: ReturnType<typeof ref<string>>
  toggleStarred: (targetType: StarTargetType, targetId: string, starred: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()
  const pendingKey = ref('')

  async function toggleStarred(
    targetType: StarTargetType,
    targetId: string,
    starred: boolean
  ): Promise<void> {
    const key = `${targetType}:${targetId}`
    pendingKey.value = key
    try {
      await setStarred({ sessionId: sessionId(), targetType, targetId, starred })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['starred', sessionId()] }),
        queryClient.invalidateQueries({ queryKey: ['albums', sessionId()] }),
        queryClient.invalidateQueries({ queryKey: ['album', sessionId()] }),
        queryClient.invalidateQueries({ queryKey: ['artists', sessionId()] }),
        queryClient.invalidateQueries({ queryKey: ['artist', sessionId()] }),
        queryClient.invalidateQueries({ queryKey: ['search', sessionId()] })
      ])
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : '收藏操作失败。', {
        title: '收藏操作失败',
        id: 'starred-mutation-error'
      })
    } finally {
      if (pendingKey.value === key) pendingKey.value = ''
    }
  }

  return { pendingKey, toggleStarred }
}
