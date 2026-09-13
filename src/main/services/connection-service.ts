import type {
  ConnectionTestInput,
  ConnectionTestResult
} from '../../shared/connection'
import type { CredentialStore, StoredCredentialInput } from './credentials/credential-store'
import { ConnectionFailure, OpenSubsonicClient } from './opensubsonic/client'
import { normalizeServerUrl, ServerUrlError } from './opensubsonic/request-url'

export class ConnectionService {
  private sessionCredential: StoredCredentialInput | null = null

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
      const probe = await this.client.testConnection(baseUrl, credential.username, credential.password)

      this.sessionCredential = credential

      let credentialPersistence: 'encrypted' | 'session-only' | 'not-requested' = 'not-requested'
      if (input.rememberMe) {
        credentialPersistence = (await this.credentialStore.save(credential))
          ? 'encrypted'
          : 'session-only'
      }

      return { ok: true, server: probe.server, credentialPersistence }
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
}
