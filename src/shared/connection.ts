export const TEST_CONNECTION_CHANNEL = 'sonavi:connection:test' as const
export const RESTORE_CONNECTION_CHANNEL = 'sonavi:connection:restore' as const
export const LIST_SAVED_CONNECTIONS_CHANNEL = 'sonavi:connection:list-saved' as const
export const CONNECT_SAVED_CONNECTION_CHANNEL = 'sonavi:connection:connect-saved' as const
export const DELETE_SAVED_CONNECTION_CHANNEL = 'sonavi:connection:delete-saved' as const
export const DISCONNECT_CONNECTION_CHANNEL = 'sonavi:connection:disconnect' as const
export const FORGET_CONNECTION_CHANNEL = 'sonavi:connection:forget' as const

export interface ConnectionTestInput {
  serverUrl: string
  username: string
  password: string
  rememberMe: boolean
  allowInsecureHttp: boolean
  profileId?: string | undefined
}

export interface SavedConnectionProfile {
  id: string
  serverUrl: string
  username: string
  isDefault: boolean
}

export type ConnectionErrorCode =
  | 'invalid-input'
  | 'insecure-http'
  | 'redirect'
  | 'network'
  | 'dns'
  | 'connection-refused'
  | 'timeout'
  | 'tls-certificate'
  | 'http-authentication'
  | 'http-forbidden'
  | 'server-error'
  | 'unexpected-content'
  | 'invalid-response'
  | 'response-too-large'
  | 'authentication'
  | 'authentication-method'
  | 'permission'
  | 'protocol-version'
  | 'server-response'

export interface ConnectionFailureResult {
  ok: false
  error: {
    code: ConnectionErrorCode
    message: string
    retryable: boolean
  }
}

export interface MusicFolderSummary {
  id: string
  name: string
}

export interface ConnectionSuccessResult {
  ok: true
  sessionId: string
  server: {
    baseUrl: string
    protocolVersion: string
    serverType?: string | undefined
    serverVersion?: string | undefined
    openSubsonic: boolean
    capabilityStatus: 'available' | 'unavailable'
    extensions: string[]
    musicFolders: MusicFolderSummary[]
  }
  credentialPersistence: 'encrypted' | 'session-only' | 'not-requested'
  profileId?: string | undefined
}

export type ConnectionTestResult = ConnectionSuccessResult | ConnectionFailureResult

export interface ConnectionApi {
  test: (input: ConnectionTestInput) => Promise<ConnectionTestResult>
  restore: () => Promise<ConnectionSuccessResult | null>
  listSaved: () => Promise<SavedConnectionProfile[]>
  connectSaved: (profileId: string) => Promise<ConnectionTestResult>
  deleteSaved: (profileId: string) => Promise<boolean>
  disconnect: (sessionId: string) => Promise<boolean>
  forget: (sessionId: string) => Promise<boolean>
}
