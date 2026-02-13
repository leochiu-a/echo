import { CalendarClock, LayoutGrid } from 'lucide-react'
import { DashboardSubsectionHeader } from '../components/DashboardSubsectionHeader'
import type { CodexMonthlyUsageSnapshot, HistorySnapshot } from '../dashboard-shared'
import { formatNumber } from '../dashboard-shared'

interface HomeSectionProps {
  history: HistorySnapshot
  monthlyUsage: CodexMonthlyUsageSnapshot | null
  gaugeAngle: number
}

export function HomeSection({ history, monthlyUsage, gaugeAngle }: HomeSectionProps) {
  const monthlyRows = monthlyUsage?.months ?? []

  return (
    <section className="grid gap-5" aria-label="Home overview">
      <DashboardSubsectionHeader icon={LayoutGrid} title="Overview" />

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <article className="grid min-h-[220px] min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)] lg:row-span-2">
          <p className="m-0 text-xs font-semibold text-[#4f616e]">Total Tokens</p>
          <p className="m-0 break-words text-[clamp(34px,3.8vw,44px)] font-extrabold leading-none tracking-[-0.02em] text-[#21333d]">
            {formatNumber(history.tokenSummary.totalTokens)}
          </p>
          <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">All recorded token usage</p>
          <div className="mt-auto inline-flex flex-wrap items-center gap-4 sm:flex-nowrap">
            <div
              className="h-[120px] w-[120px] rounded-full [mask:radial-gradient(circle_at_center,transparent_56%,#000_57%)] md:h-[146px] md:w-[146px]"
              style={{
                background: `conic-gradient(#3699a6 0deg ${gaugeAngle}deg, #e98d46 ${gaugeAngle}deg ${Math.min(gaugeAngle + 20, 340)}deg, #dce7ec ${Math.min(gaugeAngle + 20, 340)}deg 360deg)`
              }}
              aria-hidden="true"
            />
            <strong className="break-words text-[15px] font-bold tracking-[-0.005em] text-[#21333d]">
              {formatNumber(history.tokenSummary.totalTokens)}
            </strong>
          </div>
          <p className="m-0 text-[11px] font-medium text-[#4f616e]">Computed from locally stored history.</p>
        </article>

        <article className="grid min-h-[104px] min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
          <p className="m-0 text-xs font-semibold text-[#4f616e]">Input Tokens</p>
          <p className="m-0 break-words text-[clamp(28px,3.2vw,36px)] font-extrabold leading-none tracking-[-0.02em] text-[#21333d]">
            {formatNumber(history.tokenSummary.totalInputTokens)}
          </p>
          <p className="m-0 text-xs font-bold leading-[1.35] text-[#0c8a52]">Prompt/input token total</p>
        </article>

        <article className="grid min-h-[104px] min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
          <p className="m-0 text-xs font-semibold text-[#4f616e]">Output Tokens</p>
          <p className="m-0 break-words text-[clamp(28px,3.2vw,36px)] font-extrabold leading-none tracking-[-0.02em] text-[#21333d]">
            {formatNumber(history.tokenSummary.totalOutputTokens)}
          </p>
          <p className="m-0 text-xs font-bold leading-[1.35] text-[#0c8a52]">Completion/output token total</p>
        </article>
      </div>

      <DashboardSubsectionHeader icon={CalendarClock} title="Codex Monthly Usage" />
      <article className="grid min-w-0 gap-3 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
        {!monthlyUsage ? (
          <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">Loading CCusage data...</p>
        ) : monthlyUsage.error ? (
          <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#a14622]">
            Failed to load CCusage data: {monthlyUsage.error}
          </p>
        ) : monthlyRows.length === 0 ? (
          <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
            No CCusage monthly record found.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {monthlyRows.map((item) => (
              <li
                key={item.month}
                className="grid gap-2 rounded-xl border border-[#d7e4e9] bg-white/70 p-2.5 text-[11px] font-semibold text-[#4f616e]"
              >
                <strong className="text-[13px] font-bold text-[#21333d]">{item.month}</strong>
                <div className="flex flex-wrap items-center gap-3.5 [&>span>b]:text-xs [&>span>b]:font-bold [&>span>b]:text-[#21333d]">
                  <span>
                    Input <b>{formatNumber(item.inputTokens)}</b>
                  </span>
                  <span>
                    Cached <b>{formatNumber(item.cachedInputTokens)}</b>
                  </span>
                  <span>
                    Output <b>{formatNumber(item.outputTokens)}</b>
                  </span>
                  <span>
                    Reasoning <b>{formatNumber(item.reasoningOutputTokens)}</b>
                  </span>
                  <span>
                    Total <b>{formatNumber(item.totalTokens)}</b>
                  </span>
                  <span>
                    Cost <b>${item.costUSD.toFixed(2)}</b>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
