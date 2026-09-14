import { describe, expect, it } from 'vitest'
import {
  buildEndpointUrl,
  createAuthenticationToken,
  normalizeServerUrl,
  ServerUrlError
} from '../../src/main/services/opensubsonic/request-url'

describe('OpenSubsonic 请求 URL', () => {
  it('保留端口和子路径，并移除用户误填的 rest 后缀', () => {
    expect(normalizeServerUrl('https://music.example.com:8443/音乐/rest/', false)).toBe(
      'https://music.example.com:8443/%E9%9F%B3%E4%B9%90'
    )
  })

  it('默认拒绝 HTTP，并拒绝 URL 内嵌凭据或查询参数', () => {
    expect(() => normalizeServerUrl('http://music.example.com', false)).toThrow(ServerUrlError)
    expect(() => normalizeServerUrl('https://user:pass@music.example.com', false)).toThrow(
      '不能包含账号'
    )
    expect(() => normalizeServerUrl('https://music.example.com?token=secret', false)).toThrow(
      '不能包含账号'
    )
  })

  it('按规范生成 UTF-8 token/salt，URL 中不出现明文密码', () => {
    expect(createAuthenticationToken('sesame', 'c19b2d')).toBe(
      '26719a1196d2a940705a59634eb18eab'
    )

    const requestUrl = new URL(
      buildEndpointUrl(
        'https://music.example.com/subpath',
        'ping',
        '测试用户',
        '绝不进入 URL 的密码',
        'c19b2d'
      )
    )
    expect(requestUrl.pathname).toBe('/subpath/rest/ping.view')
    expect(requestUrl.searchParams.get('u')).toBe('测试用户')
    expect(requestUrl.searchParams.get('t')).toHaveLength(32)
    expect(requestUrl.searchParams.get('s')).toBe('c19b2d')
    expect(requestUrl.toString()).not.toContain('绝不进入')
    expect(requestUrl.searchParams.has('p')).toBe(false)
  })

  it('为歌单写操作保留重复参数的原始顺序', () => {
    const requestUrl = new URL(
      buildEndpointUrl(
        'https://music.example.com',
        'updatePlaylist',
        'listener',
        'secret',
        'fixed-salt',
        { playlistId: 'playlist-1', songIdToAdd: ['track-1', 'track-1', 'track-2'] }
      )
    )

    expect(requestUrl.searchParams.getAll('songIdToAdd')).toEqual([
      'track-1',
      'track-1',
      'track-2'
    ])
  })
})
