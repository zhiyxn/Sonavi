import { _electron as electron } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const screenshotPath = resolve(
  process.env.SONAVI_SCREENSHOT_PATH ?? 'artifacts/screenshots/p01-current-platform.png'
)

const executablePath = process.env.SONAVI_EXECUTABLE_PATH
const electronApplication = await electron.launch(
  executablePath ? { executablePath, args: [] } : { args: ['.'] }
)

try {
  const window = await electronApplication.firstWindow()
  const runtimeMessages = []
  window.on('console', (message) => runtimeMessages.push(`console:${message.type()}:${message.text()}`))
  window.on('pageerror', (error) => runtimeMessages.push(`pageerror:${error.message}`))

  try {
    await window.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
  } catch (error) {
    await mkdir(dirname(screenshotPath), { recursive: true })
    await window.screenshot({ path: screenshotPath, fullPage: true })
    const url = window.url()
    const bodyText = await window.locator('body').innerText().catch(() => '<无法读取 body>')
    throw new Error(
      [String(error), `URL: ${url}`, `Body: ${bodyText}`, ...runtimeMessages].join('\n'),
      { cause: error }
    )
  }

  const platformText = await window.getByTestId('platform-label').textContent()
  if (!platformText?.includes('v0.1.0')) {
    throw new Error(`应用版本 IPC 冒烟失败：${platformText ?? '空文本'}`)
  }

  if ((await window.locator('[data-testid="fake-macos-controls"]').count()) !== 0) {
    throw new Error('检测到不应存在的伪 macOS 窗口按钮')
  }

  await mkdir(dirname(screenshotPath), { recursive: true })
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log(`Electron smoke passed: ${platformText.trim()}`)
  console.log(`Screenshot: ${screenshotPath}`)

  if (platformText.includes('macOS')) {
    await electronApplication.evaluate(async ({ BrowserWindow }) => {
      const activeWindow = BrowserWindow.getAllWindows()[0]
      if (!activeWindow) throw new Error('macOS 生命周期测试找不到活动窗口')

      await new Promise((resolveClosed) => {
        activeWindow.once('closed', resolveClosed)
        activeWindow.close()
      })
    })

    const remainingWindows = await electronApplication.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
    )
    if (remainingWindows !== 0) throw new Error('macOS 关闭窗口后仍残留 BrowserWindow')

    const reopenedWindowPromise = electronApplication.waitForEvent('window')
    await electronApplication.evaluate(({ app }) => app.emit('activate'))
    const reopenedWindow = await reopenedWindowPromise
    await reopenedWindow.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
    console.log('macOS lifecycle passed: close-window -> Dock activation -> recreate-window')
  }
} finally {
  await electronApplication.close()
}
