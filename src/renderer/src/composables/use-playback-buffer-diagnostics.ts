import { onScopeDispose, watch } from 'vue'
import type { AudioEngineState } from '../services/audio-engine/types'
import { reportPlaybackBuffer } from '../services/network'
import { usePlayerStore } from '../stores/player'

export interface PlaybackBufferObservation {
  queueEntryId: string | null
  state: AudioEngineState
}

type ReportPlaybackBuffer = typeof reportPlaybackBuffer

export class PlaybackBufferDiagnosticsController {
  private activeEntryId: string | null = null
  private bufferStartedAt = 0

  constructor(
    private readonly report: ReportPlaybackBuffer,
    private readonly now: () => number = performance.now.bind(performance)
  ) {}

  observe(observation: PlaybackBufferObservation): void {
    const entryChanged =
      this.activeEntryId !== null && observation.queueEntryId !== this.activeEntryId
    if (this.activeEntryId !== null && (entryChanged || observation.state !== 'buffering')) {
      this.finishBuffering()
    }

    if (
      observation.state === 'buffering' &&
      observation.queueEntryId !== null &&
      this.activeEntryId === null
    ) {
      this.activeEntryId = observation.queueEntryId
      this.bufferStartedAt = this.now()
      this.send({ event: 'buffer-start', durationMs: 0 })
    }
  }

  dispose(): void {
    if (this.activeEntryId !== null) this.finishBuffering()
  }

  private finishBuffering(): void {
    const durationMs = Math.max(0, Math.round(this.now() - this.bufferStartedAt))
    this.activeEntryId = null
    this.bufferStartedAt = 0
    this.send({ event: 'buffer-end', durationMs: Math.min(durationMs, 3_600_000) })
  }

  private send(request: Parameters<ReportPlaybackBuffer>[0]): void {
    void this.report(request).catch(() => undefined)
  }
}

export function usePlaybackBufferDiagnostics(): void {
  const player = usePlayerStore()
  const controller = new PlaybackBufferDiagnosticsController(reportPlaybackBuffer)

  watch(
    () => ({
      queueEntryId: player.currentEntry?.queueEntryId ?? null,
      state: player.state
    }),
    (observation) => controller.observe(observation),
    { immediate: true, flush: 'sync' }
  )

  onScopeDispose(() => controller.dispose())
}
