import { describe, expect, it, vi } from 'vitest'
import { NetworkDiagnosticRecorder } from '../../src/main/services/network-diagnostics'
import { hasProtocolFailureBody } from '../../src/main/services/opensubsonic/transport'

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
})
