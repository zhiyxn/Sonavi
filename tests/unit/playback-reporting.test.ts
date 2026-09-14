import { describe, expect, it, vi } from 'vitest'
import {
  PlaybackReportingController,
  type PlaybackObservation
} from '../../src/renderer/src/composables/use-playback-reporting'

const base: PlaybackObservation = {
  queueEntryId: 'entry-1',
  sessionId: '8db257ee-54de-4931-bf0f-f4ec1d817198',
  trackId: 'track-1',
  state: 'loading',
  currentTime: 0,
  duration: 100
}

describe('播放上报控制器', () => {
  it('进入真实 playing 后上报 now-playing，累计 50% 后只提交一次', async () => {
    const report = vi.fn().mockResolvedValue({ reported: true })
    const controller = new PlaybackReportingController(report, vi.fn(), () => 1_700_000_000_000)

    controller.observe(base)
    controller.observe({ ...base, state: 'playing' })
    for (let second = 1; second <= 55; second += 1) {
      controller.observe({ ...base, state: 'playing', currentTime: second })
    }
    await Promise.resolve()

    expect(report).toHaveBeenCalledTimes(2)
    expect(report.mock.calls[0]?.[0]).toMatchObject({ submission: false })
    expect(report.mock.calls[1]?.[0]).toMatchObject({
      submission: true,
      playedAtMs: 1_700_000_000_000
    })
  })

  it('忽略 seek 跳跃，并按 queueEntryId 隔离重复歌曲', () => {
    const report = vi.fn().mockResolvedValue({ reported: true })
    const controller = new PlaybackReportingController(report, vi.fn(), () => 123)

    controller.observe(base)
    controller.observe({ ...base, state: 'playing' })
    controller.observe({ ...base, state: 'seeking', currentTime: 0 })
    controller.observe({ ...base, state: 'seeking', currentTime: 90 })
    controller.observe({ ...base, state: 'playing', currentTime: 90 })
    controller.observe({ ...base, state: 'playing', currentTime: 91 })
    expect(report).toHaveBeenCalledTimes(1)

    const nextEntry: PlaybackObservation = {
      ...base,
      queueEntryId: 'entry-2',
      state: 'playing',
      currentTime: 0
    }
    controller.observe(nextEntry)
    controller.observe(nextEntry)
    expect(report).toHaveBeenCalledTimes(2)
    expect(report.mock.calls.every((call) => call[0].submission === false)).toBe(true)
  })
})
