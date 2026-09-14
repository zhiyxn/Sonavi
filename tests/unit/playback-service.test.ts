import { describe, expect, it, vi } from 'vitest'
import type { ConnectionService, ConnectedSession } from '../../src/main/services/connection-service'
import type { OpenSubsonicClient } from '../../src/main/services/opensubsonic/client'
import { PlaybackService } from '../../src/main/services/playback-service'

const sessionId = '8db257ee-54de-4931-bf0f-f4ec1d817198'

function connectedSession(extensions: string[]): ConnectedSession {
  return {
    sessionId,
    credential: {
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret'
    },
    server: {
      baseUrl: 'https://music.example.com',
      protocolVersion: '1.16.1',
      openSubsonic: true,
      capabilityStatus: 'available',
      extensions,
      musicFolders: []
    }
  }
}

describe('PlaybackService', () => {
  it('只在 main 保存的能力声明 songLyrics 时调用结构化歌词端点', async () => {
    const getLyricsBySongId = vi.fn().mockResolvedValue({ source: 'structured', variants: [] })
    const getLyrics = vi.fn().mockResolvedValue({ source: 'legacy', variants: [] })
    const client = { getLyricsBySongId, getLyrics } as unknown as OpenSubsonicClient
    const structuredService = new PlaybackService(
      { getSession: () => connectedSession(['songLyrics']) } as unknown as ConnectionService,
      client
    )

    await expect(
      structuredService.getLyrics(sessionId, 'track-1', 'Sonavi', '跨平台试音')
    ).resolves.toMatchObject({ ok: true, value: { source: 'structured' } })
    expect(getLyricsBySongId).toHaveBeenCalledWith(
      'https://music.example.com',
      'listener',
      'secret',
      'track-1'
    )
    expect(getLyrics).not.toHaveBeenCalled()

    const legacyService = new PlaybackService(
      { getSession: () => connectedSession([]) } as unknown as ConnectionService,
      client
    )
    await legacyService.getLyrics(sessionId, 'track-1', 'Sonavi', '跨平台试音')
    expect(getLyrics).toHaveBeenCalledWith(
      'https://music.example.com',
      'listener',
      'secret',
      'Sonavi',
      '跨平台试音'
    )
  })

  it('拒绝失效会话，并将 scrobble 限定为当前凭据', async () => {
    const scrobble = vi.fn().mockResolvedValue(undefined)
    const missingService = new PlaybackService(
      { getSession: () => null } as unknown as ConnectionService,
      { scrobble } as unknown as OpenSubsonicClient
    )
    await expect(
      missingService.report(sessionId, 'track-1', true, 1_700_000_000_000)
    ).resolves.toMatchObject({ ok: false, error: { code: 'not-connected' } })
    expect(scrobble).not.toHaveBeenCalled()

    const service = new PlaybackService(
      { getSession: () => connectedSession([]) } as unknown as ConnectionService,
      { scrobble } as unknown as OpenSubsonicClient
    )
    await expect(
      service.report(sessionId, 'track-1', true, 1_700_000_000_000)
    ).resolves.toEqual({ ok: true, value: { reported: true } })
    expect(scrobble).toHaveBeenCalledWith(
      'https://music.example.com',
      'listener',
      'secret',
      'track-1',
      true,
      1_700_000_000_000
    )
  })
})
