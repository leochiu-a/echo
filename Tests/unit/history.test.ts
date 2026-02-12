import { describe, expect, it } from 'vitest'
import { applyRetention, normalizeResponseText, tokenSummary } from '@shared/domain/history'
import type { PromptHistoryEntry } from '@shared/domain/types'

function makeEntry(params: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry {
  return {
    id: crypto.randomUUID(),
    command: params.command ?? 'command',
    action: params.action ?? 'edit',
    usedSelectionContext: params.usedSelectionContext ?? false,
    status: params.status ?? 'succeeded',
    detail: params.detail ?? 'ok',
    responseText: params.responseText ?? 'text',
    inputTokens: params.inputTokens ?? null,
    outputTokens: params.outputTokens ?? null,
    totalTokens: params.totalTokens ?? null,
    createdAt: params.createdAt ?? new Date().toISOString()
  }
}

describe('history domain rules', () => {
  it('token summary aggregates totals and fallback totals', () => {
    const summary = tokenSummary([
      makeEntry({ inputTokens: 100, outputTokens: 40, totalTokens: 140 }),
      makeEntry({ inputTokens: 50, outputTokens: null, totalTokens: null }),
      makeEntry({ inputTokens: null, outputTokens: 30, totalTokens: null })
    ])

    expect(summary.totalInputTokens).toBe(150)
    expect(summary.totalOutputTokens).toBe(70)
    expect(summary.totalTokens).toBe(220)
    expect(summary.inputTokenRunCount).toBe(2)
    expect(summary.outputTokenRunCount).toBe(2)
    expect(summary.tokenizedRunCount).toBe(3)
  })

  it('retention filters expired entries', () => {
    const now = Date.now()
    const oldEntry = makeEntry({ createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString() })
    const newEntry = makeEntry({ createdAt: new Date(now).toISOString(), command: 'new command' })

    const retained = applyRetention([oldEntry, newEntry], 'sevenDays')
    expect(retained).toHaveLength(1)
    expect(retained[0]?.command).toBe('new command')
  })

  it('response text is capped to 8000 chars', () => {
    const longText = 'a'.repeat(8100)
    const normalized = normalizeResponseText(longText)

    expect(normalized?.length).toBe(8000)
    expect(normalized?.endsWith('...')).toBe(true)
  })
})
