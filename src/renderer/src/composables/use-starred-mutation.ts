import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import type { StarTargetType } from '../../../shared/library'
import { setStarred } from '../services/library'

export function useStarredMutation(sessionId: () => string): {
  errorMessage: ReturnType<typeof ref<string>>
  pendingKey: ReturnType<typeof ref<string>>
  toggleStarred: (targetType: StarTargetType, targetId: string, starred: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()
  const errorMessage = ref('')
  const pendingKey = ref('')

  async function toggleStarred(
    targetType: StarTargetType,
    targetId: string,
    starred: boolean
  ): Promise<void> {
    const key = `${targetType}:${targetId}`
    pendingKey.value = key
    errorMessage.value = ''
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
      errorMessage.value = error instanceof Error ? error.message : '收藏操作失败。'
    } finally {
      if (pendingKey.value === key) pendingKey.value = ''
    }
  }

  return { errorMessage, pendingKey, toggleStarred }
}
