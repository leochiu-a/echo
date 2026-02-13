import type { CopilotAction } from '@shared/domain/types'

export interface OverlayContext {
  selectedText: string | null
  hasEditableSelection: boolean
  accessibilityTrusted: boolean
}

export interface HistorySnapshot {
  entries: {
    id: string
    command: string
    action: CopilotAction
    usedSelectionContext: boolean
    status: 'succeeded' | 'failed' | 'cancelled'
    detail: string
    responseText: string | null
    inputTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
    createdAt: string
  }[]
  commands: string[]
  retentionPolicy: 'forever' | 'sevenDays' | 'thirtyDays' | 'ninetyDays'
  tokenSummary: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    inputTokenRunCount: number
    outputTokenRunCount: number
    tokenizedRunCount: number
  }
}

export interface SlashSuggestion {
  id: string
  command: string
  prompt: string
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function previewPrompt(prompt: string): string {
  const singleLine = prompt.replace(/\n+/g, ' ').trim()
  if (singleLine.length <= 96) {
    return singleLine
  }
  return `${singleLine.slice(0, 93)}...`
}
