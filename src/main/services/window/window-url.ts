import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

export async function loadRendererView(window: BrowserWindow, view: 'overlay' | 'dashboard'): Promise<void> {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    await window.loadURL(`${rendererUrl}/?view=${view}`)
    return
  }

  const rendererDist = process.env.ECHO_RENDERER_DIST
  if (!rendererDist) {
    throw new Error('Missing renderer dist path.')
  }

  await window.loadFile(join(rendererDist, 'index.html'), {
    query: { view }
  })
}
