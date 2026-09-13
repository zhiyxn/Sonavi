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
    const credentialStore: CredentialStore = { save }
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
      { save }
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
})
