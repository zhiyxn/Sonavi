import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { safeStorage } from 'electron'

export interface StoredCredentialInput {
  serverUrl: string
  username: string
  password: string
}

export interface CredentialStore {
  save: (credential: StoredCredentialInput) => Promise<boolean>
}

export interface EncryptionProvider {
  isAvailable: () => Promise<boolean>
  encrypt: (plainText: string) => Promise<Buffer>
}

export class SafeStorageEncryptionProvider implements EncryptionProvider {
  isAvailable(): Promise<boolean> {
    return safeStorage.isAsyncEncryptionAvailable()
  }

  encrypt(plainText: string): Promise<Buffer> {
    return safeStorage.encryptStringAsync(plainText)
  }
}

export class FileCredentialStore implements CredentialStore {
  constructor(
    private readonly userDataPath: string,
    private readonly encryptionProvider: EncryptionProvider
  ) {}

  async save(credential: StoredCredentialInput): Promise<boolean> {
    try {
      if (!(await this.encryptionProvider.isAvailable())) return false

      const encryptedPassword = await this.encryptionProvider.encrypt(credential.password)
      const payload = JSON.stringify({
        version: 1,
        serverUrl: credential.serverUrl,
        username: credential.username,
        encryptedPassword: encryptedPassword.toString('base64')
      })

      await mkdir(this.userDataPath, { recursive: true, mode: 0o700 })
      await writeFile(join(this.userDataPath, 'credentials.v1.json'), payload, { mode: 0o600 })
      return true
    } catch {
      return false
    }
  }
}
