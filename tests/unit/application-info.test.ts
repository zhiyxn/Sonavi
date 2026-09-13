import { describe, expect, it } from 'vitest'
import { ApplicationInfoSchema } from '../../src/shared/application-schema'

describe('ApplicationInfoSchema', () => {
  it('接受类型明确的 Windows 平台信息', () => {
    expect(
      ApplicationInfoSchema.parse({
        name: 'Sonavi',
        version: '0.1.0',
        platform: 'windows',
        platformLabel: 'Windows',
        shortcutModifier: 'Ctrl',
        closeBehavior: 'quit',
        canHideToBackground: false
      })
    ).toMatchObject({ platform: 'windows', shortcutModifier: 'Ctrl' })
  })

  it('拒绝越过契约的进程细节', () => {
    expect(() =>
      ApplicationInfoSchema.parse({
        name: 'Sonavi',
        version: '0.1.0',
        platform: process.platform,
        platformLabel: 'raw process.platform',
        shortcutModifier: 'Cmd',
        closeBehavior: 'quit',
        canHideToBackground: false
      })
    ).toThrow()
  })
})
