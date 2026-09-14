import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  utimes,
  writeFile
} from 'node:fs/promises'
import { join } from 'node:path'
import type { CoverCacheInfo } from '../../shared/desktop'
import type { ConnectedSession } from './connection-service'
import { accountHash } from './desktop-state-service'

const DEFAULT_MAX_BYTES = 128 * 1024 * 1024
const DEFAULT_MAX_ITEM_BYTES = 5 * 1024 * 1024

export interface CachedCover {
  bytes: Uint8Array
  contentType: string
}

export class CoverCacheService {
  private mutationChain: Promise<void> = Promise.resolve()

  constructor(
    private readonly userDataPath: string,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
    private readonly maxItemBytes = DEFAULT_MAX_ITEM_BYTES
  ) {}

  canStore(contentLength: number): boolean {
    return Number.isInteger(contentLength) && contentLength > 0 && contentLength <= this.maxItemBytes
  }

  getMaxItemBytes(): number {
    return this.maxItemBytes
  }

  async get(session: ConnectedSession, resourceId: string): Promise<CachedCover | null> {
    const paths = this.paths(session, resourceId)
    try {
      const details = await stat(paths.data)
      if (details.size <= 0 || details.size > this.maxItemBytes) return null
      const [bytes, contentType] = await Promise.all([
        readFile(paths.data),
        readFile(paths.meta, 'utf8')
      ])
      if (!contentType.startsWith('image/')) return null
      const now = new Date()
      await Promise.all([
        utimes(paths.data, now, now),
        utimes(paths.meta, now, now)
      ]).catch(() => undefined)
      return { bytes, contentType }
    } catch {
      return null
    }
  }

  async put(
    session: ConnectedSession,
    resourceId: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<boolean> {
    if (bytes.byteLength === 0 || bytes.byteLength > this.maxItemBytes || !contentType.startsWith('image/')) {
      return false
    }
    return this.enqueueMutation(async () => {
      const paths = this.paths(session, resourceId)
      await mkdir(paths.directory, { recursive: true })
      const temporaryData = `${paths.data}.${randomUUID()}.tmp`
      const temporaryMeta = `${paths.meta}.${randomUUID()}.tmp`
      try {
        await Promise.all([
          writeFile(temporaryData, bytes, { mode: 0o600 }),
          writeFile(temporaryMeta, contentType, { encoding: 'utf8', mode: 0o600 })
        ])
        await rename(temporaryData, paths.data)
        await rename(temporaryMeta, paths.meta)
        await this.evict(session)
        return true
      } finally {
        await Promise.all([
          unlink(temporaryData).catch(() => undefined),
          unlink(temporaryMeta).catch(() => undefined)
        ])
      }
    })
  }

  async getInfo(session: ConnectedSession): Promise<CoverCacheInfo> {
    const entries = await this.listEntries(this.accountDirectory(session))
    return {
      itemCount: entries.length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
      maxBytes: this.maxBytes
    }
  }

  async clear(session: ConnectedSession): Promise<CoverCacheInfo> {
    return this.enqueueMutation(async () => {
      await rm(this.accountDirectory(session), { recursive: true, force: true })
      return { itemCount: 0, totalBytes: 0, maxBytes: this.maxBytes }
    })
  }

  private async evict(session: ConnectedSession): Promise<void> {
    const entries = await this.listEntries(this.accountDirectory(session))
    let totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0)
    for (const entry of entries.sort((left, right) => left.accessedAt - right.accessedAt)) {
      if (totalBytes <= this.maxBytes) break
      await Promise.all([
        unlink(entry.dataPath).catch(() => undefined),
        unlink(entry.metaPath).catch(() => undefined)
      ])
      totalBytes -= entry.size
    }
  }

  private async listEntries(directory: string): Promise<
    Array<{ dataPath: string; metaPath: string; size: number; accessedAt: number }>
  > {
    let names: string[]
    try {
      names = await readdir(directory)
    } catch {
      return []
    }
    const dataNames = names.filter((name) => /^[a-f0-9]{64}\.cover$/.test(name))
    const entries = await Promise.all(
      dataNames.map(async (name) => {
        const dataPath = join(directory, name)
        const metaPath = join(directory, name.replace(/\.cover$/, '.type'))
        try {
          const details = await stat(dataPath)
          return { dataPath, metaPath, size: details.size, accessedAt: details.mtimeMs }
        } catch {
          return null
        }
      })
    )
    return entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }

  private paths(session: ConnectedSession, resourceId: string): {
    directory: string
    data: string
    meta: string
  } {
    const directory = this.accountDirectory(session)
    const key = createHash('sha256').update(resourceId).digest('hex')
    return {
      directory,
      data: join(directory, `${key}.cover`),
      meta: join(directory, `${key}.type`)
    }
  }

  private accountDirectory(session: ConnectedSession): string {
    return join(this.userDataPath, 'cover-cache', accountHash(session))
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationChain.catch(() => undefined).then(operation)
    this.mutationChain = result.then(() => undefined, () => undefined)
    return result
  }
}
