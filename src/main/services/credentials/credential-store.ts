import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { safeStorage } from 'electron'

export interface StoredCredentialInput {
  serverUrl: string
  username: string
  password: string
}

export interface StoredCredentialProfile {
  id: string
  serverUrl: string
  username: string
  isDefault: boolean
}

export interface LoadedCredentialProfile extends StoredCredentialProfile {
  password: string
}

export interface CredentialStore {
  save: (
    credential: StoredCredentialInput,
    profileId?: string
  ) => Promise<StoredCredentialProfile | null>
  list: () => Promise<StoredCredentialProfile[]>
  load: (profileId?: string) => Promise<LoadedCredentialProfile | null>
  setDefault: (profileId: string) => Promise<boolean>
  delete: (profileId: string) => Promise<boolean>
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

interface CredentialFileV1 {
  version: 1
  serverUrl: string
  username: string
  encryptedPassword: string
}

interface CredentialProfileFile {
  id: string
  serverUrl: string
  username: string
  encryptedPassword: string
}

interface CredentialFileV2 {
  version: 2
  defaultProfileId: string | null
  profiles: CredentialProfileFile[]
}

const LEGACY_CREDENTIAL_FILE_NAME = 'credentials.v1.json'
const CREDENTIAL_FILE_NAME = 'credentials.v2.json'
const MAX_PROFILE_COUNT = 20
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function isValidCredentialFields(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate.serverUrl === 'string' &&
    candidate.serverUrl.length > 0 &&
    candidate.serverUrl.length <= 2048 &&
    typeof candidate.username === 'string' &&
    candidate.username.length > 0 &&
    candidate.username.length <= 256 &&
    typeof candidate.encryptedPassword === 'string' &&
    candidate.encryptedPassword.length > 0 &&
    candidate.encryptedPassword.length <= 65_536 &&
    BASE64_PATTERN.test(candidate.encryptedPassword)
  )
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseCredentialFileV1(raw: string): CredentialFileV1 | null {
  const value = parseJson(raw)
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (candidate.version !== 1 || !isValidCredentialFields(candidate)) return null
  return candidate as unknown as CredentialFileV1
}

function parseCredentialProfile(value: unknown): CredentialProfileFile | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    !UUID_PATTERN.test(candidate.id) ||
    !isValidCredentialFields(candidate)
  ) {
    return null
  }
  return candidate as unknown as CredentialProfileFile
}

function parseCredentialFileV2(raw: string): CredentialFileV2 | null {
  const value = parseJson(raw)
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    candidate.version !== 2 ||
    !Array.isArray(candidate.profiles) ||
    candidate.profiles.length > MAX_PROFILE_COUNT ||
    !(
      candidate.defaultProfileId === null ||
      (typeof candidate.defaultProfileId === 'string' && UUID_PATTERN.test(candidate.defaultProfileId))
    )
  ) {
    return null
  }

  const profiles: CredentialProfileFile[] = []
  const ids = new Set<string>()
  for (const rawProfile of candidate.profiles) {
    const profile = parseCredentialProfile(rawProfile)
    if (!profile || ids.has(profile.id)) return null
    ids.add(profile.id)
    profiles.push(profile)
  }
  if (candidate.defaultProfileId !== null && !ids.has(candidate.defaultProfileId)) return null
  return { version: 2, defaultProfileId: candidate.defaultProfileId, profiles }
}

function toSummary(
  profile: CredentialProfileFile,
  defaultProfileId: string | null
): StoredCredentialProfile {
  return {
    id: profile.id,
    serverUrl: profile.serverUrl,
    username: profile.username,
    isDefault: profile.id === defaultProfileId
  }
}

export class FileCredentialStore implements CredentialStore {
  constructor(
    private readonly userDataPath: string,
    private readonly encryptionProvider: EncryptionProvider
  ) {}

  private get filePath(): string {
    return join(this.userDataPath, CREDENTIAL_FILE_NAME)
  }

  private get legacyFilePath(): string {
    return join(this.userDataPath, LEGACY_CREDENTIAL_FILE_NAME)
  }

  async save(
    credential: StoredCredentialInput,
    profileId?: string
  ): Promise<StoredCredentialProfile | null> {
    try {
      if (!(await this.encryptionProvider.isAvailable())) return null
      const encryptedPassword = await this.encryptionProvider.encrypt(credential.password)
      const state =
        (await this.readState()) ??
        ({ version: 2, defaultProfileId: null, profiles: [] } satisfies CredentialFileV2)
      let index = profileId
        ? state.profiles.findIndex((profile) => profile.id === profileId)
        : state.profiles.findIndex(
            (profile) =>
              profile.serverUrl === credential.serverUrl && profile.username === credential.username
          )
      if (profileId && index < 0) return null
      if (index < 0 && state.profiles.length >= MAX_PROFILE_COUNT) return null

      const id = index >= 0 ? state.profiles[index]!.id : randomUUID()
      const profile: CredentialProfileFile = {
        id,
        serverUrl: credential.serverUrl,
        username: credential.username,
        encryptedPassword: encryptedPassword.toString('base64')
      }
      if (index >= 0) state.profiles[index] = profile
      else {
        state.profiles.push(profile)
        index = state.profiles.length - 1
      }
      state.defaultProfileId = id
      await this.writeState(state)
      await this.removeLegacyFile()
      return toSummary(state.profiles[index]!, state.defaultProfileId)
    } catch {
      return null
    }
  }

  async list(): Promise<StoredCredentialProfile[]> {
    try {
      const state = await this.readState()
      return state
        ? state.profiles.map((profile) => toSummary(profile, state.defaultProfileId))
        : []
    } catch {
      return []
    }
  }

  async load(profileId?: string): Promise<LoadedCredentialProfile | null> {
    try {
      if (!(await this.encryptionProvider.isAvailable())) return null
      const state = await this.readState()
      if (!state) return null
      const targetId = profileId ?? state.defaultProfileId
      if (!targetId) return null
      const profile = state.profiles.find((candidate) => candidate.id === targetId)
      if (!profile) return null

      const decrypted = await this.encryptionProvider.decrypt(
        Buffer.from(profile.encryptedPassword, 'base64')
      )
      if (decrypted.shouldReEncrypt) {
        profile.encryptedPassword = (await this.encryptionProvider.encrypt(decrypted.plainText)).toString(
          'base64'
        )
        await this.writeState(state)
        await this.removeLegacyFile()
      }
      return {
        ...toSummary(profile, state.defaultProfileId),
        password: decrypted.plainText
      }
    } catch {
      return null
    }
  }

  async setDefault(profileId: string): Promise<boolean> {
    try {
      const state = await this.readState()
      if (!state || !state.profiles.some((profile) => profile.id === profileId)) return false
      if (state.defaultProfileId === profileId) return true
      state.defaultProfileId = profileId
      await this.writeState(state)
      await this.removeLegacyFile()
      return true
    } catch {
      return false
    }
  }

  async delete(profileId: string): Promise<boolean> {
    try {
      const state = await this.readState()
      if (!state) return true
      const nextProfiles = state.profiles.filter((profile) => profile.id !== profileId)
      if (nextProfiles.length === state.profiles.length) return true
      state.profiles = nextProfiles
      if (state.defaultProfileId === profileId) {
        state.defaultProfileId = nextProfiles[0]?.id ?? null
      }
      await this.writeState(state)
      await this.removeLegacyFile()
      return true
    } catch {
      return false
    }
  }

  private async readState(): Promise<CredentialFileV2 | null> {
    try {
      return parseCredentialFileV2(await readFile(this.filePath, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return null
    }

    try {
      const legacy = parseCredentialFileV1(await readFile(this.legacyFilePath, 'utf8'))
      if (!legacy) return null
      const id = randomUUID()
      const migrated: CredentialFileV2 = {
        version: 2,
        defaultProfileId: id,
        profiles: [
          {
            id,
            serverUrl: legacy.serverUrl,
            username: legacy.username,
            encryptedPassword: legacy.encryptedPassword
          }
        ]
      }
      await this.writeState(migrated)
      await this.removeLegacyFile()
      return migrated
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private async writeState(state: CredentialFileV2): Promise<void> {
    await mkdir(this.userDataPath, { recursive: true, mode: 0o700 })
    const temporaryPath = join(this.userDataPath, `${CREDENTIAL_FILE_NAME}.${randomUUID()}.tmp`)
    try {
      await writeFile(temporaryPath, JSON.stringify(state), { mode: 0o600 })
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined)
      throw error
    }
  }

  private async removeLegacyFile(): Promise<void> {
    await unlink(this.legacyFilePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}
