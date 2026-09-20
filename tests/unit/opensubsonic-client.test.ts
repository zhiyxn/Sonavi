import { afterEach, describe, expect, it, vi } from 'vitest'
import { session } from 'electron'
import {
  ConnectionFailure,
  OpenSubsonicClient
} from '../../src/main/services/opensubsonic/client'
import { NetworkDiagnosticRecorder } from '../../src/main/services/network-diagnostics'
import type {
  ApiRequestOptions,
  ApiTransport,
  TransportResponse
} from '../../src/main/services/opensubsonic/transport'
import {
  ElectronSessionTransport,
  ResponseLimitError
} from '../../src/main/services/opensubsonic/transport'

vi.mock('electron', () => ({
  session: { defaultSession: { fetch: vi.fn() } }
}))

type SessionFetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>

function rejectOnAbort(): SessionFetch {
  return (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal.addEventListener(
        'abort',
        () => reject(new DOMException('This operation was aborted', 'AbortError')),
        { once: true }
      )
    })
}

function clientWithDiagnostics(): { client: OpenSubsonicClient; recorder: NetworkDiagnosticRecorder } {
  const recorder = new NetworkDiagnosticRecorder()
  const target = session.defaultSession as unknown as { fetch: SessionFetch }
  target.fetch = vi.fn(rejectOnAbort())
  return {
    client: new OpenSubsonicClient(new ElectronSessionTransport(recorder, () => 'system')),
    recorder
  }
}

afterEach(() => {
  vi.useRealTimers()
})

function jsonResponse(body: unknown, status = 200): TransportResponse {
  return {
    status,
    contentType: 'application/json',
    cloudflareMitigated: false,
    body: JSON.stringify(body)
  }
}

class EndpointTransport implements ApiTransport {
  readonly requestedUrls: string[] = []
  readonly requestedOptions: Array<ApiRequestOptions | undefined> = []

  constructor(private readonly responses: Record<string, TransportResponse | Error>) {}

  async request(
    url: string,
    signal: AbortSignal,
    options?: ApiRequestOptions
  ): Promise<TransportResponse> {
    void signal
    this.requestedUrls.push(url)
    this.requestedOptions.push(options)
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
  it('完整艺术家索引使用独立 45 秒超时，其他端点继续保持 12 秒', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const transport: ApiTransport = {
      request: vi.fn((_url, signal) => {
        signals.push(signal)
        return new Promise<TransportResponse>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('This operation was aborted', 'AbortError')),
            { once: true }
          )
        })
      })
    }
    const client = new OpenSubsonicClient(transport)

    const artistsRequest = client
      .getArtists('https://music.example.com', 'listener', 'secret')
      .then(() => null, (error: unknown) => error)
    await vi.advanceTimersByTimeAsync(12_000)
    expect(signals[0]?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(32_999)
    expect(signals[0]?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(artistsRequest).resolves.toMatchObject({ code: 'timeout' })

    const albumRequest = client
      .getAlbumList2(
        'https://music.example.com',
        'listener',
        'secret',
        0,
        30,
        'newest',
        1
      )
      .then(() => null, (error: unknown) => error)
    await vi.advanceTimersByTimeAsync(11_999)
    expect(signals[1]?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(albumRequest).resolves.toMatchObject({ code: 'timeout' })
  })

  it('收到响应头后读取正文超时时保留状态、响应头耗时和已读字节数', async () => {
    vi.useFakeTimers()
    const recorder = new NetworkDiagnosticRecorder()
    const target = session.defaultSession as unknown as { fetch: SessionFetch }
    target.fetch = vi.fn(async (_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"subsonic-response":'))
          init.signal.addEventListener(
            'abort',
            () => controller.error(new DOMException('This operation was aborted', 'AbortError')),
            { once: true }
          )
        }
      })
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
    const client = new OpenSubsonicClient(new ElectronSessionTransport(recorder, () => 'system'))
    const request = client
      .getArtists('https://music.example.com', 'listener', 'secret')
      .then(() => null, (error: unknown) => error)

    await vi.advanceTimersByTimeAsync(45_000)
    await expect(request).resolves.toMatchObject({
      code: 'timeout',
      message: expect.stringContaining('正文读取超时')
    })
    expect(recorder.list()[0]).toMatchObject({
      operation: 'getArtists',
      status: 200,
      contentType: 'application/json',
      responseBytes: 21,
      errorCategory: 'timeout'
    })
    expect(recorder.list()[0]?.responseHeadersMs).toBeGreaterThanOrEqual(0)
  })

  it('只为完整艺术家索引使用仍然有界的较大响应上限', async () => {
    const transport = new EndpointTransport({
      getArtists: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          artists: { index: [] }
        }
      }),
      getAlbumList2: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          albumList2: { album: [] }
        }
      })
    })
    const client = new OpenSubsonicClient(transport)

    await client.getArtists('https://music.example.com', 'listener', 'secret')
    await client.getAlbumList2(
      'https://music.example.com',
      'listener',
      'secret',
      0,
      30,
      'newest',
      2
    )

    expect(transport.requestedOptions[0]).toMatchObject({
      maxResponseBytes: 16 * 1024 * 1024,
      operation: 'getArtists'
    })
    expect(transport.requestedOptions[1]).not.toHaveProperty('maxResponseBytes')
    expect(transport.requestedOptions[1]).toMatchObject({
      operation: 'getAlbumList2',
      requestContext: 'listType=newest,page=1,size=30',
      attempt: 2
    })
  })

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

  it('读取专辑列表与详情，并把查询 ID 和返回 ID 规范为 string', async () => {
    const transport = new EndpointTransport({
      getAlbumList2: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          albumList2: {
            album: [
              {
                id: 12,
                name: '石与琥珀',
                artist: 'Sonavi',
                songCount: 1,
                duration: 60,
                coverArt: 34
              }
            ]
          }
        }
      }),
      getAlbum: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          album: {
            id: 12,
            name: '石与琥珀',
            artist: 'Sonavi',
            songCount: 1,
            duration: 60,
            coverArt: 34,
            song: [
              {
                id: 56,
                title: '第一首',
                artist: 'Sonavi',
                album: '石与琥珀',
                duration: 60,
                track: 1,
                contentType: 'audio/wav'
              }
            ]
          }
        }
      })
    })
    const client = new OpenSubsonicClient(transport)

    await expect(
      client.getAlbumList2('https://music.example.com', 'listener', 'secret', 30, 25)
    ).resolves.toEqual([
      {
        id: '12',
        name: '石与琥珀',
        artist: 'Sonavi',
        songCount: 1,
        duration: 60,
        starred: false,
        coverArtId: '34'
      }
    ])
    const albumListUrl = new URL(transport.requestedUrls[0] ?? '')
    expect(albumListUrl.searchParams.get('type')).toBe('newest')
    expect(albumListUrl.searchParams.get('offset')).toBe('30')
    expect(albumListUrl.searchParams.get('size')).toBe('25')
    await expect(
      client.getAlbum('https://music.example.com', 'listener', 'secret', '12')
    ).resolves.toMatchObject({
      id: '12',
      tracks: [{ id: '56', title: '第一首' }]
    })
  })

  it('读取艺术家索引、艺术家详情和分页搜索结果', async () => {
    const transport = new EndpointTransport({
      getArtists: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          artists: {
            index: [
              {
                name: 'S',
                artist: [{ id: 9, name: '声波旅人', albumCount: 1, coverArt: 90 }]
              }
            ]
          }
        }
      }),
      getArtist: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          artist: {
            id: 9,
            name: '声波旅人',
            albumCount: 1,
            album: [
              { id: 10, name: '跨平台', artist: '声波旅人', songCount: 2, duration: 120 }
            ]
          }
        }
      }),
      search3: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          searchResult3: {
            artist: [{ id: 9, name: '声波旅人', albumCount: 1 }],
            album: [{ id: 10, name: '跨平台', artist: '声波旅人', songCount: 2, duration: 120 }],
            song: [
              { id: 11, title: '同一首歌', artist: '声波旅人', album: '跨平台', duration: 60 }
            ]
          }
        }
      })
    })
    const client = new OpenSubsonicClient(transport)

    await expect(
      client.getArtists('https://music.example.com', 'listener', 'secret')
    ).resolves.toEqual([
      {
        name: 'S',
        artists: [{ id: '9', name: '声波旅人', albumCount: 1, starred: false, coverArtId: '90' }]
      }
    ])
    await expect(
      client.getArtist('https://music.example.com', 'listener', 'secret', '9')
    ).resolves.toMatchObject({ id: '9', albums: [{ id: '10', name: '跨平台' }] })
    await expect(
      client.search3('https://music.example.com', 'listener', 'secret', '声波', 25, 50, 25)
    ).resolves.toMatchObject({
      artists: [{ id: '9' }],
      albums: [{ id: '10' }],
      tracks: [{ id: '11', title: '同一首歌' }]
    })

    const searchUrl = new URL(transport.requestedUrls[2] ?? '')
    expect(searchUrl.searchParams.get('query')).toBe('声波')
    expect(searchUrl.searchParams.get('artistOffset')).toBe('0')
    expect(searchUrl.searchParams.get('albumOffset')).toBe('25')
    expect(searchUrl.searchParams.get('albumCount')).toBe('25')
    expect(searchUrl.searchParams.get('songOffset')).toBe('50')
  })

  it('读取结构化与旧版歌词，并按协议发送播放上报', async () => {
    const transport = new EndpointTransport({
      getLyricsBySongId: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          lyricsList: {
            structuredLyrics: [
              {
                displayArtist: 'Sonavi',
                displayTitle: '跨平台试音',
                lang: 'xxx',
                offset: -100,
                synced: true,
                line: [
                  { start: 0, value: '第一行' },
                  { start: 1500, value: '第二行' }
                ]
              }
            ]
          }
        }
      }),
      getLyrics: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          lyrics: { artist: 'Sonavi', title: '文本歌词', value: '一\n\n二' }
        }
      }),
      scrobble: jsonResponse({
        'subsonic-response': { status: 'ok', version: '1.16.1' }
      })
    })
    const client = new OpenSubsonicClient(transport)

    await expect(
      client.getLyricsBySongId('https://music.example.com', 'listener', 'secret', 'track-1')
    ).resolves.toEqual({
      source: 'structured',
      variants: [
        {
          displayArtist: 'Sonavi',
          displayTitle: '跨平台试音',
          offsetMs: -100,
          synced: true,
          lines: [
            { startMs: 0, value: '第一行' },
            { startMs: 1500, value: '第二行' }
          ]
        }
      ]
    })
    await expect(
      client.getLyrics('https://music.example.com', 'listener', 'secret', 'Sonavi', '文本歌词')
    ).resolves.toMatchObject({
      source: 'legacy',
      variants: [{ synced: false, lines: [{ value: '一' }, { value: '' }, { value: '二' }] }]
    })
    await client.scrobble(
      'https://music.example.com',
      'listener',
      'secret',
      'track-1',
      false,
      1_700_000_000_000
    )

    const structuredUrl = new URL(transport.requestedUrls[0]!)
    const legacyUrl = new URL(transport.requestedUrls[1]!)
    const scrobbleUrl = new URL(transport.requestedUrls[2]!)
    expect(structuredUrl.searchParams.get('id')).toBe('track-1')
    expect(structuredUrl.searchParams.has('enhanced')).toBe(false)
    expect(legacyUrl.searchParams.get('artist')).toBe('Sonavi')
    expect(legacyUrl.searchParams.get('title')).toBe('文本歌词')
    expect(scrobbleUrl.searchParams.get('id')).toBe('track-1')
    expect(scrobbleUrl.searchParams.get('submission')).toBe('false')
    expect(scrobbleUrl.searchParams.get('time')).toBe('1700000000000')
    for (const url of transport.requestedUrls) {
      expect(new URL(url).searchParams.has('p')).toBe(false)
    }
  })

  it('读取与更新收藏，并完整保留歌单重复歌曲和移除索引', async () => {
    const ok = jsonResponse({ 'subsonic-response': { status: 'ok', version: '1.16.1' } })
    const transport = new EndpointTransport({
      getStarred2: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          starred2: {
            artist: [{ id: 9, name: '声波旅人', albumCount: 1, starred: '2026-09-14' }],
            album: [{ id: 10, name: '跨平台', artist: '声波旅人', songCount: 2, duration: 120, starred: '2026-09-14' }],
            song: [{ id: 11, title: '同一首歌', artist: '声波旅人', album: '跨平台', duration: 60, starred: '2026-09-14' }]
          }
        }
      }),
      star: ok,
      unstar: ok,
      getPlaylists: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          playlists: { playlist: [{ id: 20, name: '夜间', owner: 'listener', public: false, songCount: 2, duration: 120 }] }
        }
      }),
      getPlaylist: jsonResponse({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          playlist: {
            id: 20,
            name: '夜间',
            owner: 'listener',
            public: false,
            songCount: 2,
            duration: 120,
            entry: [
              { id: 11, title: '同一首歌', artist: '声波旅人', album: '跨平台', duration: 60 },
              { id: 11, title: '同一首歌', artist: '声波旅人', album: '跨平台', duration: 60 }
            ]
          }
        }
      }),
      createPlaylist: ok,
      updatePlaylist: ok,
      deletePlaylist: ok
    })
    const client = new OpenSubsonicClient(transport)
    const args = ['https://music.example.com', 'listener', 'secret'] as const

    await expect(client.getStarred2(...args)).resolves.toMatchObject({
      artists: [{ id: '9', starred: true }],
      albums: [{ id: '10', starred: true }],
      tracks: [{ id: '11', starred: true }]
    })
    await client.setStarred(...args, 'album', '10', true)
    await client.setStarred(...args, 'track', '11', false)
    await expect(client.getPlaylists(...args)).resolves.toEqual([
      {
        id: '20',
        name: '夜间',
        owner: 'listener',
        public: false,
        songCount: 2,
        duration: 120
      }
    ])
    await expect(client.getPlaylist(...args, '20')).resolves.toMatchObject({
      id: '20',
      tracks: [{ id: '11' }, { id: '11' }]
    })
    await client.createPlaylist(...args, '重复歌曲', ['11', '11'])
    await client.updatePlaylist(...args, '20', {
      name: '更新名称',
      public: true,
      songIdsToAdd: ['11', '12'],
      songIndexesToRemove: [3, 1]
    })
    await client.deletePlaylist(...args, '20')

    expect(new URL(transport.requestedUrls[1]!).searchParams.get('albumId')).toBe('10')
    expect(new URL(transport.requestedUrls[2]!).searchParams.get('id')).toBe('11')
    expect(new URL(transport.requestedUrls[5]!).searchParams.getAll('songId')).toEqual(['11', '11'])
    const updateParams = new URL(transport.requestedUrls[6]!).searchParams
    expect(updateParams.get('public')).toBe('true')
    expect(updateParams.getAll('songIdToAdd')).toEqual(['11', '12'])
    expect(updateParams.getAll('songIndexToRemove')).toEqual(['3', '1'])
    expect(new URL(transport.requestedUrls[7]!).searchParams.get('id')).toBe('20')
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

  it('内部 12 秒超时记为 timeout，而不是 cancelled', async () => {
    vi.useFakeTimers()
    const { client, recorder } = clientWithDiagnostics()

    const pending = client.getAlbumList2('https://music.example.com', 'listener', 'secret')
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(12_000)
    await assertion

    expect(recorder.list()).toHaveLength(1)
    expect(recorder.list()[0]).toMatchObject({
      stage: 'api',
      operation: 'getAlbumList2',
      errorCategory: 'timeout',
      errorName: 'AbortError'
    })
    expect(recorder.list()[0]?.status).toBeUndefined()
  })

  it('scrobble 超时明确记录端点，后续上报仍会发起独立请求', async () => {
    vi.useFakeTimers()
    const { client, recorder } = clientWithDiagnostics()

    const first = client.scrobble(
      'https://music.example.com',
      'listener',
      'secret',
      'track-1',
      false,
      1_700_000_000_000
    )
    const firstAssertion = expect(first).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(12_000)
    await firstAssertion

    const second = client.scrobble(
      'https://music.example.com',
      'listener',
      'secret',
      'track-2',
      false,
      1_700_000_001_000
    )
    const secondAssertion = expect(second).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(12_000)
    await secondAssertion

    expect(recorder.list()).toHaveLength(2)
    expect(recorder.list().every((entry) =>
      entry.operation === 'scrobble' && entry.errorCategory === 'timeout'
    )).toBe(true)
  })

  it('调用方取消记为 cancelled，而不是 timeout', async () => {
    const { client, recorder } = clientWithDiagnostics()
    const controller = new AbortController()

    const pending = client.search3(
      'https://music.example.com',
      'listener',
      'secret',
      'sonavi',
      0,
      0,
      10,
      controller.signal
    )
    controller.abort()
    await expect(pending).rejects.toBeDefined()

    expect(recorder.list()).toHaveLength(1)
    expect(recorder.list()[0]).toMatchObject({
      stage: 'api',
      operation: 'search3',
      errorCategory: 'cancelled'
    })
  })
})
