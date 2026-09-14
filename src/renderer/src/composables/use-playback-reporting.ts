import { ref, watch, type Ref } from 'vue'
import type { AudioEngineState } from '../services/audio-engine/types'
import { reportPlayback } from '../services/playback'
import { usePlayerStore } from '../stores/player'

const MAX_CONTINUOUS_PROGRESS_SECONDS = 5
const MAX_SUBMISSION_SECONDS = 240

export interface PlaybackObservation {
  queueEntryId: string | null
  sessionId: string | null
  trackId: string | null
  state: AudioEngineState
  currentTime: number
  duration: number
}

type ReportPlayback = typeof reportPlayback

export class PlaybackReportingController {
  private activeEntryId: string | null = null
  private previousState: AudioEngineState = 'idle'
  private previousTime = 0
  private listenedSeconds = 0
  private playedAtMs = 0
  private nowPlayingAttempted = false
  private submissionAttempted = false

  constructor(
    private readonly report: ReportPlayback,
    private readonly onError: (message: string) => void,
    private readonly now: () => number = Date.now
  ) {}

  observe(observation: PlaybackObservation): void {
    if (!observation.queueEntryId || !observation.sessionId || !observation.trackId) {
      this.reset(null, observation)
      return
    }

    if (observation.queueEntryId !== this.activeEntryId) {
      this.reset(observation.queueEntryId, observation)
      return
    } else if (this.previousState === 'playing') {
      const delta = observation.currentTime - this.previousTime
      if (delta > 0 && delta <= MAX_CONTINUOUS_PROGRESS_SECONDS) {
        this.listenedSeconds += delta
      }
    }

    if (observation.state === 'playing' && !this.nowPlayingAttempted) {
      this.nowPlayingAttempted = true
      this.playedAtMs = this.now()
      this.send(observation, false)
    }

    const threshold =
      observation.duration > 0
        ? Math.min(observation.duration * 0.5, MAX_SUBMISSION_SECONDS)
        : MAX_SUBMISSION_SECONDS
    if (
      this.nowPlayingAttempted &&
      !this.submissionAttempted &&
      this.listenedSeconds >= threshold
    ) {
      this.submissionAttempted = true
      this.send(observation, true)
    }

    this.previousState = observation.state
    this.previousTime = observation.currentTime
  }

  private reset(entryId: string | null, observation: PlaybackObservation): void {
    this.activeEntryId = entryId
    this.previousState = observation.state
    this.previousTime = observation.currentTime
    this.listenedSeconds = 0
    this.playedAtMs = 0
    this.nowPlayingAttempted = false
    this.submissionAttempted = false
  }

  private send(observation: PlaybackObservation, submission: boolean): void {
    void this.report({
      sessionId: observation.sessionId!,
      trackId: observation.trackId!,
      submission,
      playedAtMs: this.playedAtMs
    })
      .then(() => this.onError(''))
      .catch(() => this.onError('播放记录暂时未同步；音乐播放不受影响。'))
  }
}

export function usePlaybackReporting(): { errorMessage: Ref<string> } {
  const player = usePlayerStore()
  const errorMessage = ref('')
  const controller = new PlaybackReportingController(reportPlayback, (message) => {
    errorMessage.value = message
  })

  watch(
    () => ({
      queueEntryId: player.currentEntry?.queueEntryId ?? null,
      sessionId: player.currentEntry?.scope.sessionId ?? null,
      trackId: player.currentEntry?.trackId ?? null,
      state: player.state,
      currentTime: player.currentTime,
      duration: player.duration
    }),
    (observation) => controller.observe(observation),
    { immediate: true, flush: 'sync' }
  )

  return { errorMessage }
}
