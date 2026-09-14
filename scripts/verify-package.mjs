import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PRODUCT_NAME = 'Sonavi'
const APP_ID = 'com.sonavi.desktop'
const MACOS_MINIMUM_VERSION = '13.0'
const MAXIMUM_ASAR_BYTES = 16 * 1024 * 1024
const UNEXPECTED_MAC_USAGE_DESCRIPTIONS = [
  'NSAudioCaptureUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription'
]

export const PACKAGE_TARGETS = Object.freeze({
  'win-x64': Object.freeze({
    platform: 'win32',
    architecture: 'x64',
    artifactOs: 'win',
    extension: 'exe',
    unpackedDirectory: 'win-unpacked',
    executableParts: [`${PRODUCT_NAME}.exe`]
  }),
  'mac-x64': Object.freeze({
    platform: 'darwin',
    architecture: 'x64',
    artifactOs: 'mac',
    extension: 'dmg',
    unpackedDirectory: 'mac',
    executableParts: [`${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME]
  }),
  'mac-arm64': Object.freeze({
    platform: 'darwin',
    architecture: 'arm64',
    artifactOs: 'mac',
    extension: 'dmg',
    unpackedDirectory: 'mac-arm64',
    executableParts: [`${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME]
  })
})

function fail(message) {
  throw new Error(`包验证失败：${message}`)
}

async function assertFile(path, label) {
  try {
    await access(path)
  } catch {
    fail(`${label}不存在：${path}`)
  }
  const details = await stat(path)
  if (!details.isFile() || details.size === 0) fail(`${label}不是有效文件：${path}`)
  return details
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return {
    status: result.status,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    error: result.error
  }
}

export function parsePeArchitecture(buffer) {
  if (buffer.length < 64 || buffer.toString('ascii', 0, 2) !== 'MZ') return null
  const peOffset = buffer.readUInt32LE(0x3c)
  if (peOffset + 6 > buffer.length || buffer.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
    return null
  }
  const machine = buffer.readUInt16LE(peOffset + 4)
  if (machine === 0x8664) return 'x64'
  if (machine === 0xaa64) return 'arm64'
  if (machine === 0x014c) return 'ia32'
  return `unknown-0x${machine.toString(16)}`
}

export function normalizeMacArchitecture(architecture) {
  return architecture === 'x86_64' ? 'x64' : architecture
}

export function classifyMacSignatureIdentity(identity) {
  if (!identity) return 'ad-hoc'
  return identity.startsWith('Developer ID Application:') ? 'signed' : 'signed-non-distribution'
}

export function assertNoUnexpectedMacUsageDescriptions(info) {
  const present = UNEXPECTED_MAC_USAGE_DESCRIPTIONS.filter((key) => key in info)
  if (present.length > 0) fail(`Info.plist 含未使用的系统权限说明：${present.join('、')}`)
}

export async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function readPeArchitecture(path) {
  const handle = await open(path, 'r')
  try {
    const dosHeader = Buffer.alloc(64)
    const dosRead = await handle.read(dosHeader, 0, dosHeader.length, 0)
    if (dosRead.bytesRead !== dosHeader.length || dosHeader.toString('ascii', 0, 2) !== 'MZ') {
      return null
    }
    const peOffset = dosHeader.readUInt32LE(0x3c)
    if (peOffset < 64 || peOffset > 1024 * 1024) return null
    const peHeader = Buffer.alloc(6)
    const peRead = await handle.read(peHeader, 0, peHeader.length, peOffset)
    if (peRead.bytesRead !== peHeader.length || peHeader.toString('ascii', 0, 4) !== 'PE\0\0') {
      return null
    }
    const machine = peHeader.readUInt16LE(4)
    if (machine === 0x8664) return 'x64'
    if (machine === 0xaa64) return 'arm64'
    if (machine === 0x014c) return 'ia32'
    return `unknown-0x${machine.toString(16)}`
  } finally {
    await handle.close()
  }
}

export async function resolvePackagePaths(projectRoot, targetName) {
  const target = PACKAGE_TARGETS[targetName]
  if (!target) fail(`未知目标 ${targetName}，可选值：${Object.keys(PACKAGE_TARGETS).join('、')}`)

  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const version = packageJson.version
  if (typeof version !== 'string' || version.length === 0) fail('package.json 缺少版本号')

  const releaseDirectory = join(projectRoot, 'release', version)
  const artifactName = `${PRODUCT_NAME}-${version}-${target.artifactOs}-${target.architecture}.${target.extension}`
  const unpackedDirectory = join(releaseDirectory, target.unpackedDirectory)
  const executablePath = join(unpackedDirectory, ...target.executableParts)
  const appBundlePath = target.platform === 'darwin'
    ? join(unpackedDirectory, `${PRODUCT_NAME}.app`)
    : null
  const resourcesDirectory = target.platform === 'darwin'
    ? join(appBundlePath, 'Contents', 'Resources')
    : join(unpackedDirectory, 'resources')

  return {
    target,
    targetName,
    version,
    releaseDirectory,
    artifactPath: join(releaseDirectory, artifactName),
    unpackedDirectory,
    executablePath,
    appBundlePath,
    resourcesDirectory
  }
}

function inspectMacSignature(appBundlePath) {
  const details = run('/usr/bin/codesign', ['-dv', '--verbose=4', appBundlePath])
  const output = `${details.stdout}\n${details.stderr}`
  if (details.status !== 0 && output.includes('code object is not signed at all')) {
    return { status: 'unsigned', identity: null, teamIdentifier: null }
  }
  if (details.error || details.status !== 0) {
    fail(`无法确认 macOS 签名状态：${details.error?.message ?? output}`)
  }

  const identity = output.match(/^Authority=(.+)$/m)?.[1] ?? null
  const teamIdentifier = output.match(/^TeamIdentifier=(.+)$/m)?.[1] ?? null
  const verification = run('/usr/bin/codesign', ['--verify', '--deep', '--strict', appBundlePath])
  if (verification.status !== 0) fail(`macOS 签名校验失败：${verification.stderr}`)
  return {
    status: classifyMacSignatureIdentity(identity),
    identity,
    teamIdentifier: teamIdentifier === 'not set' ? null : teamIdentifier
  }
}

function inspectWindowsSignature(executablePath) {
  const script = [
    '$signature = Get-AuthenticodeSignature -LiteralPath $args[0]',
    '[pscustomobject]@{ Status = [string]$signature.Status; Subject = $signature.SignerCertificate.Subject } | ConvertTo-Json -Compress'
  ].join('; ')
  const details = run('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script,
    executablePath
  ])
  if (details.error || details.status !== 0) {
    fail(`无法确认 Windows 签名状态：${details.error?.message ?? details.stderr}`)
  }
  const signature = JSON.parse(details.stdout)
  return {
    status: signature.Status === 'Valid' ? 'signed' : String(signature.Status).toLowerCase(),
    identity: signature.Subject ?? null,
    teamIdentifier: null
  }
}

async function inspectMacPackage(paths) {
  if (process.platform !== 'darwin') fail('macOS 包元数据必须在 macOS 主机验证')
  if (!paths.appBundlePath) fail('macOS 应用包路径缺失')

  const infoPath = join(paths.appBundlePath, 'Contents', 'Info.plist')
  await assertFile(infoPath, 'Info.plist')
  const plist = run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', infoPath])
  if (plist.error || plist.status !== 0) fail(`Info.plist 无法解析：${plist.error?.message ?? plist.stderr}`)
  const info = JSON.parse(plist.stdout)
  if (info.CFBundleIdentifier !== APP_ID) fail(`应用标识为 ${info.CFBundleIdentifier ?? '空'}`)
  if (info.CFBundleShortVersionString !== paths.version) {
    fail(`应用版本为 ${info.CFBundleShortVersionString ?? '空'}，预期 ${paths.version}`)
  }
  if (info.LSMinimumSystemVersion !== MACOS_MINIMUM_VERSION) {
    fail(`macOS 最低版本为 ${info.LSMinimumSystemVersion ?? '空'}，预期 ${MACOS_MINIMUM_VERSION}`)
  }
  assertNoUnexpectedMacUsageDescriptions(info)

  const architectures = run('/usr/bin/lipo', ['-archs', paths.executablePath])
  if (architectures.error || architectures.status !== 0) {
    fail(`无法读取 Mach-O 架构：${architectures.error?.message ?? architectures.stderr}`)
  }
  const architectureList = architectures.stdout
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeMacArchitecture)
  if (architectureList.length !== 1 || architectureList[0] !== paths.target.architecture) {
    fail(`Mach-O 架构为 ${architectureList.join(', ') || '空'}，预期仅 ${paths.target.architecture}`)
  }
  const imageInfo = run('/usr/bin/hdiutil', ['imageinfo', paths.artifactPath])
  if (imageInfo.error || imageInfo.status !== 0) fail(`DMG 结构检查失败：${imageInfo.error?.message ?? imageInfo.stderr}`)

  return {
    architecture: architectureList[0],
    appId: info.CFBundleIdentifier,
    appVersion: info.CFBundleShortVersionString,
    minimumSystemVersion: info.LSMinimumSystemVersion,
    signature: inspectMacSignature(paths.appBundlePath)
  }
}

async function inspectWindowsPackage(paths) {
  if (process.platform !== 'win32') fail('Windows 包元数据必须在 Windows 主机验证')
  const architecture = await readPeArchitecture(paths.executablePath)
  if (architecture !== paths.target.architecture) {
    fail(`Windows 可执行文件架构为 ${architecture ?? '未知'}，预期 ${paths.target.architecture}`)
  }
  return {
    architecture,
    appId: APP_ID,
    appVersion: paths.version,
    minimumSystemVersion: 'Windows 11',
    signature: inspectWindowsSignature(paths.executablePath)
  }
}

export async function verifyPackage(projectRoot, targetName) {
  const root = resolve(projectRoot)
  const paths = await resolvePackagePaths(root, targetName)
  const artifact = await assertFile(paths.artifactPath, '安装包')
  await assertFile(paths.executablePath, '应用可执行文件')
  const asar = await assertFile(join(paths.resourcesDirectory, 'app.asar'), '应用 ASAR')
  if (asar.size > MAXIMUM_ASAR_BYTES) {
    fail(`应用 ASAR 为 ${asar.size} 字节，疑似携带构建期依赖（上限 ${MAXIMUM_ASAR_BYTES}）`)
  }
  await assertFile(join(paths.resourcesDirectory, 'icon.png'), '运行时图标')

  const platformDetails = paths.target.platform === 'darwin'
    ? await inspectMacPackage(paths)
    : await inspectWindowsPackage(paths)
  const requireSigning = process.env.SONAVI_REQUIRE_SIGNING === '1'
  if (requireSigning && platformDetails.signature.status !== 'signed') {
    fail(`SONAVI_REQUIRE_SIGNING=1，但签名状态为 ${platformDetails.signature.status}`)
  }

  const manifest = {
    schemaVersion: 1,
    productName: PRODUCT_NAME,
    version: paths.version,
    target: targetName,
    verifiedAt: new Date().toISOString(),
    verificationHost: { platform: process.platform, architecture: process.arch },
    artifact: {
      path: relative(root, paths.artifactPath),
      bytes: artifact.size,
      sha256: await sha256File(paths.artifactPath)
    },
    application: {
      path: relative(root, paths.executablePath),
      ...platformDetails,
      resources: ['app.asar', 'icon.png'],
      asarBytes: asar.size
    }
  }
  await mkdir(dirname(paths.artifactPath), { recursive: true })
  const manifestPath = join(paths.releaseDirectory, `${PRODUCT_NAME}-${paths.version}-${targetName}.manifest.json`)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  return { manifest, manifestPath, paths }
}

async function main() {
  const targetName = process.argv[2]
  if (!targetName) fail(`缺少目标，可选值：${Object.keys(PACKAGE_TARGETS).join('、')}`)
  const result = await verifyPackage(process.cwd(), targetName)
  console.log(JSON.stringify(result.manifest, null, 2))
  console.log(`包验证清单：${result.manifestPath}`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

export const verifyPackageScriptPath = fileURLToPath(import.meta.url)
