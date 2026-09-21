import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ServerManagementPanel from '../../src/renderer/src/components/ServerManagementPanel.vue'
import {
  deleteSavedConnection,
  listSavedConnections
} from '../../src/renderer/src/services/connection'

vi.mock('../../src/renderer/src/services/connection', () => ({
  deleteSavedConnection: vi.fn(),
  listSavedConnections: vi.fn()
}))

const currentProfileId = '82c3080c-82dc-4d4d-b7da-a610f9efffb4'
const secondProfileId = '3f85e2e9-405a-4af5-84c4-2a5bfe8e7a6c'

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('服务器管理', () => {
  it('列出账号并提供添加、更新、切换和删除非当前服务器', async () => {
    vi.mocked(listSavedConnections).mockResolvedValue([
      {
        id: currentProfileId,
        serverUrl: 'https://one.example.com',
        username: 'listener-one',
        isDefault: true
      },
      {
        id: secondProfileId,
        serverUrl: 'https://two.example.com',
        username: 'listener-two',
        isDefault: false
      }
    ])
    vi.mocked(deleteSavedConnection).mockResolvedValue(true)
    const wrapper = mount(ServerManagementPanel, {
      attachTo: document.body,
      props: {
        connection: {
          ok: true,
          sessionId: '1e2d7353-9554-46a5-84fe-89b53008f01d',
          server: {
            baseUrl: 'https://one.example.com',
            protocolVersion: '1.16.1',
            openSubsonic: true,
            capabilityStatus: 'available',
            extensions: [],
            musicFolders: []
          },
          credentialPersistence: 'encrypted',
          profileId: currentProfileId
        }
      }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('listener-one')
    expect(wrapper.text()).toContain('listener-two')
    expect(wrapper.text()).not.toContain('secret')
    await wrapper.get('button[aria-label="切换到 https://two.example.com · listener-two"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('switch')).toBeUndefined()
    expect(document.body.textContent).toContain('切换服务器？')
    const cancelSwitch = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '取消')
    cancelSwitch?.click()
    await flushPromises()
    expect(wrapper.emitted('switch')).toBeUndefined()

    await wrapper.get('button[aria-label="切换到 https://two.example.com · listener-two"]').trigger('click')
    await flushPromises()
    const confirmSwitch = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '确认切换')
    expect(confirmSwitch).toBeDefined()
    confirmSwitch?.click()
    await flushPromises()
    expect(wrapper.emitted('switch')?.[0]).toEqual([secondProfileId])
    await wrapper.get('button[aria-label="编辑 https://two.example.com · listener-two"]').trigger('click')
    expect(wrapper.emitted('edit')?.[0]?.[0]).toMatchObject({ id: secondProfileId })
    await wrapper.get('button[aria-label="删除 https://two.example.com · listener-two"]').trigger('click')
    await flushPromises()
    const confirm = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === '删除服务器')
    expect(confirm).toBeDefined()
    confirm?.click()
    await flushPromises()
    expect(deleteSavedConnection).toHaveBeenCalledWith(secondProfileId)

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('add')).toBeTruthy()
  })
})
