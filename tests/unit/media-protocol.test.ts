import { describe, expect, it, vi } from 'vitest'
import { ConnectionService } from '../../src/main/services/connection-service'
import type { CredentialStore } from '../../src/main/services/credentials/credential-store'
import { MediaHandleRegistry } from '../../src/main/services/media-handle-registry'
import {
  MAX_CONCURRENT_COVER_FETCHES,
  MediaProtocolService,
  type MediaFetch
} from '../../src/main/services/media-protocol'
import { NetworkDiagnosticRecorder } from '../../src/main/services/network-diagnostics'
import { OpenSubsonicClient } from '../../src/main/services/opensubsonic/client'
import type { ApiTransport } from '../../src/main/services/opensubsonic/transport'
import type { CoverCacheService } from '../../src/main/services/cover-cache-service'
import { TranscodeSeekResultSchema } from '../../src/shared/network-schema'

const credentialStore: CredentialStore = {
  save: async () => true,
  load: async () => null,
  delete: async () => true
}

async function connectedService(): Promise<{ service: ConnectionService; sessionId: string }> {
  const transport: ApiTransport = {
    async request(url) {
      const endpoint = new URL(url).pathname.match(/\/rest\/(.+)\.view$/)?.[1]
      const fields =
        endpoint === 'getMusicFolders'
          ? { musicFolders: { musicFolder: [] } }
          : endpoint === 'getOpenSubsonicExtensions'
            ? { openSubsonicExtensions: [] }
            : {}
      return {
        status: 200,
        contentType: 'application/json',
        cloudflareMitigated: false,
        body: JSON.stringify({
          'subsonic-response': { status: 'ok', version: '1.16.1', ...fields }
        })
      }
    }
  }
  const service = new ConnectionService(new OpenSubsonicClient(transport), credentialStore)
  const result = await service.test({
    serverUrl: 'https://music.example.com',
    username: 'listener',
    password: 'secret',
    rememberMe: false,
    allowInsecureHttp: false
  })
  if (!result.ok) throw new Error('fixture connection failed')
  return { service, sessionId: result.sessionId }
}

describe('sonavi-media 协议', () => {
  it('大量封面句柄不会淘汰仍在队列中的音频句柄', () => {
    const registry = new MediaHandleRegistry()
    const sessionId = '9f73bd9a-acde-4f0f-a3f6-3ddff7d09342'
    const audioUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'queued-song' })

    for (let index = 0; index < 10_000; index += 1) {
      registry.create({ sessionId, kind: 'cover', resourceId: `cover-${index}` })
    }

    expect(registry.resolve(audioUrl)).toMatchObject({
      sessionId,
      kind: 'audio',
      resourceId: 'queued-song'
    })
    expect(audioUrl).not.toContain('queued-song')
    expect(registry.resolve(`sonavi-media://media/${'a'.repeat(4_097)}`)).toBeNull()
  })

  it('转码跳转接受加密句柄并保留流参数', () => {
    const registry = new MediaHandleRegistry()
    const streamUrl = registry.create({
      sessionId: '9f73bd9a-acde-4f0f-a3f6-3ddff7d09342',
      kind: 'audio',
      resourceId: 'seek-song',
      streamMode: 'transcode',
      maxBitRate: 192,
      timeOffset: 17
    })

    expect(TranscodeSeekResultSchema.safeParse({ ok: true, streamUrl, timelineOffset: 17 }).success)
      .toBe(true)
    expect(registry.resolve(streamUrl)).toMatchObject({
      resourceId: 'seek-song',
      streamMode: 'transcode',
      maxBitRate: 192,
      timeOffset: 17
    })
  })

  it('只用不透明句柄解析媒体，并流式转发 Range 与 206 响应', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      }
    })
    const fetchMedia = vi.fn<MediaFetch>().mockResolvedValue(
      new Response(body, {
        status: 206,
        headers: {
          'content-type': 'audio/wav',
          'content-range': 'bytes 10-12/100',
          'accept-ranges': 'bytes'
        }
      })
    )
    const protocol = new MediaProtocolService(service, registry, fetchMedia)

    const response = await protocol.handle(
      new Request(mediaUrl, { headers: { range: 'bytes=10-12' } })
    )

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 10-12/100')
    expect(fetchMedia).toHaveBeenCalledOnce()
    const [upstreamUrl, init] = fetchMedia.mock.calls[0] ?? []
    expect(upstreamUrl).not.toContain('secret')
    expect(new URL(upstreamUrl ?? '').searchParams.get('id')).toBe('song-1')
    expect(new Headers(init?.headers).get('range')).toBe('bytes=10-12')
    expect((await response.arrayBuffer()).byteLength).toBe(3)
  })

  it.each([
    ['多段 Range', new Request('https://placeholder', { headers: { range: 'bytes=0-1,3-4' } }), 416],
    ['非 GET 方法', new Request('https://placeholder', { method: 'POST' }), 405]
  ])('%s 在访问上游前被拒绝', async (_name, template, status) => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    const fetchMedia = vi.fn<MediaFetch>()
    const protocol = new MediaProtocolService(service, registry, fetchMedia)
    const request = new Request(mediaUrl, {
      method: template.method,
      headers: template.headers
    })

    await expect(protocol.handle(request)).resolves.toMatchObject({ status })
    expect(fetchMedia).not.toHaveBeenCalled()
  })

  it('拒绝上游重定向和伪装成 XML 的媒体响应', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'cover', resourceId: 'cover-1' })
    const fetchMedia = vi
      .fn<MediaFetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://other' } }))
      .mockResolvedValueOnce(new Response('<error/>', { headers: { 'content-type': 'text/xml' } }))
    const protocol = new MediaProtocolService(service, registry, fetchMedia)

    await expect(protocol.handle(new Request(mediaUrl))).resolves.toMatchObject({ status: 502 })
    await expect(protocol.handle(new Request(mediaUrl))).resolves.toMatchObject({ status: 502 })
  })

  it('封面实际响应超过缓存单项上限时中止而不无界缓冲', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'cover', resourceId: 'cover-1' })
    const put = vi.fn()
    const coverCache = {
      get: async () => null,
      canStore: () => true,
      getMaxItemBytes: () => 3,
      put
    } as unknown as CoverCacheService
    const protocol = new MediaProtocolService(
      service,
      registry,
      async () => new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { 'content-type': 'image/png', 'content-length': '2' }
      }),
      undefined,
      undefined,
      coverCache
    )

    await expect(protocol.handle(new Request(mediaUrl))).resolves.toMatchObject({ status: 502 })
    expect(put).not.toHaveBeenCalled()
  })

  it('缓存未命中时最多并发请求六张封面，并按完成顺序放行队列', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const releaseUpstream: Array<() => void> = []
    let active = 0
    let peakActive = 0
    const fetchMedia = vi.fn<MediaFetch>(async () => {
      active += 1
      peakActive = Math.max(peakActive, active)
      return await new Promise<Response>((resolve) => {
        releaseUpstream.push(() => {
          active -= 1
          resolve(new Response(new Uint8Array([1]), {
            headers: { 'content-type': 'image/png', 'content-length': '1' }
          }))
        })
      })
    })
    const coverCache = {
      get: async () => null,
      canStore: () => true,
      getMaxItemBytes: () => 1024,
      put: async () => undefined
    } as unknown as CoverCacheService
    const protocol = new MediaProtocolService(
      service,
      registry,
      fetchMedia,
      undefined,
      undefined,
      coverCache
    )
    const requests = Array.from({ length: 12 }, (_, index) => {
      const url = registry.create({
        sessionId,
        kind: 'cover',
        resourceId: `cover-${index}`
      })
      return protocol.handle(new Request(url))
    })

    await vi.waitFor(() => expect(fetchMedia).toHaveBeenCalledTimes(MAX_CONCURRENT_COVER_FETCHES))
    releaseUpstream.splice(0, MAX_CONCURRENT_COVER_FETCHES).forEach((release) => release())
    await vi.waitFor(() => expect(fetchMedia).toHaveBeenCalledTimes(12))
    releaseUpstream.splice(0).forEach((release) => release())

    await expect(Promise.all(requests)).resolves.toHaveLength(12)
    expect(peakActive).toBe(MAX_CONCURRENT_COVER_FETCHES)
  })

  it.each([
    [200, null],
    [416, 'bytes */100']
  ] as const)('保留上游 %s 状态及受限响应头', async (status, contentRange) => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    const upstream = new Response(status === 200 ? new Uint8Array([1]) : null, {
      status,
      headers: {
        ...(status === 200 ? { 'content-type': 'audio/wav' } : {}),
        ...(contentRange ? { 'content-range': contentRange } : {})
      }
    })
    const protocol = new MediaProtocolService(service, registry, async () => upstream)

    const response = await protocol.handle(new Request(mediaUrl))
    expect(response.status).toBe(status)
    expect(response.headers.get('content-range')).toBe(contentRange)
  })

  it('上游网络失败被收敛为不泄露细节的 502', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    const protocol = new MediaProtocolService(service, registry, async () => {
      throw new Error('secret upstream url')
    })

    const response = await protocol.handle(new Request(mediaUrl))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('secret')
  })

  it('兼容转码只发送受控格式、码率和已确认的时间偏移', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({
      sessionId,
      kind: 'audio',
      resourceId: 'song-1',
      streamMode: 'transcode',
      maxBitRate: 192,
      timeOffset: 42
    })
    const fetchMedia = vi.fn<MediaFetch>().mockResolvedValue(
      new Response(new Uint8Array([1]), { headers: { 'content-type': 'audio/mpeg' } })
    )
    const protocol = new MediaProtocolService(service, registry, fetchMedia)

    const response = await protocol.handle(new Request(mediaUrl))
    await response.arrayBuffer()
    const upstreamUrl = new URL(fetchMedia.mock.calls[0]![0])
    expect(Object.fromEntries(upstreamUrl.searchParams)).toMatchObject({
      format: 'mp3',
      maxBitRate: '192',
      estimateContentLength: 'true',
      timeOffset: '42'
    })
  })

  it.each([
    [403, 'http-forbidden'],
    [500, 'http-status']
  ] as const)('将转码上游 HTTP %s 分类到脱敏诊断', async (status, category) => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({
      sessionId,
      kind: 'audio',
      resourceId: 'song-1',
      streamMode: 'transcode',
      maxBitRate: 192
    })
    const diagnostics = new NetworkDiagnosticRecorder()
    const protocol = new MediaProtocolService(
      service,
      registry,
      async () => new Response(null, { status }),
      diagnostics,
      () => 'manual'
    )

    await expect(protocol.handle(new Request(mediaUrl))).resolves.toMatchObject({ status: 502 })
    expect(diagnostics.list()[0]).toMatchObject({
      stage: 'audio-transcode',
      proxyMode: 'manual',
      status,
      errorCategory: category
    })
  })

  it('把传输中断分类为 broken-stream', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    const diagnostics = new NetworkDiagnosticRecorder()
    const brokenBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('connection reset'))
      }
    })
    const protocol = new MediaProtocolService(
      service,
      registry,
      async () => new Response(brokenBody, { headers: { 'content-type': 'audio/mpeg' } }),
      diagnostics
    )

    const response = await protocol.handle(new Request(mediaUrl))
    await expect(response.arrayBuffer()).rejects.toThrow()
    expect(diagnostics.list()).toHaveLength(1)
    expect(diagnostics.list()[0]).toMatchObject({
      stage: 'audio-original',
      operation: 'stream',
      errorCategory: 'broken-stream',
      errorName: 'Error',
      errorDetail: 'connection reset'
    })
  })

  it('消费者取消与上游读取竞争时只留下一条终态记录', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    const diagnostics = new NetworkDiagnosticRecorder()
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
      }
    })
    const protocol = new MediaProtocolService(
      service,
      registry,
      async () => new Response(upstreamBody, { headers: { 'content-type': 'audio/mpeg' } }),
      diagnostics
    )

    const response = await protocol.handle(new Request(mediaUrl))
    const reader = response.body!.getReader()
    await reader.read()
    const pendingRead = reader.read()
    await reader.cancel().catch(() => undefined)
    await pendingRead.catch(() => undefined)

    expect(diagnostics.list()).toHaveLength(1)
    expect(diagnostics.list()[0]).toMatchObject({
      stage: 'audio-original',
      operation: 'stream',
      errorCategory: 'cancelled'
    })
  })

  it('撤销会话会使旧句柄失效并取消尚未完成的上游请求', async () => {
    const { service, sessionId } = await connectedService()
    const registry = new MediaHandleRegistry()
    const mediaUrl = registry.create({ sessionId, kind: 'audio', resourceId: 'song-1' })
    let upstreamSignal: AbortSignal | undefined
    const protocol = new MediaProtocolService(service, registry, async (_url, init) => {
      upstreamSignal = init.signal ?? undefined
      return await new Promise<Response>((_resolve, reject) => {
        upstreamSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
    })

    const pendingResponse = protocol.handle(new Request(mediaUrl))
    await vi.waitFor(() => expect(upstreamSignal).toBeDefined())
    expect(protocol.revokeSession(sessionId)).toBe(1)
    expect(registry.revokeSession(sessionId)).toBe(1)
    expect(upstreamSignal?.aborted).toBe(true)
    await expect(pendingResponse).resolves.toMatchObject({ status: 502 })
    await expect(protocol.handle(new Request(mediaUrl))).resolves.toMatchObject({ status: 404 })
  })
})
