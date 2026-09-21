import { describe, expect, it, vi } from 'vitest'
import { SingleInstanceController } from '../../src/main/platform/single-instance'

function createHarness(hasLock: boolean) {
  let secondInstanceListener: (() => void) | null = null
  const requestLock = vi.fn(() => hasLock)
  const quit = vi.fn()
  const onSecondInstance = vi.fn((listener: () => void) => {
    secondInstanceListener = listener
  })
  const removeSecondInstanceListener = vi.fn()
  const controller = new SingleInstanceController({
    requestLock,
    quit,
    onSecondInstance,
    removeSecondInstanceListener
  })

  return {
    controller,
    requestLock,
    quit,
    onSecondInstance,
    removeSecondInstanceListener,
    emitSecondInstance: () => secondInstanceListener?.()
  }
}

describe('应用单实例生命周期', () => {
  it('未取得锁的后续进程立即退出且不监听重复启动事件', () => {
    const harness = createHarness(false)

    expect(harness.controller.acquire()).toBe(false)
    expect(harness.requestLock).toHaveBeenCalledOnce()
    expect(harness.quit).toHaveBeenCalledOnce()
    expect(harness.onSecondInstance).not.toHaveBeenCalled()
  })

  it('主实例收到重复启动时只唤醒既有窗口', () => {
    const harness = createHarness(true)
    const showPrimaryWindow = vi.fn()

    expect(harness.controller.acquire()).toBe(true)
    harness.controller.setShowPrimaryWindow(showPrimaryWindow)
    harness.emitSecondInstance()
    harness.emitSecondInstance()

    expect(harness.quit).not.toHaveBeenCalled()
    expect(showPrimaryWindow).toHaveBeenCalledTimes(2)
  })

  it('窗口初始化期间的重复启动在窗口可用后补执行一次唤醒', () => {
    const harness = createHarness(true)
    const showPrimaryWindow = vi.fn()

    harness.controller.acquire()
    harness.emitSecondInstance()
    harness.emitSecondInstance()
    expect(showPrimaryWindow).not.toHaveBeenCalled()

    harness.controller.setShowPrimaryWindow(showPrimaryWindow)
    expect(showPrimaryWindow).toHaveBeenCalledOnce()
  })

  it('释放时移除主实例监听器', () => {
    const harness = createHarness(true)

    harness.controller.acquire()
    harness.controller.dispose()

    expect(harness.removeSecondInstanceListener).toHaveBeenCalledOnce()
  })
})
