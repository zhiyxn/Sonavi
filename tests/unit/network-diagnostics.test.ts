import { describe, expect, it, vi } from 'vitest'
import {
  classifyNetworkError,
  NetworkDiagnosticRecorder,
  redactDiagnosticText
} from '../../src/main/services/network-diagnostics'
import { hasProtocolFailureBody } from '../../src/main/services/opensubsonic/transport'
import { PlaybackBufferDiagnosticRequestSchema } from '../../src/shared/network-schema'

describe('P08 连接诊断', () => {
  it('只导出脱敏结构字段并限制记录数量', () => {
    vi.spyOn(performance, 'now').mockReturnValue(25)
    const recorder = new NetworkDiagnosticRecorder()
    for (let index = 0; index < 250; index += 1) {
      recorder.record({
        stage: 'audio-transcode',
        proxyMode: 'manual',
        startedAt: 10,
        status: 403,
        contentType: 'text/xml',
        errorCategory: 'http-forbidden'
      })
    }

    expect(recorder.list()).toHaveLength(200)
    const exported = recorder.exportText()
    expect(exported).toContain('URL、账号、凭据、token、资源 ID')
    expect(exported).not.toContain('music.example.com')
    expect(Buffer.byteLength(exported, 'utf8')).toBeLessThanOrEqual(256 * 1024)
  })

  it('识别 HTTP 200 中的 JSON 或 XML 协议错误体', () => {
    expect(hasProtocolFailureBody('{"subsonic-response":{"status":"failed"}}')).toBe(true)
    expect(hasProtocolFailureBody('<subsonic-response status="failed"/>')).toBe(true)
    expect(hasProtocolFailureBody('{"subsonic-response":{"status":"ok"}}')).toBe(false)
  })

  it('把内部超时与调用方取消分开分类', () => {
    const abortError = new DOMException('This operation was aborted', 'AbortError')

    expect(classifyNetworkError(abortError, { timedOut: true })).toBe('timeout')
    expect(classifyNetworkError(abortError, { cancelledByCaller: true })).toBe('cancelled')
    expect(classifyNetworkError(abortError)).toBe('cancelled')
    expect(classifyNetworkError(new Error('net::ERR_CERT_AUTHORITY_INVALID'))).toBe('certificate')
    expect(classifyNetworkError(new Error('connect ECONNREFUSED'))).toBe('network')
  })

  it('超时记录给出检查网络与代理的建议', () => {
    const recorder = new NetworkDiagnosticRecorder()
    recorder.record({
      stage: 'api',
      proxyMode: 'system',
      startedAt: performance.now() - 12_010,
      operation: 'getArtists',
      requestContext: 'listType=newest,page=1,size=30',
      attempt: 2,
      errorCategory: 'timeout'
    })

    const [entry] = recorder.list()
    expect(entry).toMatchObject({
      operation: 'getArtists',
      requestContext: 'listType=newest,page=1,size=30',
      attempt: 2,
      errorCategory: 'timeout'
    })
    expect(entry?.recommendation).toContain('超时')
  })

  it('记录端点名与脱敏后的错误文本，不泄露 URL、凭据与 token', () => {
    const recorder = new NetworkDiagnosticRecorder()
    recorder.record({
      stage: 'api',
      proxyMode: 'system',
      startedAt: 0,
      operation: 'stream',
      errorCategory: 'timeout',
      error: new Error(
        'request to https://listener:secret@music.example.com/rest/stream.view?u=listener&t=token123&s=salt123 failed'
      )
    })

    const [entry] = recorder.list()
    expect(entry?.operation).toBe('stream')
    expect(entry?.errorName).toBe('Error')
    expect(entry?.errorDetail).toContain('failed')
    for (const leaked of ['music.example.com', 'secret', 'token123', 'salt123', 'u=listener']) {
      expect(entry?.errorDetail).not.toContain(leaked)
      expect(recorder.exportText()).not.toContain(leaked)
    }
  })

  it('脱敏函数移除 URL 与凭据参数', () => {
    expect(redactDiagnosticText('failed   at https://a.example/x?t=abc  ')).toBe('failed at <url>')
    expect(redactDiagnosticText('plain message')).toBe('plain message')
  })

  it('白名单化查询上下文并导出第三版结构', () => {
    const recorder = new NetworkDiagnosticRecorder()
    recorder.record({
      stage: 'api',
      proxyMode: 'system',
      startedAt: performance.now(),
      operation: 'getAlbumList2',
      requestContext: 'listType=newest,page=1,size=30',
      attempt: 1,
      errorCategory: 'none'
    })
    recorder.record({
      stage: 'api',
      proxyMode: 'system',
      startedAt: performance.now(),
      operation: 'getAlbumList2',
      requestContext: 'listType=newest,page=1,size=30,secret=do-not-record',
      errorCategory: 'none'
    })

    expect(recorder.list()[0]?.requestContext).toBeUndefined()
    expect(recorder.list()[1]?.requestContext).toBe('listType=newest,page=1,size=30')
    expect(recorder.exportText()).not.toContain('do-not-record')
    expect(JSON.parse(recorder.exportText())).toMatchObject({ schemaVersion: 3 })
  })

  it('缓冲事件只记录事件类型与持续时间，并拒绝身份字段', () => {
    const recorder = new NetworkDiagnosticRecorder()
    recorder.record({
      stage: 'playback-buffer',
      proxyMode: 'system',
      startedAt: performance.now(),
      event: 'buffer-start',
      durationMs: 0,
      errorCategory: 'none'
    })
    recorder.record({
      stage: 'playback-buffer',
      proxyMode: 'system',
      startedAt: performance.now(),
      event: 'buffer-end',
      durationMs: 1_234,
      errorCategory: 'none'
    })

    expect(recorder.list()[0]).toMatchObject({
      stage: 'playback-buffer',
      event: 'buffer-end',
      durationMs: 1_234
    })
    expect(recorder.exportText()).not.toMatch(/trackId|resourceId|https?:\/\//)
    expect(PlaybackBufferDiagnosticRequestSchema.safeParse({
      event: 'buffer-start',
      durationMs: 0,
      trackId: 'must-not-cross-ipc'
    }).success).toBe(false)
    expect(PlaybackBufferDiagnosticRequestSchema.safeParse({
      event: 'buffer-start',
      durationMs: 1
    }).success).toBe(false)
  })
})
