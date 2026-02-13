import { clipboard } from 'electron'
import { runAppleScript } from './apple-script'

export type ApplyMode = 'replace' | 'insert'

export class MacOSApplyOutputBridge {
  async applyOutput(text: string, mode: ApplyMode): Promise<boolean> {
    const normalized = text.trim()
    if (!normalized) {
      return false
    }

    clipboard.writeText(normalized)

    // Keep this focused on keystroke automation because Electron has no native
    // cross-app replace/insert API on macOS.
    const script =
      mode === 'insert'
        ? `
            tell application "System Events"
              key code 124
              keystroke "v" using command down
            end tell
          `
        : `
            tell application "System Events"
              keystroke "v" using command down
            end tell
          `

    try {
      await runAppleScript(script)
      return true
    } catch {
      return false
    }
  }
}
