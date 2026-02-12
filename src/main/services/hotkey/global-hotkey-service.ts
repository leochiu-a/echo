import { app, globalShortcut } from 'electron'

export class GlobalHotkeyService {
  private registeredShortcut: string | null = null
  private onPressed: (() => void) | null = null

  bind(onPressed: () => void): void {
    this.onPressed = onPressed
  }

  register(shortcut: string): void {
    if (!shortcut.trim()) {
      return
    }

    this.unregister()

    const registered = globalShortcut.register(shortcut, () => {
      this.onPressed?.()
    })

    if (!registered) {
      throw new Error(`Failed to register global shortcut: ${shortcut}`)
    }

    this.registeredShortcut = shortcut
  }

  unregister(): void {
    if (this.registeredShortcut) {
      globalShortcut.unregister(this.registeredShortcut)
      this.registeredShortcut = null
      return
    }

    globalShortcut.unregisterAll()
  }

  dispose(): void {
    this.unregister()
  }
}

export function ensureShortcutLifecycle(hotkeyService: GlobalHotkeyService): void {
  app.on('will-quit', () => {
    hotkeyService.dispose()
  })
}
