import { describe, expect, it, vi } from 'vitest'
import { LibraryService } from '../../src/main/services/library-service'
import { MediaHandleRegistry } from '../../src/main/services/media-handle-registry'
import type { ConnectionService } from '../../src/main/services/connection-service'
import type { OpenSubsonicClient } from '../../src/main/services/opensubsonic/client'

const SESSION_ID = '9f73bd9a-acde-4f0f-a3f6-3ddff7d09342'

describe('LibraryService 搜索生命周期', () => {
  it('只允许当前会话以匹配的 requestId 中止活动搜索', async () => {
    let requestStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve
    })
    const search3 = vi.fn(
      (...parameters: Parameters<OpenSubsonicClient['search3']>) =>
        new Promise<Awaited<ReturnType<OpenSubsonicClient['search3']>>>((_resolve, reject) => {
          const signal = parameters[6]
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Search cancelled', 'AbortError')),
            { once: true }
          )
          requestStarted?.()
        })
    )
    const connectionService = {
      getSession: (sessionId: string) =>
        sessionId === SESSION_ID
          ? {
              sessionId,
              credential: {
                serverUrl: 'https://music.example.com',
                username: 'listener',
                password: 'secret'
              }
            }
          : null
    } as unknown as ConnectionService
    const service = new LibraryService(
      connectionService,
      { search3 } as unknown as OpenSubsonicClient,
      new MediaHandleRegistry()
    )
    const requestId = '813489b6-8df7-4708-98ae-8dc3b7b14d22'
    const pending = service.search(SESSION_ID, requestId, '跨平台', 0, 25)

    await started
    expect(service.cancelSearch('c6593ec1-803d-4a66-98a4-71730047c6f4', requestId)).toBe(false)
    expect(service.cancelSearch(SESSION_ID, '89cfb53e-2b4d-4bb8-8732-8c492ef1668f')).toBe(false)
    expect(service.cancelSearch(SESSION_ID, requestId)).toBe(true)
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'network', retryable: true }
    })
    expect(service.cancelSearch(SESSION_ID, requestId)).toBe(false)
  })
})
