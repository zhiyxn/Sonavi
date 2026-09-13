import { randomUUID } from 'node:crypto'
import type {
  ConnectionSuccessResult,
  ConnectionTestInput,
  ConnectionTestResult
} from '../../shared/connection'
import type { CredentialStore, StoredCredentialInput } from './credentials/credential-store'
import { ConnectionFailure, OpenSubsonicClient } from './opensubsonic/client'
import { normalizeServerUrl, ServerUrlError } from './opensubsonic/request-url'

export interface ConnectedSession {
  sessionId: string
  credential: StoredCredentialInput
}

export class ConnectionService {
  private sessionCredential: StoredCredentialInput | null = null
  private sessionId: string | null = null

  constructor(
    private readonly client: OpenSubsonicClient,
    private readonly credentialStore: CredentialStore
  ) {}

  async test(input: ConnectionTestInput): Promise<ConnectionTestResult> {
    try {
      const baseUrl = normalizeServerUrl(input.serverUrl, input.allowInsecureHttp)
      const credential = {
        serverUrl: baseUrl,
        username: input.username.trim(),
        password: input.password
      }
      const probe = await this.connect(credential)

      let credentialPersistence: 'encrypted' | 'session-only' | 'not-requested' = 'not-requested'
      if (input.rememberMe) {
        credentialPersistence = (await this.credentialStore.save(credential))
          ? 'encrypted'
          : 'session-only'
      }

      return {
        ok: true,
        sessionId: this.sessionId!,
        server: probe.server,
        credentialPersistence
      }
    } catch (error) {
      if (error instanceof ServerUrlError) {
        return {
          ok: false,
          error: { code: error.reason, message: error.message, retryable: false }
        }
      }

      if (error instanceof ConnectionFailure) {
        return {
          ok: false,
          error: { code: error.code, message: error.message, retryable: error.retryable }
        }
      }

      return {
        ok: false,
        error: { code: 'network', message: '连接检查失败，请稍后重试。', retryable: true }
      }
    }
  }

  async restore(): Promise<ConnectionSuccessResult | null> {
    const credential = await this.credentialStore.load()
    if (!credential) return null

    try {
      const normalized = {
        serverUrl: normalizeServerUrl(credential.serverUrl, true),
        username: credential.username.trim(),
        password: credential.password
      }
      const probe = await this.connect(normalized)
      return {
        ok: true,
        sessionId: this.sessionId!,
        server: probe.server,
        credentialPersistence: 'encrypted'
      }
    } catch {
      return null
    }
  }

  disconnect(sessionId: string): boolean {
    if (this.sessionId !== sessionId) return false
    this.sessionId = null
    this.sessionCredential = null
    return true
  }

  async forget(sessionId: string): Promise<boolean> {
    if (this.sessionId !== sessionId || !(await this.credentialStore.delete())) return false
    return this.disconnect(sessionId)
  }

  getCurrentSessionId(): string | null {
    return this.sessionId
  }

  getSession(sessionId: string): ConnectedSession | null {
    if (this.sessionId !== sessionId || !this.sessionCredential) return null
    return { sessionId: this.sessionId, credential: { ...this.sessionCredential } }
  }

  private async connect(credential: StoredCredentialInput) {
    const probe = await this.client.testConnection(
      credential.serverUrl,
      credential.username,
      credential.password
    )
    this.sessionCredential = credential
    this.sessionId = randomUUID()
    return probe
  }
}
