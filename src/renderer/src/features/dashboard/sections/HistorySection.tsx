import type { PromptHistoryRetentionPolicy } from '@shared/domain/types'
import { Archive, History, ShieldCheck } from 'lucide-react'
import { DashboardSubsectionHeader } from '../components/DashboardSubsectionHeader'
import type { HistorySnapshot } from '../dashboard-shared'
import {
  RETENTION_LABEL,
  cn,
  dashboardSecondaryButtonClass,
  dashboardSelectClass,
  formatAction,
  formatTimestamp,
  statusDotClass,
  statusLabel
} from '../dashboard-shared'

interface HistorySectionProps {
  history: HistorySnapshot
  onRetentionPolicyChange: (policy: PromptHistoryRetentionPolicy) => void
  onClearAll: () => void
  onDeleteEntry: (id: string) => void
}

export function HistorySection({
  history,
  onRetentionPolicyChange,
  onClearAll,
  onDeleteEntry
}: HistorySectionProps) {
  return (
    <section className="grid gap-5" aria-label="History records">
      <DashboardSubsectionHeader icon={History} title="Recent Sessions" />
      <article className="grid min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center text-[#4f616e]" aria-hidden="true">
              <Archive className="h-3 w-3" strokeWidth={2.2} />
            </span>
            <div>
              <h3 className="m-0 text-base font-bold text-[#21333d]">History Retention</h3>
              <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                Records older than the selected duration are automatically removed.
              </p>
            </div>
          </div>
          <select
            className={dashboardSelectClass}
            value={history.retentionPolicy}
            onChange={(event) => onRetentionPolicyChange(event.target.value as PromptHistoryRetentionPolicy)}
          >
            {Object.entries(RETENTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-[#bccfd6]/60" />

        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center text-[#4f616e]" aria-hidden="true">
            <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="m-0 text-base font-bold text-[#21333d]">Data and Privacy</h3>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Your prompt is sent to Codex during execution. This page only shows locally stored records.
            </p>
          </div>
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-xs font-semibold text-[#4f616e]">
          {history.entries.length} {history.entries.length === 1 ? 'record' : 'records'}
        </strong>
        <button
          type="button"
          className={dashboardSecondaryButtonClass}
          onClick={onClearAll}
          disabled={history.entries.length === 0}
        >
          Clear All
        </button>
      </div>

      {history.entries.length === 0 ? (
        <article className="grid min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
          <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">No history records yet.</p>
        </article>
      ) : (
        <ul className="grid list-none gap-2.5 p-0">
          {history.entries.map((entry) => (
            <li
              key={entry.id}
              className="grid gap-1.5 rounded-xl border border-white/50 bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]"
            >
              <header className="flex items-center justify-between gap-2.5 text-xs text-[#21333d]">
                <div className="inline-flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', statusDotClass(entry.status))} aria-hidden="true" />
                  <strong className="text-sm font-semibold">{entry.command || '(empty command)'}</strong>
                </div>
                <time>{formatTimestamp(entry.createdAt)}</time>
              </header>

              <p className="m-0 text-xs font-medium leading-[1.35] text-[#4f616e]">
                {formatAction(entry.action)} - {statusLabel(entry.status)} - {entry.detail}
              </p>

              {entry.responseText ? (
                <pre className="m-0 max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#b4c9d1]/70 bg-white/80 p-3.5 text-sm text-[#1f1d19]">
                  {entry.responseText}
                </pre>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className={dashboardSecondaryButtonClass}
                  onClick={() => onDeleteEntry(entry.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
