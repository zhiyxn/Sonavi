import { session } from 'electron'
import type { ProxyMode } from '../../../shared/network'
import {
  classifyNetworkError,
  NetworkDiagnosticRecorder
} from '../network-diagnostics'

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024

export interface ApiRequestOptions {
  maxResponseBytes?: number
}

export interface TransportResponse {
  status: number
  contentType: string
  cloudflareMitigated: boolean
  body: string
}

export interface ApiTransport {
  request: (
    url: string,
    signal: AbortSignal,
    options?: ApiRequestOptions
  ) => Promise<TransportResponse>
}

export class ResponseLimitError extends Error {
  constructor() {
    super('response exceeded the configured size limit')
    this.name = 'ResponseLimitError'
  }
}

async function readLimitedBody(response: Response, maxResponseBytes: number): Promise<string> {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let body = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteCount += value.byteLength
    if (byteCount > maxResponseBytes) {
      await reader.cancel()
      throw new ResponseLimitError()
    }

    body += decoder.decode(value, { stream: true })
  }

  return body + decoder.decode()
}

export function hasProtocolFailureBody(body: string): boolean {
  return (
    /["']status["']\s*:\s*["']failed["']/i.test(body) ||
    /<subsonic-response\b[^>]*\bstatus=["']failed["']/i.test(body)
  )
}

export class ElectronSessionTransport implements ApiTransport {
  constructor(
    private readonly diagnostics?: NetworkDiagnosticRecorder,
    private readonly getProxyMode: () => ProxyMode = () => 'system'
  ) {}

  async request(
    url: string,
    signal: AbortSignal,
    options: ApiRequestOptions = {}
  ): Promise<TransportResponse> {
    const startedAt = performance.now()
    try {
      const response = await session.defaultSession.fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        signal
      })
      const contentType = response.headers.get('content-type') ?? ''
      const body = await readLimitedBody(
        response,
        options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
      )
      const errorCategory =
        response.status === 401
          ? 'http-authentication'
          : response.status === 403
            ? 'http-forbidden'
            : response.status < 200 || response.status >= 300
              ? 'http-status'
              : hasProtocolFailureBody(body)
                ? 'server-response'
                : contentType.toLowerCase().includes('text/html')
                ? 'unexpected-content'
                : 'none'
      this.diagnostics?.record({
        stage: 'api',
        proxyMode: this.getProxyMode(),
        startedAt,
        status: response.status,
        ...(contentType ? { contentType } : {}),
        errorCategory
      })
      return {
        status: response.status,
        contentType,
        cloudflareMitigated: response.headers.get('cf-mitigated') === 'challenge',
        body
      }
    } catch (error) {
      this.diagnostics?.record({
        stage: 'api',
        proxyMode: this.getProxyMode(),
        startedAt,
        errorCategory:
          error instanceof ResponseLimitError ? 'unexpected-content' : classifyNetworkError(error)
      })
      throw error
    }
  }
}
