import { describe, expect, it, vi } from 'vitest'
import {
  findNewerRelease,
  getUpdateArtifactName,
  RELEASES_API_URL,
  UpdateCheckService
} from '../../src/main/services/update-check-service'

const release = (tag_name: string, prerelease = false, draft = false, names?: string[]) => ({
  tag_name, prerelease, draft,
  assets: (names ?? [
    `Sonavi-${tag_name.replace(/^v/, '')}-win-x64.exe`,
    `Sonavi-${tag_name.replace(/^v/, '')}-mac-x64.dmg`,
    `Sonavi-${tag_name.replace(/^v/, '')}-mac-arm64.dmg`
  ]).map((name) => ({ name, state: 'uploaded', browser_download_url: 'https://untrusted.example/file' }))
})

describe('公开版本检查', () => {
  it('候选版可升级到更高候选或正式版，忽略草稿和不支持的标签', () => {
    expect(findNewerRelease('0.1.0-rc.7', [
      release('v0.1.0-rc.8', true),
      release('v0.1.0'),
      release('v9.0.0', false, true),
      release('preview-99', true)
    ], 'darwin', 'x64')).toEqual({ status: 'available', version: '0.1.0', downloadAvailable: true })
    expect(findNewerRelease('0.1.0-rc.7', [release('v0.1.0-rc.8', true)], 'darwin', 'arm64'))
      .toEqual({ status: 'available', version: '0.1.0-rc.8', downloadAvailable: true })
  })

  it('正式版不提示候选版或更低版本', () => {
    expect(findNewerRelease('0.1.0', [release('v0.2.0-rc.1', true), release('v0.1.0')], 'win32', 'x64'))
      .toEqual({ status: 'up-to-date' })
    expect(findNewerRelease('0.1.0', [release('v0.2.0')], 'win32', 'x64'))
      .toEqual({ status: 'available', version: '0.2.0', downloadAvailable: true })
  })

  it('只为三种目标匹配已上传的安装包，缺失时保留发布页入口', () => {
    expect(getUpdateArtifactName('0.2.0', 'win32', 'x64')).toBe('Sonavi-0.2.0-win-x64.exe')
    expect(getUpdateArtifactName('0.2.0', 'darwin', 'x64')).toBe('Sonavi-0.2.0-mac-x64.dmg')
    expect(getUpdateArtifactName('0.2.0', 'darwin', 'arm64')).toBe('Sonavi-0.2.0-mac-arm64.dmg')
    expect(getUpdateArtifactName('0.2.0', 'linux', 'x64')).toBeNull()
    expect(findNewerRelease('0.1.0', [release('v0.2.0', false, false, [])], 'darwin', 'x64'))
      .toEqual({ status: 'available', version: '0.2.0', downloadAvailable: false })
    expect(findNewerRelease('0.1.0', [release('v0.2.0')], 'linux', 'x64'))
      .toEqual({ status: 'available', version: '0.2.0', downloadAvailable: false })
    const pendingAsset = release('v0.2.0')
    pendingAsset.assets[0]!.state = 'new'
    expect(findNewerRelease('0.1.0', [pendingAsset], 'win32', 'x64'))
      .toEqual({ status: 'available', version: '0.2.0', downloadAvailable: false })
  })

  it('仅请求固定 GitHub API，拒绝错误响应并限制正文', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([release('v0.1.0-rc.8', true)]), {
      headers: { 'content-type': 'application/json' }
    }))
    const service = new UpdateCheckService(fetcher, 'darwin', 'x64')
    expect(await service.check('0.1.0-rc.7')).toEqual({ status: 'available', version: '0.1.0-rc.8', downloadAvailable: true })
    expect(service.getDownloadUrl()).toBe(
      'https://github.com/zhiyxn/Sonavi/releases/download/v0.1.0-rc.8/Sonavi-0.1.0-rc.8-mac-x64.dmg'
    )
    expect(fetcher).toHaveBeenCalledWith(RELEASES_API_URL, expect.objectContaining({
      credentials: 'omit', redirect: 'manual', cache: 'no-store'
    }))

    const failed = new UpdateCheckService(async () => new Response('Unavailable', { status: 503 }))
    await expect(failed.check('0.1.0-rc.7')).rejects.toThrow('更新服务暂时不可用')
    const oversized = new UpdateCheckService(async () => new Response('x'.repeat(1024 * 1024 + 1), {
      headers: { 'content-type': 'application/json' }
    }))
    await expect(oversized.check('0.1.0-rc.7')).rejects.toThrow('更新响应超过大小限制')
  })
})
