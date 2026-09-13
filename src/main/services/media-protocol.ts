import type { ConnectionService } from './connection-service'
import type { MediaHandleRegistry } from './media-handle-registry'
import { buildEndpointUrl } from './opensubsonic/request-url'

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

export class MediaProtocolService {
  constructor(
    private readonly connectionService: ConnectionService,
    private readonly handles: MediaHandleRegistry,
    private readonly fetchMedia: MediaFetch
  ) {}

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

    const { serverUrl, username, password } = connected.credential
    const endpoint = handle.kind === 'cover' ? 'getCoverArt' : 'stream'
    const url = buildEndpointUrl(serverUrl, endpoint, username, password, undefined, {
      id: handle.resourceId,
      ...(handle.kind === 'audio' ? { format: 'raw' } : {})
    })
    let upstream: Response
    try {
      upstream = await this.fetchMedia(url, {
        method: request.method,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        signal: request.signal,
        ...(range ? { headers: { range } } : {})
      })
    } catch {
      return errorResponse(502, 'Upstream media request failed')
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel()
      return errorResponse(502, 'Upstream redirect rejected')
    }

    if (upstream.status === 416) {
      const headers = new Headers({ 'cache-control': 'no-store' })
      const contentRange = upstream.headers.get('content-range')
      if (contentRange) headers.set('content-range', contentRange)
      return new Response(null, { status: 416, headers })
    }

    if (upstream.status !== 200 && upstream.status !== 206) {
      await upstream.body?.cancel()
      return errorResponse(502, 'Upstream media request failed')
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!hasExpectedMediaType(handle.kind, contentType)) {
      await upstream.body?.cancel()
      return errorResponse(502, 'Unexpected upstream media type')
    }

    const headers = new Headers({ 'cache-control': 'no-store' })
    for (const name of SAFE_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers
    })
  }
}
