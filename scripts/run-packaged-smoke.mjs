import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { resolvePackagePaths } from './verify-package.mjs'

function run(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, options)
    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`打包应用 Electron 冒烟失败：${signal ? `信号 ${signal}` : `退出码 ${code}`}`))
    })
  })
}

async function main() {
  const targetName = process.argv[2]
  if (!targetName) throw new Error('缺少打包目标，例如 win-x64、mac-x64 或 mac-arm64')
  const projectRoot = process.cwd()
  const paths = await resolvePackagePaths(projectRoot, targetName)
  if (process.platform !== paths.target.platform || process.arch !== paths.target.architecture) {
    throw new Error(
      `打包应用必须在对应主机运行：当前 ${process.platform}/${process.arch}，目标 ${paths.target.platform}/${paths.target.architecture}`
    )
  }
  await access(paths.executablePath)

  const screenshotSuffix = targetName.replaceAll('-', '_')
  await run(process.execPath, [resolve(projectRoot, 'tests/e2e/electron-smoke.mjs')], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SONAVI_EXECUTABLE_PATH: paths.executablePath,
      SONAVI_SCREENSHOT_PATH: resolve(projectRoot, `artifacts/screenshots/p10-${screenshotSuffix}.png`),
      SONAVI_LYRICS_SCREENSHOT_PATH: resolve(projectRoot, `artifacts/screenshots/p10-${screenshotSuffix}-lyrics.png`),
      SONAVI_DIAGNOSTICS_SCREENSHOT_PATH: resolve(projectRoot, `artifacts/screenshots/p10-${screenshotSuffix}-diagnostics.png`),
      SONAVI_DESKTOP_SCREENSHOT_PATH: resolve(projectRoot, `artifacts/screenshots/p10-${screenshotSuffix}-desktop.png`)
    }
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
