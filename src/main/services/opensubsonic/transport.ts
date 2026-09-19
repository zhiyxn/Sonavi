import { session } from 'electron'
import type { ProxyMode } from '../../../shared/network'
import {
  type AbortClassification,
  classifyNetworkError,
  NetworkDiagnosticRecorder
} from '../network-diagnostics'

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024

export interface ApiRequestOptions {
  maxResponseBytes?: number
  operation?: string
  requestContext?: string
  attempt?: number
  describeAbort?: () => AbortClassification
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

async function readLimitedBody(
  response: Response,
  maxResponseBytes: number,
  onBytesRead?: (byteCount: number) => void
): Promise<string> {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let body = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteCount += value.byteLength
    onBytesRead?.(byteCount)
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
    let status: number | undefined
    let contentType: string | undefined
    let responseHeadersMs: number | undefined
    let responseBytes = 0
    try {
      const response = await session.defaultSession.fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        signal
      })
      status = response.status
      contentType = response.headers.get('content-type') ?? ''
      responseHeadersMs = Math.max(0, Math.round(performance.now() - startedAt))
      const body = await readLimitedBody(
        response,
        options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
        (byteCount) => { responseBytes = byteCount }
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
        ...(options.operation ? { operation: options.operation } : {}),
        ...(options.requestContext ? { requestContext: options.requestContext } : {}),
        ...(options.attempt ? { attempt: options.attempt } : {}),
        status,
        ...(contentType ? { contentType } : {}),
        responseHeadersMs,
        responseBytes,
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
        ...(options.operation ? { operation: options.operation } : {}),
        ...(options.requestContext ? { requestContext: options.requestContext } : {}),
        ...(options.attempt ? { attempt: options.attempt } : {}),
        ...(status ? { status } : {}),
        ...(contentType ? { contentType } : {}),
        ...(responseHeadersMs !== undefined ? { responseHeadersMs } : {}),
        responseBytes,
        error,
        errorCategory:
          error instanceof ResponseLimitError
            ? 'unexpected-content'
            : classifyNetworkError(error, options.describeAbort?.())
      })
      throw error
    }
  }
}
