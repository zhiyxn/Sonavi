import { _electron as electron } from 'playwright-core'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const applicationStartedAt = performance.now()

const screenshotPath = resolve(
  process.env.SONAVI_SCREENSHOT_PATH ?? 'artifacts/screenshots/p08-current-platform.png'
)
const lyricsScreenshotPath = resolve(
  process.env.SONAVI_LYRICS_SCREENSHOT_PATH ??
    'artifacts/screenshots/p07-lyrics-current-platform.png'
)
const diagnosticsScreenshotPath = resolve(
  process.env.SONAVI_DIAGNOSTICS_SCREENSHOT_PATH ??
    'artifacts/screenshots/p08-diagnostics-current-platform.png'
)
const desktopScreenshotPath = resolve(
  process.env.SONAVI_DESKTOP_SCREENSHOT_PATH ??
    'artifacts/screenshots/p09-desktop-current-platform.png'
)

const executablePath = process.env.SONAVI_EXECUTABLE_PATH
const userDataPath = await mkdtemp(join(tmpdir(), 'sonavi-e2e-user-data-'))
const launchApplication = () =>
  electron.launch(
    executablePath
      ? { executablePath, args: [`--user-data-dir=${userDataPath}`] }
      : { args: ['.', `--user-data-dir=${userDataPath}`] }
  )
let electronApplication = await launchApplication()
let fixtureServer
const mediaRequests = []
const playbackRequests = []
const fixtureAlbums = [
  {
    id: 'fixture-album',
    name: '石与琥珀',
    artist: 'Sonavi Fixture',
    songCount: 3,
    duration: 12,
    coverArt: 'fixture-cover'
  },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `fixture-album-${index + 2}`,
    name: `分页专辑 ${index + 2}`,
    artist: 'Sonavi Fixture',
    songCount: 1,
    duration: 4
  }))
]
const fixtureTracks = [
  {
    id: 'fixture-track',
    title: '跨平台试音',
    artist: 'Sonavi Fixture',
    album: '石与琥珀',
    duration: 4,
    track: 1,
    contentType: 'audio/wav',
    coverArt: 'fixture-cover'
  },
  {
    id: 'fixture-track-2',
    title: '队列下一首',
    artist: 'Sonavi Fixture',
    album: '石与琥珀',
    duration: 4,
    track: 2,
    contentType: 'audio/wav',
    coverArt: 'fixture-cover'
  },
  {
    id: 'fixture-track-3',
    title: '循环终点',
    artist: 'Sonavi Fixture',
    album: '石与琥珀',
    duration: 4,
    track: 3,
    contentType: 'audio/wav',
    coverArt: 'fixture-cover'
  }
]
const starredTrackIds = new Set(['fixture-track'])
const starredAlbumIds = new Set()
const starredArtistIds = new Set()
let playlistSequence = 2
const fixturePlaylists = [
  {
    id: 'fixture-playlist-1',
    name: '现有歌单',
    owner: 'fixture-user',
    public: false,
    songIds: ['fixture-track', 'fixture-track']
  }
]

async function waitForCondition(condition, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
  }
  throw new Error(message)
}

async function launchDuplicateInstance() {
  const duplicateExecutable =
    executablePath ?? (await electronApplication.evaluate(({ app }) => app.getPath('exe')))
  const duplicateArguments = executablePath
    ? [`--user-data-dir=${userDataPath}`]
    : ['.', `--user-data-dir=${userDataPath}`]

  await new Promise((resolveDuplicate, rejectDuplicate) => {
    const duplicate = spawn(duplicateExecutable, duplicateArguments, {
      cwd: resolve('.'),
      stdio: 'ignore',
      windowsHide: true
    })
    const timeout = setTimeout(() => {
      duplicate.kill()
      rejectDuplicate(new Error('重复启动的后续进程没有在单实例锁检查后退出'))
    }, 10_000)
    duplicate.once('error', (error) => {
      clearTimeout(timeout)
      rejectDuplicate(error)
    })
    duplicate.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0 && signal === null) resolveDuplicate()
      else rejectDuplicate(new Error(`重复启动进程异常退出：code=${code}, signal=${signal}`))
    })
  })
}

async function chooseSelectOption(page, label, option) {
  const trigger = page.getByRole('combobox', { name: label, exact: true })
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await waitForCondition(
    async () => (await trigger.textContent())?.includes(option),
    `${label} 未更新为 ${option}`
  )
}

async function setSliderValue(page, label, value, step) {
  const slider = page.getByRole('slider', { name: label, exact: true })
  const maximum = Number(await slider.getAttribute('aria-valuemax'))
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new Error(`${label} 无法取得有效轨道范围`)
  }
  const pageStep = step * 10
  const pageIncrements = Math.floor(value / pageStep)
  const remainingIncrements = Math.round((value - pageIncrements * pageStep) / step)
  await slider.focus()
  await slider.press('Home')
  for (let index = 0; index < pageIncrements; index += 1) await slider.press('PageUp')
  for (let index = 0; index < remainingIncrements; index += 1) await slider.press('ArrowRight')
  await page.waitForTimeout(100)
  const actual = Number(await slider.getAttribute('aria-valuenow'))
  if (actual < value - step / 2 || actual > value + 0.5) {
    throw new Error(`${label} 未更新到 ${value}，实际为 ${actual}`)
  }
}

async function assertSliderAlignment(page, label) {
  const slider = page.getByRole('slider', { name: label, exact: true })
  const layout = await slider.evaluate((thumb) => {
    const root = thumb.closest('[data-slot="slider"]')
    const track = root?.querySelector('[data-slot="slider-track"]')
    const rootView = root?.ownerDocument.defaultView
    if (!root || !track || !rootView) return null

    const thumbBox = thumb.getBoundingClientRect()
    const trackBox = track.getBoundingClientRect()
    return {
      rootDisplay: rootView.getComputedStyle(root).display,
      centerDelta: Math.abs(
        thumbBox.top + thumbBox.height / 2 - (trackBox.top + trackBox.height / 2)
      )
    }
  })

  if (!layout || layout.rootDisplay !== 'flex' || layout.centerDelta > 1) {
    throw new Error(`${label} 与轨道错位：${JSON.stringify(layout)}`)
  }
}

async function assertPlayerControlsCentered(page) {
  const layout = await page.locator('footer[aria-label="播放器"]').evaluate((footer) => {
    const controls = footer.querySelector('.player-controls')
    if (!controls) return null

    const footerBox = footer.getBoundingClientRect()
    const controlsBox = controls.getBoundingClientRect()
    return Math.abs(
      controlsBox.left + controlsBox.width / 2 - (footerBox.left + footerBox.width / 2)
    )
  })

  if (layout === null || layout > 1) {
    throw new Error(`播放控制区未水平居中，中心偏差 ${layout ?? '未知'}px`)
  }
}

function playlistPayload(playlist) {
  const entries = playlist.songIds
    .map((songId) => fixtureTracks.find((track) => track.id === songId))
    .filter(Boolean)
    .map((track) => ({ ...track, ...(starredTrackIds.has(track.id) ? { starred: '2026-09-14' } : {}) }))
  return {
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner,
    public: playlist.public,
    songCount: entries.length,
    duration: entries.reduce((total, track) => total + track.duration, 0),
    entry: entries
  }
}

function createSyntheticWav() {
  const sampleRate = 8_000
  const sampleCount = sampleRate * 4
  const dataSize = sampleCount * 2
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 220) * 2_400)
    wav.writeInt16LE(sample, 44 + index * 2)
  }
  return wav
}

const syntheticWav = createSyntheticWav()
const coverPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

function fixtureResponse(endpoint, requestUrl) {
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
        openSubsonicExtensions: [
          { name: 'songLyrics', versions: [1] },
          { name: 'transcodeOffset', versions: [1] }
        ]
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
  if (endpoint === 'getAlbumList2') {
    const offset = Number(requestUrl.searchParams.get('offset') ?? 0)
    const size = Number(requestUrl.searchParams.get('size') ?? 10)
    return {
      'subsonic-response': {
        ...base,
        albumList2: {
          album: fixtureAlbums.slice(offset, offset + size)
        }
      }
    }
  }
  if (endpoint === 'getAlbum') {
    return {
      'subsonic-response': {
        ...base,
        album: {
          id: 'fixture-album',
          name: '石与琥珀',
          artist: 'Sonavi Fixture',
          songCount: 3,
          duration: 12,
          coverArt: 'fixture-cover',
          ...(starredAlbumIds.has('fixture-album') ? { starred: '2026-09-14' } : {}),
          song: fixtureTracks.map((track) => ({
            ...track,
            ...(starredTrackIds.has(track.id) ? { starred: '2026-09-14' } : {})
          }))
        }
      }
    }
  }
  if (endpoint === 'getArtists') {
    return {
      'subsonic-response': {
        ...base,
        artists: {
          index: [
            {
              name: 'S',
              artist: [
                {
                  id: 'fixture-artist',
                  name: 'Sonavi Fixture',
                  albumCount: fixtureAlbums.length,
                  coverArt: 'fixture-cover',
                  ...(starredArtistIds.has('fixture-artist') ? { starred: '2026-09-14' } : {})
                }
              ]
            }
          ]
        }
      }
    }
  }
  if (endpoint === 'getArtist') {
    return {
      'subsonic-response': {
        ...base,
        artist: {
          id: 'fixture-artist',
          name: 'Sonavi Fixture',
          albumCount: fixtureAlbums.length,
          coverArt: 'fixture-cover',
          ...(starredArtistIds.has('fixture-artist') ? { starred: '2026-09-14' } : {}),
          album: fixtureAlbums
        }
      }
    }
  }
  if (endpoint === 'search3') {
    return {
      'subsonic-response': {
        ...base,
        searchResult3: {
          artist: [{ id: 'fixture-artist', name: 'Sonavi Fixture', albumCount: 31 }],
          album: [fixtureAlbums[0]],
          song: [
            {
              ...fixtureTracks[0],
              ...(starredTrackIds.has('fixture-track') ? { starred: '2026-09-14' } : {})
            }
          ]
        }
      }
    }
  }
  if (endpoint === 'getLyricsBySongId') {
    return {
      'subsonic-response': {
        ...base,
        lyricsList: {
          structuredLyrics: [
            {
              displayArtist: 'Sonavi Fixture',
              displayTitle: '跨平台试音',
              lang: 'zho',
              offset: 0,
              synced: true,
              line: [
                { start: 0, value: '歌词第一行' },
                { start: 1000, value: '歌词第二行' },
                { start: 3000, value: '歌词第三行' }
              ]
            }
          ]
        }
      }
    }
  }
  if (endpoint === 'scrobble') {
    playbackRequests.push({
      id: requestUrl.searchParams.get('id'),
      submission: requestUrl.searchParams.get('submission'),
      time: requestUrl.searchParams.get('time')
    })
    return { 'subsonic-response': base }
  }
  if (endpoint === 'getStarred2') {
    return {
      'subsonic-response': {
        ...base,
        starred2: {
          artist: starredArtistIds.has('fixture-artist')
            ? [{ id: 'fixture-artist', name: 'Sonavi Fixture', albumCount: fixtureAlbums.length, coverArt: 'fixture-cover', starred: '2026-09-14' }]
            : [],
          album: fixtureAlbums
            .filter((album) => starredAlbumIds.has(album.id))
            .map((album) => ({ ...album, starred: '2026-09-14' })),
          song: fixtureTracks
            .filter((track) => starredTrackIds.has(track.id))
            .map((track) => ({ ...track, starred: '2026-09-14' }))
        }
      }
    }
  }
  if (endpoint === 'star' || endpoint === 'unstar') {
    const collection = requestUrl.searchParams.has('albumId')
      ? starredAlbumIds
      : requestUrl.searchParams.has('artistId')
        ? starredArtistIds
        : starredTrackIds
    const id =
      requestUrl.searchParams.get('albumId') ??
      requestUrl.searchParams.get('artistId') ??
      requestUrl.searchParams.get('id')
    if (id) {
      if (endpoint === 'star') collection.add(id)
      else collection.delete(id)
    }
    return { 'subsonic-response': base }
  }
  if (endpoint === 'getPlaylists') {
    return {
      'subsonic-response': {
        ...base,
        playlists: {
          playlist: fixturePlaylists.map(({ songIds: _songIds, ...playlist }) => ({
            ...playlist,
            songCount: _songIds.length,
            duration: _songIds.length * 4
          }))
        }
      }
    }
  }
  if (endpoint === 'getPlaylist') {
    const playlist = fixturePlaylists.find((item) => item.id === requestUrl.searchParams.get('id'))
    return playlist
      ? { 'subsonic-response': { ...base, playlist: playlistPayload(playlist) } }
      : null
  }
  if (endpoint === 'createPlaylist') {
    fixturePlaylists.push({
      id: `fixture-playlist-${playlistSequence++}`,
      name: requestUrl.searchParams.get('name') ?? '未命名歌单',
      owner: 'fixture-user',
      public: false,
      songIds: requestUrl.searchParams.getAll('songId')
    })
    return { 'subsonic-response': base }
  }
  if (endpoint === 'updatePlaylist') {
    const playlist = fixturePlaylists.find(
      (item) => item.id === requestUrl.searchParams.get('playlistId')
    )
    if (!playlist) return null
    if (requestUrl.searchParams.has('name')) playlist.name = requestUrl.searchParams.get('name') ?? playlist.name
    if (requestUrl.searchParams.has('public')) playlist.public = requestUrl.searchParams.get('public') === 'true'
    playlist.songIds.push(...requestUrl.searchParams.getAll('songIdToAdd'))
    const removals = requestUrl.searchParams
      .getAll('songIndexToRemove')
      .map(Number)
      .sort((left, right) => right - left)
    for (const index of removals) playlist.songIds.splice(index, 1)
    return { 'subsonic-response': base }
  }
  if (endpoint === 'deletePlaylist') {
    const index = fixturePlaylists.findIndex((item) => item.id === requestUrl.searchParams.get('id'))
    if (index < 0) return null
    fixturePlaylists.splice(index, 1)
    return { 'subsonic-response': base }
  }
  return null
}

function sendMedia(request, response, body, contentType) {
  const range = request.headers.range
  mediaRequests.push({ path: request.url, range: range ?? null })
  response.setHeader('accept-ranges', 'bytes')
  response.setHeader('content-type', contentType)

  if (!range) {
    response.statusCode = 200
    response.setHeader('content-length', body.length)
    response.end(body)
    return
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match) {
    response.statusCode = 416
    response.setHeader('content-range', `bytes */${body.length}`)
    response.end()
    return
  }

  const requestedStart = match[1] ? Number(match[1]) : null
  const requestedEnd = match[2] ? Number(match[2]) : null
  const start = requestedStart ?? Math.max(0, body.length - (requestedEnd ?? body.length))
  const end = Math.min(requestedEnd ?? body.length - 1, body.length - 1)
  if (start >= body.length || start > end) {
    response.statusCode = 416
    response.setHeader('content-range', `bytes */${body.length}`)
    response.end()
    return
  }

  const chunk = body.subarray(start, end + 1)
  response.statusCode = 206
  response.setHeader('content-range', `bytes ${start}-${end}/${body.length}`)
  response.setHeader('content-length', chunk.length)
  response.end(chunk)
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
    if (endpoint === 'stream' && validAuthentication) {
      sendMedia(request, response, syntheticWav, 'audio/wav')
      return
    }
    if (endpoint === 'getCoverArt' && validAuthentication) {
      sendMedia(request, response, coverPng, 'image/png')
      return
    }

    const body = endpoint && validAuthentication ? fixtureResponse(endpoint, requestUrl) : null

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
  let window = await electronApplication.firstWindow()
  const runtimeMessages = []
  window.on('console', (message) => runtimeMessages.push(`console:${message.type()}:${message.text()}`))
  window.on('pageerror', (error) => runtimeMessages.push(`pageerror:${error.message}`))

  const logoLoaded = await window.locator('img.brand-logo').evaluate(
    (image) => 'complete' in image && 'naturalWidth' in image && image.complete && image.naturalWidth > 0
  )
  if (!logoLoaded) throw new Error('Sonavi logo asset did not load')
  await window
    .getByRole('button', { name: '在浏览器中打开 Sonavi GitHub 仓库', exact: true })
    .waitFor()

  try {
    await window.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
    console.log(`P09 startup measurement: ${(performance.now() - applicationStartedAt).toFixed(0)} ms to connection UI`)
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

  await Promise.all([
    assertSliderAlignment(window, '播放进度'),
    assertSliderAlignment(window, '音量')
  ])
  await assertPlayerControlsCentered(window)
  console.log('Player slider layout passed: progress and volume thumbs are track-aligned')

  const platformText = await window.getByTestId('platform-label').textContent()
  if (!platformText?.includes('v0.1.0')) {
    throw new Error(`应用版本 IPC 冒烟失败：${platformText ?? '空文本'}`)
  }

  if ((await window.locator('[data-testid="fake-macos-controls"]').count()) !== 0) {
    throw new Error('检测到不应存在的伪 macOS 窗口按钮')
  }

  const securityPreferences = await electronApplication.evaluate(({ BrowserWindow }) => {
    const activeWindow = BrowserWindow.getAllWindows()[0]
    return activeWindow?.webContents.getLastWebPreferences()
  })
  if (
    securityPreferences?.contextIsolation !== true ||
    securityPreferences.sandbox !== true ||
    securityPreferences.nodeIntegration !== false ||
    securityPreferences.webSecurity !== true ||
    securityPreferences.webviewTag !== false ||
    securityPreferences.allowRunningInsecureContent !== false ||
    securityPreferences.navigateOnDragDrop === true
  ) {
    throw new Error(`BrowserWindow 安全偏好不符合约束：${JSON.stringify(securityPreferences)}`)
  }
  const csp = await window
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  if (
    !csp?.includes("default-src 'none'") ||
    !csp.includes("frame-ancestors 'none'") ||
    csp.includes('ws://localhost')
  ) {
    throw new Error(`CSP 默认拒绝策略缺失：${csp ?? '空'}`)
  }

  const bridgeShape = await window.evaluate(() => ({
    getInfo: typeof window.sonavi?.application?.getInfo,
    testConnection: typeof window.sonavi?.connection?.test,
    restoreConnection: typeof window.sonavi?.connection?.restore,
    disconnectConnection: typeof window.sonavi?.connection?.disconnect,
    forgetConnection: typeof window.sonavi?.connection?.forget,
    listAlbums: typeof window.sonavi?.library?.listAlbums,
    getAlbum: typeof window.sonavi?.library?.getAlbum,
    listArtists: typeof window.sonavi?.library?.listArtists,
    getArtist: typeof window.sonavi?.library?.getArtist,
    search: typeof window.sonavi?.library?.search,
    cancelSearch: typeof window.sonavi?.library?.cancelSearch,
    getLyrics: typeof window.sonavi?.playback?.getLyrics,
    reportPlayback: typeof window.sonavi?.playback?.report,
    getNetworkSettings: typeof window.sonavi?.network?.getSettings,
    updateNetworkSettings: typeof window.sonavi?.network?.updateSettings,
    listNetworkDiagnostics: typeof window.sonavi?.network?.listDiagnostics,
    exportNetworkDiagnostics: typeof window.sonavi?.network?.exportDiagnostics,
    createTranscodeSeek: typeof window.sonavi?.network?.createTranscodeSeek,
    getDesktopPreferences: typeof window.sonavi?.desktop?.getPreferences,
    updateDesktopPreferences: typeof window.sonavi?.desktop?.updatePreferences,
    updatePlaybackStatus: typeof window.sonavi?.desktop?.updatePlaybackStatus,
    onDesktopCommand: typeof window.sonavi?.desktop?.onCommand,
    savePausedQueue: typeof window.sonavi?.desktop?.savePausedQueue,
    restorePausedQueue: typeof window.sonavi?.desktop?.restorePausedQueue,
    refreshQueuePlayback: typeof window.sonavi?.desktop?.refreshQueuePlayback,
    completeQuitPreparation: typeof window.sonavi?.desktop?.completeQuitPreparation,
    getCoverCacheInfo: typeof window.sonavi?.desktop?.getCoverCacheInfo,
    clearCoverCache: typeof window.sonavi?.desktop?.clearCoverCache,
    rendererProcess: typeof window.process
  }))
  if (
    bridgeShape.getInfo !== 'function' ||
    bridgeShape.testConnection !== 'function' ||
    bridgeShape.restoreConnection !== 'function' ||
    bridgeShape.disconnectConnection !== 'function' ||
    bridgeShape.forgetConnection !== 'function' ||
    bridgeShape.listAlbums !== 'function' ||
    bridgeShape.getAlbum !== 'function' ||
    bridgeShape.listArtists !== 'function' ||
    bridgeShape.getArtist !== 'function' ||
    bridgeShape.search !== 'function' ||
    bridgeShape.cancelSearch !== 'function' ||
    bridgeShape.getLyrics !== 'function' ||
    bridgeShape.reportPlayback !== 'function' ||
    bridgeShape.getNetworkSettings !== 'function' ||
    bridgeShape.updateNetworkSettings !== 'function' ||
    bridgeShape.listNetworkDiagnostics !== 'function' ||
    bridgeShape.exportNetworkDiagnostics !== 'function' ||
    bridgeShape.createTranscodeSeek !== 'function' ||
    bridgeShape.getDesktopPreferences !== 'function' ||
    bridgeShape.updateDesktopPreferences !== 'function' ||
    bridgeShape.updatePlaybackStatus !== 'function' ||
    bridgeShape.onDesktopCommand !== 'function' ||
    bridgeShape.savePausedQueue !== 'function' ||
    bridgeShape.restorePausedQueue !== 'function' ||
    bridgeShape.refreshQueuePlayback !== 'function' ||
    bridgeShape.completeQuitPreparation !== 'function' ||
    bridgeShape.getCoverCacheInfo !== 'function' ||
    bridgeShape.clearCoverCache !== 'function' ||
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
  const toastClosePosition = await window
    .locator('[data-sonner-toast] [data-close-button]')
    .getAttribute('data-close-button-position')
  if (toastClosePosition !== 'top-right') {
    throw new Error(`Sonner 关闭按钮位置错误：${toastClosePosition ?? '未设置'}`)
  }
  console.log('Connection IPC passed: trusted sender + input validation + renderer result validation')

  fixtureServer = await startFixtureServer()
  const fixtureAddress = fixtureServer.address()
  if (!fixtureAddress || typeof fixtureAddress === 'string') {
    throw new Error('无法读取本地 OpenSubsonic fixture 端口')
  }
  await window.locator('#server-url').fill(`http://127.0.0.1:${fixtureAddress.port}/sonavi-fixture`)
  await window.locator('#username').fill('fixture-user')
  await window.locator('#password').fill('fixture-password')
  await window.locator('#remember-me').click()
  await window.locator('#allow-insecure-http').click()
  await window.getByRole('button', { name: '测试连接' }).click()
  await window.getByRole('heading', { name: '最近添加' }).waitFor()
  await window.keyboard.press(platformText.includes('macOS') ? 'Meta+Comma' : 'Control+Comma')
  await window.getByRole('heading', { name: '设置', exact: true }).waitFor()
  await window.getByRole('button', { name: '首页', exact: true }).click()
  await window.getByRole('heading', { name: '最近添加' }).waitFor()
  await window.getByRole('button', { name: '下一页', exact: true }).click()
  await window.getByRole('button', { name: /分页专辑 31/ }).waitFor()
  if (!(await window.getByRole('button', { name: '下一页', exact: true }).isDisabled())) {
    throw new Error('最后一页的下一页按钮没有禁用')
  }
  await window.getByRole('button', { name: '上一页', exact: true }).click()
  await window.getByRole('button', { name: /石与琥珀/ }).waitFor()
  await window.getByRole('button', { name: /石与琥珀/ }).click()
  await window.getByRole('heading', { name: '专辑详情' }).waitFor()
  await window.getByRole('button', { name: '播放 跨平台试音' }).click()
  await window.getByRole('button', { name: '暂停' }).waitFor()
  const mediaSessionState = await window.evaluate(() => ({
    title: navigator.mediaSession?.metadata?.title,
    playbackState: navigator.mediaSession?.playbackState
  }))
  if (mediaSessionState.title !== '跨平台试音' || mediaSessionState.playbackState !== 'playing') {
    throw new Error(`Media Session 元数据未同步：${JSON.stringify(mediaSessionState)}`)
  }
  const globalMediaShortcutRegistered = await electronApplication.evaluate(({ globalShortcut }) =>
    globalShortcut.isRegistered('MediaPlayPause')
  )
  if (globalMediaShortcutRegistered) throw new Error('不应同时注册全局媒体键与 Media Session')
  await waitForCondition(
    () => mediaRequests.some((request) => request.path?.includes('/stream.view')),
    '真实 HTMLAudioElement 未在时限内请求 fixture 音频流'
  )
  await window.getByRole('button', { name: '歌词', exact: true }).click()
  await window.getByRole('heading', { name: '歌词', exact: true }).waitFor()
  await window.getByText('歌词第一行', { exact: true }).waitFor()
  await window.getByRole('button', { name: '关闭', exact: true }).click()
  await waitForCondition(
    () => playbackRequests.some((request) => request.id === 'fixture-track' && request.submission === 'false'),
    '进入 playing 后未发送 now-playing scrobble'
  )
  await window.getByRole('button', { name: '加入队列 跨平台试音' }).click()
  await window.getByRole('button', { name: '播放队列', exact: true }).click()
  await window.getByRole('heading', { name: '播放队列' }).waitFor()
  await window.getByText('4 项 · 顺序').waitFor()
  await window.getByRole('button', { name: '下一首', exact: true }).click()
  await window
    .locator('footer[aria-label="播放器"] .player-track-details > strong')
    .getByText('队列下一首')
    .waitFor()
  await window.getByRole('button', { name: '上一首', exact: true }).click()
  await window
    .locator('footer[aria-label="播放器"] .player-track-details > strong')
    .getByText('跨平台试音')
    .waitFor()
  await window.getByRole('button', { name: '暂停' }).click()
  await window.getByRole('button', { name: '继续播放' }).waitFor()
  await setSliderValue(window, '播放进度', 2, 0.1)
  await window.waitForFunction(() =>
    globalThis.document
      .querySelector('footer[aria-label="播放器"]')
      ?.textContent?.includes('0:02')
  )
  await window.getByRole('button', { name: '歌词', exact: true }).click()
  await window.getByRole('heading', { name: '歌词', exact: true }).waitFor()
  const activeLyric = await window.locator('.lyrics-lines li[aria-current="true"]').textContent()
  if (activeLyric?.trim() !== '歌词第二行') {
    throw new Error(`同步歌词未跟随 seek 后的 AudioEngine 进度：${activeLyric ?? '无高亮'}`)
  }
  await window.screenshot({ path: lyricsScreenshotPath, fullPage: true })
  await window.getByRole('button', { name: '关闭', exact: true }).click()
  await window.getByRole('button', { name: '继续播放' }).click()
  await window.getByRole('button', { name: '暂停' }).waitFor()
  await waitForCondition(
    () => playbackRequests.some((request) => request.id === 'fixture-track' && request.submission === 'true'),
    '累计真实播放达到阈值后未发送 submission scrobble'
  )
  const oldCoverHandle = await window
    .locator('img[alt="石与琥珀 封面"]')
    .first()
    .getAttribute('src')
  if (!oldCoverHandle?.startsWith('sonavi-media://')) {
    throw new Error(`未取得不透明封面句柄：${oldCoverHandle ?? '空'}`)
  }
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log('OpenSubsonic integration passed: two album pages + detail + opaque media handles')
  console.log('Audio integration passed: queue + lyrics sync + now-playing/submission + seek filtering')

  const queueButton = window.getByRole('button', { name: '播放队列', exact: true })
  if ((await queueButton.getAttribute('aria-expanded')) === 'true') await queueButton.click()
  await window.getByRole('button', { name: '艺术家', exact: true }).click()
  await window.getByRole('heading', { name: '艺术家', exact: true }).waitFor()
  await window.getByRole('button', { name: /Sonavi Fixture/ }).click()
  await window.getByRole('heading', { name: 'Sonavi Fixture' }).waitFor()
  await window.getByRole('button', { name: /石与琥珀/ }).first().click()
  await window.getByRole('heading', { name: '专辑详情' }).waitFor()
  await window.getByRole('button', { name: '搜索', exact: true }).click()
  const searchInput = window.getByPlaceholder('搜索艺术家、专辑或歌曲')
  const searchSubmit = window.locator('.search-form').getByRole('button', { name: '搜索', exact: true })
  await searchInput.fill('跨平台')
  const [searchInputBox, searchSubmitBox] = await Promise.all([
    searchInput.boundingBox(),
    searchSubmit.boundingBox()
  ])
  if (
    !searchInputBox ||
    !searchSubmitBox ||
    Math.abs(searchInputBox.y - searchSubmitBox.y) > 1 ||
    Math.abs(searchInputBox.height - searchSubmitBox.height) > 1
  ) {
    throw new Error('搜索框与搜索按钮未对齐')
  }
  await searchSubmit.click()
  await window.getByText('“跨平台”的搜索结果', { exact: true }).waitFor()
  await window
    .getByText('1 位艺术家 · 专辑第 1 页（1 张） · 歌曲第 1 页（1 首）', { exact: true })
    .waitFor()
  const albumResults = window.getByRole('region', { name: '专辑' })
  await albumResults.getByText('Sonavi Fixture', { exact: true }).waitFor()
  await albumResults.getByText('3 首歌曲', { exact: true }).waitFor()
  const songResults = window.getByRole('region', { name: '歌曲' })
  await songResults.getByText('跨平台试音', { exact: true }).waitFor()
  const [discoveryResultsBox, songResultsBox] = await Promise.all([
    window.locator('.search-discovery-column').boundingBox(),
    songResults.boundingBox()
  ])
  if (
    !discoveryResultsBox ||
    !songResultsBox ||
    songResultsBox.y < discoveryResultsBox.y + discoveryResultsBox.height - 1
  ) {
    throw new Error('搜索结果未按艺术家、专辑、歌曲上下排列')
  }
  const [albumNextDisabled, trackNextDisabled] = await Promise.all([
    window.getByRole('button', { name: '专辑下一页', exact: true }).isDisabled(),
    window.getByRole('button', { name: '歌曲下一页', exact: true }).isDisabled()
  ])
  if (!albumNextDisabled || !trackNextDisabled) {
    throw new Error('单页搜索结果的独立下一页按钮没有禁用')
  }
  const [albumGridBox, albumPaginationBox, trackListBox, trackPaginationBox] = await Promise.all([
    albumResults.locator('.search-album-grid').boundingBox(),
    albumResults.locator('[data-testid="search-albums-pagination"]').boundingBox(),
    songResults.locator('.track-results').boundingBox(),
    songResults.locator('[data-testid="search-tracks-pagination"]').boundingBox()
  ])
  if (
    !albumGridBox ||
    !albumPaginationBox ||
    !trackListBox ||
    !trackPaginationBox ||
    albumPaginationBox.y - (albumGridBox.y + albumGridBox.height) < 19 ||
    trackPaginationBox.y - (trackListBox.y + trackListBox.height) < 19
  ) {
    throw new Error('搜索结果内容与独立分页器的垂直间距不足 20px')
  }
  await electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(960, 640)
  })
  await window.waitForTimeout(200)
  const hasHorizontalOverflow = await window.evaluate(
    () =>
      globalThis.document.documentElement.scrollWidth >
      globalThis.document.documentElement.clientWidth
  )
  if (hasHorizontalOverflow) throw new Error('P05 最小窗口出现应用级横向溢出')
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log('P05 navigation passed: artists + artist detail + album detail + submitted search')

  await window.getByRole('button', { name: '收藏', exact: true }).click()
  await window.getByRole('heading', { name: '收藏', exact: true }).waitFor()
  const favoriteTracks = window.getByRole('region', { name: '歌曲' })
  await favoriteTracks.getByText('跨平台试音', { exact: true }).waitFor()
  await favoriteTracks.getByRole('button', { name: '取消收藏', exact: true }).click()
  await window.getByText('还没有收藏的艺术家、专辑或歌曲。').waitFor()

  await window.getByRole('button', { name: '歌单', exact: true }).click()
  await window.getByRole('heading', { name: '歌单', exact: true }).waitFor()
  await window.getByRole('button', { name: /现有歌单/ }).click()
  await window.getByRole('heading', { name: '歌单详情', exact: true }).waitFor()
  const playlistTracks = window.locator('.track-results')
  await playlistTracks.getByText('跨平台试音', { exact: true }).first().waitFor()
  if ((await playlistTracks.getByText('跨平台试音', { exact: true }).count()) !== 2) {
    throw new Error('歌单详情未保留重复歌曲')
  }
  await window.getByRole('button', { name: '播放全部', exact: true }).click()
  await playlistTracks.getByRole('button', { name: '移除', exact: true }).first().click()
  await window.getByText('歌曲已从歌单移除。').waitFor()
  await waitForCondition(
    async () => (await playlistTracks.getByText('跨平台试音', { exact: true }).count()) === 1,
    '歌单按索引移除未生效'
  )
  await window.getByRole('button', { name: '返回歌单', exact: true }).click()
  await window.getByPlaceholder('例如：夜间聆听').fill('P06 自动化')
  await window.getByLabel(/包含当前队列/).click()
  await window.getByRole('button', { name: '创建歌单', exact: true }).click()
  await window.getByText('歌单已创建。').waitFor()
  await window.getByRole('button', { name: /P06 自动化/ }).click()
  await window.getByLabel('名称').fill('P06 已更新')
  await window.getByLabel('对服务器上的其他用户公开').click()
  await window.getByRole('button', { name: '保存信息', exact: true }).click()
  await window.getByText('歌单信息已更新。').waitFor()
  await window.getByRole('button', { name: '删除歌单', exact: true }).click()
  await window.getByRole('button', { name: '删除歌单', exact: true }).last().click()
  await window.getByText('歌单已删除。').waitFor()
  await window.getByRole('button', { name: /现有歌单/ }).waitFor()
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log('P06 integration passed: favorites sync + playlist CRUD + duplicate track index removal')

  await window.getByRole('button', { name: '设置', exact: true }).click()
  await window.getByRole('heading', { name: '设置', exact: true }).waitFor()
  await window.getByRole('button', { name: '重启 Sonavi', exact: true }).click()
  await window.getByText('重启 Sonavi？', { exact: true }).waitFor()
  await window.getByRole('button', { name: '取消', exact: true }).click()
  await chooseSelectOption(window, '播放模式', 'MP3 兼容转码')
  await chooseSelectOption(window, '转码最高码率', '192 kbps')
  await window.getByRole('button', { name: '保存播放与网络设置' }).click()
  await window.getByText('当前歌曲会尽量从原进度切换，否则下一曲生效。').waitFor()
  await window.locator('footer[aria-label="播放器"] .player-stream-note').getByText('WAV → MP3 · 兼容转码', { exact: true }).waitFor()
  await chooseSelectOption(window, '代理模式', '直接连接')
  await window.getByRole('button', { name: '保存播放与网络设置' }).click()
  await window.getByText('代理已切换，旧连接和当前播放已安全停止。').waitFor()
  const savedNetworkSettings = await window.evaluate(() => window.sonavi.network.getSettings())
  if (
    savedNetworkSettings.playback.mode !== 'compatible' ||
    savedNetworkSettings.playback.maxBitRate !== 192 ||
    savedNetworkSettings.proxy.mode !== 'direct'
  ) {
    throw new Error(`设置组件未持久化所选值：${JSON.stringify(savedNetworkSettings)}`)
  }
  await window.getByRole('button', { name: '首页', exact: true }).click()
  await window.getByRole('heading', { name: '专辑详情', exact: true }).waitFor()
  await window.getByRole('button', { name: '播放 跨平台试音' }).click()
  await window.getByRole('button', { name: '暂停' }).waitFor()
  await window.locator('footer[aria-label="播放器"] .player-stream-note').getByText('WAV → MP3 · 兼容转码', { exact: true }).waitFor()
  await setSliderValue(window, '播放进度', 2, 0.1)
  await window.waitForFunction(() =>
    globalThis.document
      .querySelector('footer[aria-label="播放器"]')
      ?.textContent?.includes('0:02')
  )
  const findTranscodeSeekRequest = () => mediaRequests
    .map((request) => new URL(request.path, 'http://127.0.0.1'))
    .find(
      (requestUrl) =>
        requestUrl.searchParams.get('format') === 'mp3' &&
        requestUrl.searchParams.get('timeOffset') === '2'
    )
  await waitForCondition(
    () => Boolean(findTranscodeSeekRequest()),
    '兼容转码 seek 请求未在时限内到达 fixture'
  )
  const transcodeRequest = findTranscodeSeekRequest()
  if (transcodeRequest?.searchParams.get('maxBitRate') !== '192') {
    throw new Error('兼容转码或 transcodeOffset 参数未按 P08 设置发送')
  }
  await window.getByRole('button', { name: '设置', exact: true }).click()
  const bufferPayloadRejected = await window.evaluate(async () => {
    try {
      await window.sonavi.network.reportPlaybackBuffer({
        event: 'buffer-start',
        durationMs: 0,
        trackId: 'must-not-cross-ipc'
      })
      return false
    } catch {
      return true
    }
  })
  if (!bufferPayloadRejected) throw new Error('缓冲诊断 IPC 接受了曲目身份字段')
  await window.evaluate(async () => {
    await window.sonavi.network.reportPlaybackBuffer({ event: 'buffer-start', durationMs: 0 })
    await window.sonavi.network.reportPlaybackBuffer({ event: 'buffer-end', durationMs: 1_234 })
  })
  await window.getByRole('button', { name: '刷新', exact: true }).click()
  await window.getByText('转码音频', { exact: true }).first().waitFor()
  await window.getByText('播放缓冲', { exact: true }).first().waitFor()
  await window.getByText(/buffer-end · — · 无类型 · 1234 ms/).first().waitFor()
  await window
    .getByText(/getAlbumList2 · listType=newest,page=1,size=30 · 第 1 次/)
    .first()
    .waitFor()
  const coverTimingDiagnostic = await window.evaluate(async () => {
    const entries = await window.sonavi.network.listDiagnostics()
    const cover = entries.find((entry) => entry.operation === 'getCoverArt')
    return cover
      ? { queueMs: cover.queueMs, upstreamMs: cover.upstreamMs }
      : null
  })
  if (
    !coverTimingDiagnostic ||
    typeof coverTimingDiagnostic.queueMs !== 'number' ||
    typeof coverTimingDiagnostic.upstreamMs !== 'number'
  ) {
    throw new Error('封面诊断未分别记录排队与上游耗时')
  }
  await window.getByText(/scrobble ·/).first().waitFor()
  await chooseSelectOption(window, '关闭窗口时', '隐藏窗口并继续播放（默认）')
  await chooseSelectOption(window, '外观', '深色')
  await window.getByRole('button', { name: '保存桌面设置' }).click()
  await window.getByText('桌面设置已保存。关闭窗口时将按新规则执行。').waitFor()
  if ((await window.locator('html').getAttribute('data-theme')) !== 'dark') {
    throw new Error('深色主题偏好未应用到共享 renderer')
  }
  await window.getByText(/项 · .* MiB/).waitFor()
  await window.getByRole('button', { name: '清空当前账号缓存', exact: true }).click()
  await window.getByRole('heading', { name: '清空当前账号的封面缓存？' }).waitFor()
  await window.getByRole('button', { name: '清空缓存', exact: true }).click()
  await window.getByText('0 项 · 0 B / 128.0 MiB', { exact: true }).waitFor()
  await mkdir(dirname(diagnosticsScreenshotPath), { recursive: true })
  await window.screenshot({ path: diagnosticsScreenshotPath, fullPage: true })
  console.log('P08 integration passed: shared proxy policy + compatible transcode + full-timeline seek + diagnostics')

  await window.getByRole('button', { name: '首页', exact: true }).click()
  await window.getByRole('heading', { name: '专辑详情', exact: true }).waitFor()
  await window.getByRole('button', { name: '播放 跨平台试音' }).click()
  await window.getByRole('button', { name: '暂停' }).waitFor()
  const windowIdentityBeforeClose = await electronApplication.evaluate(({ BrowserWindow }) => {
    const activeWindow = BrowserWindow.getAllWindows()[0]
    return activeWindow ? { id: activeWindow.id, webContentsId: activeWindow.webContents.id } : null
  })
  await electronApplication.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
  await window.waitForTimeout(350)
  const hiddenWindowState = await electronApplication.evaluate(({ BrowserWindow }) => {
    const activeWindow = BrowserWindow.getAllWindows()[0]
    return activeWindow
      ? { id: activeWindow.id, webContentsId: activeWindow.webContents.id, visible: activeWindow.isVisible(), destroyed: activeWindow.isDestroyed() }
      : null
  })
  if (
    !hiddenWindowState || hiddenWindowState.visible || hiddenWindowState.destroyed ||
    hiddenWindowState.id !== windowIdentityBeforeClose?.id ||
    hiddenWindowState.webContentsId !== windowIdentityBeforeClose.webContentsId
  ) {
    throw new Error(`关闭到后台破坏了播放宿主：${JSON.stringify(hiddenWindowState)}`)
  }
  await launchDuplicateInstance()
  await waitForCondition(
    () => electronApplication.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() === true),
    '重复启动没有唤醒主实例窗口'
  )
  await window.getByRole('heading', { name: '专辑详情' }).waitFor()
  await window.getByText('跨平台试音', { exact: true }).first().waitFor()
  const windowStateAfterDuplicateLaunch = await electronApplication.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows()
    const activeWindow = windows[0]
    return activeWindow
      ? {
          count: windows.length,
          id: activeWindow.id,
          webContentsId: activeWindow.webContents.id,
          visible: activeWindow.isVisible()
        }
      : null
  })
  if (
    !windowStateAfterDuplicateLaunch ||
    windowStateAfterDuplicateLaunch.count !== 1 ||
    !windowStateAfterDuplicateLaunch.visible ||
    windowStateAfterDuplicateLaunch.id !== windowIdentityBeforeClose?.id ||
    windowStateAfterDuplicateLaunch.webContentsId !== windowIdentityBeforeClose.webContentsId
  ) {
    throw new Error(`重复启动没有只唤醒原窗口：${JSON.stringify(windowStateAfterDuplicateLaunch)}`)
  }
  await mkdir(dirname(desktopScreenshotPath), { recursive: true })
  await window.screenshot({ path: desktopScreenshotPath, fullPage: true })
  console.log('P09/P22 lifecycle passed: close hides and duplicate launch restores the same AudioEngine host')

  const memoryBefore = await electronApplication.evaluate(({ app }) =>
    app.getAppMetrics().reduce((total, metric) => total + metric.memory.workingSetSize, 0)
  )
  const requestCountBeforeSwitching = mediaRequests.length
  for (let index = 0; index < 20; index += 1) {
    await window.getByRole('button', { name: '设置', exact: true }).click()
    await window.getByRole('heading', { name: '设置', exact: true }).waitFor()
    await window.getByRole('button', { name: '首页', exact: true }).click()
    await window.getByRole('heading', { name: '专辑详情', exact: true }).waitFor()
  }
  const memoryAfter = await electronApplication.evaluate(({ app }) =>
    app.getAppMetrics().reduce((total, metric) => total + metric.memory.workingSetSize, 0)
  )
  const memoryDeltaKiB = memoryAfter - memoryBefore
  const requestDelta = mediaRequests.length - requestCountBeforeSwitching
  if (memoryDeltaKiB > 128 * 1024) {
    throw new Error(`快速切页内存增量异常：${memoryDeltaKiB} KiB`)
  }
  console.log(`P09 rapid-switch measurement: memory delta ${memoryDeltaKiB} KiB, media requests +${requestDelta}`)

  await window.getByRole('button', { name: '设置', exact: true }).click()
  await window.getByRole('heading', { name: '设置', exact: true }).waitFor()
  // Freeze the short fixture before taking the expected queue snapshot. Otherwise it can
  // naturally advance while the disconnect confirmation is open, making the pre-action UI
  // title older than the correctly persisted queue index.
  await window.getByRole('button', { name: '暂停', exact: true }).click()
  await window.getByRole('button', { name: '继续播放', exact: true }).waitFor()
  const expectedPausedTitle = (await window
    .locator('footer[aria-label="播放器"] .player-track-details > strong')
    .textContent())?.trim()
  if (!expectedPausedTitle || !fixtureTracks.some((track) => track.title === expectedPausedTitle)) {
    throw new Error(`断开前无法确定当前歌曲：${expectedPausedTitle ?? '空'}`)
  }
  await window.getByRole('button', { name: '断开连接' }).click()
  await window.getByRole('heading', { name: '断开当前连接？' }).waitFor()
  await window.getByRole('button', { name: '确认断开', exact: true }).click()
  await window.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
  try {
    await waitForCondition(async () => {
      try {
        const state = JSON.parse(
          await readFile(join(userDataPath, 'desktop-state.v1.json'), 'utf8')
        )
        return state.pausedQueue?.tracks?.[state.pausedQueue.currentIndex]?.title === expectedPausedTitle
      } catch {
        return false
      }
    }, '关闭进程前暂停队列未完成持久化')
  } catch {
    let diagnostic = { file: 'unreadable' }
    try {
      const state = JSON.parse(
        await readFile(join(userDataPath, 'desktop-state.v1.json'), 'utf8')
      )
      diagnostic = {
        file: 'readable',
        expectedTitle: expectedPausedTitle,
        currentIndex: state.pausedQueue?.currentIndex ?? null,
        currentTitle: state.pausedQueue?.tracks?.[state.pausedQueue.currentIndex]?.title ?? null,
        trackCount: state.pausedQueue?.tracks?.length ?? 0,
        trackTitles: state.pausedQueue?.tracks?.map((track) => track.title) ?? []
      }
    } catch {
      // The diagnostic intentionally excludes credentials and account hashes.
    }
    throw new Error(`关闭进程前暂停队列未完成持久化：${JSON.stringify(diagnostic)}`)
  }
  if ((await window.locator('#password').inputValue()) !== '') {
    throw new Error('连接完成后密码输入框未清空')
  }
  const revokedHandleStatus = await electronApplication.evaluate(
    async ({ session }, mediaHandle) => (await session.defaultSession.fetch(mediaHandle)).status,
    oldCoverHandle
  )
  if (revokedHandleStatus !== 404) {
    throw new Error(`断开后旧媒体句柄仍可访问：HTTP ${revokedHandleStatus}`)
  }
  console.log('Session cleanup passed: playback stopped + old media handle revoked')

  await electronApplication.close()
  electronApplication = await launchApplication()
  window = await electronApplication.firstWindow()
  await window.getByRole('heading', { name: '最近添加' }).waitFor()
  await window
    .locator('footer[aria-label="播放器"] .player-track-details > strong')
    .getByText(expectedPausedTitle, { exact: true })
    .waitFor()
  await window.getByRole('button', { name: '继续播放' }).waitFor()
  console.log('Credential restore passed: encrypted credential restored after application restart')
  console.log('P09 queue restore passed: queue metadata restored paused with fresh media handles')

  await window.getByRole('button', { name: '设置', exact: true }).click()
  await window.getByRole('heading', { name: '设置', exact: true }).waitFor()
  await window.getByRole('button', { name: '退出并忘记账号' }).click()
  await window.getByRole('button', { name: '退出并删除', exact: true }).click()
  await window.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
  await electronApplication.close()
  electronApplication = await launchApplication()
  window = await electronApplication.firstWindow()
  await window.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
  console.log('Credential deletion passed: forgotten account is not restored after restart')

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

} catch (error) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    const details = error instanceof Error ? (error.stack ?? error.message) : String(error)
    const redactedDetails = details
      .replaceAll('```', '` ` `')
      .replace(/(password|token|salt|authorization)=\S+/gi, '$1=[REDACTED]')
    await appendFile(summaryPath, `### Electron smoke failure\n\n\`\`\`text\n${redactedDetails}\n\`\`\`\n`)
    const workflowAnnotation = redactedDetails
      .slice(0, 4000)
      .replaceAll('%', '%25')
      .replaceAll('\r', '%0D')
      .replaceAll('\n', '%0A')
    console.log(`::error title=Electron smoke failure::${workflowAnnotation}`)
  }
  throw error
} finally {
  await electronApplication.close()
  if (fixtureServer) {
    await new Promise((resolveClose, rejectClose) => {
      fixtureServer.close((error) => (error ? rejectClose(error) : resolveClose()))
    })
  }
  await rm(userDataPath, { recursive: true, force: true })
}
