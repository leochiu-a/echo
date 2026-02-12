import { app } from 'electron'
import { join } from 'node:path'
import { AppCoordinator } from './app/app-coordinator'
import { registerIpcHandlers } from './ipc/register-ipc'

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

const preloadPath = join(__dirname, '../preload/index.js')
process.env.ECHO_RENDERER_DIST = join(__dirname, '../renderer')
const coordinator = new AppCoordinator(preloadPath)

app.on('second-instance', () => {
  void coordinator.toggleOverlayFromHotkey()
})

app.whenReady().then(async () => {
  registerIpcHandlers(coordinator)
  await coordinator.start()

  // In local dev, open a visible entry window so startup is discoverable.
  if (process.env.VITE_DEV_SERVER_URL) {
    await coordinator.openDashboard()
  }
})

app.on('activate', () => {
  // Keep behavior minimal: overlay is hotkey-driven by default.
})

app.on('before-quit', () => {
  void coordinator.stop()
})
