import { describe, expect, it, vi } from 'vitest'
import { ConnectionService } from '../../src/main/services/connection-service'
import type {
  CredentialStore
} from '../../src/main/services/credentials/credential-store'
import { OpenSubsonicClient } from '../../src/main/services/opensubsonic/client'
import type {
  ApiTransport,
  TransportResponse
} from '../../src/main/services/opensubsonic/transport'

const transport: ApiTransport = {
  async request(url): Promise<TransportResponse> {
    const endpoint = new URL(url).pathname.match(/\/rest\/(.+)\.view$/)?.[1]
    const endpointFields =
      endpoint === 'getOpenSubsonicExtensions'
        ? { openSubsonicExtensions: [] }
        : endpoint === 'getMusicFolders'
          ? { musicFolders: { musicFolder: [] } }
          : {}

    return {
      status: 200,
      contentType: 'application/json',
      cloudflareMitigated: false,
      body: JSON.stringify({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          ...endpointFields
        }
      })
    }
  }
}

const profileId = '82c3080c-82dc-4d4d-b7da-a610f9efffb4'

function credentialStore(overrides: Partial<CredentialStore> = {}): CredentialStore {
  return {
    save: async (credential) => ({
      id: profileId,
      serverUrl: credential.serverUrl,
      username: credential.username,
      isDefault: true
    }),
    list: async () => [],
    load: async () => null,
    setDefault: async () => true,
    delete: async () => true,
    ...overrides
  }
}

describe('ConnectionService', () => {
  it.each([
    [true, 'encrypted'],
    [false, 'session-only']
  ] as const)('按 CredentialStore 结果返回保存状态：%s', async (saved, expectedPersistence) => {
    const save = vi
      .fn<CredentialStore['save']>()
      .mockResolvedValue(
        saved
          ? { id: profileId, serverUrl: 'https://music.example.com', username: 'listener', isDefault: true }
          : null
      )
    const service = new ConnectionService(
      new OpenSubsonicClient(transport),
      credentialStore({ save })
    )

    const result = await service.test({
      serverUrl: 'https://music.example.com/rest/',
      username: ' listener ',
      password: 'secret',
      rememberMe: true,
      allowInsecureHttp: false
    })

    expect(result).toMatchObject({ ok: true, credentialPersistence: expectedPersistence })
    expect(save).toHaveBeenCalledWith({
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret'
    })
  })

  it('未明确确认时在网络请求前拒绝 HTTP', async () => {
    const request = vi.fn<ApiTransport['request']>()
    const save = vi.fn<CredentialStore['save']>()
    const service = new ConnectionService(
      new OpenSubsonicClient({ request }),
      credentialStore({ save })
    )

    await expect(
      service.test({
        serverUrl: 'http://music.example.com',
        username: 'listener',
        password: 'secret',
        rememberMe: false,
        allowInsecureHttp: false
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'insecure-http' } })
    expect(request).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('每次成功连接都会轮换不透明会话 ID，使旧会话失效', async () => {
    const service = new ConnectionService(new OpenSubsonicClient(transport), credentialStore())
    const input = {
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret',
      rememberMe: false,
      allowInsecureHttp: false
    }

    const first = await service.test(input)
    const second = await service.test(input)
    expect(first.ok && second.ok && first.sessionId).not.toBe(second.ok && second.sessionId)
    if (!first.ok || !second.ok) throw new Error('fixture connection failed')
    expect(service.getSession(first.sessionId)).toBeNull()
    expect(service.getSession(second.sessionId)?.credential.username).toBe('listener')
  })

  it('从系统密文存储恢复凭据并产生新的会话 ID', async () => {
    const storedCredentials = credentialStore({
      load: async () => ({
        id: profileId,
        serverUrl: 'https://music.example.com',
        username: 'listener',
        password: 'secret',
        isDefault: true
      })
    })
    const service = new ConnectionService(new OpenSubsonicClient(transport), storedCredentials)

    const restored = await service.restore()
    expect(restored).toMatchObject({
      ok: true,
      credentialPersistence: 'encrypted',
      profileId
    })
    if (!restored?.ok) throw new Error('fixture restore failed')
    expect(service.getSession(restored.sessionId)?.credential.password).toBe('secret')
  })

  it('断开只接受当前会话；忘记账号会清除会话和持久化凭据', async () => {
    const deleteCredential = vi.fn<CredentialStore['delete']>().mockResolvedValue(true)
    const service = new ConnectionService(
      new OpenSubsonicClient(transport),
      credentialStore({ delete: deleteCredential })
    )
    const result = await service.test({
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret',
      rememberMe: true,
      allowInsecureHttp: false
    })
    if (!result.ok) throw new Error('fixture connection failed')

    await expect(service.forget('b79c8445-459d-49e8-8e98-e54beb270a12')).resolves.toBe(false)
    expect(deleteCredential).not.toHaveBeenCalled()
    await expect(service.forget(result.sessionId)).resolves.toBe(true)
    expect(deleteCredential).toHaveBeenCalledWith(profileId)
    expect(service.getSession(result.sessionId)).toBeNull()
  })

  it('成功切换已保存服务器后轮换会话并设为默认，活动服务器不能直接删除', async () => {
    const secondProfileId = '3f85e2e9-405a-4af5-84c4-2a5bfe8e7a6c'
    const setDefault = vi.fn<CredentialStore['setDefault']>().mockResolvedValue(true)
    const deleteProfile = vi.fn<CredentialStore['delete']>().mockResolvedValue(true)
    const service = new ConnectionService(
      new OpenSubsonicClient(transport),
      credentialStore({
        load: async (requestedId) => requestedId === secondProfileId
          ? {
              id: secondProfileId,
              serverUrl: 'https://second.example.com',
              username: 'second-listener',
              password: 'second-secret',
              isDefault: false
            }
          : null,
        setDefault,
        delete: deleteProfile
      })
    )
    const current = await service.test({
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret',
      rememberMe: false,
      allowInsecureHttp: false
    })
    if (!current.ok) throw new Error('fixture connection failed')

    const switched = await service.connectSaved(secondProfileId)
    expect(switched).toMatchObject({ ok: true, profileId: secondProfileId })
    if (!switched.ok) throw new Error('fixture switch failed')
    expect(service.getSession(current.sessionId)).toBeNull()
    expect(service.getSession(switched.sessionId)?.profileId).toBe(secondProfileId)
    expect(setDefault).toHaveBeenCalledWith(secondProfileId)
    await expect(service.deleteSavedProfile(secondProfileId)).resolves.toBe(false)
    expect(deleteProfile).not.toHaveBeenCalled()
  })

  it('已保存凭据缺失时切换失败并保留当前会话', async () => {
    const service = new ConnectionService(
      new OpenSubsonicClient(transport),
      credentialStore({ load: async () => null })
    )
    const current = await service.test({
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret',
      rememberMe: false,
      allowInsecureHttp: false
    })
    if (!current.ok) throw new Error('fixture connection failed')

    await expect(service.connectSaved(profileId)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-input' }
    })
    expect(service.getSession(current.sessionId)).not.toBeNull()
  })
})
