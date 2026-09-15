import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectReleaseAssets,
  getReleaseAssetNames,
  validateReleaseTag
} from '../../scripts/prepare-release.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('候选版发布资产准备', () => {
  it('要求标签与 package.json 候选版本完全一致', () => {
    expect(validateReleaseTag('v0.1.0-rc.1', '0.1.0-rc.1')).toBe('v0.1.0-rc.1')
    expect(() => validateReleaseTag('v0.1.0', '0.1.0-rc.1')).toThrow('预期 v0.1.0-rc.1')
    expect(() => validateReleaseTag('v0.1.0', '0.1.0')).toThrow('不是 x.y.z-rc.n 候选版本')
  })

  it('只收集三个安装包和三个验证清单，并生成稳定 SHA-256 清单', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sonavi-release-assets-'))
    temporaryDirectories.push(root)
    await writeFile(join(root, 'package.json'), '{"version":"0.1.0-rc.1"}\n')
    const source = join(root, 'downloaded')
    const output = join(root, 'upload')
    const expectedNames = getReleaseAssetNames('0.1.0-rc.1')

    for (const [index, name] of expectedNames.entries()) {
      const directory = join(source, `target-${index}`)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, name), `asset-${index}`)
    }
    await writeFile(join(source, 'ignored.blockmap'), 'not published')

    const result = await collectReleaseAssets(root, source, output)
    expect(result.assets).toEqual(expectedNames)
    await expect(readFile(join(output, 'ignored.blockmap'), 'utf8')).rejects.toThrow()

    const checksum = await readFile(result.checksumPath, 'utf8')
    for (const [index, name] of expectedNames.entries()) {
      const digest = createHash('sha256').update(`asset-${index}`).digest('hex')
      expect(checksum).toContain(`${digest}  ${name}`)
    }
  })
})
