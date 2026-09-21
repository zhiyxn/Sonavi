import { randomUUID } from 'node:crypto'
import type {
  ConnectionSuccessResult,
  ConnectionTestInput,
  ConnectionTestResult,
  SavedConnectionProfile
} from '../../shared/connection'
import type {
  CredentialStore,
  StoredCredentialInput,
  StoredCredentialProfile
} from './credentials/credential-store'
import { ConnectionFailure, OpenSubsonicClient } from './opensubsonic/client'
import { normalizeServerUrl, ServerUrlError } from './opensubsonic/request-url'

export interface ConnectedSession {
  sessionId: string
  credential: StoredCredentialInput
  profileId?: string | null
  server: ConnectionSuccessResult['server']
}

export class ConnectionService {
  private sessionCredential: StoredCredentialInput | null = null
  private sessionId: string | null = null
  private sessionServer: ConnectionSuccessResult['server'] | null = null
  private sessionProfileId: string | null = null

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
      const probe = await this.connect(credential, null)

      let credentialPersistence: 'encrypted' | 'session-only' | 'not-requested' = 'not-requested'
      let savedProfile: StoredCredentialProfile | null = null
      if (input.rememberMe) {
        savedProfile = input.profileId
          ? await this.credentialStore.save(credential, input.profileId)
          : await this.credentialStore.save(credential)
        credentialPersistence = savedProfile ? 'encrypted' : 'session-only'
        this.sessionProfileId = savedProfile?.id ?? null
      }

      return {
        ok: true,
        sessionId: this.sessionId!,
        server: probe.server,
        credentialPersistence,
        ...(savedProfile ? { profileId: savedProfile.id } : {})
      }
    } catch (error) {
      return this.toFailure(error)
    }
  }

  async restore(): Promise<ConnectionSuccessResult | null> {
    const profile = await this.credentialStore.load()
    if (!profile) return null

    try {
      const normalized = {
        serverUrl: normalizeServerUrl(profile.serverUrl, true),
        username: profile.username.trim(),
        password: profile.password
      }
      const probe = await this.connect(normalized, profile.id)
      return {
        ok: true,
        sessionId: this.sessionId!,
        server: probe.server,
        credentialPersistence: 'encrypted',
        profileId: profile.id
      }
    } catch {
      return null
    }
  }

  async listSavedProfiles(): Promise<SavedConnectionProfile[]> {
    return this.credentialStore.list()
  }

  async connectSaved(profileId: string): Promise<ConnectionTestResult> {
    const profile = await this.credentialStore.load(profileId)
    if (!profile) {
      return {
        ok: false,
        error: {
          code: 'invalid-input',
          message: '已保存的服务器不存在或凭据无法解密。',
          retryable: false
        }
      }
    }

    try {
      const credential = {
        serverUrl: normalizeServerUrl(profile.serverUrl, true),
        username: profile.username.trim(),
        password: profile.password
      }
      const probe = await this.connect(credential, profile.id)
      const selected = await this.credentialStore.setDefault(profile.id)
      return {
        ok: true,
        sessionId: this.sessionId!,
        server: probe.server,
        credentialPersistence: selected ? 'encrypted' : 'session-only',
        profileId: profile.id
      }
    } catch (error) {
      return this.toFailure(error)
    }
  }

  async deleteSavedProfile(profileId: string): Promise<boolean> {
    if (this.sessionProfileId === profileId) return false
    return this.credentialStore.delete(profileId)
  }

  disconnect(sessionId: string): boolean {
    if (this.sessionId !== sessionId) return false
    this.sessionId = null
    this.sessionCredential = null
    this.sessionServer = null
    this.sessionProfileId = null
    return true
  }

  async forget(sessionId: string): Promise<boolean> {
    if (this.sessionId !== sessionId) return false
    if (this.sessionProfileId && !(await this.credentialStore.delete(this.sessionProfileId))) {
      return false
    }
    return this.disconnect(sessionId)
  }

  getCurrentSessionId(): string | null {
    return this.sessionId
  }

  getSession(sessionId: string): ConnectedSession | null {
    if (this.sessionId !== sessionId || !this.sessionCredential || !this.sessionServer) return null
    return {
      sessionId: this.sessionId,
      credential: { ...this.sessionCredential },
      profileId: this.sessionProfileId,
      server: {
        ...this.sessionServer,
        extensions: [...this.sessionServer.extensions],
        musicFolders: this.sessionServer.musicFolders.map((folder) => ({ ...folder }))
      }
    }
  }

  private async connect(credential: StoredCredentialInput, profileId: string | null) {
    const probe = await this.client.testConnection(
      credential.serverUrl,
      credential.username,
      credential.password
    )
    this.sessionCredential = credential
    this.sessionServer = probe.server
    this.sessionId = randomUUID()
    this.sessionProfileId = profileId
    return probe
  }

  private toFailure(error: unknown): ConnectionTestResult {
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
