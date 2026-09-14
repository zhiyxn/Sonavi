import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type {
  DesktopPreferences,
  PausedQueueTrack,
  SavePausedQueueRequest
} from '../../shared/desktop'
import {
  DesktopPreferencesSchema,
  PausedQueueTrackSchema
} from '../../shared/desktop-schema'
import type { ConnectedSession } from './connection-service'

export interface PersistedWindowState {
  x?: number | undefined
  y?: number | undefined
  width: number
  height: number
  maximized: boolean
}

export interface PersistedPausedQueue {
  tracks: PausedQueueTrack[]
  currentIndex: number
  playbackOrder: 'sequential' | 'shuffle'
  repeatMode: 'off' | 'all' | 'one'
}

const WindowStateSchema = z.object({
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().min(960).max(16_384),
  height: z.number().int().min(640).max(16_384),
  maximized: z.boolean()
}) satisfies z.ZodType<PersistedWindowState>

const StoredPausedQueueSchema = z.object({
  accountHash: z.string().regex(/^[a-f0-9]{64}$/),
  tracks: z.array(PausedQueueTrackSchema).max(1_000),
  currentIndex: z.number().int().min(0).max(999),
  playbackOrder: z.enum(['sequential', 'shuffle']),
  repeatMode: z.enum(['off', 'all', 'one'])
})

const DesktopStateSchema = z.object({
  version: z.literal(1),
  preferences: DesktopPreferencesSchema,
  window: WindowStateSchema.optional(),
  pausedQueue: StoredPausedQueueSchema.optional()
})

type DesktopState = z.infer<typeof DesktopStateSchema>

const DEFAULT_PREFERENCES: DesktopPreferences = {
  closeAction: 'hide',
  theme: 'system',
  volume: 1
}

export class DesktopStateService {
  private state: DesktopState = {
    version: 1,
    preferences: { ...DEFAULT_PREFERENCES }
  }
  private writeChain: Promise<void> = Promise.resolve()
  private readonly filePath: string

  constructor(private readonly userDataPath: string) {
    this.filePath = join(userDataPath, 'desktop-state.v1.json')
  }

  async initialize(): Promise<void> {
    try {
      const parsed = DesktopStateSchema.safeParse(JSON.parse(await readFile(this.filePath, 'utf8')))
      if (parsed.success) this.state = parsed.data
    } catch {
      // Missing, unreadable, or invalid local state is treated as a clean first run.
    }
  }

  getPreferences(): DesktopPreferences {
    return { ...this.state.preferences }
  }

  async updatePreferences(preferences: DesktopPreferences): Promise<DesktopPreferences> {
    this.state.preferences = DesktopPreferencesSchema.parse(preferences)
    await this.persist()
    return this.getPreferences()
  }

  getWindowState(): PersistedWindowState | null {
    return this.state.window ? { ...this.state.window } : null
  }

  async saveWindowState(windowState: PersistedWindowState): Promise<void> {
    this.state.window = WindowStateSchema.parse(windowState)
    await this.persist()
  }

  async savePausedQueue(
    request: SavePausedQueueRequest,
    connectedSession: ConnectedSession
  ): Promise<void> {
    this.state.pausedQueue = StoredPausedQueueSchema.parse({
      accountHash: accountHash(connectedSession),
      tracks: request.tracks,
      currentIndex: Math.min(request.currentIndex, Math.max(0, request.tracks.length - 1)),
      playbackOrder: request.playbackOrder,
      repeatMode: request.repeatMode
    })
    await this.persist()
  }

  restorePausedQueue(connectedSession: ConnectedSession): PersistedPausedQueue | null {
    const stored = this.state.pausedQueue
    if (!stored || stored.accountHash !== accountHash(connectedSession) || stored.tracks.length === 0) {
      return null
    }
    return {
      tracks: stored.tracks.map((track) => ({ ...track })),
      currentIndex: Math.min(stored.currentIndex, stored.tracks.length - 1),
      playbackOrder: stored.playbackOrder,
      repeatMode: stored.repeatMode
    }
  }

  async clearPausedQueue(): Promise<void> {
    delete this.state.pausedQueue
    await this.persist()
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2)
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(this.userDataPath, { recursive: true })
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
      try {
        await writeFile(temporaryPath, snapshot, { encoding: 'utf8', mode: 0o600 })
        await rename(temporaryPath, this.filePath)
      } finally {
        await unlink(temporaryPath).catch(() => undefined)
      }
    })
    return this.writeChain
  }
}

export function accountHash(session: ConnectedSession): string {
  return createHash('sha256')
    .update(session.credential.serverUrl)
    .update('\0')
    .update(session.credential.username)
    .digest('hex')
}
