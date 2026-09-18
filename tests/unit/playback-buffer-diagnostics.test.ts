import { describe, expect, it, vi } from 'vitest'
import {
  PlaybackBufferDiagnosticsController,
  type PlaybackBufferObservation
} from '../../src/renderer/src/composables/use-playback-buffer-diagnostics'

const base: PlaybackBufferObservation = {
  queueEntryId: 'entry-1',
  state: 'playing'
}

describe('播放缓冲脱敏诊断', () => {
  it('只记录一次缓冲开始和结束，并计算持续时间', async () => {
    const report = vi.fn().mockResolvedValue(undefined)
    let now = 1_000
    const controller = new PlaybackBufferDiagnosticsController(report, () => now)

    controller.observe(base)
    controller.observe({ ...base, state: 'buffering' })
    controller.observe({ ...base, state: 'buffering' })
    now = 2_275
    controller.observe(base)
    await Promise.resolve()

    expect(report.mock.calls.map(([request]) => request)).toEqual([
      { event: 'buffer-start', durationMs: 0 },
      { event: 'buffer-end', durationMs: 1_275 }
    ])
    expect(JSON.stringify(report.mock.calls)).not.toContain('entry-1')
  })

  it('缓冲中切歌时结束旧区间，并为新条目建立新区间', async () => {
    const report = vi.fn().mockResolvedValue(undefined)
    let now = 100
    const controller = new PlaybackBufferDiagnosticsController(report, () => now)

    controller.observe({ ...base, state: 'buffering' })
    now = 350
    controller.observe({ queueEntryId: 'entry-2', state: 'buffering' })
    now = 500
    controller.dispose()
    await Promise.resolve()

    expect(report.mock.calls.map(([request]) => request)).toEqual([
      { event: 'buffer-start', durationMs: 0 },
      { event: 'buffer-end', durationMs: 250 },
      { event: 'buffer-start', durationMs: 0 },
      { event: 'buffer-end', durationMs: 150 }
    ])
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/entry-|track|url|credential/i)
  })

  it('没有活动歌曲时忽略 buffering 状态，上报失败也不影响播放状态机', async () => {
    const report = vi.fn().mockRejectedValue(new Error('ipc unavailable'))
    const controller = new PlaybackBufferDiagnosticsController(report, () => 1)

    controller.observe({ queueEntryId: null, state: 'buffering' })
    controller.observe({ ...base, state: 'buffering' })
    controller.observe(base)
    await Promise.resolve()
    await Promise.resolve()

    expect(report).toHaveBeenCalledTimes(2)
  })
})
