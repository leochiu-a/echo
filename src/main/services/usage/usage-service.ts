import type { PromptHistoryEntry } from '@shared/domain/types'

export interface MonthlyUsageSummary {
  month: string
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  runCount: number
}

export class UsageService {
  summarizeCurrentMonth(entries: PromptHistoryEntry[], now = new Date()): MonthlyUsageSummary {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    let totalTokens = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let runCount = 0

    for (const entry of entries) {
      const createdAt = new Date(entry.createdAt)
      if (Number.isNaN(createdAt.getTime()) || createdAt < monthStart) {
        continue
      }

      totalTokens += Math.max(0, entry.totalTokens ?? 0)
      totalInputTokens += Math.max(0, entry.inputTokens ?? 0)
      totalOutputTokens += Math.max(0, entry.outputTokens ?? 0)
      runCount += 1
    }

    return {
      month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      runCount
    }
  }
}
