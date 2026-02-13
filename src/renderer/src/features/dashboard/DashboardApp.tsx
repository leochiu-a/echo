import { useEffect, useMemo, useState } from 'react'
import type { AppSettings, PromptHistoryRetentionPolicy } from '@shared/domain/types'
import { getEchoApi, preloadUnavailableMessage } from '@renderer/shared/echo-api'
import {
  hasPendingSettingsValue,
  TAB_ITEMS,
  type CodexMonthlyUsageSnapshot,
  type HistorySnapshot,
  type SettingsDraft,
  type TabKey,
  cn
} from './dashboard-shared'
import { CommandsSection } from './sections/CommandsSection'
import { HistorySection } from './sections/HistorySection'
import { HomeSection } from './sections/HomeSection'
import { SettingsSection } from './sections/SettingsSection'

export function DashboardApp() {
  const echo = getEchoApi()

  const [tab, setTab] = useState<TabKey>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [history, setHistory] = useState<HistorySnapshot | null>(null)
  const [monthlyUsage, setMonthlyUsage] = useState<CodexMonthlyUsageSnapshot | null>(null)
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

    const refreshCCusageMonthly = () => {
      void echo.usage
        .getMonthly()
        .then(setMonthlyUsage)
        .catch((error) =>
          setMonthlyUsage({
            source: 'ccusage',
            months: [],
            fetchedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Failed to load CCusage monthly usage.'
          })
        )
    }

    const offSettings = echo.settings.onChanged((nextSettings) => {
      hydrateFromSettings(nextSettings)
    })

    const offHistory = echo.history.onChanged((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
      refreshCCusageMonthly()
    })

    void echo.settings.get().then((nextSettings) => {
      hydrateFromSettings(nextSettings)
    })

    void echo.history.get().then((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })
    refreshCCusageMonthly()

    return () => {
      offSettings()
      offHistory()
    }
  }, [echo])

  const activeTab = TAB_ITEMS.find((item) => item.key === tab) ?? TAB_ITEMS[0]

  const hasPendingSettings = useMemo(() => hasPendingSettingsValue(settings, settingsDraft), [settings, settingsDraft])

  const inputShare = useMemo(() => {
    if (!history || history.tokenSummary.totalTokens <= 0) {
      return 0
    }

    return Math.min(1, history.tokenSummary.totalInputTokens / history.tokenSummary.totalTokens)
  }, [history])

  const gaugeAngle = Math.max(10, Math.round(25 + inputShare * 260))

  const onRetentionPolicyChange = (policy: PromptHistoryRetentionPolicy) => {
    if (!echo) {
      return
    }

    void echo.history.setRetentionPolicy(policy)
  }

  const onClearHistory = () => {
    if (!echo) {
      return
    }

    void echo.history.clear()
  }

  const onDeleteHistoryEntry = (id: string) => {
    if (!echo) {
      return
    }

    void echo.history.deleteEntry(id)
  }

  const onAddCommand = () => {
    setCommandDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        command: 'new-command',
        prompt: 'Describe task here: {{input}}'
      }
    ])
  }

  const onSaveCommands = () => {
    if (!echo) {
      return
    }

    void echo.settings
      .update({ slashCommands: commandDrafts })
      .then(() => setCommandFeedback('Commands saved.'))
      .catch((error) => setCommandFeedback(error instanceof Error ? error.message : 'Failed to save commands.'))
  }

  const onUpdateCommand = (id: string, command: string) => {
    setCommandDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, command } : item))
    )
  }

  const onUpdatePrompt = (id: string, prompt: string) => {
    setCommandDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, prompt } : item))
    )
  }

  const onRemoveCommand = (id: string) => {
    setCommandDrafts((current) => current.filter((item) => item.id !== id))
  }

  const onPatchSettingsDraft = (patch: Partial<SettingsDraft>) => {
    setSettingsDraft((current) => ({ ...current, ...patch }))
  }

  const onSaveSettings = () => {
    if (!echo) {
      return
    }

    setSettingsFeedback(null)
    void echo.settings
      .update(settingsDraft)
      .then(() => setSettingsFeedback('Settings saved.'))
      .catch((error) => setSettingsFeedback(error instanceof Error ? error.message : 'Failed to save settings.'))
  }

  const onResetSettings = () => {
    if (!echo) {
      return
    }

    setSettingsFeedback(null)
    void echo.settings.reset().then(() => setSettingsFeedback('Reset to defaults.'))
  }

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
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-[#91b7c5]/70 bg-[#e8f4f8]/90 text-[15px] font-extrabold text-[#1f6976]"
              aria-hidden="true"
            >
              E
            </span>
            <h1 className="m-0 text-[34px] font-black leading-[0.94] tracking-[-0.02em] text-black/90 md:text-[38px]">
              Echo
            </h1>
          </header>

          <nav
            className="grid content-start items-start grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
            aria-label="Dashboard sections"
          >
            {TAB_ITEMS.map((item) => {
              const TabIcon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    'inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-2 text-sm font-semibold text-[#3e5968] transition-colors lg:justify-start lg:px-3',
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
              <HomeSection
                history={history}
                monthlyUsage={monthlyUsage}
                gaugeAngle={gaugeAngle}
              />
            ) : null}

            {tab === 'history' ? (
              <HistorySection
                history={history}
                onRetentionPolicyChange={onRetentionPolicyChange}
                onClearAll={onClearHistory}
                onDeleteEntry={onDeleteHistoryEntry}
              />
            ) : null}

            {tab === 'commands' ? (
              <CommandsSection
                commandDrafts={commandDrafts}
                commandFeedback={commandFeedback}
                onAddCommand={onAddCommand}
                onSaveCommands={onSaveCommands}
                onRemoveCommand={onRemoveCommand}
                onUpdateCommand={onUpdateCommand}
                onUpdatePrompt={onUpdatePrompt}
              />
            ) : null}

            {tab === 'settings' ? (
              <SettingsSection
                settingsDraft={settingsDraft}
                hasPendingSettings={hasPendingSettings}
                settingsFeedback={settingsFeedback}
                onPatchDraft={onPatchSettingsDraft}
                onSaveSettings={onSaveSettings}
                onResetSettings={onResetSettings}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
