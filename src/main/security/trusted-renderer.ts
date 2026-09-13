import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

function isExpectedDevelopmentUrl(frameUrl: string, developmentUrl: string): boolean {
  const actual = new URL(frameUrl)
  const expected = new URL(developmentUrl)
  return actual.origin === expected.origin
}

function isExpectedPackagedUrl(frameUrl: string): boolean {
  if (!frameUrl.startsWith('file:')) return false
  const expectedPath = resolve(import.meta.dirname, '../renderer/index.html')
  return resolve(fileURLToPath(frameUrl)) === expectedPath
}

export function isTrustedRendererUrl(frameUrl: string, developmentUrl?: string): boolean {
  try {
    return developmentUrl
      ? isExpectedDevelopmentUrl(frameUrl, developmentUrl)
      : isExpectedPackagedUrl(frameUrl)
  } catch {
    return false
  }
}

export function assertTrustedIpcSender(
  event: IpcMainInvokeEvent,
  developmentUrl = process.env.ELECTRON_RENDERER_URL
): void {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const frame = event.senderFrame

  if (!owner || !frame || frame !== event.sender.mainFrame) {
    throw new Error('拒绝非主应用窗口的 IPC 请求')
  }

  if (!isTrustedRendererUrl(frame.url, developmentUrl)) {
    throw new Error('拒绝不受信任来源的 IPC 请求')
  }
}
