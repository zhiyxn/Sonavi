import { describe, expect, it, vi } from 'vitest'
import { createTrayMenuTemplate } from '../../src/main/platform/desktop-integration'
import {
  createPausedQueuePersistence,
  isSettingsShortcut,
  shouldIgnoreDesktopShortcut
} from '../../src/renderer/src/composables/use-desktop-integration'
import type { SavePausedQueueRequest } from '../../src/shared/desktop'

const queueRequest = (title: string): SavePausedQueueRequest => ({
  sessionId: 'session-id',
  tracks: [{ id: 'track-id', title, artist: 'Artist', album: 'Album', duration: 120, starred: false }],
  currentIndex: 0,
  playbackOrder: 'sequential',
  repeatMode: 'off'
})

describe('P09 桌面集成', () => {
  it('托盘区分播放控制、显示窗口与真正退出', () => {
    const showWindow = vi.fn()
    const sendCommand = vi.fn()
    const quit = vi.fn()
    const template = createTrayMenuTemplate(
      { hasTrack: true, isPlaying: true, canGoPrevious: true, canGoNext: false },
      { showWindow, sendCommand, quit }
    )

    expect(template.map((item) => item.label).filter(Boolean)).toEqual([
      '显示 Sonavi', '暂停', '上一首', '下一首', '退出 Sonavi'
    ])
    ;(template[0]?.click as () => void)()
    ;(template[2]?.click as () => void)()
    ;(template[6]?.click as () => void)()
    expect(showWindow).toHaveBeenCalledOnce()
    expect(sendCommand).toHaveBeenCalledWith('toggle-playback')
    expect(quit).toHaveBeenCalledOnce()
    expect(template[4]?.enabled).toBe(false)
  })

  it('编辑控件中的空格不会被播放器快捷键截获', () => {
    const input = document.createElement('input')
    const button = document.createElement('button')
    const plain = document.createElement('div')
    expect(shouldIgnoreDesktopShortcut(input)).toBe(true)
    expect(shouldIgnoreDesktopShortcut(button)).toBe(true)
    expect(shouldIgnoreDesktopShortcut(plain)).toBe(false)
  })

  it('设置快捷键只匹配当前平台修饰键且不截获输入控件', () => {
    const plain = document.createElement('div')
    const input = document.createElement('input')
    const base = { key: ',', altKey: false, shiftKey: false }
    expect(isSettingsShortcut({ ...base, ctrlKey: true, metaKey: false, target: plain }, 'Ctrl')).toBe(true)
    expect(isSettingsShortcut({ ...base, ctrlKey: false, metaKey: true, target: plain }, 'Cmd')).toBe(true)
    expect(isSettingsShortcut({ ...base, ctrlKey: true, metaKey: false, target: plain }, 'Cmd')).toBe(false)
    expect(isSettingsShortcut({ ...base, ctrlKey: true, metaKey: false, target: input }, 'Ctrl')).toBe(false)
  })

  it('显式 flush 取消防抖并等待最新暂停队列写入完成', async () => {
    let finishSave: ((saved: boolean) => void) | undefined
    const persist = vi.fn(() => new Promise<boolean>((resolve) => { finishSave = resolve }))
    const persistence = createPausedQueuePersistence(persist, 60_000)
    persistence.schedule(queueRequest('旧快照'))

    let flushed = false
    const flushPromise = persistence.flush(queueRequest('最新快照')).then((result) => {
      flushed = true
      return result
    })

    await vi.waitFor(() => expect(persist).toHaveBeenCalledOnce())
    expect(persist).toHaveBeenCalledWith(queueRequest('最新快照'))
    expect(flushed).toBe(false)
    finishSave?.(true)
    await expect(flushPromise).resolves.toBe(true)
    expect(flushed).toBe(true)
  })
})
