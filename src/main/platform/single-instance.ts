export interface SingleInstanceDependencies {
  requestLock: () => boolean
  quit: () => void
  onSecondInstance: (listener: () => void) => void
  removeSecondInstanceListener: (listener: () => void) => void
}

export class SingleInstanceController {
  private acquired = false
  private pendingWindowShow = false
  private showPrimaryWindow: (() => void) | null = null
  private readonly onSecondInstance = (): void => {
    if (this.showPrimaryWindow) this.showPrimaryWindow()
    else this.pendingWindowShow = true
  }

  constructor(private readonly dependencies: SingleInstanceDependencies) {}

  acquire(): boolean {
    if (this.acquired) return true
    if (!this.dependencies.requestLock()) {
      this.dependencies.quit()
      return false
    }

    this.acquired = true
    this.dependencies.onSecondInstance(this.onSecondInstance)
    return true
  }

  setShowPrimaryWindow(showPrimaryWindow: () => void): void {
    this.showPrimaryWindow = showPrimaryWindow
    if (!this.pendingWindowShow) return

    this.pendingWindowShow = false
    showPrimaryWindow()
  }

  dispose(): void {
    if (!this.acquired) return
    this.dependencies.removeSecondInstanceListener(this.onSecondInstance)
    this.acquired = false
    this.pendingWindowShow = false
    this.showPrimaryWindow = null
  }
}
