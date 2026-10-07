import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { DesktopPreferencesSchema } from '../../src/shared/desktop-schema'
import { hasEnglishTranslation, translate } from '../../src/shared/localization'
import { macosAdapter } from '../../src/main/platform/macos'
import { windowsAdapter } from '../../src/main/platform/windows'
import { getActiveLanguage, setActiveLanguage, t } from '../../src/renderer/src/i18n'

describe('P28 双语与安装包 locale', () => {
  it('桌面偏好只接受简体中文和英文', () => {
    const base = { closeAction: 'hide', theme: 'system', checkUpdatesOnStartup: true, volume: 1 }
    expect(DesktopPreferencesSchema.parse({ ...base, language: 'zh-CN' }).language).toBe('zh-CN')
    expect(DesktopPreferencesSchema.parse({ ...base, language: 'en-US' }).language).toBe('en-US')
    expect(() => DesktopPreferencesSchema.parse({ ...base, language: 'fr-FR' })).toThrow()
  })

  it('共享字典支持插值并以中文为稳定源文案', () => {
    expect(translate('zh-CN', '设置')).toBe('设置')
    expect(translate('en-US', '设置')).toBe('Settings')
    expect(translate('en-US', '第 {page} 页', { page: 3 })).toBe('Page 3')
  })

  it('renderer 切换语言时立即更新文案和文档语言', () => {
    setActiveLanguage('en-US')
    expect(getActiveLanguage()).toBe('en-US')
    expect(t('设置')).toBe('Settings')
    expect(document.documentElement.lang).toBe('en-US')

    setActiveLanguage('zh-CN')
    expect(t('设置')).toBe('设置')
  })

  it('renderer 中所有中文 t() 字面量都有英文翻译', async () => {
    const paths = (await readdir('src/renderer/src', { recursive: true }))
      .filter((path) => path.endsWith('.ts') || path.endsWith('.vue'))
    const missing = new Set<string>()
    for (const path of paths) {
      const source = await readFile(`src/renderer/src/${path}`, 'utf8')
      for (const match of source.matchAll(/\bt\('([^']*[\u3400-\u9fff][^']*)'/g)) {
        if (!hasEnglishTranslation(match[1]!)) missing.add(match[1]!)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('Windows 与 macOS 应用菜单使用已保存语言', () => {
    expect(windowsAdapter.createMenuTemplate('Sonavi', 'en-US')[0]?.label).toBe('File')
    expect(macosAdapter.createMenuTemplate('Sonavi', 'en-US')[1]?.label).toBe('Edit')
    expect(windowsAdapter.createMenuTemplate('Sonavi', 'zh-CN')[0]?.label).toBe('文件')
  })

  it('electron-builder 只保留中文与英文 Electron locale', async () => {
    const config = await readFile('electron-builder.yml', 'utf8')
    expect(config).toMatch(/win:[\s\S]*?electronLanguages:\s*\n\s*- zh-CN\s*\n\s*- en-US/)
    expect(config).toMatch(/mac:[\s\S]*?electronLanguages:\s*\n\s*- zh_CN\s*\n\s*- en-US/)
  })
})
