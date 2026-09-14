import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConnectedSession } from '../../src/main/services/connection-service'
import { CoverCacheService } from '../../src/main/services/cover-cache-service'

const temporaryDirectories: string[] = []
const session = (username: string): ConnectedSession => ({
  sessionId: crypto.randomUUID(),
  credential: { serverUrl: 'https://music.example.com', username, password: 'secret' },
  server: {
    baseUrl: 'https://music.example.com',
    protocolVersion: '1.16.1',
    openSubsonic: true,
    capabilityStatus: 'available',
    extensions: [],
    musicFolders: []
  }
})

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('P09 封面缓存', () => {
  it('按账号隔离并在容量上限内执行 LRU 淘汰', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-cover-cache-'))
    temporaryDirectories.push(directory)
    const cache = new CoverCacheService(directory, 5, 10)
    const firstAccount = session('first')
    const secondAccount = session('second')

    await cache.put(firstAccount, 'cover-1', new Uint8Array([1, 2, 3, 4]), 'image/png')
    await cache.put(firstAccount, 'cover-2', new Uint8Array([5, 6, 7, 8]), 'image/png')
    await cache.put(secondAccount, 'cover-1', new Uint8Array([9, 10]), 'image/png')

    expect(await cache.getInfo(firstAccount)).toMatchObject({ itemCount: 1, totalBytes: 4, maxBytes: 5 })
    expect(await cache.get(firstAccount, 'cover-2')).toMatchObject({ contentType: 'image/png' })
    expect(await cache.get(secondAccount, 'cover-1')).toMatchObject({ contentType: 'image/png' })
    expect(await cache.clear(firstAccount)).toEqual({ itemCount: 0, totalBytes: 0, maxBytes: 5 })
    expect((await cache.getInfo(secondAccount)).itemCount).toBe(1)
  })

  it('拒绝超限条目和非图片内容', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-cover-cache-'))
    temporaryDirectories.push(directory)
    const cache = new CoverCacheService(directory, 100, 3)
    expect(await cache.put(session('listener'), 'large', new Uint8Array(4), 'image/png')).toBe(false)
    expect(await cache.put(session('listener'), 'audio', new Uint8Array(2), 'audio/mpeg')).toBe(false)
  })
})
