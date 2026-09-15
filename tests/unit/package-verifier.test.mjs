import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PACKAGE_TARGETS,
  assertNoUnexpectedMacUsageDescriptions,
  classifyMacSignatureIdentity,
  createWindowsSignatureInvocation,
  normalizeMacArchitecture,
  parsePeArchitecture,
  parsePeCertificateTable,
  readPeMetadata,
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

function createPeOptionalHeader({ signed = false } = {}) {
  const buffer = Buffer.alloc(240)
  buffer.writeUInt16LE(0x20b, 0)
  if (signed) {
    buffer.writeUInt32LE(4096, 144)
    buffer.writeUInt32LE(1024, 148)
  }
  return buffer
}

function createCompletePe({ signed = false } = {}) {
  const buffer = Buffer.alloc(8192)
  buffer.write('MZ', 0, 'ascii')
  buffer.writeUInt32LE(128, 0x3c)
  buffer.write('PE\0\0', 128, 'ascii')
  buffer.writeUInt16LE(0x8664, 132)
  buffer.writeUInt16LE(240, 148)
  createPeOptionalHeader({ signed }).copy(buffer, 152)
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

  it('直接从 PE Certificate Table 区分有无 Authenticode 数据', () => {
    expect(parsePeCertificateTable(createPeOptionalHeader())).toBeNull()
    expect(parsePeCertificateTable(createPeOptionalHeader({ signed: true }))).toEqual({
      fileOffset: 4096,
      size: 1024
    })
  })

  it('增量读取 PE 架构和签名目录，不需要把整个 EXE 载入内存', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonavi-pe-verifier-'))
    temporaryDirectories.push(directory)
    const unsignedPath = join(directory, 'unsigned.exe')
    const signedPath = join(directory, 'signed.exe')
    await writeFile(unsignedPath, createCompletePe())
    await writeFile(signedPath, createCompletePe({ signed: true }))

    await expect(readPeMetadata(unsignedPath)).resolves.toEqual({
      architecture: 'x64',
      certificateTable: null
    })
    await expect(readPeMetadata(signedPath)).resolves.toEqual({
      architecture: 'x64',
      certificateTable: { fileOffset: 4096, size: 1024 }
    })
  })

  it('通过环境变量传递 Windows 路径，不把路径拼到 PowerShell 命令尾部', () => {
    const executablePath = 'D:\\a\\Sonavi project\\Sonavi.exe'
    const invocation = createWindowsSignatureInvocation(executablePath)
    expect(invocation.args).not.toContain(executablePath)
    expect(invocation.args.at(-1)).toContain('$env:SONAVI_SIGNATURE_PATH')
    expect(invocation.options.env.SONAVI_SIGNATURE_PATH).toBe(executablePath)
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
