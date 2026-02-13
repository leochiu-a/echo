import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'

const execFileAsync = promisify(execFile)
const CCUSAGE_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const CCUSAGE_ARGS = ['-y', '@ccusage/codex@latest', 'monthly', '--json']
const CCUSAGE_TIMEOUT_MS = 20_000
const CCUSAGE_MAX_BUFFER_BYTES = 8 * 1024 * 1024

const ccusageMonthlyEntrySchema = z.object({
  month: z.string().min(1),
  inputTokens: z.coerce.number().nonnegative(),
  cachedInputTokens: z.coerce.number().nonnegative(),
  outputTokens: z.coerce.number().nonnegative(),
  reasoningOutputTokens: z.coerce.number().nonnegative(),
  totalTokens: z.coerce.number().nonnegative(),
  costUSD: z.coerce.number().nonnegative()
})

const ccusageMonthlyResponseSchema = z.object({
  monthly: z.array(ccusageMonthlyEntrySchema)
})

export type CodexMonthlyUsageEntry = z.infer<typeof ccusageMonthlyEntrySchema>

export interface CodexMonthlyUsageSnapshot {
  source: 'ccusage'
  months: CodexMonthlyUsageEntry[]
  fetchedAt: string
  error: string | null
}

export class UsageService {
  async getMonthlySummary(): Promise<CodexMonthlyUsageSnapshot> {
    const fetchedAt = new Date().toISOString()

    try {
      const report = await this.readCCusageMonthlyReport()
      const months = sortMonthlyEntries(report.monthly)

      return {
        source: 'ccusage',
        months,
        fetchedAt,
        error: null
      }
    } catch (error) {
      return {
        source: 'ccusage',
        months: [],
        fetchedAt,
        error: error instanceof Error ? error.message : 'Failed to load CCusage monthly usage.'
      }
    }
  }

  private async readCCusageMonthlyReport() {
    const { stdout } = await execFileAsync(CCUSAGE_BIN, CCUSAGE_ARGS, {
      timeout: CCUSAGE_TIMEOUT_MS,
      maxBuffer: CCUSAGE_MAX_BUFFER_BYTES,
      env: process.env
    })

    const jsonPayload = extractJsonPayload(stdout)
    return ccusageMonthlyResponseSchema.parse(JSON.parse(jsonPayload))
  }
}

function extractJsonPayload(stdout: string): string {
  const text = `${stdout}`.trim()
  if (!text) {
    throw new Error('CCusage returned an empty response.')
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('CCusage response is not valid JSON.')
  }

  return text.slice(firstBrace, lastBrace + 1)
}

function sortMonthlyEntries(entries: CodexMonthlyUsageEntry[]): CodexMonthlyUsageEntry[] {
  return [...entries].sort((left, right) => {
    const leftDate = parseMonthLabel(left.month)
    const rightDate = parseMonthLabel(right.month)

    if (leftDate && rightDate) {
      return rightDate.getTime() - leftDate.getTime()
    }
    if (leftDate) {
      return -1
    }
    if (rightDate) {
      return 1
    }
    return right.month.localeCompare(left.month)
  })
}

function parseMonthLabel(monthLabel: string): Date | null {
  const parsed = new Date(`${monthLabel} 1`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}
