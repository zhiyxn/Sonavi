import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Session } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetworkPolicyService } from '../../src/main/services/network-policy-service'
import { invalidateNetworkSessionAfterSettingsUpdate } from '../../src/main/services/network-session-invalidation'

const temporaryDirectories: string[] = []

async function createService() {
  const directory = await mkdtemp(join(tmpdir(), 'sonavi-network-'))
  temporaryDirectories.push(directory)
  const setProxy = vi.fn().mockResolvedValue(undefined)
  const closeAllConnections = vi.fn().mockResolvedValue(undefined)
  const service = new NetworkPolicyService(directory, {
    setProxy,
    closeAllConnections
  } as unknown as Session)
  await service.initialize()
  return { service, setProxy, closeAllConnections }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('P08 网络与播放策略', () => {
  it('仅在代理连接实际重置时撤销当前会话的搜索与媒体资源', () => {
    const actions = {
      cancelSearches: vi.fn(),
      revokeMediaRequests: vi.fn(),
      revokeMediaHandles: vi.fn()
    }

    expect(invalidateNetworkSessionAfterSettingsUpdate(false, 'session-1', actions)).toBe(false)
    expect(actions.cancelSearches).not.toHaveBeenCalled()
    expect(actions.revokeMediaRequests).not.toHaveBeenCalled()
    expect(actions.revokeMediaHandles).not.toHaveBeenCalled()

    expect(invalidateNetworkSessionAfterSettingsUpdate(true, 'session-1', actions)).toBe(true)
    expect(actions.cancelSearches).toHaveBeenCalledOnce()
    expect(actions.revokeMediaRequests).toHaveBeenCalledOnce()
    expect(actions.revokeMediaHandles).toHaveBeenCalledOnce()
  })

  it('系统、直连和手动代理互斥，并在切换后关闭旧连接', async () => {
    const { service, setProxy, closeAllConnections } = await createService()
    expect(setProxy).toHaveBeenLastCalledWith({ mode: 'system' })

    await service.update({
      playback: { mode: 'automatic', maxBitRate: 320 },
      proxy: { mode: 'direct' }
    })
    expect(setProxy).toHaveBeenLastCalledWith({ mode: 'direct' })

    const result = await service.update({
      playback: { mode: 'compatible', maxBitRate: 192 },
      proxy: { mode: 'manual', manualUrl: 'http://127.0.0.1:7890' }
    })
    expect(setProxy).toHaveBeenLastCalledWith({
      mode: 'fixed_servers',
      proxyRules: 'http://127.0.0.1:7890'
    })
    expect(closeAllConnections).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ connectionsReset: true })
  })

  it('拒绝带凭据的代理，且不会静默改为直连', async () => {
    const { service, setProxy } = await createService()
    await expect(
      service.update({
        playback: { mode: 'original', maxBitRate: 320 },
        proxy: { mode: 'manual', manualUrl: 'http://user:secret@127.0.0.1:7890' }
      })
    ).rejects.toThrow('账号或密码')
    expect(setProxy).toHaveBeenCalledTimes(1)
  })

  it('只在 transcodeOffset 已确认时开放转码跳转', async () => {
    const { service } = await createService()
    await service.update({
      playback: { mode: 'compatible', maxBitRate: 256 },
      proxy: { mode: 'system' }
    })
    expect(service.createPlaybackPlan('audio/flac', false)).toMatchObject({
      streamMode: 'transcode',
      seekMode: 'unavailable',
      maxBitRate: 256
    })
    expect(service.createPlaybackPlan('audio/flac', true)).toMatchObject({
      streamMode: 'transcode',
      seekMode: 'transcode-offset'
    })
  })

  it('自动模式仅为已知媒体类型生成一次兼容回退入口', async () => {
    const { service } = await createService()
    expect(service.createPlaybackPlan('audio/flac', true)).toMatchObject({
      streamMode: 'original',
      seekMode: 'native',
      fallbackToTranscode: true
    })
    expect(service.createPlaybackPlan('audio/x-unknown', true)).toMatchObject({
      streamMode: 'transcode',
      seekMode: 'transcode-offset',
      fallbackToTranscode: false
    })
  })
})
