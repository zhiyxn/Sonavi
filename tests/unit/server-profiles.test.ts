import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  FileCredentialStore,
  type EncryptionProvider
} from '../../src/main/services/credentials/credential-store'

const temporaryDirectories: string[] = []

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sonavi-server-profile-test-'))
  temporaryDirectories.push(directory)
  return directory
}

const encryptionProvider: EncryptionProvider = {
  isAvailable: async () => true,
  encrypt: async (plainText) => Buffer.from(`encrypted:${plainText}`),
  decrypt: async (encrypted) => ({
    plainText: encrypted.toString().replace(/^encrypted:/, ''),
    shouldReEncrypt: false
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('多服务器凭据存储', () => {
  it('保存多个账号且列表不包含密码或密文', async () => {
    const directory = await createTemporaryDirectory()
    const store = new FileCredentialStore(directory, encryptionProvider)

    const first = await store.save({
      serverUrl: 'https://one.example.com',
      username: 'listener-one',
      password: 'secret-one'
    })
    const second = await store.save({
      serverUrl: 'https://two.example.com',
      username: 'listener-two',
      password: 'secret-two'
    })

    expect(first).toMatchObject({ serverUrl: 'https://one.example.com', username: 'listener-one' })
    expect(second).toMatchObject({ serverUrl: 'https://two.example.com', username: 'listener-two' })
    const profiles = await store.list()
    expect(profiles).toHaveLength(2)
    expect(profiles.filter((profile) => profile.isDefault)).toEqual([second])
    expect(JSON.stringify(profiles)).not.toContain('secret')
    expect(JSON.stringify(profiles)).not.toContain('encryptedPassword')

    const restored = await store.load(first && typeof first === 'object' ? first.id : undefined)
    expect(restored).toMatchObject({
      id: first && typeof first === 'object' ? first.id : undefined,
      serverUrl: 'https://one.example.com',
      username: 'listener-one',
      password: 'secret-one'
    })
  })

  it('把 v1 单账号原子迁移为 v2 默认账号且不暴露明文', async () => {
    const directory = await createTemporaryDirectory()
    await writeFile(
      join(directory, 'credentials.v1.json'),
      JSON.stringify({
        version: 1,
        serverUrl: 'https://legacy.example.com',
        username: 'legacy-listener',
        encryptedPassword: Buffer.from('encrypted:legacy-secret').toString('base64')
      })
    )
    const store = new FileCredentialStore(directory, encryptionProvider)

    const profiles = await store.list()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({
      serverUrl: 'https://legacy.example.com',
      username: 'legacy-listener',
      isDefault: true
    })
    await expect(store.load()).resolves.toMatchObject({ password: 'legacy-secret' })

    const migrated = await readFile(join(directory, 'credentials.v2.json'), 'utf8')
    expect(migrated).not.toContain('legacy-secret')
    expect(JSON.parse(migrated)).toMatchObject({ version: 2 })
    await expect(readFile(join(directory, 'credentials.v1.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
