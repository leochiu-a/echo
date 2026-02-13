import { useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  PromptHistoryEntry,
  PromptHistoryRetentionPolicy,
  PromptHistoryStatus
} from '@shared/domain/types'
import { getEchoApi, preloadUnavailableMessage } from '@renderer/shared/echo-api'
import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  CalendarClock,
  Command as CommandIcon,
  Cpu,
  History,
  House,
  Keyboard,
  LayoutGrid,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react'

const MODELS = ['gpt-5.2', 'gpt-5.3-codex', 'gpt-5.2-codex']
const EFFORTS = ['low', 'medium', 'high', 'xhigh']

interface HistorySnapshot {
  entries: PromptHistoryEntry[]
  commands: string[]
  retentionPolicy: PromptHistoryRetentionPolicy
  tokenSummary: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    inputTokenRunCount: number
    outputTokenRunCount: number
    tokenizedRunCount: number
  }
}

type TabKey = 'home' | 'history' | 'commands' | 'settings'

interface SettingsDraft {
  codexModel: string
  codexReasoningEffort: string
  openPanelShortcut: string
  replaceShortcut: string
  insertShortcut: string
}

const TAB_ITEMS: {
  key: TabKey
  label: string
  pageTitle: string
  icon: LucideIcon
  description: string
}[] = [
  {
    key: 'home',
    label: 'Home',
    pageTitle: 'Home',
    icon: House,
    description: 'Live token usage summary from your locally stored prompt history.'
  },
  {
    key: 'history',
    label: 'History',
    pageTitle: 'History records',
    icon: History,
    description: 'Recent prompt runs, with status and timestamps.'
  },
  {
    key: 'commands',
    label: 'Commands',
    pageTitle: 'Command dashboardview',
    icon: CommandIcon,
    description: 'Configure slash commands and prompt templates for inline input autocomplete.'
  },
  {
    key: 'settings',
    label: 'Settings',
    pageTitle: 'Settings',
    icon: SlidersHorizontal,
    description:
      'Configure Codex App Server streaming model, reasoning effort, and shortcuts for input, replace, and insert actions.'
  }
]

const RETENTION_LABEL: Record<PromptHistoryRetentionPolicy, string> = {
  forever: 'Forever',
  sevenDays: '7 days',
  thirtyDays: '30 days',
  ninetyDays: '90 days'
}

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

const dashboardInputClass =
  'w-full rounded-2xl border border-black/10 bg-white/75 px-3.5 py-2.5 text-sm text-[#21333d] outline-none transition focus:border-[#489eac] focus:outline focus:outline-2 focus:outline-[#3d99a84d] focus:outline-offset-1'

const dashboardSelectClass =
  'rounded-2xl border border-black/10 bg-white/75 px-3.5 py-2.5 text-sm font-semibold text-[#21333d] outline-none transition focus:border-[#489eac] focus:outline focus:outline-2 focus:outline-[#3d99a84d] focus:outline-offset-1'

const dashboardPrimaryButtonClass =
  'rounded-full border border-transparent bg-[#0f8d9f] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45'

const dashboardSecondaryButtonClass =
  'rounded-full border border-[#a9c1ca] bg-white/80 px-3.5 py-2 text-[13px] font-semibold text-[#32515f] transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45'

export function DashboardApp() {
  const echo = getEchoApi()

  const [tab, setTab] = useState<TabKey>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [history, setHistory] = useState<HistorySnapshot | null>(null)
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null)

  const [commandDrafts, setCommandDrafts] = useState<AppSettings['slashCommands']>([])
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    codexModel: 'gpt-5.3-codex',
    codexReasoningEffort: 'medium',
    openPanelShortcut: 'Command+K',
    replaceShortcut: 'Command+Enter',
    insertShortcut: 'Command+Shift+Enter'
  })

  useEffect(() => {
    if (!echo) {
      setSettingsFeedback(preloadUnavailableMessage)
      return
    }

    const hydrateFromSettings = (nextSettings: AppSettings) => {
      setSettings(nextSettings)
      setCommandDrafts(nextSettings.slashCommands)
      setSettingsDraft({
        codexModel: nextSettings.codexModel,
        codexReasoningEffort: nextSettings.codexReasoningEffort,
        openPanelShortcut: nextSettings.openPanelShortcut,
        replaceShortcut: nextSettings.replaceShortcut,
        insertShortcut: nextSettings.insertShortcut
      })
    }

    const offSettings = echo.settings.onChanged((nextSettings) => {
      hydrateFromSettings(nextSettings)
    })

    const offHistory = echo.history.onChanged((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })

    void echo.settings.get().then((nextSettings) => {
      hydrateFromSettings(nextSettings)
    })

    void echo.history.get().then((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })

    return () => {
      offSettings()
      offHistory()
    }
  }, [echo])

  const activeTab = TAB_ITEMS.find((item) => item.key === tab) ?? TAB_ITEMS[0]

  const monthlyUsage = useMemo(() => {
    if (!history) {
      return { runCount: 0, totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0 }
    }

    const now = new Date()
    return history.entries.reduce(
      (accumulator, entry) => {
        const createdAt = new Date(entry.createdAt)
        if (
          createdAt.getUTCFullYear() !== now.getUTCFullYear() ||
          createdAt.getUTCMonth() !== now.getUTCMonth()
        ) {
          return accumulator
        }

        accumulator.runCount += 1
        accumulator.totalTokens += Math.max(0, entry.totalTokens ?? 0)
        accumulator.totalInputTokens += Math.max(0, entry.inputTokens ?? 0)
        accumulator.totalOutputTokens += Math.max(0, entry.outputTokens ?? 0)
        return accumulator
      },
      { runCount: 0, totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0 }
    )
  }, [history])

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric'
      }).format(new Date()),
    []
  )

  const hasPendingSettings = useMemo(() => {
    if (!settings) {
      return false
    }

    return (
      settings.codexModel !== settingsDraft.codexModel ||
      settings.codexReasoningEffort !== settingsDraft.codexReasoningEffort ||
      settings.openPanelShortcut !== settingsDraft.openPanelShortcut ||
      settings.replaceShortcut !== settingsDraft.replaceShortcut ||
      settings.insertShortcut !== settingsDraft.insertShortcut
    )
  }, [settings, settingsDraft])

  const inputShare = useMemo(() => {
    if (!history || history.tokenSummary.totalTokens <= 0) {
      return 0
    }

    return Math.min(1, history.tokenSummary.totalInputTokens / history.tokenSummary.totalTokens)
  }, [history])

  const gaugeAngle = Math.max(10, Math.round(25 + inputShare * 260))

  if (!echo) {
    return (
      <main className="grid h-full w-full place-items-center p-3 text-center text-lg font-semibold text-[#1f3642]">
        {preloadUnavailableMessage}
      </main>
    )
  }

  if (!settings || !history) {
    return (
      <main className="grid h-full w-full place-items-center p-3 text-center text-lg font-semibold text-[#1f3642]">
        Loading dashboard...
      </main>
    )
  }

  return (
    <main className="relative h-full w-full overflow-hidden p-2.5 md:p-[11px]">
      <div
        className="pointer-events-none absolute -left-[230px] -top-[120px] z-0 hidden h-[410px] w-[410px] rounded-full bg-[#a2d6e0]/45 md:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-[120px] -top-[80px] z-0 hidden h-[310px] w-[310px] rounded-full bg-[#e8dbcb]/55 md:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-[70px] right-[70px] z-0 hidden h-[280px] w-[280px] rounded-full bg-[#d5e6df]/60 md:block"
        aria-hidden="true"
      />

      <div className="relative z-[1] grid h-full w-full grid-cols-1 gap-[11px] lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 rounded-2xl border border-white/50 bg-white/65 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_24px_rgba(30,67,83,0.06)] backdrop-blur-[14px] backdrop-saturate-[1.35] lg:grid-rows-[auto_1fr] lg:gap-[14px] lg:rounded-[18px] lg:p-[14px]">
          <header className="inline-flex items-center gap-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-[#91b7c5]/70 bg-[#e8f4f8]/90 text-[15px] font-extrabold text-[#1f6976]" aria-hidden="true">
              E
            </span>
            <h1 className="m-0 text-[34px] font-black leading-[0.94] tracking-[-0.02em] text-black/90 md:text-[38px]">
              Echo
            </h1>
          </header>

          <nav className="grid content-start items-start grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1" aria-label="Dashboard sections">
            {TAB_ITEMS.map((item) => {
              const TabIcon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border px-2 text-sm font-semibold text-[#3e5968] transition-colors lg:justify-start lg:px-3',
                    tab === item.key
                      ? 'border-black/10 bg-black/10 text-black/90'
                      : 'border-transparent bg-transparent hover:border-black/5 hover:bg-black/[0.045]'
                  )}
                  onClick={() => setTab(item.key)}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center text-[#2a5f6d]" aria-hidden="true">
                    <TabIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3 rounded-2xl border border-white/50 bg-white/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_24px_rgba(30,67,83,0.06)] backdrop-blur-[14px] backdrop-saturate-[1.35] md:gap-[14px] md:p-5">
          <header className="border-b border-[#bccfd6]/60 pb-3">
            <h2 className="m-0 text-[26px] font-black tracking-[-0.02em] text-[#21333d] md:text-[32px]">
              {activeTab.pageTitle}
            </h2>
            <p className="mt-1.5 text-[13px] font-medium leading-[1.35] text-[#4f616e]">{activeTab.description}</p>
          </header>

          <div className="overflow-auto pr-1 [scrollbar-gutter:stable]">
            {tab === 'home' ? (
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
                  {monthlyUsage.runCount === 0 ? (
                    <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                      No usage recorded for {monthLabel} yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4">
                      <strong className="w-[98px] shrink-0 text-[13px] font-bold text-[#21333d]">{monthLabel}</strong>
                      <div className="flex flex-wrap items-center gap-3.5 [&>span>b]:text-xs [&>span>b]:font-bold [&>span>b]:text-[#21333d]">
                        <span className="text-[11px] font-semibold text-[#4f616e]">
                          Runs <b>{formatNumber(monthlyUsage.runCount)}</b>
                        </span>
                        <span className="text-[11px] font-semibold text-[#4f616e]">
                          Input <b>{formatNumber(monthlyUsage.totalInputTokens)}</b>
                        </span>
                        <span className="text-[11px] font-semibold text-[#4f616e]">
                          Output <b>{formatNumber(monthlyUsage.totalOutputTokens)}</b>
                        </span>
                        <span className="text-[11px] font-semibold text-[#4f616e]">
                          Total <b>{formatNumber(monthlyUsage.totalTokens)}</b>
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              </section>
            ) : null}

            {tab === 'history' ? (
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
                      onChange={(event) => {
                        void echo.history.setRetentionPolicy(event.target.value as PromptHistoryRetentionPolicy)
                      }}
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
                    onClick={() => void echo.history.clear()}
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
                            onClick={() => void echo.history.deleteEntry(entry.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            {tab === 'commands' ? (
              <section className="grid gap-5" aria-label="Command dashboard view">
                <article className="grid min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
                  <h3 className="m-0 text-base font-bold text-[#21333d]">Slash command mapping</h3>
                  <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                    Type <code>/</code> in the inline input to trigger autocomplete. Use <code>{'{{input}}'}</code>{' '}
                    in prompt templates to inject remaining text after the command.
                  </p>
                  <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                    Example: <code>/reply Thanks for the update</code> {'->'} prompt template receives{' '}
                    <code>Thanks for the update</code>.
                  </p>
                </article>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-xs font-semibold text-[#4f616e]">
                    {commandDrafts.length} {commandDrafts.length === 1 ? 'command' : 'commands'}
                  </strong>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={dashboardPrimaryButtonClass}
                      onClick={() => {
                        setCommandDrafts((current) => [
                          ...current,
                          {
                            id: crypto.randomUUID(),
                            command: 'new-command',
                            prompt: 'Describe task here: {{input}}'
                          }
                        ])
                      }}
                    >
                      Add Command
                    </button>
                    <button
                      type="button"
                      className={dashboardSecondaryButtonClass}
                      onClick={() => {
                        void echo.settings
                          .update({ slashCommands: commandDrafts })
                          .then(() => setCommandFeedback('Commands saved.'))
                          .catch((error) =>
                            setCommandFeedback(error instanceof Error ? error.message : 'Failed to save commands.')
                          )
                      }}
                    >
                      Save Commands
                    </button>
                  </div>
                </div>

                {commandFeedback ? <p className="m-0 text-xs text-[#0b6e4f]">{commandFeedback}</p> : null}

                {commandDrafts.length === 0 ? (
                  <article className="grid min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
                    <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                      No slash command yet. Add one to get started.
                    </p>
                  </article>
                ) : (
                  <ul className="grid list-none gap-2.5 p-0">
                    {commandDrafts.map((item, index) => (
                      <li
                        key={item.id}
                        className="grid gap-1.5 rounded-xl border border-white/50 bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>Command #{index + 1}</strong>
                          <button
                            type="button"
                            className={dashboardSecondaryButtonClass}
                            onClick={() => {
                              setCommandDrafts((current) => current.filter((command) => command.id !== item.id))
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        <label className="grid gap-1.5 text-[13px] text-[#4f616e]">
                          Slash
                          <div className="flex items-center overflow-hidden rounded-xl border border-[#a9c2ca]/85 bg-white/90">
                            <span className="pl-2.5 text-lg font-bold leading-none text-[#11738a]">/</span>
                            <input
                              className="w-full border-0 bg-transparent px-2.5 py-2.5 text-sm text-[#21333d] outline-none"
                              value={item.command}
                              onChange={(event) => {
                                setCommandDrafts((current) =>
                                  current.map((command) =>
                                    command.id === item.id ? { ...command, command: event.target.value } : command
                                  )
                                )
                              }}
                            />
                          </div>
                        </label>

                        <label className="grid gap-1.5 text-[13px] text-[#4f616e]">
                          Prompt template
                          <textarea
                            className={cn(dashboardInputClass, 'min-h-20 resize-y')}
                            value={item.prompt}
                            rows={4}
                            onChange={(event) => {
                              setCommandDrafts((current) =>
                                current.map((command) =>
                                  command.id === item.id ? { ...command, prompt: event.target.value } : command
                                )
                              )
                            }}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            {tab === 'settings' ? (
              <section className="grid gap-5" aria-label="Settings">
                <DashboardSubsectionHeader icon={Keyboard} title="Keyboard Shortcuts" />
                <div className="grid gap-4">
                  <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,320px)_auto] lg:items-start lg:gap-2.5">
                    <div>
                      <strong className="mb-1.5 block text-base font-bold text-[#21333d]">Open Input Panel</strong>
                      <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                        Toggle the floating input panel. Default: Command + K.
                      </p>
                    </div>
                    <input
                      className={cn(dashboardInputClass, 'h-14 px-3.5')}
                      value={settingsDraft.openPanelShortcut}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, openPanelShortcut: event.target.value }))
                      }
                    />
                    <div className="inline-flex flex-wrap items-center justify-start gap-1.5 lg:justify-end" aria-hidden="true">
                      {tokenizeShortcut(settingsDraft.openPanelShortcut).map((token, index) => (
                        <span
                          key={`${token}-${index}`}
                          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase text-[#21333d]"
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  </label>

                  <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,320px)_auto] lg:items-start lg:gap-2.5">
                    <div>
                      <strong className="mb-1.5 block text-base font-bold text-[#21333d]">Replace Action</strong>
                      <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                        Apply output by replacing the current selection.
                      </p>
                    </div>
                    <input
                      className={cn(dashboardInputClass, 'h-14 px-3.5')}
                      value={settingsDraft.replaceShortcut}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, replaceShortcut: event.target.value }))
                      }
                    />
                    <div className="inline-flex flex-wrap items-center justify-start gap-1.5 lg:justify-end" aria-hidden="true">
                      {tokenizeShortcut(settingsDraft.replaceShortcut).map((token, index) => (
                        <span
                          key={`${token}-${index}`}
                          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase text-[#21333d]"
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  </label>

                  <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,320px)_auto] lg:items-start lg:gap-2.5">
                    <div>
                      <strong className="mb-1.5 block text-base font-bold text-[#21333d]">Insert Action</strong>
                      <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
                        Apply output by inserting next to the current selection.
                      </p>
                    </div>
                    <input
                      className={cn(dashboardInputClass, 'h-14 px-3.5')}
                      value={settingsDraft.insertShortcut}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, insertShortcut: event.target.value }))
                      }
                    />
                    <div className="inline-flex flex-wrap items-center justify-start gap-1.5 lg:justify-end" aria-hidden="true">
                      {tokenizeShortcut(settingsDraft.insertShortcut).map((token, index) => (
                        <span
                          key={`${token}-${index}`}
                          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase text-[#21333d]"
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  </label>
                </div>

                <DashboardSubsectionHeader icon={Cpu} title="Model" />
                <div className="grid gap-4">
                  <label className="grid gap-2 text-base font-bold text-[#21333d]">
                    Model
                    <select
                      className={cn(dashboardSelectClass, 'h-14 w-full md:max-w-[390px]')}
                      value={settingsDraft.codexModel}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, codexModel: event.target.value }))
                      }
                    >
                      {MODELS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-base font-bold text-[#21333d]">
                    Reasoning Effort
                    <select
                      className={cn(dashboardSelectClass, 'h-14 w-full md:max-w-[390px]')}
                      value={settingsDraft.codexReasoningEffort}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, codexReasoningEffort: event.target.value }))
                      }
                    >
                      {EFFORTS.map((effort) => (
                        <option key={effort} value={effort}>
                          {effort}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className={dashboardSecondaryButtonClass}
                    onClick={() => {
                      setSettingsFeedback(null)
                      void echo.settings
                        .update(settingsDraft)
                        .then(() => setSettingsFeedback('Settings saved.'))
                        .catch((error) =>
                          setSettingsFeedback(error instanceof Error ? error.message : 'Failed to save settings.')
                        )
                    }}
                    disabled={!hasPendingSettings}
                  >
                    Save Settings
                  </button>
                  <button
                    type="button"
                    className={dashboardPrimaryButtonClass}
                    onClick={() => {
                      setSettingsFeedback(null)
                      void echo.settings.reset().then(() => setSettingsFeedback('Reset to defaults.'))
                    }}
                  >
                    Reset to Defaults
                  </button>
                </div>

                {settingsFeedback ? <p className="m-0 text-xs text-[#0b6e4f]">{settingsFeedback}</p> : null}
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function DashboardSubsectionHeader(props: { icon: LucideIcon; title: string }) {
  const Icon = props.icon

  return (
    <header className="grid gap-2.5">
      <div className="inline-flex items-center gap-2.5">
        <span className="inline-flex h-5 w-5 items-center justify-center text-[#4f616e]" aria-hidden="true">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <h3 className="m-0 text-lg font-bold text-[#4f616e] md:text-[18px]">{props.title}</h3>
      </div>
      <div className="h-px bg-black/10" />
    </header>
  )
}

function formatTimestamp(input: string): string {
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return input
  }

  return parsed.toLocaleString()
}

function formatAction(action: PromptHistoryEntry['action']): string {
  return action === 'edit' ? 'Edit Selection' : 'Ask Question'
}

function statusLabel(status: PromptHistoryStatus): string {
  if (status === 'succeeded') {
    return 'Succeeded'
  }
  if (status === 'cancelled') {
    return 'Cancelled'
  }
  return 'Failed'
}

function statusDotClass(status: PromptHistoryStatus): string {
  if (status === 'succeeded') {
    return 'bg-[#0a9f62]'
  }
  if (status === 'cancelled') {
    return 'bg-[#eb9b3e]'
  }
  return 'bg-[#d45149]'
}

function tokenizeShortcut(value: string): string[] {
  const tokens = value
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return ['none']
  }

  return tokens.map((token) => {
    const normalized = token.toLowerCase()
    if (normalized === 'command') return 'cmd'
    if (normalized === 'control') return 'ctrl'
    if (normalized === 'option') return 'opt'
    if (normalized === 'shift') return 'shift'
    if (normalized === 'enter') return 'enter'
    return token.length > 12 ? `${token.slice(0, 12)}...` : token
  })
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}
