import { z } from 'zod'
import type {
  ConnectionErrorCode,
  ConnectionSuccessResult,
  MusicFolderSummary
} from '../../../shared/connection'
import { buildEndpointUrl, type ConnectionEndpoint } from './request-url'
import {
  ResponseLimitError,
  type ApiTransport,
  type TransportResponse
} from './transport'

const RESPONSE_TIMEOUT_MS = 12_000

const SubsonicErrorSchema = z.object({
  code: z.number().int(),
  message: z.string().optional()
})

const MusicFolderSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string()
})

const SubsonicResponseSchema = z.object({
  'subsonic-response': z.object({
    status: z.enum(['ok', 'failed']),
    version: z.string().min(1),
    type: z.string().min(1).optional(),
    serverVersion: z.string().min(1).optional(),
    openSubsonic: z.boolean().optional(),
    error: SubsonicErrorSchema.optional(),
    openSubsonicExtensions: z
      .array(
        z.object({
          name: z.string().min(1),
          versions: z.array(z.number().int())
        })
      )
      .optional(),
    musicFolders: z
      .object({
        musicFolder: z.array(MusicFolderSchema).default([])
      })
      .optional()
  })
})

type ParsedResponse = z.infer<typeof SubsonicResponseSchema>['subsonic-response']

export class ConnectionFailure extends Error {
  constructor(
    readonly code: ConnectionErrorCode,
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ConnectionFailure'
  }
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = 'cause' in error ? errorText(error.cause) : ''
  return `${error.name} ${error.message} ${cause}`.toLowerCase()
}

function classifyNetworkError(error: unknown, didTimeout: boolean): ConnectionFailure {
  if (didTimeout || errorText(error).includes('abort')) {
    return new ConnectionFailure('timeout', '服务器响应超时，请检查地址与网络。', true)
  }

  const text = errorText(error)
  if (text.includes('name_not_resolved') || text.includes('enotfound') || text.includes('dns')) {
    return new ConnectionFailure('dns', '无法解析服务器域名。', true)
  }

  if (text.includes('connection_refused') || text.includes('econnrefused')) {
    return new ConnectionFailure('connection-refused', '服务器拒绝连接，请检查地址和端口。', true)
  }

  if (
    text.includes('certificate') ||
    text.includes('cert_') ||
    text.includes('ssl') ||
    text.includes('tls')
  ) {
    return new ConnectionFailure('tls-certificate', 'TLS 证书验证失败，Sonavi 不会绕过证书检查。', false)
  }

  return new ConnectionFailure('network', '无法连接服务器，请检查网络与服务器地址。', true)
}

function assertHttpStatus(response: TransportResponse): void {
  if (response.status >= 300 && response.status < 400) {
    throw new ConnectionFailure('redirect', '服务器要求重定向；请直接填写最终服务器地址。', false)
  }

  if (response.status === 401) {
    throw new ConnectionFailure('http-authentication', '上游 HTTP 认证拒绝了请求。', false)
  }

  if (response.status === 403) {
    const message = response.cloudflareMitigated
      ? '服务器前置防护要求浏览器挑战，桌面客户端无法完成该挑战。'
      : '服务器或反向代理拒绝了请求。'
    throw new ConnectionFailure('http-forbidden', message, false)
  }

  if (response.status >= 500) {
    throw new ConnectionFailure('server-error', '服务器暂时出错，请稍后重试。', true)
  }

  if (response.status < 200 || response.status >= 300) {
    throw new ConnectionFailure('server-response', `服务器返回了 HTTP ${response.status}。`, false)
  }
}

function parseResponse(response: TransportResponse): ParsedResponse {
  assertHttpStatus(response)

  const trimmedBody = response.body.trimStart()
  if (response.contentType.toLowerCase().includes('text/html') || trimmedBody.startsWith('<')) {
    throw new ConnectionFailure('unexpected-content', '服务器返回了网页而不是 Subsonic JSON。', false)
  }

  let rawResponse: unknown
  try {
    rawResponse = JSON.parse(response.body)
  } catch {
    throw new ConnectionFailure('invalid-response', '服务器返回的内容不是有效 JSON。', false)
  }

  const parsed = SubsonicResponseSchema.safeParse(rawResponse)
  if (!parsed.success) {
    throw new ConnectionFailure('invalid-response', '服务器响应不符合 Subsonic 协议。', false)
  }

  const subsonicResponse = parsed.data['subsonic-response']
  if (subsonicResponse.status === 'failed') {
    throw mapProtocolError(subsonicResponse.error)
  }

  return subsonicResponse
}

function mapProtocolError(error: z.infer<typeof SubsonicErrorSchema> | undefined): ConnectionFailure {
  const code = error?.code

  if (code === 40 || code === 44) {
    return new ConnectionFailure('authentication', '用户名、密码或 API 凭据不正确。', false)
  }

  if (code === 41 || code === 42 || code === 43) {
    return new ConnectionFailure('authentication-method', '服务器不支持 Sonavi 使用的安全认证方式。', false)
  }

  if (code === 50) {
    return new ConnectionFailure('permission', '当前账号无权执行此操作。', false)
  }

  if (code === 20 || code === 30) {
    return new ConnectionFailure('protocol-version', '客户端与服务器的 Subsonic 协议版本不兼容。', false)
  }

  return new ConnectionFailure('server-response', '服务器报告 Subsonic 请求失败。', false)
}

function canDegradeCapabilityProbe(error: ConnectionFailure): boolean {
  return [
    'http-authentication',
    'http-forbidden',
    'server-response',
    'unexpected-content',
    'invalid-response'
  ].includes(error.code)
}

export interface ConnectionProbeResult {
  server: ConnectionSuccessResult['server']
}

export class OpenSubsonicClient {
  constructor(private readonly transport: ApiTransport) {}

  async testConnection(baseUrl: string, username: string, password: string): Promise<ConnectionProbeResult> {
    const ping = await this.request('ping', baseUrl, username, password)
    let capabilityStatus: 'available' | 'unavailable' = 'available'
    let extensions: string[] = []

    try {
      const capabilityResponse = await this.request(
        'getOpenSubsonicExtensions',
        baseUrl,
        username,
        password
      )
      extensions = (capabilityResponse.openSubsonicExtensions ?? []).map(({ name }) => name)
    } catch (error) {
      if (!(error instanceof ConnectionFailure) || !canDegradeCapabilityProbe(error)) throw error
      capabilityStatus = 'unavailable'
    }

    const foldersResponse = await this.request('getMusicFolders', baseUrl, username, password)
    const musicFolders: MusicFolderSummary[] =
      foldersResponse.musicFolders?.musicFolder.map(({ id, name }) => ({ id, name })) ?? []

    return {
      server: {
        baseUrl,
        protocolVersion: ping.version,
        ...(ping.type ? { serverType: ping.type } : {}),
        ...(ping.serverVersion ? { serverVersion: ping.serverVersion } : {}),
        openSubsonic: ping.openSubsonic === true,
        capabilityStatus,
        extensions,
        musicFolders
      }
    }
  }

  private async request(
    endpoint: ConnectionEndpoint,
    baseUrl: string,
    username: string,
    password: string
  ): Promise<ParsedResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS)

    try {
      const url = buildEndpointUrl(baseUrl, endpoint, username, password)
      const response = await this.transport.request(url, controller.signal)
      return parseResponse(response)
    } catch (error) {
      if (error instanceof ConnectionFailure) throw error
      if (error instanceof ResponseLimitError) {
        throw new ConnectionFailure('response-too-large', '服务器响应超过安全大小限制。', false)
      }
      throw classifyNetworkError(error, controller.signal.aborted)
    } finally {
      clearTimeout(timeout)
    }
  }
}
