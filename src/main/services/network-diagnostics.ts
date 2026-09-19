import { randomUUID } from 'node:crypto'
import type {
  DiagnosticErrorCategory,
  DiagnosticStage,
  NetworkDiagnosticEntry,
  PlaybackBufferEvent,
  ProxyMode
} from '../../shared/network'

const MAX_ENTRIES = 200
const MAX_EXPORT_BYTES = 256 * 1024
const MAX_ERROR_DETAIL_LENGTH = 200
const MAX_OPERATION_LENGTH = 64
const MAX_ERROR_NAME_LENGTH = 64

export interface AbortClassification {
  timedOut?: boolean | undefined
  cancelledByCaller?: boolean | undefined
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name} ${error.message}` : ''
}

export function classifyNetworkError(
  error: unknown,
  abort: AbortClassification = {}
): DiagnosticErrorCategory {
  // 内部超时同样以 AbortError 抛出，必须先看显式中断原因，否则会被记成调用方取消。
  if (abort.timedOut) return 'timeout'
  if (abort.cancelledByCaller) return 'cancelled'

  const message = errorText(error).toLowerCase()
  if (message.includes('abort') || message.includes('cancel')) return 'cancelled'
  if (
    message.includes('certificate') ||
    message.includes('cert_') ||
    message.includes('ssl') ||
    message.includes('tls')
  ) {
    return 'certificate'
  }
  return 'network'
}

export function redactDiagnosticText(value: string): string {
  return value
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
    .replace(/([?&](?:u|p|t|s|token|apikey|salt)=)[^&\s]*/gi, '$1<redacted>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ERROR_DETAIL_LENGTH)
}

function sanitizeRequestContext(value: string): string | undefined {
  const match = /^listType=(newest|alphabeticalByName),page=(\d{1,7}),size=(\d{1,3})$/.exec(value)
  if (!match) return undefined
  const [, listType, rawPage, rawSize] = match
  const page = Number(rawPage)
  const size = Number(rawSize)
  if (!listType || !Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100) {
    return undefined
  }
  return `listType=${listType},page=${page},size=${size}`
}

export function describeError(
  error: unknown
): Pick<NetworkDiagnosticEntry, 'errorName' | 'errorDetail'> {
  if (!(error instanceof Error)) return {}

  const errorName = redactDiagnosticText(error.name).slice(0, MAX_ERROR_NAME_LENGTH) || 'Error'
  const errorDetail = redactDiagnosticText(error.message)
  return {
    errorName,
    ...(errorDetail ? { errorDetail } : {})
  }
}

export function recommendationFor(category: DiagnosticErrorCategory): string {
  switch (category) {
    case 'none':
      return '请求成功，无需操作。'
    case 'certificate':
      return '检查服务器证书、系统时间与证书链；Sonavi 不会忽略证书错误。'
    case 'http-authentication':
      return '服务器要求 HTTP 身份验证，请检查反向代理配置。'
    case 'http-forbidden':
      return '服务器拒绝访问，请检查账号权限与反向代理规则。'
    case 'http-status':
      return '检查服务器状态和反向代理日志后重试。'
    case 'server-response':
      return '服务器以 HTTP 200 返回了协议错误体，请检查服务端日志和该端点支持情况。'
    case 'unexpected-content':
      return '服务器返回了非预期内容，可能是登录页、代理错误页或协议错误体。'
    case 'broken-stream':
      return '音频流在传输中断开，请检查网络、代理和服务器转码日志。'
    case 'timeout':
      return '请求在超时时间内没有收到服务器响应，请检查网络、代理与服务器负载后重试。'
    case 'cancelled':
      return '请求已因切换连接、代理或播放项目而取消。'
    case 'network':
      return '检查网络与代理设置；代理失败时 Sonavi 不会静默改为直连。'
  }
}

export interface DiagnosticRecordInput {
  stage: DiagnosticStage
  proxyMode: ProxyMode
  startedAt: number
  operation?: string | undefined
  requestContext?: string | undefined
  attempt?: number | undefined
  event?: PlaybackBufferEvent | undefined
  status?: number | undefined
  contentType?: string | undefined
  responseHeadersMs?: number | undefined
  responseBytes?: number | undefined
  errorCategory: DiagnosticErrorCategory
  error?: unknown
  durationMs?: number | undefined
}

export class NetworkDiagnosticRecorder {
  private readonly entries: NetworkDiagnosticEntry[] = []

  record(input: DiagnosticRecordInput): void {
    const requestContext = input.requestContext
      ? sanitizeRequestContext(input.requestContext)
      : undefined
    const entry: NetworkDiagnosticEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      stage: input.stage,
      proxyMode: input.proxyMode,
      ...(input.operation ? { operation: input.operation.slice(0, MAX_OPERATION_LENGTH) } : {}),
      ...(requestContext ? { requestContext } : {}),
      ...(input.attempt ? { attempt: Math.min(20, Math.max(1, Math.floor(input.attempt))) } : {}),
      ...(input.event ? { event: input.event } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.contentType ? { contentType: input.contentType.slice(0, 200) } : {}),
      ...(input.responseHeadersMs !== undefined
        ? { responseHeadersMs: Math.min(3_600_000, Math.max(0, Math.round(input.responseHeadersMs))) }
        : {}),
      ...(input.responseBytes !== undefined
        ? { responseBytes: Math.min(32 * 1024 * 1024, Math.max(0, Math.round(input.responseBytes))) }
        : {}),
      errorCategory: input.errorCategory,
      ...describeError(input.error),
      durationMs:
        input.durationMs === undefined
          ? Math.max(0, Math.round(performance.now() - input.startedAt))
          : Math.min(3_600_000, Math.max(0, Math.round(input.durationMs))),
      recommendation:
        input.event === 'buffer-start'
          ? '播放器进入缓冲；等待对应的 buffer-end 记录持续时间。'
          : input.event === 'buffer-end'
            ? '播放器已退出缓冲；请结合持续时间与相邻音频流记录判断链路稳定性。'
            : recommendationFor(input.errorCategory)
    }
    this.entries.unshift(entry)
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
  }

  list(): NetworkDiagnosticEntry[] {
    return this.entries.map((entry) => ({ ...entry }))
  }

  exportText(): string {
    const payload = JSON.stringify(
      {
        schemaVersion: 4,
        generatedAt: new Date().toISOString(),
        redaction:
          'URL、账号、凭据、token、资源 ID 与响应正文未被记录；缓冲日志只包含事件、持续时间，端点名、白名单查询上下文与错误文本在写入前已脱敏。',
        entries: this.entries
      },
      null,
      2
    )
    return Buffer.byteLength(payload, 'utf8') <= MAX_EXPORT_BYTES
      ? payload
      : JSON.stringify(
          {
            schemaVersion: 4,
            generatedAt: new Date().toISOString(),
            redaction:
              'URL、账号、凭据、token、资源 ID 与响应正文未被记录；缓冲日志只包含事件、持续时间，端点名、白名单查询上下文与错误文本在写入前已脱敏。',
            entries: this.entries.slice(0, 100)
          },
          null,
          2
        )
  }
}
