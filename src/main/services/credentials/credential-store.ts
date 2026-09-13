import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { safeStorage } from 'electron'

export interface StoredCredentialInput {
  serverUrl: string
  username: string
  password: string
}

export interface CredentialStore {
  save: (credential: StoredCredentialInput) => Promise<boolean>
  load: () => Promise<StoredCredentialInput | null>
  delete: () => Promise<boolean>
}

export interface EncryptionProvider {
  isAvailable: () => Promise<boolean>
  encrypt: (plainText: string) => Promise<Buffer>
  decrypt: (encrypted: Buffer) => Promise<{ plainText: string; shouldReEncrypt: boolean }>
}

export class SafeStorageEncryptionProvider implements EncryptionProvider {
  isAvailable(): Promise<boolean> {
    return safeStorage.isAsyncEncryptionAvailable()
  }

  encrypt(plainText: string): Promise<Buffer> {
    return safeStorage.encryptStringAsync(plainText)
  }

  async decrypt(encrypted: Buffer): Promise<{ plainText: string; shouldReEncrypt: boolean }> {
    const decrypted = await safeStorage.decryptStringAsync(encrypted)
    return { plainText: decrypted.result, shouldReEncrypt: decrypted.shouldReEncrypt }
  }
}

interface CredentialFile {
  version: 1
  serverUrl: string
  username: string
  encryptedPassword: string
}

const CREDENTIAL_FILE_NAME = 'credentials.v1.json'

function parseCredentialFile(raw: string): CredentialFile | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    candidate.version !== 1 ||
    typeof candidate.serverUrl !== 'string' ||
    candidate.serverUrl.length === 0 ||
    candidate.serverUrl.length > 2048 ||
    typeof candidate.username !== 'string' ||
    candidate.username.length === 0 ||
    candidate.username.length > 256 ||
    typeof candidate.encryptedPassword !== 'string' ||
    candidate.encryptedPassword.length === 0 ||
    candidate.encryptedPassword.length > 65_536 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      candidate.encryptedPassword
    )
  ) {
    return null
  }

  return candidate as unknown as CredentialFile
}

export class FileCredentialStore implements CredentialStore {
  constructor(
    private readonly userDataPath: string,
    private readonly encryptionProvider: EncryptionProvider
  ) {}

  private get filePath(): string {
    return join(this.userDataPath, CREDENTIAL_FILE_NAME)
  }

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
      const temporaryPath = join(this.userDataPath, `${CREDENTIAL_FILE_NAME}.${randomUUID()}.tmp`)
      try {
        await writeFile(temporaryPath, payload, { mode: 0o600 })
        await rename(temporaryPath, this.filePath)
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined)
        throw error
      }
      return true
    } catch {
      return false
    }
  }

  async load(): Promise<StoredCredentialInput | null> {
    try {
      if (!(await this.encryptionProvider.isAvailable())) return null
      const stored = parseCredentialFile(await readFile(this.filePath, 'utf8'))
      if (!stored) return null

      const decrypted = await this.encryptionProvider.decrypt(
        Buffer.from(stored.encryptedPassword, 'base64')
      )
      const credential = {
        serverUrl: stored.serverUrl,
        username: stored.username,
        password: decrypted.plainText
      }
      if (decrypted.shouldReEncrypt && !(await this.save(credential))) return null
      return credential
    } catch {
      return null
    }
  }

  async delete(): Promise<boolean> {
    try {
      await unlink(this.filePath)
      return true
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT'
    }
  }
}
