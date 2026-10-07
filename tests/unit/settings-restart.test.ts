import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { SonaviApi } from '../../src/shared/application'
import type { DesktopPreferences } from '../../src/shared/desktop'
import SettingsPanel from '../../src/renderer/src/components/SettingsPanel.vue'
import { setActiveLanguage } from '../../src/renderer/src/i18n'

afterEach(() => {
  setActiveLanguage('zh-CN')
  Reflect.deleteProperty(window, 'sonavi')
  document.body.innerHTML = ''
})

describe('设置页安全重启', () => {
  it('取消不调用 IPC，确认后只请求一次重启', async () => {
    const restartApplication = vi.fn(async () => true)
    const updatePreferences = vi.fn(async (preferences: DesktopPreferences) => preferences)
    const checkForUpdates = vi.fn(async () => ({ status: 'available', version: '0.1.0-rc.8', downloadAvailable: true }))
    const openReleasesPage = vi.fn(async () => true)
    const downloadUpdate = vi.fn(async () => true)
    Object.defineProperty(window, 'sonavi', {
      value: {
        application: { checkForUpdates, openReleasesPage, downloadUpdate },
        desktop: {
          getPreferences: async () => ({
            closeAction: 'hide',
            theme: 'system',
            language: 'zh-CN',
            checkUpdatesOnStartup: true,
            volume: 1
          }),
          updatePreferences,
          restartApplication,
          getCoverCacheInfo: async () => ({
            itemCount: 0,
            totalBytes: 0,
            maxBytes: 134_217_728
          })
        },
        network: {
          getSettings: async () => ({
            playback: { mode: 'automatic', maxBitRate: 320 },
            proxy: { mode: 'system' }
          }),
          listDiagnostics: async () => []
        }
      } as unknown as SonaviApi,
      configurable: true
    })

    const wrapper = mount(SettingsPanel, {
      props: {
        applicationInfo: {
          name: 'Sonavi',
          version: '0.1.0',
          platform: 'windows',
          platformLabel: 'Windows',
          shortcutModifier: 'Ctrl',
          closeBehavior: 'hide-window',
          canHideToBackground: true
        },
        connection: {
          ok: true,
          sessionId: '1e2d7353-9554-46a5-84fe-89b53008f01d',
          server: {
            baseUrl: 'https://music.example.com',
            protocolVersion: '1.16.1',
            openSubsonic: true,
            capabilityStatus: 'available',
            extensions: [],
            musicFolders: []
          },
          credentialPersistence: 'encrypted'
        }
      },
      global: { plugins: [createPinia()] }
    })
    await flushPromises()

    expect(wrapper.find('#interface-language').exists()).toBe(true)
    expect(wrapper.find('#check-updates-on-startup').attributes('data-state')).toBe('checked')
    await wrapper.get('#check-updates-on-startup').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ checkUpdatesOnStartup: false }))
    const updateButton = wrapper.findAll('button').find((button) => button.text() === '检查更新')
    await updateButton?.trigger('click')
    await flushPromises()
    expect(checkForUpdates).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('发现新版本：0.1.0-rc.8')
    const downloadButton = wrapper.findAll('button').find((button) => button.text() === '下载当前系统安装包')
    await downloadButton?.trigger('click')
    await flushPromises()
    expect(downloadUpdate).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('已在默认浏览器中打开下载链接。')
    const releasesButton = wrapper.findAll('button').find((button) => button.text() === '查看发布页')
    await releasesButton?.trigger('click')
    expect(openReleasesPage).toHaveBeenCalledOnce()
    checkForUpdates.mockResolvedValueOnce({
      status: 'available', version: '0.1.0-rc.8', downloadAvailable: false
    })
    await updateButton?.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('button').some((button) => button.text() === '下载当前系统安装包')).toBe(false)
    expect(wrapper.findAll('button').some((button) => button.text() === '查看发布页')).toBe(true)
    checkForUpdates.mockRejectedValueOnce(new Error('offline'))
    await updateButton?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('检查更新失败，请检查网络或稍后重试。')
    expect(wrapper.text()).toContain('界面语言')
    setActiveLanguage('en-US')
    await nextTick()
    expect(wrapper.get('#close-action').text()).toBe('Hide the window and keep playing (default)')
    expect(wrapper.get('#appearance-theme').text()).toBe('Use system setting')
    expect(wrapper.get('#interface-language').text()).toBe('Simplified Chinese')
    expect(wrapper.get('#playback-mode').text()).toBe(
      'Automatic (prefer original for known formats, otherwise transcode)'
    )
    expect(wrapper.get('#max-bitrate').text()).toBe('320 kbps')
    expect(wrapper.get('#proxy-mode').text()).toBe('Use system proxy')
    setActiveLanguage('zh-CN')
    await nextTick()

    const restartButton = wrapper.findAll('button')
      .find((button) => button.text() === '重启 Sonavi')
    expect(restartButton).toBeDefined()
    await restartButton?.trigger('click')
    await flushPromises()
    expect(restartApplication).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('重启 Sonavi？')

    const cancelButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '取消')
    cancelButton?.click()
    await flushPromises()
    expect(restartApplication).not.toHaveBeenCalled()

    await restartButton?.trigger('click')
    await flushPromises()
    const confirmButton = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '确认重启')
    confirmButton?.click()
    await flushPromises()
    expect(restartApplication).toHaveBeenCalledOnce()

    wrapper.unmount()
  })
})
