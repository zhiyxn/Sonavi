import { _electron as electron } from 'playwright-core'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'

const screenshotPath = resolve(
  process.env.SONAVI_SCREENSHOT_PATH ?? 'artifacts/screenshots/p02-current-platform.png'
)

const executablePath = process.env.SONAVI_EXECUTABLE_PATH
const electronApplication = await electron.launch(
  executablePath ? { executablePath, args: [] } : { args: ['.'] }
)
let fixtureServer

function fixtureResponse(endpoint) {
  const base = {
    status: 'ok',
    version: '1.16.1',
    type: 'fixture-server',
    serverVersion: '1.0.0',
    openSubsonic: true
  }

  if (endpoint === 'ping') return { 'subsonic-response': base }
  if (endpoint === 'getOpenSubsonicExtensions') {
    return {
      'subsonic-response': {
        ...base,
        openSubsonicExtensions: [{ name: 'songLyrics', versions: [1] }]
      }
    }
  }
  if (endpoint === 'getMusicFolders') {
    return {
      'subsonic-response': {
        ...base,
        musicFolders: { musicFolder: [{ id: 'fixture-folder', name: 'Fixture Music' }] }
      }
    }
  }
  return null
}

async function startFixtureServer() {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    const endpoint = requestUrl.pathname.match(/^\/sonavi-fixture\/rest\/(.+)\.view$/)?.[1]
    const salt = requestUrl.searchParams.get('s') ?? ''
    const expectedToken = createHash('md5').update(`fixture-password${salt}`, 'utf8').digest('hex')
    const validAuthentication =
      requestUrl.searchParams.get('u') === 'fixture-user' &&
      requestUrl.searchParams.get('t') === expectedToken &&
      !requestUrl.searchParams.has('p')
    const body = endpoint && validAuthentication ? fixtureResponse(endpoint) : null

    response.statusCode = body ? 200 : 401
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify(
        body ?? {
          'subsonic-response': {
            status: 'failed',
            version: '1.16.1',
            error: { code: 40, message: 'fixture authentication failed' }
          }
        }
      )
    )
  })

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  return server
}

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

  const bridgeShape = await window.evaluate(() => ({
    getInfo: typeof window.sonavi?.application?.getInfo,
    testConnection: typeof window.sonavi?.connection?.test,
    rendererProcess: typeof window.process
  }))
  if (
    bridgeShape.getInfo !== 'function' ||
    bridgeShape.testConnection !== 'function' ||
    bridgeShape.rendererProcess !== 'undefined'
  ) {
    throw new Error(`preload 安全边界冒烟失败：${JSON.stringify(bridgeShape)}`)
  }

  await mkdir(dirname(screenshotPath), { recursive: true })
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log(`Electron smoke passed: ${platformText.trim()}`)
  console.log(`Screenshot: ${screenshotPath}`)

  await window.getByRole('button', { name: '测试连接' }).click()
  await window.getByText('连接信息不完整或超出允许范围。').waitFor()
  console.log('Connection IPC passed: trusted sender + input validation + renderer result validation')

  fixtureServer = await startFixtureServer()
  const fixtureAddress = fixtureServer.address()
  if (!fixtureAddress || typeof fixtureAddress === 'string') {
    throw new Error('无法读取本地 OpenSubsonic fixture 端口')
  }
  await window.locator('#server-url').fill(`http://127.0.0.1:${fixtureAddress.port}/sonavi-fixture`)
  await window.locator('#username').fill('fixture-user')
  await window.locator('#password').fill('fixture-password')
  await window.locator('#allow-insecure-http').check()
  await window.getByRole('button', { name: '测试连接' }).click()
  await window
    .getByText('已连接 fixture-server，发现 1 个音乐文件夹。凭据仅用于本次会话。')
    .waitFor()
  if ((await window.locator('#password').inputValue()) !== '') {
    throw new Error('连接完成后密码输入框未清空')
  }
  console.log('OpenSubsonic integration passed: Electron Session + token auth + 3 fixed endpoints')

  const encryptionCheck = await electronApplication.evaluate(async ({ safeStorage }) => {
    const available = await safeStorage.isAsyncEncryptionAvailable()
    if (!available) return { available, roundTrip: false }

    const encrypted = await safeStorage.encryptStringAsync('sonavi-safe-storage-smoke')
    const decrypted = await safeStorage.decryptStringAsync(encrypted)
    return { available, roundTrip: decrypted.result === 'sonavi-safe-storage-smoke' }
  })
  if (encryptionCheck.available && !encryptionCheck.roundTrip) {
    throw new Error('safeStorage 加密往返验证失败')
  }
  console.log(
    encryptionCheck.available
      ? 'safeStorage passed: async encryption round-trip'
      : 'safeStorage unavailable: plaintext fallback remains disabled'
  )

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
  if (fixtureServer) {
    await new Promise((resolveClose, rejectClose) => {
      fixtureServer.close((error) => (error ? rejectClose(error) : resolveClose()))
    })
  }
}
