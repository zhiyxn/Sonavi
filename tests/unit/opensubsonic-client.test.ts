import { describe, expect, it } from 'vitest'
import {
  ConnectionFailure,
  OpenSubsonicClient
} from '../../src/main/services/opensubsonic/client'
import type {
  ApiTransport,
  TransportResponse
} from '../../src/main/services/opensubsonic/transport'
import { ResponseLimitError } from '../../src/main/services/opensubsonic/transport'

function jsonResponse(body: unknown, status = 200): TransportResponse {
  return {
    status,
    contentType: 'application/json',
    cloudflareMitigated: false,
    body: JSON.stringify(body)
  }
}

class EndpointTransport implements ApiTransport {
  constructor(private readonly responses: Record<string, TransportResponse | Error>) {}

  async request(url: string): Promise<TransportResponse> {
    const endpoint = new URL(url).pathname.match(/\/rest\/(.+)\.view$/)?.[1]
    const response = endpoint ? this.responses[endpoint] : undefined
    if (!response) throw new Error('missing fixture')
    if (response instanceof Error) throw response
    return response
  }
}

const successfulPing = {
  'subsonic-response': {
    status: 'ok',
    version: '1.16.1',
    type: 'navidrome',
    serverVersion: '0.58.0',
    openSubsonic: true
  }
}

const successfulFolders = {
  'subsonic-response': {
    status: 'ok',
    version: '1.16.1',
    musicFolders: { musicFolder: [{ id: 7, name: '音乐库' }] }
  }
}

describe('OpenSubsonicClient', () => {
  it('探测 ping、扩展和音乐文件夹，并把服务端 ID 统一为 string', async () => {
    const client = new OpenSubsonicClient(
      new EndpointTransport({
        ping: jsonResponse(successfulPing),
        getOpenSubsonicExtensions: jsonResponse({
          'subsonic-response': {
            status: 'ok',
            version: '1.16.1',
            openSubsonicExtensions: [{ name: 'songLyrics', versions: [1] }]
          }
        }),
        getMusicFolders: jsonResponse(successfulFolders)
      })
    )

    await expect(
      client.testConnection('https://music.example.com', 'listener', 'secret')
    ).resolves.toEqual({
      server: {
        baseUrl: 'https://music.example.com',
        protocolVersion: '1.16.1',
        serverType: 'navidrome',
        serverVersion: '0.58.0',
        openSubsonic: true,
        capabilityStatus: 'available',
        extensions: ['songLyrics'],
        musicFolders: [{ id: '7', name: '音乐库' }]
      }
    })
  })

  it('旧 Subsonic 不支持扩展端点时降级，但仍要求音乐文件夹可访问', async () => {
    const client = new OpenSubsonicClient(
      new EndpointTransport({
        ping: jsonResponse(successfulPing),
        getOpenSubsonicExtensions: jsonResponse({
          'subsonic-response': {
            status: 'failed',
            version: '1.16.1',
            error: { code: 70, message: 'not found' }
          }
        }),
        getMusicFolders: jsonResponse(successfulFolders)
      })
    )

    const result = await client.testConnection('https://music.example.com', 'listener', 'secret')
    expect(result.server.capabilityStatus).toBe('unavailable')
    expect(result.server.extensions).toEqual([])
  })

  it('区分协议认证失败、Cloudflare 挑战和 HTML 响应', async () => {
    const authenticationClient = new OpenSubsonicClient(
      new EndpointTransport({
        ping: jsonResponse({
          'subsonic-response': {
            status: 'failed',
            version: '1.16.1',
            error: { code: 40, message: 'Wrong username or password' }
          }
        })
      })
    )
    await expect(
      authenticationClient.testConnection('https://music.example.com', 'listener', 'wrong')
    ).rejects.toMatchObject({ code: 'authentication' })

    const cloudflareClient = new OpenSubsonicClient(
      new EndpointTransport({
        ping: {
          status: 403,
          contentType: 'text/html',
          cloudflareMitigated: true,
          body: '<html>challenge</html>'
        }
      })
    )
    await expect(
      cloudflareClient.testConnection('https://music.example.com', 'listener', 'secret')
    ).rejects.toMatchObject({ code: 'http-forbidden' })

    const htmlClient = new OpenSubsonicClient(
      new EndpointTransport({
        ping: {
          status: 200,
          contentType: 'text/html',
          cloudflareMitigated: false,
          body: '<html>login</html>'
        }
      })
    )
    await expect(
      htmlClient.testConnection('https://music.example.com', 'listener', 'secret')
    ).rejects.toBeInstanceOf(ConnectionFailure)
    await expect(
      htmlClient.testConnection('https://music.example.com', 'listener', 'secret')
    ).rejects.toMatchObject({ code: 'unexpected-content' })
  })

  it('把 DNS 与 TLS 错误分类为不含原始请求 URL 的安全消息', async () => {
    const dnsClient = new OpenSubsonicClient(
      new EndpointTransport({ ping: new Error('net::ERR_NAME_NOT_RESOLVED at secret-url') })
    )
    await expect(
      dnsClient.testConnection('https://music.example.com', 'listener', 'secret')
    ).rejects.toMatchObject({ code: 'dns', message: '无法解析服务器域名。' })

    const tlsClient = new OpenSubsonicClient(
      new EndpointTransport({ ping: new Error('net::ERR_CERT_AUTHORITY_INVALID') })
    )
    await expect(
      tlsClient.testConnection('https://music.example.com', 'listener', 'secret')
    ).rejects.toMatchObject({ code: 'tls-certificate' })
  })

  it.each([
    ['重定向', jsonResponse({}, 302), 'redirect'],
    ['HTTP 认证', jsonResponse({}, 401), 'http-authentication'],
    ['服务器错误', jsonResponse({}, 503), 'server-error'],
    [
      '无权限',
      jsonResponse({
        'subsonic-response': {
          status: 'failed',
          version: '1.16.1',
          error: { code: 50, message: 'forbidden' }
        }
      }),
      'permission'
    ],
    [
      '协议版本',
      jsonResponse({
        'subsonic-response': {
          status: 'failed',
          version: '1.16.1',
          error: { code: 20, message: 'upgrade client' }
        }
      }),
      'protocol-version'
    ],
    [
      '认证方式',
      jsonResponse({
        'subsonic-response': {
          status: 'failed',
          version: '1.16.1',
          error: { code: 42, message: 'unsupported auth' }
        }
      }),
      'authentication-method'
    ],
    [
      '非法 JSON',
      {
        status: 200,
        contentType: 'application/json',
        cloudflareMitigated: false,
        body: '{broken'
      },
      'invalid-response'
    ],
    ['连接被拒绝', new Error('connect ECONNREFUSED'), 'connection-refused'],
    ['请求中止', new Error('AbortError: aborted'), 'timeout'],
    ['响应过大', new ResponseLimitError(), 'response-too-large']
  ])('分类%s错误', async (_caseName, fixture, expectedCode) => {
    const client = new OpenSubsonicClient(new EndpointTransport({ ping: fixture }))

    await expect(
      client.testConnection('https://music.example.com', 'listener', 'secret')
    ).rejects.toMatchObject({ code: expectedCode })
  })
})
