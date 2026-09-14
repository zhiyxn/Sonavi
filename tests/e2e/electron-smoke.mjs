import { _electron as electron } from 'playwright-core'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const screenshotPath = resolve(
  process.env.SONAVI_SCREENSHOT_PATH ?? 'artifacts/screenshots/p06-current-platform.png'
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
  if (!csp?.includes("default-src 'none'") || !csp.includes("frame-ancestors 'none'")) {
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
  await window.locator('#remember-me').check()
  await window.locator('#allow-insecure-http').check()
  await window.getByRole('button', { name: '测试连接' }).click()
  await window.getByRole('heading', { name: '最近添加' }).waitFor()
  await window.getByRole('button', { name: '加载更多专辑' }).click()
  await window.getByRole('button', { name: /分页专辑 31/ }).waitFor()
  if ((await window.getByRole('button', { name: '加载更多专辑' }).count()) !== 0) {
    throw new Error('最后一页加载后仍显示加载更多按钮')
  }
  await window.getByRole('button', { name: /石与琥珀/ }).click()
  await window.getByRole('heading', { name: '专辑详情' }).waitFor()
  await window.getByRole('button', { name: '播放 跨平台试音' }).click()
  await window.getByRole('button', { name: '暂停' }).waitFor()
  if (!mediaRequests.some((request) => request.path?.includes('/stream.view'))) {
    throw new Error('真实 HTMLAudioElement 未请求 fixture 音频流')
  }
  await window.getByRole('button', { name: '加入队列 跨平台试音' }).click()
  await window.getByRole('button', { name: '播放队列', exact: true }).click()
  await window.getByRole('heading', { name: '播放队列' }).waitFor()
  await window.getByText('4 项 · 顺序').waitFor()
  await window.getByRole('button', { name: '下一首', exact: true }).click()
  await window
    .locator('footer[aria-label="播放器"] > div.min-w-0 > strong')
    .getByText('队列下一首')
    .waitFor()
  await window.getByRole('button', { name: '上一首', exact: true }).click()
  await window
    .locator('footer[aria-label="播放器"] > div.min-w-0 > strong')
    .getByText('跨平台试音')
    .waitFor()
  await window.getByRole('button', { name: '暂停' }).click()
  await window.getByRole('button', { name: '继续播放' }).waitFor()
  await window.locator('input[aria-label="播放进度"]').evaluate((element) => {
    element.value = '2'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await window.waitForFunction(() =>
    globalThis.document
      .querySelector('footer[aria-label="播放器"]')
      ?.textContent?.includes('0:02')
  )
  await window.getByRole('button', { name: '继续播放' }).click()
  await window.getByRole('button', { name: '暂停' }).waitFor()
  const oldCoverHandle = await window
    .locator('img[alt="石与琥珀 封面"]')
    .first()
    .getAttribute('src')
  if (!oldCoverHandle?.startsWith('sonavi-media://')) {
    throw new Error(`未取得不透明封面句柄：${oldCoverHandle ?? '空'}`)
  }
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log('OpenSubsonic integration passed: two album pages + detail + opaque media handles')
  console.log('Audio integration passed: album queue + duplicate entry + next/previous + pause + seek + resume')

  await window.getByRole('button', { name: '播放队列', exact: true }).click()
  await window.getByRole('button', { name: '艺术家', exact: true }).click()
  await window.getByRole('heading', { name: '艺术家', exact: true }).waitFor()
  await window.getByRole('button', { name: /Sonavi Fixture/ }).click()
  await window.getByRole('heading', { name: 'Sonavi Fixture' }).waitFor()
  await window.getByRole('button', { name: /石与琥珀/ }).first().click()
  await window.getByRole('heading', { name: '专辑详情' }).waitFor()
  await window.getByRole('button', { name: '搜索', exact: true }).click()
  await window.getByPlaceholder('搜索艺术家、专辑或歌曲').fill('跨平台')
  const songResults = window.getByRole('region', { name: '歌曲' })
  await songResults.getByText('跨平台试音', { exact: true }).waitFor()
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
  console.log('P05 navigation passed: artists + artist detail + album detail + debounced search')

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
  if ((await playlistTracks.getByText('跨平台试音', { exact: true }).count()) !== 1) {
    throw new Error('歌单按索引移除未生效')
  }
  await window.getByRole('button', { name: '返回歌单', exact: true }).click()
  await window.getByPlaceholder('例如：夜间聆听').fill('P06 自动化')
  await window.getByLabel(/包含当前队列/).check()
  await window.getByRole('button', { name: '创建歌单', exact: true }).click()
  await window.getByText('歌单已创建。').waitFor()
  await window.getByRole('button', { name: /P06 自动化/ }).click()
  await window.getByLabel('名称').fill('P06 已更新')
  await window.getByLabel('对服务器上的其他用户公开').check()
  await window.getByRole('button', { name: '保存信息', exact: true }).click()
  await window.getByText('歌单信息已更新。').waitFor()
  window.once('dialog', (dialog) => dialog.accept())
  await window.getByRole('button', { name: '删除歌单', exact: true }).click()
  await window.getByText('歌单已删除。').waitFor()
  await window.getByRole('button', { name: /现有歌单/ }).waitFor()
  await window.screenshot({ path: screenshotPath, fullPage: true })
  console.log('P06 integration passed: favorites sync + playlist CRUD + duplicate track index removal')

  await window.getByRole('button', { name: '设置', exact: true }).click()
  await window.getByRole('button', { name: '断开连接' }).click()
  await window.getByRole('heading', { name: '连接你的音乐空间' }).waitFor()
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
  console.log('Credential restore passed: encrypted credential restored after application restart')

  window.once('dialog', (dialog) => dialog.accept())
  await window.getByRole('button', { name: '退出并忘记账号' }).click()
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
  await rm(userDataPath, { recursive: true, force: true })
}
