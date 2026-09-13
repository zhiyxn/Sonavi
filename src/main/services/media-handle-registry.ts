import { randomUUID } from 'node:crypto'

export type MediaKind = 'cover' | 'audio'

export interface MediaHandle {
  sessionId: string
  kind: MediaKind
  resourceId: string
}

const MAX_HANDLES = 2_000

export class MediaHandleRegistry {
  private readonly handles = new Map<string, MediaHandle>()

  create(handle: MediaHandle): string {
    if (this.handles.size >= MAX_HANDLES) {
      const oldest = this.handles.keys().next().value
      if (oldest) this.handles.delete(oldest)
    }

    const id = randomUUID()
    this.handles.set(id, { ...handle })
    return `sonavi-media://media/${id}`
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

    const id = url.pathname.match(/^\/([0-9a-f-]+)$/i)?.[1]
    if (!id) return null
    const handle = this.handles.get(id)
    return handle ? { ...handle } : null
  }
}
