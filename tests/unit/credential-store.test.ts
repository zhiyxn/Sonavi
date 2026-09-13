import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  FileCredentialStore,
  type EncryptionProvider
} from '../../src/main/services/credentials/credential-store'

const temporaryDirectories: string[] = []

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sonavi-credential-test-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('FileCredentialStore', () => {
  it('只把系统加密后的密文写入 userData', async () => {
    const directory = await createTemporaryDirectory()
    const encryptionProvider: EncryptionProvider = {
      isAvailable: async () => true,
      encrypt: async (plainText) => Buffer.from(`encrypted:${plainText}`)
    }
    const store = new FileCredentialStore(directory, encryptionProvider)

    await expect(
      store.save({
        serverUrl: 'https://music.example.com',
        username: 'listener',
        password: 'never-write-plaintext'
      })
    ).resolves.toBe(true)

    const storedFile = await readFile(join(directory, 'credentials.v1.json'), 'utf8')
    expect(storedFile).not.toContain('never-write-plaintext')
    expect(JSON.parse(storedFile)).toMatchObject({
      version: 1,
      serverUrl: 'https://music.example.com',
      username: 'listener'
    })
  })

  it('系统加密不可用时不创建明文文件', async () => {
    const directory = await createTemporaryDirectory()
    const encryptionProvider: EncryptionProvider = {
      isAvailable: async () => false,
      encrypt: async () => {
        throw new Error('must not run')
      }
    }
    const store = new FileCredentialStore(directory, encryptionProvider)

    await expect(
      store.save({
        serverUrl: 'https://music.example.com',
        username: 'listener',
        password: 'secret'
      })
    ).resolves.toBe(false)

    await expect(readFile(join(directory, 'credentials.v1.json'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
