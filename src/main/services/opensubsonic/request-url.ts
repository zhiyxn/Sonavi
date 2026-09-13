import { createHash, randomBytes } from 'node:crypto'

export const SUBSONIC_PROTOCOL_VERSION = '1.16.1'
export const SUBSONIC_CLIENT_NAME = 'Sonavi'

export type ConnectionEndpoint =
  | 'ping'
  | 'getOpenSubsonicExtensions'
  | 'getMusicFolders'
  | 'getAlbumList2'
  | 'getAlbum'
  | 'getCoverArt'
  | 'stream'

export type EndpointParameters = Record<string, string | number>

export class ServerUrlError extends Error {
  constructor(
    readonly reason: 'invalid-input' | 'insecure-http',
    message: string
  ) {
    super(message)
    this.name = 'ServerUrlError'
  }
}

export function normalizeServerUrl(input: string, allowInsecureHttp: boolean): string {
  let url: URL

  try {
    url = new URL(input.trim())
  } catch {
    throw new ServerUrlError('invalid-input', '服务器地址不是有效 URL。')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ServerUrlError('invalid-input', '服务器地址只支持 HTTPS 或 HTTP。')
  }

  if (url.protocol === 'http:' && !allowInsecureHttp) {
    throw new ServerUrlError('insecure-http', 'HTTP 不会加密凭据，请明确允许后再连接。')
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new ServerUrlError('invalid-input', '服务器地址不能包含账号、查询参数或片段。')
  }

  const pathnameWithoutTrailingSlash = url.pathname.replace(/\/+$/, '')
  url.pathname = pathnameWithoutTrailingSlash.endsWith('/rest')
    ? pathnameWithoutTrailingSlash.slice(0, -'/rest'.length)
    : pathnameWithoutTrailingSlash

  return url.toString().replace(/\/$/, '')
}

export function createAuthenticationToken(password: string, salt: string): string {
  return createHash('md5').update(password, 'utf8').update(salt, 'utf8').digest('hex')
}

export function buildEndpointUrl(
  baseUrl: string,
  endpoint: ConnectionEndpoint,
  username: string,
  password: string,
  salt = randomBytes(16).toString('hex'),
  parameters: EndpointParameters = {}
): string {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/rest/${endpoint}.view`
  url.searchParams.set('u', username)
  url.searchParams.set('t', createAuthenticationToken(password, salt))
  url.searchParams.set('s', salt)
  url.searchParams.set('v', SUBSONIC_PROTOCOL_VERSION)
  url.searchParams.set('c', SUBSONIC_CLIENT_NAME)
  url.searchParams.set('f', 'json')
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, String(value))
  }
  return url.toString()
}
