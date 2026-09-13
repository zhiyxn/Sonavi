import { describe, expect, it, vi } from 'vitest'
import { ConnectionService } from '../../src/main/services/connection-service'
import type { CredentialStore } from '../../src/main/services/credentials/credential-store'
import { MediaHandleRegistry } from '../../src/main/services/media-handle-registry'
import { MediaProtocolService, type MediaFetch } from '../../src/main/services/media-protocol'
import { OpenSubsonicClient } from '../../src/main/services/opensubsonic/client'
import type { ApiTransport } from '../../src/main/services/opensubsonic/transport'

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
