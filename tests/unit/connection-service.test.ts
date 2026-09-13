import { describe, expect, it, vi } from 'vitest'
import { ConnectionService } from '../../src/main/services/connection-service'
import type {
  CredentialStore,
  StoredCredentialInput
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

describe('ConnectionService', () => {
  it.each([
    [true, 'encrypted'],
    [false, 'session-only']
  ] as const)('按 CredentialStore 结果返回保存状态：%s', async (saved, expectedPersistence) => {
    const save = vi.fn<(credential: StoredCredentialInput) => Promise<boolean>>().mockResolvedValue(saved)
    const credentialStore: CredentialStore = {
      save,
      load: async () => null,
      delete: async () => true
    }
    const service = new ConnectionService(new OpenSubsonicClient(transport), credentialStore)

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
      { save, load: async () => null, delete: async () => true }
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
    const service = new ConnectionService(new OpenSubsonicClient(transport), {
      save: async () => true,
      load: async () => null,
      delete: async () => true
    })
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
    const credentialStore: CredentialStore = {
      save: async () => true,
      load: async () => ({
        serverUrl: 'https://music.example.com',
        username: 'listener',
        password: 'secret'
      }),
      delete: async () => true
    }
    const service = new ConnectionService(new OpenSubsonicClient(transport), credentialStore)

    const restored = await service.restore()
    expect(restored).toMatchObject({ ok: true, credentialPersistence: 'encrypted' })
    if (!restored?.ok) throw new Error('fixture restore failed')
    expect(service.getSession(restored.sessionId)?.credential.password).toBe('secret')
  })

  it('断开只接受当前会话；忘记账号会清除会话和持久化凭据', async () => {
    const deleteCredential = vi.fn<CredentialStore['delete']>().mockResolvedValue(true)
    const service = new ConnectionService(new OpenSubsonicClient(transport), {
      save: async () => true,
      load: async () => null,
      delete: deleteCredential
    })
    const result = await service.test({
      serverUrl: 'https://music.example.com',
      username: 'listener',
      password: 'secret',
      rememberMe: false,
      allowInsecureHttp: false
    })
    if (!result.ok) throw new Error('fixture connection failed')

    await expect(service.forget('b79c8445-459d-49e8-8e98-e54beb270a12')).resolves.toBe(false)
    expect(deleteCredential).not.toHaveBeenCalled()
    await expect(service.forget(result.sessionId)).resolves.toBe(true)
    expect(deleteCredential).toHaveBeenCalledOnce()
    expect(service.getSession(result.sessionId)).toBeNull()
  })
})
