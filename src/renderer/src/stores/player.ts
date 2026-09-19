import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'
import type { TrackSummary } from '../../../shared/library'
import { HtmlAudioEngine, isActivePlaybackState } from '../services/audio-engine/html-audio-engine'
import type { AudioEngineSnapshot, AudioEngineState } from '../services/audio-engine/types'
import { createTranscodeSeek } from '../services/network'

export type PlaybackOrder = 'sequential' | 'shuffle'
export type RepeatMode = 'off' | 'all' | 'one'

export interface PlaybackScope {
  sessionId: string
  serverId: string
  accountId: string
}

export interface QueueEntry {
  queueEntryId: string
  trackId: string
  scope: PlaybackScope
  track: TrackSummary
}

function createQueueEntry(track: TrackSummary, scope: PlaybackScope): QueueEntry {
  return {
    queueEntryId: globalThis.crypto.randomUUID(),
    trackId: track.id,
    scope: { ...scope },
    track: { ...track }
  }
}

function shuffleIds(ids: string[]): string[] {
  const shuffled = [...ids]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!]
  }
  return shuffled
}

export const usePlayerStore = defineStore('player', () => {
  const engine = markRaw(new HtmlAudioEngine())
  const state = ref<AudioEngineState>('idle')
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const errorMessage = ref('')
  const generationId = ref(0)
  const queue = ref<QueueEntry[]>([])
  const currentEntryId = ref<string | null>(null)
  const playbackOrder = ref<PlaybackOrder>('sequential')
  const repeatMode = ref<RepeatMode>('off')
  const shuffleOrder = ref<string[]>([])
  const playbackHistory = ref<string[]>([])
  const automaticRecoveryAttempted = new Set<string>()
  let automaticRecoveryTimer: ReturnType<typeof setTimeout> | null = null

  const currentEntry = computed(
    () => queue.value.find((entry) => entry.queueEntryId === currentEntryId.value) ?? null
  )
  const track = computed(() => currentEntry.value?.track ?? null)
  const isPlaying = computed(() => isActivePlaybackState(state.value))
  const canGoPrevious = computed(() => currentEntry.value !== null)
  const canGoNext = computed(() => getNextEntryId() !== null)
  const canSeek = computed(() => track.value?.playback.seekMode !== 'unavailable')

  engine.subscribe((event) => {
    if (event.type === 'ended') {
      if (
        event.generationId === generationId.value &&
        event.trackId === currentEntry.value?.trackId
      ) {
        void handleNaturalEnded()
      }
      return
    }
    applySnapshot(event.snapshot)
  })

  function applySnapshot(snapshot: AudioEngineSnapshot): void {
    const wasActive = isActivePlaybackState(state.value)
    generationId.value = snapshot.generationId
    state.value = snapshot.state
    currentTime.value = snapshot.currentTime
    duration.value = snapshot.duration
    volume.value = snapshot.volume
    errorMessage.value = snapshot.errorMessage
    const entry = currentEntry.value
    if (
      snapshot.state === 'error' &&
      wasActive &&
      entry &&
      entry.track.playback.seekMode !== 'unavailable' &&
      (snapshot.errorReason === 'stream' || snapshot.errorReason === 'buffer-timeout')
    ) {
      scheduleAutomaticRecovery(entry.queueEntryId)
    }
  }

  function scheduleAutomaticRecovery(queueEntryId: string): void {
    if (automaticRecoveryAttempted.has(queueEntryId)) return
    automaticRecoveryAttempted.add(queueEntryId)
    if (automaticRecoveryTimer !== null) clearTimeout(automaticRecoveryTimer)
    automaticRecoveryTimer = setTimeout(() => {
      automaticRecoveryTimer = null
      if (currentEntryId.value !== queueEntryId || state.value !== 'error') return
      void recoverCurrentEntry()
    }, 0)
  }

  function cancelScheduledAutomaticRecovery(): void {
    if (automaticRecoveryTimer === null) return
    clearTimeout(automaticRecoveryTimer)
    automaticRecoveryTimer = null
  }

  function orderedEntryIds(): string[] {
    if (playbackOrder.value === 'shuffle') {
      const available = new Set(queue.value.map((entry) => entry.queueEntryId))
      return shuffleOrder.value.filter((id) => available.has(id))
    }
    return queue.value.map((entry) => entry.queueEntryId)
  }

  function entryById(queueEntryId: string | null): QueueEntry | null {
    return queue.value.find((entry) => entry.queueEntryId === queueEntryId) ?? null
  }

  function getNextEntryId(): string | null {
    if (!currentEntryId.value) return queue.value[0]?.queueEntryId ?? null
    const order = orderedEntryIds()
    const currentIndex = order.indexOf(currentEntryId.value)
    if (currentIndex >= 0 && currentIndex < order.length - 1) return order[currentIndex + 1] ?? null
    return repeatMode.value === 'all' ? (order[0] ?? null) : null
  }

  async function loadEntry(
    entry: QueueEntry,
    autoplay: boolean,
    recordHistory = true
  ): Promise<void> {
    cancelScheduledAutomaticRecovery()
    currentEntryId.value = entry.queueEntryId
    if (recordHistory && playbackHistory.value.at(-1) !== entry.queueEntryId) {
      playbackHistory.value.push(entry.queueEntryId)
    }
    await engine.load(
      {
        trackId: entry.trackId,
        streamUrl: entry.track.streamUrl,
        ...(entry.track.fallbackStreamUrl
          ? { fallbackStreamUrl: entry.track.fallbackStreamUrl }
          : {}),
        duration: entry.track.duration
      },
      autoplay
    )
  }

  async function replaceQueue(
    tracks: TrackSummary[],
    startIndex: number,
    scope: PlaybackScope,
    autoplay = true
  ): Promise<void> {
    cancelScheduledAutomaticRecovery()
    automaticRecoveryAttempted.clear()
    engine.stop()
    queue.value = tracks.map((item) => createQueueEntry(item, scope))
    shuffleOrder.value =
      playbackOrder.value === 'shuffle'
        ? shuffleIds(queue.value.map((entry) => entry.queueEntryId))
        : []
    playbackHistory.value = []
    if (queue.value.length === 0) {
      currentEntryId.value = null
      return
    }
    const safeIndex = Math.min(Math.max(0, startIndex), queue.value.length - 1)
    await loadEntry(queue.value[safeIndex]!, autoplay)
  }

  async function restoreQueue(
    tracks: TrackSummary[],
    startIndex: number,
    scope: PlaybackScope,
    restoredPlaybackOrder: PlaybackOrder,
    restoredRepeatMode: RepeatMode
  ): Promise<void> {
    playbackOrder.value = restoredPlaybackOrder
    repeatMode.value = restoredRepeatMode
    await replaceQueue(tracks, startIndex, scope, false)
  }

  function appendToQueue(tracks: TrackSummary[], scope: PlaybackScope): void {
    if (tracks.length === 0) return
    const additions = tracks.map((item) => createQueueEntry(item, scope))
    queue.value.push(...additions)
    if (playbackOrder.value === 'shuffle') {
      shuffleOrder.value.push(...shuffleIds(additions.map((entry) => entry.queueEntryId)))
    }
    if (!currentEntry.value) void loadEntry(additions[0]!, false)
  }

  async function playQueueEntry(queueEntryId: string): Promise<void> {
    const entry = entryById(queueEntryId)
    if (entry) await loadEntry(entry, true)
  }

  async function next(): Promise<void> {
    const nextEntry = entryById(getNextEntryId())
    if (nextEntry) await loadEntry(nextEntry, true)
  }

  async function previous(): Promise<void> {
    if (!currentEntry.value) return

    if (playbackOrder.value === 'shuffle') {
      while (playbackHistory.value.at(-1) === currentEntryId.value) playbackHistory.value.pop()
      const previousEntry = entryById(playbackHistory.value.at(-1) ?? null)
      if (previousEntry) {
        await loadEntry(previousEntry, true, false)
        return
      }
      if (repeatMode.value === 'all') {
        const order = orderedEntryIds()
        const wrappedEntry = entryById(order.at(-1) ?? null)
        if (wrappedEntry) await loadEntry(wrappedEntry, true)
      } else {
        await restartCurrent()
      }
      return
    }

    const currentIndex = queue.value.findIndex(
      (entry) => entry.queueEntryId === currentEntryId.value
    )
    const previousIndex =
      currentIndex > 0
        ? currentIndex - 1
        : repeatMode.value === 'all'
          ? queue.value.length - 1
          : -1
    if (previousIndex >= 0) await loadEntry(queue.value[previousIndex]!, true)
    else await restartCurrent()
  }

  function removeQueueEntry(queueEntryId: string): void {
    const removingCurrent = currentEntryId.value === queueEntryId
    const wasActive = isActivePlaybackState(state.value)
    const orderBeforeRemoval = orderedEntryIds()
    const removedIndex = orderBeforeRemoval.indexOf(queueEntryId)
    const replacementId =
      orderBeforeRemoval[removedIndex + 1] ?? orderBeforeRemoval[removedIndex - 1] ?? null

    queue.value = queue.value.filter((entry) => entry.queueEntryId !== queueEntryId)
    shuffleOrder.value = shuffleOrder.value.filter((id) => id !== queueEntryId)
    playbackHistory.value = playbackHistory.value.filter((id) => id !== queueEntryId)
    automaticRecoveryAttempted.delete(queueEntryId)
    if (!removingCurrent) return

    const replacement = entryById(replacementId)
    if (replacement) void loadEntry(replacement, wasActive)
    else clearQueue()
  }

  function moveQueueEntry(queueEntryId: string, targetIndex: number): void {
    const sourceIndex = queue.value.findIndex((entry) => entry.queueEntryId === queueEntryId)
    if (sourceIndex < 0 || queue.value.length < 2) return
    const safeTarget = Math.min(Math.max(0, targetIndex), queue.value.length - 1)
    if (sourceIndex === safeTarget) return
    const [entry] = queue.value.splice(sourceIndex, 1)
    queue.value.splice(safeTarget, 0, entry!)
  }

  function clearQueue(): void {
    cancelScheduledAutomaticRecovery()
    automaticRecoveryAttempted.clear()
    engine.stop()
    queue.value = []
    currentEntryId.value = null
    shuffleOrder.value = []
    playbackHistory.value = []
  }

  function toggle(): void {
    if (!currentEntry.value) return
    if (isActivePlaybackState(state.value)) engine.pause()
    else void engine.play()
  }

  function pause(): void {
    engine.pause()
  }

  async function seek(seconds: number): Promise<void> {
    const entry = currentEntry.value
    if (!entry || !Number.isFinite(seconds)) return
    if (entry.track.playback.seekMode === 'native') {
      engine.seek(seconds)
      return
    }
    if (entry.track.playback.seekMode === 'unavailable') return

    const wasActive = isActivePlaybackState(state.value)
    const result = await createTranscodeSeek({
      sessionId: entry.scope.sessionId,
      trackId: entry.trackId,
      timeOffset: Math.floor(Math.min(Math.max(0, seconds), entry.track.duration))
    })
    if (currentEntryId.value !== entry.queueEntryId) return
    if (!result.ok) {
      errorMessage.value = result.message
      return
    }
    await engine.load(
      {
        trackId: entry.trackId,
        streamUrl: result.streamUrl,
        duration: entry.track.duration,
        timelineOffset: result.timelineOffset
      },
      wasActive
    )
  }

  async function retry(): Promise<void> {
    cancelScheduledAutomaticRecovery()
    await recoverCurrentEntry()
  }

  async function recoverCurrentEntry(): Promise<void> {
    const entry = currentEntry.value
    if (!entry) return
    const resumeAt = Math.min(Math.max(0, currentTime.value), entry.track.duration)
    if (entry.track.playback.seekMode === 'transcode-offset' && resumeAt > 0) {
      const result = await createTranscodeSeek({
        sessionId: entry.scope.sessionId,
        trackId: entry.trackId,
        timeOffset: Math.floor(resumeAt)
      })
      if (currentEntryId.value !== entry.queueEntryId) return
      if (!result.ok) {
        errorMessage.value = result.message
        return
      }
      await engine.load(
        {
          trackId: entry.trackId,
          streamUrl: result.streamUrl,
          duration: entry.track.duration,
          timelineOffset: result.timelineOffset
        },
        true
      )
      return
    }

    await loadEntry(entry, true, false)
    if (entry.track.playback.seekMode === 'native' && resumeAt > 0) engine.seek(resumeAt)
  }

  async function restartCurrent(): Promise<void> {
    const entry = currentEntry.value
    if (!entry) return
    if (entry.track.playback.seekMode === 'native') engine.seek(0)
    else await loadEntry(entry, isActivePlaybackState(state.value), false)
  }

  function setVolume(nextVolume: number): void {
    engine.setVolume(nextVolume)
  }

  function togglePlaybackOrder(): void {
    playbackOrder.value = playbackOrder.value === 'sequential' ? 'shuffle' : 'sequential'
    shuffleOrder.value =
      playbackOrder.value === 'shuffle'
        ? shuffleIds(queue.value.map((entry) => entry.queueEntryId))
        : []
    playbackHistory.value = currentEntryId.value ? [currentEntryId.value] : []
  }

  function cycleRepeatMode(): void {
    repeatMode.value =
      repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  async function handleNaturalEnded(): Promise<void> {
    if (!currentEntry.value) return
    if (repeatMode.value === 'one') {
      await restartCurrent()
      await engine.play()
      return
    }
    await next()
  }

  function stop(): void {
    clearQueue()
  }

  return {
    state,
    track,
    currentTime,
    duration,
    volume,
    errorMessage,
    generationId,
    queue,
    currentEntryId,
    currentEntry,
    playbackOrder,
    repeatMode,
    playbackHistory,
    isPlaying,
    canGoPrevious,
    canGoNext,
    canSeek,
    replaceQueue,
    restoreQueue,
    appendToQueue,
    playQueueEntry,
    next,
    previous,
    removeQueueEntry,
    moveQueueEntry,
    clearQueue,
    toggle,
    pause,
    seek,
    retry,
    setVolume,
    togglePlaybackOrder,
    cycleRepeatMode,
    stop
  }
})
