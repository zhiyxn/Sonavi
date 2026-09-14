import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PACKAGE_TARGETS,
  assertNoUnexpectedMacUsageDescriptions,
  classifyMacSignatureIdentity,
  normalizeMacArchitecture,
  parsePeArchitecture,
  sha256File
} from '../../scripts/verify-package.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function createPe(machine) {
  const buffer = Buffer.alloc(256)
  buffer.write('MZ', 0, 'ascii')
  buffer.writeUInt32LE(128, 0x3c)
  buffer.write('PE\0\0', 128, 'ascii')
  buffer.writeUInt16LE(machine, 132)
  return buffer
}

describe('P10 包验证器', () => {
  it('固定三个首版目标且不混淆架构', () => {
    expect(Object.keys(PACKAGE_TARGETS)).toEqual(['win-x64', 'mac-x64', 'mac-arm64'])
    expect(PACKAGE_TARGETS['win-x64']).toMatchObject({ platform: 'win32', architecture: 'x64' })
    expect(PACKAGE_TARGETS['mac-x64']).toMatchObject({ platform: 'darwin', architecture: 'x64' })
    expect(PACKAGE_TARGETS['mac-arm64']).toMatchObject({ platform: 'darwin', architecture: 'arm64' })
  })

  it('从 PE 头区分 Windows x64、arm64 与无效文件', () => {
    expect(parsePeArchitecture(createPe(0x8664))).toBe('x64')
    expect(parsePeArchitecture(createPe(0xaa64))).toBe('arm64')
    expect(parsePeArchitecture(Buffer.from('not-a-pe'))).toBeNull()
  })

  it('将 Mach-O 的 x86_64 名称归一为产品目标 x64', () => {
    expect(normalizeMacArchitecture('x86_64')).toBe('x64')
    expect(normalizeMacArchitecture('arm64')).toBe('arm64')
  })

  it('只将 Developer ID Application 证书视为可发行的 macOS 签名', () => {
    expect(classifyMacSignatureIdentity(null)).toBe('ad-hoc')
    expect(classifyMacSignatureIdentity('Apple Development: Developer Example')).toBe('signed-non-distribution')
    expect(classifyMacSignatureIdentity('Developer ID Application: Developer Example (TEAM123456)')).toBe('signed')
  })

  it('拒绝未使用的 macOS 隐私权限说明', () => {
    expect(() => assertNoUnexpectedMacUsageDescriptions({ CFBundleIdentifier: 'com.sonavi.desktop' })).not.toThrow()
    expect(() => assertNoUnexpectedMacUsageDescriptions({ NSCameraUsageDescription: 'unused' })).toThrow(
      'NSCameraUsageDescription'
    )
  })

  it('为安装包生成稳定 SHA-256', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-package-verifier-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'artifact.bin')
    const contents = Buffer.from('sonavi-p10')
    await writeFile(path, contents)
    await expect(sha256File(path)).resolves.toBe(createHash('sha256').update(contents).digest('hex'))
  })
})
