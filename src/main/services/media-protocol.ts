import type { ConnectionService } from './connection-service'
import type { MediaHandleRegistry } from './media-handle-registry'
import { buildEndpointUrl } from './opensubsonic/request-url'
import type { ProxyMode } from '../../shared/network'
import {
  classifyNetworkError,
  NetworkDiagnosticRecorder
} from './network-diagnostics'
import type { CoverCacheService } from './cover-cache-service'

const SAFE_RESPONSE_HEADERS = [
  'accept-ranges',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified'
] as const

export type MediaFetch = (url: string, init: RequestInit) => Promise<Response>

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  })
}

function isValidRange(range: string): boolean {
  return /^bytes=(?:\d+-\d*|-\d+)$/.test(range)
}

function hasExpectedMediaType(kind: 'cover' | 'audio', contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  if (kind === 'cover') return normalized.startsWith('image/')
  return normalized.startsWith('audio/') || normalized.startsWith('application/octet-stream')
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function readBoundedBody(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      totalBytes += chunk.value.byteLength
      if (totalBytes > maxBytes) throw new Error('Cover response exceeded cache item limit')
      chunks.push(chunk.value)
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  }
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export class MediaProtocolService {
  private readonly activeRequests = new Map<string, Set<AbortController>>()

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly handles: MediaHandleRegistry,
    private readonly fetchMedia: MediaFetch,
    private readonly diagnostics?: NetworkDiagnosticRecorder,
    private readonly getProxyMode: () => ProxyMode = () => 'system',
    private readonly coverCache?: CoverCacheService
  ) {}

  revokeSession(sessionId: string): number {
    const controllers = this.activeRequests.get(sessionId)
    if (!controllers) return 0
    this.activeRequests.delete(sessionId)
    for (const controller of controllers) controller.abort()
    return controllers.size
  }

  dispose(): void {
    for (const sessionId of [...this.activeRequests.keys()]) this.revokeSession(sessionId)
  }

  async handle(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return errorResponse(405, 'Method Not Allowed')
    }

    const handle = this.handles.resolve(request.url)
    if (!handle) return errorResponse(404, 'Media handle not found')

    const connected = this.connectionService.getSession(handle.sessionId)
    if (!connected) return errorResponse(401, 'Media session expired')

    const range = request.headers.get('range')
    if (range && !isValidRange(range)) return errorResponse(416, 'Invalid range')

    if (handle.kind === 'cover' && request.method === 'GET' && !range && this.coverCache) {
      const cached = await this.coverCache.get(connected, handle.resourceId)
      if (cached) {
        return new Response(responseBody(cached.bytes), {
          status: 200,
          headers: {
            'content-type': cached.contentType,
            'content-length': String(cached.bytes.byteLength),
            'cache-control': 'private, max-age=86400'
          }
        })
      }
    }

    const abortController = new AbortController()
    const startedAt = performance.now()
    const diagnosticStage =
      handle.kind === 'cover'
        ? 'cover'
        : handle.streamMode === 'transcode'
          ? 'audio-transcode'
          : 'audio-original'
    const endpoint = handle.kind === 'cover' ? 'getCoverArt' : 'stream'
    const operation: string = endpoint
    const record = (
      errorCategory: Parameters<NetworkDiagnosticRecorder['record']>[0]['errorCategory'],
      status?: number,
      contentType?: string,
      error?: unknown
    ): void =>
      this.diagnostics?.record({
        stage: diagnosticStage,
        proxyMode: this.getProxyMode(),
        startedAt,
        operation,
        ...(status ? { status } : {}),
        ...(contentType ? { contentType } : {}),
        ...(error !== undefined ? { error } : {}),
        errorCategory
      })
    const sessionRequests = this.activeRequests.get(handle.sessionId) ?? new Set<AbortController>()
    sessionRequests.add(abortController)
    this.activeRequests.set(handle.sessionId, sessionRequests)
    const abortFromRequest = (): void => abortController.abort()
    request.signal.addEventListener('abort', abortFromRequest, { once: true })
    let cleanedUp = false
    const cleanup = (): void => {
      if (cleanedUp) return
      cleanedUp = true
      request.signal.removeEventListener('abort', abortFromRequest)
      sessionRequests.delete(abortController)
      if (sessionRequests.size === 0) this.activeRequests.delete(handle.sessionId)
    }
    let settled = false
    let clientCancelled = false
    // 一个媒体请求只允许一条终态记录：消费者取消与上游断流可能同时发生，先到者胜出。
    const settle = (
      errorCategory: Parameters<NetworkDiagnosticRecorder['record']>[0]['errorCategory'],
      status?: number,
      contentType?: string,
      error?: unknown
    ): void => {
      if (settled) return
      settled = true
      cleanup()
      record(errorCategory, status, contentType, error)
    }

    const { serverUrl, username, password } = connected.credential
    const url = buildEndpointUrl(serverUrl, endpoint, username, password, undefined, {
      id: handle.resourceId,
      ...(handle.kind === 'audio' && handle.streamMode === 'original' ? { format: 'raw' } : {}),
      ...(handle.kind === 'audio' && handle.streamMode === 'transcode'
        ? {
            format: 'mp3',
            ...(handle.maxBitRate ? { maxBitRate: handle.maxBitRate } : {}),
            estimateContentLength: true,
            ...(handle.timeOffset !== undefined ? { timeOffset: handle.timeOffset } : {})
          }
        : {})
    })
    let upstream: Response
    try {
      upstream = await this.fetchMedia(url, {
        method: request.method,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        signal: abortController.signal,
        ...(range ? { headers: { range } } : {})
      })
    } catch (error) {
      settle(
        classifyNetworkError(error, { cancelledByCaller: abortController.signal.aborted }),
        undefined,
        undefined,
        error
      )
      return errorResponse(502, 'Upstream media request failed')
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel()
      cleanup()
      record('http-status', upstream.status, upstream.headers.get('content-type') ?? undefined)
      return errorResponse(502, 'Upstream redirect rejected')
    }

    if (upstream.status === 416) {
      await upstream.body?.cancel()
      cleanup()
      const headers = new Headers({ 'cache-control': 'no-store' })
      const contentRange = upstream.headers.get('content-range')
      if (contentRange) headers.set('content-range', contentRange)
      record('none', upstream.status, upstream.headers.get('content-type') ?? undefined)
      return new Response(null, { status: 416, headers })
    }

    if (upstream.status !== 200 && upstream.status !== 206) {
      await upstream.body?.cancel()
      cleanup()
      record(
        upstream.status === 401
          ? 'http-authentication'
          : upstream.status === 403
            ? 'http-forbidden'
            : 'http-status',
        upstream.status,
        upstream.headers.get('content-type') ?? undefined
      )
      return errorResponse(502, 'Upstream media request failed')
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!hasExpectedMediaType(handle.kind, contentType)) {
      await upstream.body?.cancel()
      cleanup()
      record('unexpected-content', upstream.status, contentType)
      return errorResponse(502, 'Unexpected upstream media type')
    }

    const headers = new Headers({ 'cache-control': 'no-store' })
    for (const name of SAFE_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }

    if (request.method === 'HEAD' || !upstream.body) {
      await upstream.body?.cancel()
      cleanup()
      record('none', upstream.status, contentType)
      return new Response(null, { status: upstream.status, headers })
    }

    const contentLength = Number(upstream.headers.get('content-length'))
    if (
      handle.kind === 'cover' &&
      upstream.status === 200 &&
      !range &&
      this.coverCache?.canStore(contentLength)
    ) {
      try {
        const bytes = await readBoundedBody(upstream.body, this.coverCache.getMaxItemBytes())
        cleanup()
        record('none', upstream.status, contentType)
        await this.coverCache.put(connected, handle.resourceId, bytes, contentType)
        headers.set('cache-control', 'private, max-age=86400')
        return new Response(responseBody(bytes), { status: 200, headers })
      } catch (error) {
        settle(
          clientCancelled || abortController.signal.aborted
            ? 'cancelled'
            : classifyNetworkError(error),
          upstream.status,
          contentType,
          error
        )
        return errorResponse(502, 'Upstream cover request failed')
      }
    }

    const reader = upstream.body.getReader()
    const streamingBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read()
          if (chunk.done) {
            controller.close()
            settle('none', upstream.status, contentType)
          } else {
            controller.enqueue(chunk.value)
          }
        } catch (error) {
          controller.error(error)
          settle(
            clientCancelled || abortController.signal.aborted ? 'cancelled' : 'broken-stream',
            upstream.status,
            contentType,
            error
          )
        }
      },
      async cancel(reason) {
        clientCancelled = true
        settle('cancelled', upstream.status, contentType)
        try {
          await reader.cancel(reason)
        } catch {
          // 上游流可能已结束或已中断；终态记录不依赖它。
        }
      }
    })

    return new Response(streamingBody, {
      status: upstream.status,
      headers
    })
  }
}
