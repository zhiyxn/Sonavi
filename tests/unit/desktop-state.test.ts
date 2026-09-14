import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConnectedSession } from '../../src/main/services/connection-service'
import { DesktopStateService } from '../../src/main/services/desktop-state-service'

const temporaryDirectories: string[] = []

function connectedSession(username = 'listener'): ConnectedSession {
  return {
    sessionId: crypto.randomUUID(),
    credential: { serverUrl: 'https://music.example.com', username, password: 'never-persist-me' },
    server: {
      baseUrl: 'https://music.example.com',
      protocolVersion: '1.16.1',
      openSubsonic: true,
      capabilityStatus: 'available',
      extensions: [],
      musicFolders: []
    }
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('P09 桌面状态', () => {
  it('持久化桌面偏好与暂停队列，且不写入凭据或媒体 URL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-desktop-state-'))
    temporaryDirectories.push(directory)
    const service = new DesktopStateService(directory)
    await service.initialize()
    await service.updatePreferences({ closeAction: 'quit', theme: 'dark', volume: 0.42 })
    const session = connectedSession()
    await service.savePausedQueue(
      {
        sessionId: session.sessionId,
        tracks: [{
          id: 'track-1',
          title: '一首歌',
          artist: '艺术家',
          album: '专辑',
          duration: 180,
          starred: false
        }],
        currentIndex: 0,
        playbackOrder: 'shuffle',
        repeatMode: 'all'
      },
      session
    )

    const restoredService = new DesktopStateService(directory)
    await restoredService.initialize()
    expect(restoredService.getPreferences()).toEqual({ closeAction: 'quit', theme: 'dark', volume: 0.42 })
    expect(restoredService.restorePausedQueue(session)).toMatchObject({
      currentIndex: 0,
      playbackOrder: 'shuffle',
      repeatMode: 'all',
      tracks: [{ id: 'track-1' }]
    })
    expect(restoredService.restorePausedQueue(connectedSession('other-user'))).toBeNull()

    const persisted = await readFile(join(directory, 'desktop-state.v1.json'), 'utf8')
    expect(persisted).not.toContain('never-persist-me')
    expect(persisted).not.toContain('sonavi-media://')
    expect(persisted).not.toContain(session.sessionId)
  })

  it('损坏状态文件时安全回到明确默认值', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-desktop-state-'))
    temporaryDirectories.push(directory)
    const service = new DesktopStateService(directory)
    await service.initialize()
    expect(service.getPreferences()).toEqual({ closeAction: 'hide', theme: 'system', volume: 1 })
  })
})
