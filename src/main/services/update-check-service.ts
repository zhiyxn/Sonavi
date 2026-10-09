import { z } from 'zod'
import type { UpdateCheckResult } from '../../shared/application'

export const RELEASES_API_URL = 'https://api.github.com/repos/zhiyxn/Sonavi/releases?per_page=20'
export const RELEASES_PAGE_URL = 'https://github.com/zhiyxn/Sonavi/releases'

const MAX_RESPONSE_BYTES = 1024 * 1024
const ReleaseSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(z.object({ name: z.string(), state: z.string() }))
})

interface Version {
  major: number
  minor: number
  patch: number
  releaseCandidate: number | null
}

function parseVersion(value: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(value)
  if (!match) return null
  const parts = [match[1], match[2], match[3], match[4]]
    .map((part) => part === undefined ? null : Number(part))
  if (parts.some((part) => part !== null && !Number.isSafeInteger(part))) return null
  return {
    major: parts[0]!,
    minor: parts[1]!,
    patch: parts[2]!,
    releaseCandidate: parts[3] ?? null
  }
}

function compareVersions(left: Version, right: Version): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  if (left.releaseCandidate === null) return right.releaseCandidate === null ? 0 : 1
  if (right.releaseCandidate === null) return -1
  return left.releaseCandidate - right.releaseCandidate
}

export function getUpdateArtifactName(
  version: string,
  platform: NodeJS.Platform,
  arch: string
): string | null {
  if (!parseVersion(version)) return null
  if (platform === 'win32' && arch === 'x64') return `Sonavi-${version}-win-x64.exe`
  if (platform === 'darwin' && arch === 'x64') return `Sonavi-${version}-mac-x64.dmg`
  if (platform === 'darwin' && arch === 'arm64') return `Sonavi-${version}-mac-arm64.dmg`
  return null
}

function selectNewerRelease(
  currentVersion: string,
  rawReleases: unknown,
  platform: NodeJS.Platform,
  arch: string
): { result: UpdateCheckResult; downloadUrl: string | null } {
  const current = parseVersion(currentVersion)
  if (!current) throw new Error('当前应用版本格式不受支持。')
  const releases = z.array(ReleaseSchema).parse(rawReleases)
  let newest: { version: Version; label: string; tag: string; downloadAvailable: boolean } | null = null
  for (const release of releases) {
    if (release.draft || (current.releaseCandidate === null && release.prerelease)) continue
    const version = parseVersion(release.tag_name)
    if (!version || (version.releaseCandidate !== null) !== release.prerelease) continue
    if (compareVersions(version, current) <= 0) continue
    if (!newest || compareVersions(version, newest.version) > 0) {
      const label = release.tag_name.replace(/^v/, '')
      const artifactName = getUpdateArtifactName(label, platform, arch)
      const uploaded = new Set(release.assets.filter((asset) => asset.state === 'uploaded')
        .map((asset) => asset.name))
      newest = {
        version,
        label,
        tag: release.tag_name,
        downloadAvailable: artifactName !== null && uploaded.has(artifactName)
      }
    }
  }
  if (!newest) return { result: { status: 'up-to-date' }, downloadUrl: null }
  const artifactName = getUpdateArtifactName(newest.label, platform, arch)
  return {
    result: { status: 'available', version: newest.label, downloadAvailable: newest.downloadAvailable },
    downloadUrl: newest.downloadAvailable && artifactName
      ? `${RELEASES_PAGE_URL}/download/${newest.tag}/${artifactName}`
      : null
  }
}

export function findNewerRelease(
  currentVersion: string,
  rawReleases: unknown,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): UpdateCheckResult {
  return selectNewerRelease(currentVersion, rawReleases, platform, arch).result
}

async function readLimitedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('更新响应为空。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('更新响应超过大小限制。')
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } finally {
    if (bytes > MAX_RESPONSE_BYTES) await reader.cancel().catch(() => undefined)
  }
}

export class UpdateCheckService {
  private pending: Promise<UpdateCheckResult> | null = null
  private lastDownloadUrl: string | null = null

  constructor(
    private readonly fetchReleaseList: (url: string, init: RequestInit) => Promise<Response>,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly arch: string = process.arch
  ) {}

  getDownloadUrl(): string | null {
    return this.lastDownloadUrl
  }

  check(currentVersion: string): Promise<UpdateCheckResult> {
    if (this.pending) return this.pending
    const request = this.performCheck(currentVersion)
    this.pending = request
    void request.finally(() => { this.pending = null }).catch(() => undefined)
    return request
  }

  private async performCheck(currentVersion: string): Promise<UpdateCheckResult> {
    this.lastDownloadUrl = null
    const response = await this.fetchReleaseList(RELEASES_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('更新服务暂时不可用。')
    }
    const selected = selectNewerRelease(
      currentVersion,
      await readLimitedJson(response),
      this.platform,
      this.arch
    )
    this.lastDownloadUrl = selected.downloadUrl
    return selected.result
  }
}
