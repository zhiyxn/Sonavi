import { useQueryClient } from '@tanstack/vue-query'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { DesktopCommand, SavePausedQueueRequest } from '../../../shared/desktop'
import {
  completeQuitPreparation,
  refreshQueuePlayback,
  restorePausedQueue,
  savePausedQueue,
  updateDesktopPlaybackStatus
} from '../services/desktop'
import { useDesktopStore } from '../stores/desktop'
import { usePlayerStore } from '../stores/player'
import { useSessionStore } from '../stores/session'

export interface PausedQueuePersistence {
  schedule: (request: SavePausedQueueRequest) => void
  flush: (request?: SavePausedQueueRequest) => Promise<boolean>
  cancel: () => void
}

export function createPausedQueuePersistence(
  persist: (request: SavePausedQueueRequest) => Promise<boolean> = savePausedQueue,
  delayMs = 350
): PausedQueuePersistence {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingRequest: SavePausedQueueRequest | null = null
  let saveChain = Promise.resolve(true)

  const enqueue = (request: SavePausedQueueRequest): Promise<boolean> => {
    const operation = saveChain.catch(() => false).then(() => persist(request))
    saveChain = operation
    return operation
  }

  const flush = (request?: SavePausedQueueRequest): Promise<boolean> => {
    if (request) pendingRequest = request
    if (timer) clearTimeout(timer)
    timer = null
    const nextRequest = pendingRequest
    pendingRequest = null
    return nextRequest ? enqueue(nextRequest) : saveChain
  }

  return {
    schedule: (request) => {
      pendingRequest = request
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void flush().catch(() => undefined)
      }, delayMs)
    },
    flush,
    cancel: () => {
      if (timer) clearTimeout(timer)
      timer = null
      pendingRequest = null
    }
  }
}

export function shouldIgnoreDesktopShortcut(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]')
  )
}

function shouldIgnoreSettingsShortcut(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
  )
}

export function isSettingsShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target'>,
  modifier: 'Ctrl' | 'Cmd' | undefined
): boolean {
  if (event.key !== ',' || event.altKey || event.shiftKey || shouldIgnoreSettingsShortcut(event.target)) {
    return false
  }
  return modifier === 'Cmd'
    ? event.metaKey && !event.ctrlKey
    : modifier === 'Ctrl' && event.ctrlKey && !event.metaKey
}

function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  const resolved =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

export function useDesktopIntegration(options?: {
  getShortcutModifier: () => 'Ctrl' | 'Cmd' | undefined
  openSettings: () => void
}): {
  flushPausedQueue: () => Promise<boolean>
  refreshPlaybackQueue: () => Promise<boolean>
} {
  const player = usePlayerStore()
  const session = useSessionStore()
  const desktop = useDesktopStore()
  const queryClient = useQueryClient()
  let commandCleanup: (() => void) | null = null
  let volumeSaveTimer: ReturnType<typeof setTimeout> | null = null
  let readySessionId: string | null = null
  const mediaQuery = matchMedia('(prefers-color-scheme: dark)')
  const queuePersistence = createPausedQueuePersistence()

  const createQueueTracks = (): SavePausedQueueRequest['tracks'] =>
    player.queue.map(({ track }) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      ...(track.track ? { track: track.track } : {}),
      ...(track.disc ? { disc: track.disc } : {}),
      ...(track.contentType ? { contentType: track.contentType } : {}),
      starred: track.starred
    }))

  const createQueueSaveRequest = (sessionId: string): SavePausedQueueRequest => {
    const entries = player.queue.map((entry) => ({
      queueEntryId: entry.queueEntryId,
      track: entry.track
    }))
    const currentIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.queueEntryId === player.currentEntryId)
    )
    return {
      sessionId,
      tracks: createQueueTracks(),
      currentIndex,
      playbackOrder: player.playbackOrder,
      repeatMode: player.repeatMode
    }
  }

  const flushPausedQueue = async (): Promise<boolean> => {
    const connected = session.connection
    if (!connected || readySessionId !== connected.sessionId) return false
    try {
      return await queuePersistence.flush(createQueueSaveRequest(connected.sessionId))
    } catch {
      return false
    }
  }

  const refreshPlaybackQueue = async (): Promise<boolean> => {
    const connected = session.connection
    if (!connected || player.queue.length === 0) return false
    try {
      const freshTracks = await refreshQueuePlayback({
        sessionId: connected.sessionId,
        tracks: createQueueTracks()
      })
      return freshTracks ? await player.refreshQueueTracks(freshTracks) : false
    } catch {
      return false
    }
  }

  const runCommand = async (command: DesktopCommand): Promise<void> => {
    if (command === 'toggle-playback') player.toggle()
    else if (command === 'next') await player.next()
    else if (command === 'previous') await player.previous()
    else if (command === 'pause-for-system') player.pause()
    else if (command === 'network-resumed') {
      player.pause()
      const connected = session.connection
      if (connected) {
        const restored = await restorePausedQueue(connected.sessionId)
        if (restored) {
          await player.restoreQueue(
            restored.tracks,
            restored.currentIndex,
            {
              sessionId: connected.sessionId,
              serverId: connected.server.baseUrl,
              accountId: connected.sessionId
            },
            restored.playbackOrder,
            restored.repeatMode
          )
        }
        await queryClient.invalidateQueries()
      }
    } else if (command === 'prepare-to-quit') {
      await flushPausedQueue()
      await completeQuitPreparation()
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (options && isSettingsShortcut(event, options.getShortcutModifier())) {
      event.preventDefault()
      options.openSettings()
      return
    }
    if (
      event.code !== 'Space' ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      shouldIgnoreDesktopShortcut(event.target)
    ) return
    event.preventDefault()
    player.toggle()
  }

  const updateMediaSession = (): void => {
    if (!('mediaSession' in navigator)) return
    const track = player.track
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          ...(track.coverUrl ? { artwork: [{ src: track.coverUrl }] } : {})
        })
      : null
    navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : track ? 'paused' : 'none'
    if (track && player.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: player.duration,
          playbackRate: 1,
          position: Math.min(Math.max(0, player.currentTime), player.duration)
        })
      } catch {
        // Chromium can reject transient metadata states; the next snapshot retries.
      }
    }
  }

  const setMediaActionHandlers = (): void => {
    if (!('mediaSession' in navigator)) return
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => { if (!player.isPlaying) player.toggle() }],
      ['pause', () => player.pause()],
      ['previoustrack', () => { void player.previous() }],
      ['nexttrack', () => { void player.next() }],
      ['seekto', (details) => { if (details.seekTime !== undefined) void player.seek(details.seekTime) }],
      ['seekbackward', (details) => { void player.seek(player.currentTime - (details.seekOffset ?? 10)) }],
      ['seekforward', (details) => { void player.seek(player.currentTime + (details.seekOffset ?? 10)) }]
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // A platform may expose Media Session without every optional action.
      }
    }
  }

  const clearMediaActionHandlers = (): void => {
    if (!('mediaSession' in navigator)) return
    for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'] as MediaSessionAction[]) {
      try {
        navigator.mediaSession.setActionHandler(action, null)
      } catch {
        // Ignore unsupported optional actions during teardown.
      }
    }
  }

  onMounted(async () => {
    await desktop.initialize()
    player.setVolume(desktop.preferences.volume)
    applyTheme(desktop.preferences.theme)
    setMediaActionHandlers()
    commandCleanup = window.sonavi.desktop.onCommand((command) => { void runCommand(command) })
    window.addEventListener('keydown', onKeyDown)
  })

  watch(
    () => desktop.preferences.theme,
    (theme) => applyTheme(theme),
    { immediate: true }
  )
  const onSystemThemeChanged = (): void => {
    if (desktop.preferences.theme === 'system') applyTheme('system')
  }
  mediaQuery.addEventListener('change', onSystemThemeChanged)

  watch(
    () => session.connection,
    async (connected) => {
      queuePersistence.cancel()
      readySessionId = null
      if (!connected) return
      const restored = await restorePausedQueue(connected.sessionId)
      if (session.connection?.sessionId !== connected.sessionId) return
      if (restored && player.queue.length === 0) {
        await player.restoreQueue(
          restored.tracks,
          restored.currentIndex,
          {
            sessionId: connected.sessionId,
            serverId: connected.server.baseUrl,
            accountId: connected.sessionId
          },
          restored.playbackOrder,
          restored.repeatMode
        )
      }
      readySessionId = connected.sessionId
    }
  )

  watch(
    () => [
      player.track,
      player.isPlaying,
      player.canGoPrevious,
      player.canGoNext,
      player.currentTime,
      player.duration
    ],
    () => {
      const track = player.track
      void updateDesktopPlaybackStatus({
        hasTrack: Boolean(track),
        isPlaying: player.isPlaying,
        canGoPrevious: player.canGoPrevious,
        canGoNext: player.canGoNext,
        ...(track ? { title: track.title, artist: track.artist, album: track.album } : {})
      })
      updateMediaSession()
    },
    { immediate: true }
  )

  watch(
    () => ({
      sessionId: session.connection?.sessionId ?? null,
      entries: player.queue.map((entry) => ({
        queueEntryId: entry.queueEntryId,
        track: entry.track
      })),
      currentEntryId: player.currentEntryId,
      playbackOrder: player.playbackOrder,
      repeatMode: player.repeatMode
    }),
    (snapshot) => {
      if (!snapshot.sessionId || readySessionId !== snapshot.sessionId) return
      const currentIndex = Math.max(
        0,
        snapshot.entries.findIndex((entry) => entry.queueEntryId === snapshot.currentEntryId)
      )
      queuePersistence.schedule({
        sessionId: snapshot.sessionId,
        tracks: snapshot.entries.map(({ track }) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          ...(track.track ? { track: track.track } : {}),
          ...(track.disc ? { disc: track.disc } : {}),
          ...(track.contentType ? { contentType: track.contentType } : {}),
          starred: track.starred
        })),
        currentIndex,
        playbackOrder: snapshot.playbackOrder,
        repeatMode: snapshot.repeatMode
      })
    },
    { deep: true }
  )

  watch(
    () => player.volume,
    (volume) => {
      if (!desktop.initialized) return
      if (volumeSaveTimer) clearTimeout(volumeSaveTimer)
      volumeSaveTimer = setTimeout(() => { void desktop.update({ volume }) }, 350)
    }
  )

  onBeforeUnmount(() => {
    void flushPausedQueue()
    queuePersistence.cancel()
    if (volumeSaveTimer) clearTimeout(volumeSaveTimer)
    commandCleanup?.()
    window.removeEventListener('keydown', onKeyDown)
    mediaQuery.removeEventListener('change', onSystemThemeChanged)
    clearMediaActionHandlers()
  })

  return { flushPausedQueue, refreshPlaybackQueue }
}
