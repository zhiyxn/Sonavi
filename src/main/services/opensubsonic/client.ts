import { z } from 'zod'
import type {
  ConnectionErrorCode,
  ConnectionSuccessResult,
  MusicFolderSummary
} from '../../../shared/connection'
import type {
  AlbumDetail,
  AlbumListType,
  AlbumSummary,
  ArtistDetail,
  ArtistIndex,
  ArtistSummary,
  PlaylistDetail,
  PlaylistSummary,
  SearchResultPage,
  StarTargetType,
  TrackSummary
} from '../../../shared/library'
import type { LyricsPayload, LyricsVariant } from '../../../shared/playback'
import {
  buildEndpointUrl,
  type ConnectionEndpoint,
  type EndpointParameters
} from './request-url'
import {
  ResponseLimitError,
  type ApiTransport,
  type TransportResponse
} from './transport'

const RESPONSE_TIMEOUT_MS = 12_000

const SubsonicErrorSchema = z.object({
  code: z.number().int(),
  message: z.string().optional()
})

const MusicFolderSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string()
})

const AlbumSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  artist: z.string().default('未知艺术家'),
  year: z.number().int().optional(),
  songCount: z.number().int().nonnegative().default(0),
  duration: z.number().nonnegative().default(0),
  coverArt: z.union([z.string(), z.number()]).transform(String).optional(),
  starred: z.string().optional()
})

const TrackSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  artist: z.string().default('未知艺术家'),
  album: z.string().default('未知专辑'),
  duration: z.number().nonnegative().default(0),
  track: z.number().int().positive().optional(),
  discNumber: z.number().int().positive().optional(),
  contentType: z.string().optional(),
  coverArt: z.union([z.string(), z.number()]).transform(String).optional(),
  starred: z.string().optional()
})

const ArtistSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  albumCount: z.number().int().nonnegative().default(0),
  coverArt: z.union([z.string(), z.number()]).transform(String).optional(),
  starred: z.string().optional()
})

const PlaylistSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  owner: z.string().default(''),
  public: z.boolean().default(false),
  songCount: z.number().int().nonnegative().default(0),
  duration: z.number().nonnegative().default(0),
  comment: z.string().optional(),
  created: z.string().optional(),
  changed: z.string().optional()
})

const StructuredLyricsSchema = z.object({
  displayArtist: z.string().optional(),
  displayTitle: z.string().optional(),
  lang: z.string().optional(),
  offset: z.number().int().default(0),
  synced: z.boolean(),
  line: z
    .array(
      z.object({
        start: z.number().int().nonnegative().optional(),
        value: z.string()
      })
    )
    .default([])
})

const LegacyLyricsSchema = z.object({
  artist: z.string().optional(),
  title: z.string().optional(),
  value: z.string().default('')
})

const SubsonicResponseSchema = z.object({
  'subsonic-response': z.object({
    status: z.enum(['ok', 'failed']),
    version: z.string().min(1),
    type: z.string().min(1).optional(),
    serverVersion: z.string().min(1).optional(),
    openSubsonic: z.boolean().optional(),
    error: SubsonicErrorSchema.optional(),
    openSubsonicExtensions: z
      .array(
        z.object({
          name: z.string().min(1),
          versions: z.array(z.number().int())
        })
      )
      .optional(),
    musicFolders: z
      .object({
        musicFolder: z.array(MusicFolderSchema).default([])
      })
      .optional(),
    albumList2: z.object({ album: z.array(AlbumSchema).default([]) }).optional(),
    album: AlbumSchema.extend({ song: z.array(TrackSchema).default([]) }).optional(),
    artists: z
      .object({
        index: z
          .array(
            z.object({
              name: z.string(),
              artist: z.array(ArtistSchema).default([])
            })
          )
          .default([])
      })
      .optional(),
    artist: ArtistSchema.extend({ album: z.array(AlbumSchema).default([]) }).optional(),
    searchResult3: z
      .object({
        artist: z.array(ArtistSchema).default([]),
        album: z.array(AlbumSchema).default([]),
        song: z.array(TrackSchema).default([])
      })
      .optional(),
    starred2: z
      .object({
        artist: z.array(ArtistSchema).default([]),
        album: z.array(AlbumSchema).default([]),
        song: z.array(TrackSchema).default([])
      })
      .optional(),
    playlists: z.object({ playlist: z.array(PlaylistSchema).default([]) }).optional(),
    playlist: PlaylistSchema.extend({ entry: z.array(TrackSchema).default([]) }).optional(),
    lyricsList: z
      .object({ structuredLyrics: z.array(StructuredLyricsSchema).default([]) })
      .optional(),
    lyrics: LegacyLyricsSchema.optional()
  })
})

type ParsedResponse = z.infer<typeof SubsonicResponseSchema>['subsonic-response']

export class ConnectionFailure extends Error {
  constructor(
    readonly code: ConnectionErrorCode,
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ConnectionFailure'
  }
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = 'cause' in error ? errorText(error.cause) : ''
  return `${error.name} ${error.message} ${cause}`.toLowerCase()
}

function classifyNetworkError(error: unknown, didTimeout: boolean): ConnectionFailure {
  if (didTimeout || errorText(error).includes('abort')) {
    return new ConnectionFailure('timeout', '服务器响应超时，请检查地址与网络。', true)
  }

  const text = errorText(error)
  if (text.includes('name_not_resolved') || text.includes('enotfound') || text.includes('dns')) {
    return new ConnectionFailure('dns', '无法解析服务器域名。', true)
  }

  if (text.includes('connection_refused') || text.includes('econnrefused')) {
    return new ConnectionFailure('connection-refused', '服务器拒绝连接，请检查地址和端口。', true)
  }

  if (
    text.includes('certificate') ||
    text.includes('cert_') ||
    text.includes('ssl') ||
    text.includes('tls')
  ) {
    return new ConnectionFailure('tls-certificate', 'TLS 证书验证失败，Sonavi 不会绕过证书检查。', false)
  }

  return new ConnectionFailure('network', '无法连接服务器，请检查网络与服务器地址。', true)
}

function assertHttpStatus(response: TransportResponse): void {
  if (response.status >= 300 && response.status < 400) {
    throw new ConnectionFailure('redirect', '服务器要求重定向；请直接填写最终服务器地址。', false)
  }

  if (response.status === 401) {
    throw new ConnectionFailure('http-authentication', '上游 HTTP 认证拒绝了请求。', false)
  }

  if (response.status === 403) {
    const message = response.cloudflareMitigated
      ? '服务器前置防护要求浏览器挑战，桌面客户端无法完成该挑战。'
      : '服务器或反向代理拒绝了请求。'
    throw new ConnectionFailure('http-forbidden', message, false)
  }

  if (response.status >= 500) {
    throw new ConnectionFailure('server-error', '服务器暂时出错，请稍后重试。', true)
  }

  if (response.status < 200 || response.status >= 300) {
    throw new ConnectionFailure('server-response', `服务器返回了 HTTP ${response.status}。`, false)
  }
}

function parseResponse(response: TransportResponse): ParsedResponse {
  assertHttpStatus(response)

  const trimmedBody = response.body.trimStart()
  if (response.contentType.toLowerCase().includes('text/html') || trimmedBody.startsWith('<')) {
    throw new ConnectionFailure('unexpected-content', '服务器返回了网页而不是 Subsonic JSON。', false)
  }

  let rawResponse: unknown
  try {
    rawResponse = JSON.parse(response.body)
  } catch {
    throw new ConnectionFailure('invalid-response', '服务器返回的内容不是有效 JSON。', false)
  }

  const parsed = SubsonicResponseSchema.safeParse(rawResponse)
  if (!parsed.success) {
    throw new ConnectionFailure('invalid-response', '服务器响应不符合 Subsonic 协议。', false)
  }

  const subsonicResponse = parsed.data['subsonic-response']
  if (subsonicResponse.status === 'failed') {
    throw mapProtocolError(subsonicResponse.error)
  }

  return subsonicResponse
}

function mapProtocolError(error: z.infer<typeof SubsonicErrorSchema> | undefined): ConnectionFailure {
  const code = error?.code

  if (code === 40 || code === 44) {
    return new ConnectionFailure('authentication', '用户名、密码或 API 凭据不正确。', false)
  }

  if (code === 41 || code === 42 || code === 43) {
    return new ConnectionFailure('authentication-method', '服务器不支持 Sonavi 使用的安全认证方式。', false)
  }

  if (code === 50) {
    return new ConnectionFailure('permission', '当前账号无权执行此操作。', false)
  }

  if (code === 20 || code === 30) {
    return new ConnectionFailure('protocol-version', '客户端与服务器的 Subsonic 协议版本不兼容。', false)
  }

  return new ConnectionFailure('server-response', '服务器报告 Subsonic 请求失败。', false)
}

function canDegradeCapabilityProbe(error: ConnectionFailure): boolean {
  return [
    'http-authentication',
    'http-forbidden',
    'server-response',
    'unexpected-content',
    'invalid-response'
  ].includes(error.code)
}

export interface ConnectionProbeResult {
  server: ConnectionSuccessResult['server']
}

type AlbumWithCover = AlbumSummary & { coverArtId?: string | undefined }
type ArtistWithCover = ArtistSummary & { coverArtId?: string | undefined }
type TrackWithCover = Omit<TrackSummary, 'coverUrl' | 'streamUrl'> & {
  coverArtId?: string | undefined
}

function mapAlbum(album: z.infer<typeof AlbumSchema>): AlbumWithCover {
  return {
    id: album.id,
    name: album.name,
    artist: album.artist,
    ...(album.year ? { year: album.year } : {}),
    songCount: album.songCount,
    duration: album.duration,
    starred: album.starred !== undefined,
    ...(album.coverArt ? { coverArtId: album.coverArt } : {})
  }
}

function mapArtist(artist: z.infer<typeof ArtistSchema>): ArtistWithCover {
  return {
    id: artist.id,
    name: artist.name,
    albumCount: artist.albumCount,
    starred: artist.starred !== undefined,
    ...(artist.coverArt ? { coverArtId: artist.coverArt } : {})
  }
}

function mapTrack(track: z.infer<typeof TrackSchema>): TrackWithCover {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    starred: track.starred !== undefined,
    ...(track.track ? { track: track.track } : {}),
    ...(track.discNumber ? { disc: track.discNumber } : {}),
    ...(track.contentType ? { contentType: track.contentType } : {}),
    ...(track.coverArt ? { coverArtId: track.coverArt } : {})
  }
}

function mapPlaylist(playlist: z.infer<typeof PlaylistSchema>): PlaylistSummary {
  return {
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner,
    public: playlist.public,
    songCount: playlist.songCount,
    duration: playlist.duration,
    ...(playlist.comment !== undefined ? { comment: playlist.comment } : {}),
    ...(playlist.created ? { created: playlist.created } : {}),
    ...(playlist.changed ? { changed: playlist.changed } : {})
  }
}

function normalizeLyricsLanguage(language: string | undefined): string | undefined {
  if (!language || language === 'xxx' || language === 'und') return undefined
  return language
}

function mapStructuredLyrics(lyrics: z.infer<typeof StructuredLyricsSchema>): LyricsVariant {
  const language = normalizeLyricsLanguage(lyrics.lang)
  return {
    ...(lyrics.displayArtist ? { displayArtist: lyrics.displayArtist } : {}),
    ...(lyrics.displayTitle ? { displayTitle: lyrics.displayTitle } : {}),
    ...(language ? { language } : {}),
    offsetMs: lyrics.offset,
    synced: lyrics.synced,
    lines: lyrics.line.map((line) => ({
      ...(line.start !== undefined ? { startMs: line.start } : {}),
      value: line.value
    }))
  }
}

export class OpenSubsonicClient {
  constructor(private readonly transport: ApiTransport) {}

  async testConnection(baseUrl: string, username: string, password: string): Promise<ConnectionProbeResult> {
    const ping = await this.request('ping', baseUrl, username, password)
    let capabilityStatus: 'available' | 'unavailable' = 'available'
    let extensions: string[] = []

    try {
      const capabilityResponse = await this.request(
        'getOpenSubsonicExtensions',
        baseUrl,
        username,
        password
      )
      extensions = (capabilityResponse.openSubsonicExtensions ?? []).map(({ name }) => name)
    } catch (error) {
      if (!(error instanceof ConnectionFailure) || !canDegradeCapabilityProbe(error)) throw error
      capabilityStatus = 'unavailable'
    }

    const foldersResponse = await this.request('getMusicFolders', baseUrl, username, password)
    const musicFolders: MusicFolderSummary[] =
      foldersResponse.musicFolders?.musicFolder.map(({ id, name }) => ({ id, name })) ?? []

    return {
      server: {
        baseUrl,
        protocolVersion: ping.version,
        ...(ping.type ? { serverType: ping.type } : {}),
        ...(ping.serverVersion ? { serverVersion: ping.serverVersion } : {}),
        openSubsonic: ping.openSubsonic === true,
        capabilityStatus,
        extensions,
        musicFolders
      }
    }
  }

  async getAlbumList2(
    baseUrl: string,
    username: string,
    password: string,
    offset = 0,
    size = 30,
    type: AlbumListType = 'newest'
  ): Promise<AlbumWithCover[]> {
    const response = await this.request('getAlbumList2', baseUrl, username, password, {
      type,
      size,
      offset
    })

    return (response.albumList2?.album ?? []).map(mapAlbum)
  }

  async getAlbum(
    baseUrl: string,
    username: string,
    password: string,
    albumId: string
  ): Promise<
    Omit<AlbumDetail, 'coverUrl' | 'tracks'> & {
      coverArtId?: string | undefined
      tracks: TrackWithCover[]
    }
  > {
    const response = await this.request('getAlbum', baseUrl, username, password, { id: albumId })
    if (!response.album) {
      throw new ConnectionFailure('invalid-response', '服务器未返回专辑详情。', false)
    }

    const album = response.album
    return {
      id: album.id,
      name: album.name,
      artist: album.artist,
      ...(album.year ? { year: album.year } : {}),
      songCount: album.songCount,
      duration: album.duration,
      starred: album.starred !== undefined,
      ...(album.coverArt ? { coverArtId: album.coverArt } : {}),
      tracks: album.song.map(mapTrack)
    }
  }

  async getArtists(
    baseUrl: string,
    username: string,
    password: string
  ): Promise<Array<Omit<ArtistIndex, 'artists'> & { artists: ArtistWithCover[] }>> {
    const response = await this.request('getArtists', baseUrl, username, password)
    return (response.artists?.index ?? []).map((index) => ({
      name: index.name,
      artists: index.artist.map(mapArtist)
    }))
  }

  async getArtist(
    baseUrl: string,
    username: string,
    password: string,
    artistId: string
  ): Promise<Omit<ArtistDetail, 'coverUrl' | 'albums'> & {
    coverArtId?: string | undefined
    albums: AlbumWithCover[]
  }> {
    const response = await this.request('getArtist', baseUrl, username, password, { id: artistId })
    if (!response.artist) {
      throw new ConnectionFailure('invalid-response', '服务器未返回艺术家详情。', false)
    }

    return {
      ...mapArtist(response.artist),
      albums: response.artist.album.map(mapAlbum)
    }
  }

  async search3(
    baseUrl: string,
    username: string,
    password: string,
    query: string,
    offset: number,
    size: number,
    signal?: AbortSignal
  ): Promise<Omit<SearchResultPage, 'nextOffset' | 'hasMore' | 'artists' | 'albums' | 'tracks'> & {
    artists: ArtistWithCover[]
    albums: AlbumWithCover[]
    tracks: TrackWithCover[]
  }> {
    const response = await this.request(
      'search3',
      baseUrl,
      username,
      password,
      {
        query,
        artistCount: size,
        artistOffset: offset,
        albumCount: size,
        albumOffset: offset,
        songCount: size,
        songOffset: offset
      },
      signal
    )
    const result = response.searchResult3
    return {
      artists: (result?.artist ?? []).map(mapArtist),
      albums: (result?.album ?? []).map(mapAlbum),
      tracks: (result?.song ?? []).map(mapTrack)
    }
  }

  async getStarred2(
    baseUrl: string,
    username: string,
    password: string
  ): Promise<{
    artists: ArtistWithCover[]
    albums: AlbumWithCover[]
    tracks: TrackWithCover[]
  }> {
    const response = await this.request('getStarred2', baseUrl, username, password)
    return {
      artists: (response.starred2?.artist ?? []).map(mapArtist),
      albums: (response.starred2?.album ?? []).map(mapAlbum),
      tracks: (response.starred2?.song ?? []).map(mapTrack)
    }
  }

  async setStarred(
    baseUrl: string,
    username: string,
    password: string,
    targetType: StarTargetType,
    targetId: string,
    starred: boolean
  ): Promise<void> {
    const parameter = targetType === 'track' ? 'id' : `${targetType}Id`
    await this.request(starred ? 'star' : 'unstar', baseUrl, username, password, {
      [parameter]: targetId
    })
  }

  async getPlaylists(
    baseUrl: string,
    username: string,
    password: string
  ): Promise<PlaylistSummary[]> {
    const response = await this.request('getPlaylists', baseUrl, username, password)
    return (response.playlists?.playlist ?? []).map(mapPlaylist)
  }

  async getPlaylist(
    baseUrl: string,
    username: string,
    password: string,
    playlistId: string
  ): Promise<Omit<PlaylistDetail, 'tracks'> & { tracks: TrackWithCover[] }> {
    const response = await this.request('getPlaylist', baseUrl, username, password, {
      id: playlistId
    })
    if (!response.playlist) {
      throw new ConnectionFailure('invalid-response', '服务器未返回歌单详情。', false)
    }
    return { ...mapPlaylist(response.playlist), tracks: response.playlist.entry.map(mapTrack) }
  }

  async createPlaylist(
    baseUrl: string,
    username: string,
    password: string,
    name: string,
    songIds: string[]
  ): Promise<void> {
    await this.request('createPlaylist', baseUrl, username, password, {
      name,
      ...(songIds.length > 0 ? { songId: songIds } : {})
    })
  }

  async updatePlaylist(
    baseUrl: string,
    username: string,
    password: string,
    playlistId: string,
    changes: {
      name?: string | undefined
      comment?: string | undefined
      public?: boolean | undefined
      songIdsToAdd?: string[] | undefined
      songIndexesToRemove?: number[] | undefined
    }
  ): Promise<void> {
    const parameters: EndpointParameters = { playlistId }
    if (changes.name !== undefined) parameters.name = changes.name
    if (changes.comment !== undefined) parameters.comment = changes.comment
    if (changes.public !== undefined) parameters.public = changes.public
    if (changes.songIdsToAdd?.length) parameters.songIdToAdd = changes.songIdsToAdd
    if (changes.songIndexesToRemove?.length) {
      parameters.songIndexToRemove = changes.songIndexesToRemove
    }
    await this.request('updatePlaylist', baseUrl, username, password, parameters)
  }

  async deletePlaylist(
    baseUrl: string,
    username: string,
    password: string,
    playlistId: string
  ): Promise<void> {
    await this.request('deletePlaylist', baseUrl, username, password, { id: playlistId })
  }

  async getLyricsBySongId(
    baseUrl: string,
    username: string,
    password: string,
    trackId: string
  ): Promise<LyricsPayload> {
    const response = await this.request('getLyricsBySongId', baseUrl, username, password, {
      id: trackId
    })
    const variants = (response.lyricsList?.structuredLyrics ?? []).map(mapStructuredLyrics)
    return { source: variants.length > 0 ? 'structured' : 'none', variants }
  }

  async getLyrics(
    baseUrl: string,
    username: string,
    password: string,
    artist: string,
    title: string
  ): Promise<LyricsPayload> {
    const response = await this.request('getLyrics', baseUrl, username, password, {
      artist,
      title
    })
    const lyrics = response.lyrics
    if (!lyrics?.value) return { source: 'none', variants: [] }

    return {
      source: 'legacy',
      variants: [
        {
          ...(lyrics.artist ? { displayArtist: lyrics.artist } : {}),
          ...(lyrics.title ? { displayTitle: lyrics.title } : {}),
          offsetMs: 0,
          synced: false,
          lines: lyrics.value.split(/\r?\n/).map((value) => ({ value }))
        }
      ]
    }
  }

  async scrobble(
    baseUrl: string,
    username: string,
    password: string,
    trackId: string,
    submission: boolean,
    playedAtMs: number
  ): Promise<void> {
    await this.request('scrobble', baseUrl, username, password, {
      id: trackId,
      time: playedAtMs,
      submission
    })
  }

  private async request(
    endpoint: ConnectionEndpoint,
    baseUrl: string,
    username: string,
    password: string,
    parameters: EndpointParameters = {},
    externalSignal?: AbortSignal
  ): Promise<ParsedResponse> {
    const timeoutController = new AbortController()
    const signal = externalSignal
      ? AbortSignal.any([timeoutController.signal, externalSignal])
      : timeoutController.signal
    const timeout = setTimeout(() => timeoutController.abort(), RESPONSE_TIMEOUT_MS)

    try {
      const url = buildEndpointUrl(baseUrl, endpoint, username, password, undefined, parameters)
      const response = await this.transport.request(url, signal)
      return parseResponse(response)
    } catch (error) {
      if (error instanceof ConnectionFailure) throw error
      if (error instanceof ResponseLimitError) {
        throw new ConnectionFailure('response-too-large', '服务器响应超过安全大小限制。', false)
      }
      throw classifyNetworkError(error, timeoutController.signal.aborted)
    } finally {
      clearTimeout(timeout)
    }
  }
}
