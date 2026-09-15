import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PACKAGE_TARGETS, sha256File } from './verify-package.mjs'

const PRODUCT_NAME = 'Sonavi'

function fail(message) {
  throw new Error(`发布准备失败：${message}`)
}

export function validateReleaseTag(tag, version) {
  if (!/^\d+\.\d+\.\d+-rc\.\d+$/.test(version)) {
    fail(`package.json 版本 ${version} 不是 x.y.z-rc.n 候选版本`)
  }
  const expectedTag = `v${version}`
  if (tag !== expectedTag) fail(`标签为 ${tag || '空'}，预期 ${expectedTag}`)
  return expectedTag
}

export function getReleaseAssetNames(version) {
  return Object.entries(PACKAGE_TARGETS).flatMap(([targetName, target]) => [
    `${PRODUCT_NAME}-${version}-${target.artifactOs}-${target.architecture}.${target.extension}`,
    `${PRODUCT_NAME}-${version}-${targetName}.manifest.json`
  ])
}

async function readProjectVersion(projectRoot) {
  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    fail('package.json 缺少版本号')
  }
  return packageJson.version
}

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...await findFiles(path))
    else if (entry.isFile()) paths.push(path)
  }
  return paths
}

export async function collectReleaseAssets(projectRoot, sourceDirectory, outputDirectory) {
  const root = resolve(projectRoot)
  const source = resolve(root, sourceDirectory)
  const output = resolve(root, outputDirectory)
  const version = await readProjectVersion(root)
  const expectedNames = getReleaseAssetNames(version)
  const sourceFiles = await findFiles(source)
  await mkdir(output, { recursive: true })

  for (const expectedName of expectedNames) {
    const matches = sourceFiles.filter((path) => basename(path) === expectedName)
    if (matches.length !== 1) {
      fail(`${expectedName} 应恰好出现一次，实际 ${matches.length} 次`)
    }
    await copyFile(matches[0], join(output, expectedName))
  }

  const checksumLines = []
  for (const name of [...expectedNames].sort()) {
    checksumLines.push(`${await sha256File(join(output, name))}  ${name}`)
  }
  const checksumPath = join(output, 'SHA256SUMS.txt')
  await writeFile(checksumPath, `${checksumLines.join('\n')}\n`, { mode: 0o600 })
  return { version, assets: expectedNames, checksumPath }
}

async function main() {
  const [command, firstArgument, secondArgument] = process.argv.slice(2)
  if (command === 'validate-tag') {
    const version = await readProjectVersion(process.cwd())
    console.log(`发布标签校验通过：${validateReleaseTag(process.env.SONAVI_RELEASE_TAG, version)}`)
    return
  }
  if (command === 'collect' && firstArgument && secondArgument) {
    const result = await collectReleaseAssets(process.cwd(), firstArgument, secondArgument)
    console.log(`已准备 Sonavi ${result.version} 的 ${result.assets.length} 个文件与 SHA-256 清单`)
    return
  }
  fail('用法：prepare-release.mjs validate-tag | collect <来源目录> <输出目录>')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
