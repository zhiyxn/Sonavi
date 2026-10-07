import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
    await service.updatePreferences({
      closeAction: 'quit',
      theme: 'dark',
      language: 'en-US',
      checkUpdatesOnStartup: false,
      volume: 0.42
    })
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
    expect(restoredService.getPreferences()).toEqual({
      closeAction: 'quit',
      theme: 'dark',
      language: 'en-US',
      checkUpdatesOnStartup: false,
      volume: 0.42
    })
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
    expect(service.getPreferences()).toEqual({
      closeAction: 'hide',
      theme: 'system',
      language: 'zh-CN',
      checkUpdatesOnStartup: true,
      volume: 1
    })
  })

  it('旧 v1 状态缺少语言时保留其他偏好并迁移为中文', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-desktop-state-'))
    temporaryDirectories.push(directory)
    await writeFile(join(directory, 'desktop-state.v1.json'), JSON.stringify({
      version: 1,
      preferences: { closeAction: 'quit', theme: 'dark', volume: 0.35 },
      window: { width: 1200, height: 760, maximized: false }
    }))

    const service = new DesktopStateService(directory)
    await service.initialize()

    expect(service.getPreferences()).toEqual({
      closeAction: 'quit',
      theme: 'dark',
      language: 'zh-CN',
      checkUpdatesOnStartup: true,
      volume: 0.35
    })
    expect(service.getWindowState()).toEqual({ width: 1200, height: 760, maximized: false })
  })

  it('旧版有语言但没有更新开关时默认启用并保留语言', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-desktop-state-'))
    temporaryDirectories.push(directory)
    await writeFile(join(directory, 'desktop-state.v1.json'), JSON.stringify({
      version: 1,
      preferences: { closeAction: 'quit', theme: 'dark', language: 'en-US', volume: 0.4 },
      window: { width: 1100, height: 700, maximized: false }
    }))
    const service = new DesktopStateService(directory)
    await service.initialize()
    expect(service.getPreferences()).toEqual({
      closeAction: 'quit', theme: 'dark', language: 'en-US', checkUpdatesOnStartup: true, volume: 0.4
    })
    expect(service.getWindowState()).toEqual({ width: 1100, height: 700, maximized: false })
  })
})
