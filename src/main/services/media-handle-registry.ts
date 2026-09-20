import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type MediaKind = 'cover' | 'audio'

export interface CoverMediaHandle {
  sessionId: string
  kind: 'cover'
  resourceId: string
}

export interface AudioMediaHandle {
  sessionId: string
  kind: 'audio'
  resourceId: string
  streamMode?: 'original' | 'transcode' | undefined
  maxBitRate?: number | undefined
  timeOffset?: number | undefined
}

export type MediaHandle = CoverMediaHandle | AudioMediaHandle

type EncryptedMediaHandle = MediaHandle & { epoch: number }

const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const MAX_TOKEN_CHARACTERS = 4_096
const MAX_REUSED_COVER_HANDLES_PER_SESSION = 10_000

function isMediaHandle(value: unknown): value is EncryptedMediaHandle {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.sessionId !== 'string' ||
    candidate.sessionId.length > 64 ||
    typeof candidate.resourceId !== 'string' ||
    candidate.resourceId.length === 0 ||
    candidate.resourceId.length > 1_024 ||
    typeof candidate.epoch !== 'number' ||
    candidate.epoch < 0 ||
    !Number.isInteger(candidate.epoch) ||
    (candidate.kind !== 'cover' && candidate.kind !== 'audio')
  ) return false
  if (candidate.kind === 'cover') return true
  return (
    (candidate.streamMode === undefined || candidate.streamMode === 'original' || candidate.streamMode === 'transcode') &&
    (candidate.maxBitRate === undefined ||
      (typeof candidate.maxBitRate === 'number' &&
        [128, 192, 256, 320].includes(candidate.maxBitRate))) &&
    (candidate.timeOffset === undefined ||
      (typeof candidate.timeOffset === 'number' &&
        Number.isFinite(candidate.timeOffset) &&
        candidate.timeOffset >= 0 &&
        candidate.timeOffset <= 86_400))
  )
}

export class MediaHandleRegistry {
  private encryptionKey = randomBytes(32)
  private readonly sessionEpochs = new Map<string, number>()
  private readonly issuedCounts = new Map<string, number>()
  private readonly coverUrls = new Map<string, Map<string, string>>()

  create(handle: MediaHandle): string {
    if (handle.kind === 'cover') {
      const existing = this.coverUrls.get(handle.sessionId)?.get(handle.resourceId)
      if (existing) return existing
    }
    const epoch = this.sessionEpochs.get(handle.sessionId) ?? 0
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv)
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ ...handle, epoch }), 'utf8'),
      cipher.final()
    ])
    const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
    this.issuedCounts.set(handle.sessionId, (this.issuedCounts.get(handle.sessionId) ?? 0) + 1)
    const url = `sonavi-media://media/${token}`
    if (handle.kind === 'cover') {
      const sessionCovers = this.coverUrls.get(handle.sessionId) ?? new Map<string, string>()
      sessionCovers.set(handle.resourceId, url)
      if (sessionCovers.size > MAX_REUSED_COVER_HANDLES_PER_SESSION) {
        const oldestResourceId = sessionCovers.keys().next().value
        if (oldestResourceId !== undefined) sessionCovers.delete(oldestResourceId)
      }
      this.coverUrls.set(handle.sessionId, sessionCovers)
    }
    return url
  }

  resolve(rawUrl: string): MediaHandle | null {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return null
    }

    if (url.protocol !== 'sonavi-media:' || url.hostname !== 'media' || url.search || url.hash) {
      return null
    }

    const token = url.pathname.match(/^\/([a-z0-9_-]+)$/i)?.[1]
    if (!token || token.length > MAX_TOKEN_CHARACTERS) return null
    try {
      const bytes = Buffer.from(token, 'base64url')
      if (bytes.byteLength <= IV_BYTES + AUTH_TAG_BYTES) return null
      const iv = bytes.subarray(0, IV_BYTES)
      const authTag = bytes.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
      const encrypted = bytes.subarray(IV_BYTES + AUTH_TAG_BYTES)
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv)
      decipher.setAuthTag(authTag)
      const parsed: unknown = JSON.parse(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
      )
      if (!isMediaHandle(parsed)) return null
      if (parsed.epoch !== (this.sessionEpochs.get(parsed.sessionId) ?? 0)) return null
      if (parsed.kind === 'cover') {
        return {
          sessionId: parsed.sessionId,
          kind: 'cover',
          resourceId: parsed.resourceId
        }
      }
      return {
        sessionId: parsed.sessionId,
        kind: 'audio',
        resourceId: parsed.resourceId,
        ...(parsed.streamMode ? { streamMode: parsed.streamMode } : {}),
        ...(parsed.maxBitRate !== undefined ? { maxBitRate: parsed.maxBitRate } : {}),
        ...(parsed.timeOffset !== undefined ? { timeOffset: parsed.timeOffset } : {})
      }
    } catch {
      return null
    }
  }

  revokeSession(sessionId: string): number {
    const revoked = this.issuedCounts.get(sessionId) ?? 0
    this.issuedCounts.delete(sessionId)
    this.coverUrls.delete(sessionId)
    this.sessionEpochs.set(sessionId, (this.sessionEpochs.get(sessionId) ?? 0) + 1)
    return revoked
  }

  clear(): void {
    this.encryptionKey = randomBytes(32)
    this.sessionEpochs.clear()
    this.issuedCounts.clear()
    this.coverUrls.clear()
  }
}
