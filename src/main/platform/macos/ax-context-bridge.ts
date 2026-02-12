import { systemPreferences } from 'electron'
import { runAppleScript } from './apple-script'

const APPLE_SCRIPT_DELIMITER = '<<<ECHO_AX_DELIM_6A68A6F5>>>'

export interface OverlayContextSnapshot {
  selectedText: string | null
  hasEditableSelection: boolean
  accessibilityTrusted: boolean
}

export class MacOSAXContextBridge {
  private readonly maxSelectedTextLength = 12_000

  async captureSnapshot(): Promise<OverlayContextSnapshot> {
    const accessibilityTrusted = systemPreferences.isTrustedAccessibilityClient(false)
    if (!accessibilityTrusted) {
      return {
        selectedText: null,
        hasEditableSelection: false,
        accessibilityTrusted
      }
    }

    try {
      const output = await runAppleScript(`
        set selectedText to ""
        set editableFlag to false

        tell application "System Events"
          set frontApp to first process whose frontmost is true
          try
            set focusedElement to value of attribute "AXFocusedUIElement" of frontApp
            try
              set selectedText to value of attribute "AXSelectedText" of focusedElement
            end try
            try
              set editableFlag to value of attribute "AXEditable" of focusedElement
            end try
          end try
        end tell

        return selectedText & "${APPLE_SCRIPT_DELIMITER}" & (editableFlag as string)
      `)

      const delimiterIndex = output.lastIndexOf(APPLE_SCRIPT_DELIMITER)
      if (delimiterIndex < 0) {
        return {
          selectedText: null,
          hasEditableSelection: false,
          accessibilityTrusted
        }
      }

      const rawSelectedText = output.slice(0, delimiterIndex)
      const rawEditableFlag = output.slice(delimiterIndex + APPLE_SCRIPT_DELIMITER.length).trim().toLowerCase()

      const selectedText = this.normalizedSelectedText(rawSelectedText)
      return {
        selectedText,
        hasEditableSelection: selectedText !== null && rawEditableFlag === 'true',
        accessibilityTrusted
      }
    } catch {
      return {
        selectedText: null,
        hasEditableSelection: false,
        accessibilityTrusted
      }
    }
  }

  private normalizedSelectedText(text: string): string | null {
    const trimmed = text.trim()
    if (!trimmed) {
      return null
    }

    const withRecoveredLineBreaks = recoverLineBreaksIfNeeded(trimmed)
    return withRecoveredLineBreaks.slice(0, this.maxSelectedTextLength)
  }
}

function recoverLineBreaksIfNeeded(text: string): string {
  if (text.length < 100 || /\n/.test(text)) {
    return text
  }

  return text
    .replace(/([。！？；])/g, '$1\n')
    .replace(/([.!?;])\s+/g, '$1\n')
    .replace(/\s*\n\s*/g, '\n')
}
