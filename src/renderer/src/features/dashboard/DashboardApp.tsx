import { useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  PromptHistoryEntry,
  PromptHistoryRetentionPolicy,
  PromptHistoryStatus
} from '@shared/domain/types'
import { getEchoApi, preloadUnavailableMessage } from '@renderer/shared/echo-api'

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
  marker: string
  description: string
}[] = [
  {
    key: 'home',
    label: 'Home',
    pageTitle: 'Home',
    marker: '⌂',
    description: 'Live token usage summary from your locally stored prompt history.'
  },
  {
    key: 'history',
    label: 'History',
    pageTitle: 'History records',
    marker: '⟳',
    description: 'Recent prompt runs, with status and timestamps.'
  },
  {
    key: 'commands',
    label: 'Commands',
    pageTitle: 'Command dashboardview',
    marker: '/',
    description: 'Configure slash commands and prompt templates for inline input autocomplete.'
  },
  {
    key: 'settings',
    label: 'Settings',
    pageTitle: 'Settings',
    marker: '⚙',
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
    return <main className="dashboard-shell dashboard-shell--status">{preloadUnavailableMessage}</main>
  }

  if (!settings || !history) {
    return <main className="dashboard-shell dashboard-shell--status">Loading dashboard...</main>
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-bg-orb dashboard-bg-orb--left" aria-hidden="true" />
      <div className="dashboard-bg-orb dashboard-bg-orb--top" aria-hidden="true" />
      <div className="dashboard-bg-orb dashboard-bg-orb--bottom" aria-hidden="true" />

      <div className="dashboard-frame">
        <aside className="dashboard-sidebar">
          <header className="dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">
              E
            </span>
            <h1>Echo</h1>
          </header>

          <nav className="dashboard-nav" aria-label="Dashboard sections">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={tab === item.key ? 'dashboard-nav-button active' : 'dashboard-nav-button'}
                onClick={() => setTab(item.key)}
              >
                <span className="dashboard-nav-icon" aria-hidden="true">
                  {item.marker}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="dashboard-main">
          <header className="dashboard-page-header">
            <h2>{activeTab.pageTitle}</h2>
            <p>{activeTab.description}</p>
          </header>

          <div className="dashboard-page-content">
            {tab === 'home' ? (
              <section className="dashboard-section" aria-label="Home overview">
                <DashboardSubsectionHeader icon="▤" title="Overview" />

                <div className="dashboard-overview-grid">
                  <article className="dashboard-card dashboard-card--hero">
                    <p className="dashboard-card-label">Total Tokens</p>
                    <p className="dashboard-card-number">{formatNumber(history.tokenSummary.totalTokens)}</p>
                    <p className="dashboard-muted">All recorded token usage</p>
                    <div className="dashboard-gauge-row">
                      <div
                        className="dashboard-gauge"
                        style={{
                          background: `conic-gradient(#3699a6 0deg ${gaugeAngle}deg, #e98d46 ${gaugeAngle}deg ${Math.min(gaugeAngle + 20, 340)}deg, #dce7ec ${Math.min(gaugeAngle + 20, 340)}deg 360deg)`
                        }}
                        aria-hidden="true"
                      />
                      <strong>{formatNumber(history.tokenSummary.totalTokens)}</strong>
                    </div>
                    <p className="dashboard-footnote">Computed from locally stored history.</p>
                  </article>

                  <article className="dashboard-card dashboard-stat-tile">
                    <p className="dashboard-card-label">Input Tokens</p>
                    <p className="dashboard-card-number">{formatNumber(history.tokenSummary.totalInputTokens)}</p>
                    <p className="dashboard-positive">Prompt/input token total</p>
                  </article>

                  <article className="dashboard-card dashboard-stat-tile">
                    <p className="dashboard-card-label">Output Tokens</p>
                    <p className="dashboard-card-number">{formatNumber(history.tokenSummary.totalOutputTokens)}</p>
                    <p className="dashboard-positive">Completion/output token total</p>
                  </article>
                </div>

                <DashboardSubsectionHeader icon="◷" title="Codex Monthly Usage" />
                <article className="dashboard-card dashboard-card--wide dashboard-monthly-panel">
                  {monthlyUsage.runCount === 0 ? (
                    <p className="dashboard-muted">No usage recorded for {monthLabel} yet.</p>
                  ) : (
                    <div className="dashboard-monthly-row">
                      <strong>{monthLabel}</strong>
                      <div className="dashboard-monthly-metrics">
                        <span>
                          Runs <b>{formatNumber(monthlyUsage.runCount)}</b>
                        </span>
                        <span>
                          Input <b>{formatNumber(monthlyUsage.totalInputTokens)}</b>
                        </span>
                        <span>
                          Output <b>{formatNumber(monthlyUsage.totalOutputTokens)}</b>
                        </span>
                        <span>
                          Total <b>{formatNumber(monthlyUsage.totalTokens)}</b>
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              </section>
            ) : null}

            {tab === 'history' ? (
              <section className="dashboard-section" aria-label="History records">
                <DashboardSubsectionHeader icon="⟳" title="Recent Sessions" />
                <article className="dashboard-card dashboard-card--wide">
                  <div className="dashboard-inline-row dashboard-inline-row--space-between">
                    <div className="dashboard-info-row">
                      <span className="dashboard-info-icon" aria-hidden="true">
                        ◫
                      </span>
                      <div>
                      <h3 className="dashboard-subtitle">History Retention</h3>
                      <p className="dashboard-muted">
                        Records older than the selected duration are automatically removed.
                      </p>
                      </div>
                    </div>
                    <select
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

                  <div className="dashboard-divider" />

                  <div className="dashboard-info-row">
                    <span className="dashboard-info-icon" aria-hidden="true">
                      ⌁
                    </span>
                    <div>
                      <h3 className="dashboard-subtitle">Data and Privacy</h3>
                      <p className="dashboard-muted">
                        Your prompt is sent to Codex during execution. This page only shows locally stored records.
                      </p>
                    </div>
                  </div>
                </article>

                <div className="dashboard-inline-row dashboard-inline-row--space-between">
                  <strong className="dashboard-record-count">
                    {history.entries.length} {history.entries.length === 1 ? 'record' : 'records'}
                  </strong>
                  <button
                    type="button"
                    className="dashboard-secondary-button"
                    onClick={() => void echo.history.clear()}
                    disabled={history.entries.length === 0}
                  >
                    Clear All
                  </button>
                </div>

                {history.entries.length === 0 ? (
                  <article className="dashboard-card dashboard-card--wide">
                    <p className="dashboard-muted">No history records yet.</p>
                  </article>
                ) : (
                  <ul className="dashboard-history-list">
                    {history.entries.map((entry) => (
                      <li key={entry.id} className="dashboard-history-item">
                        <header className="dashboard-history-item-header">
                          <div className="dashboard-history-title-row">
                            <span className={`dashboard-status-dot ${statusDotClass(entry.status)}`} aria-hidden="true" />
                            <strong>{entry.command || '(empty command)'}</strong>
                          </div>
                          <time>{formatTimestamp(entry.createdAt)}</time>
                        </header>

                        <p className="dashboard-history-meta">
                          {formatAction(entry.action)} - {statusLabel(entry.status)} - {entry.detail}
                        </p>

                        {entry.responseText ? <pre>{entry.responseText}</pre> : null}

                        <div className="dashboard-inline-row dashboard-inline-row--end">
                          <button
                            type="button"
                            className="dashboard-secondary-button"
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
              <section className="dashboard-section" aria-label="Command dashboard view">
                <article className="dashboard-card dashboard-card--wide">
                  <h3 className="dashboard-subtitle">Slash command mapping</h3>
                  <p className="dashboard-muted">
                    Type <code>/</code> in the inline input to trigger autocomplete. Use <code>{'{{input}}'}</code>{' '}
                    in prompt templates to inject remaining text after the command.
                  </p>
                  <p className="dashboard-muted">
                    Example: <code>/reply Thanks for the update</code> {'->'} prompt template receives{' '}
                    <code>Thanks for the update</code>.
                  </p>
                </article>

                <div className="dashboard-inline-row dashboard-inline-row--space-between">
                  <strong className="dashboard-record-count">
                    {commandDrafts.length} {commandDrafts.length === 1 ? 'command' : 'commands'}
                  </strong>
                  <div className="dashboard-inline-row">
                    <button
                      type="button"
                      className="dashboard-primary-button"
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
                      className="dashboard-secondary-button"
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

                {commandFeedback ? <p className="feedback-label">{commandFeedback}</p> : null}

                {commandDrafts.length === 0 ? (
                  <article className="dashboard-card dashboard-card--wide">
                    <p className="dashboard-muted">No slash command yet. Add one to get started.</p>
                  </article>
                ) : (
                  <ul className="dashboard-command-list">
                    {commandDrafts.map((item, index) => (
                      <li key={item.id} className="dashboard-command-item">
                        <div className="dashboard-inline-row dashboard-inline-row--space-between">
                          <strong>Command #{index + 1}</strong>
                          <button
                            type="button"
                            className="dashboard-secondary-button"
                            onClick={() => {
                              setCommandDrafts((current) => current.filter((command) => command.id !== item.id))
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        <label>
                          Slash
                          <div className="dashboard-slash-field">
                            <span>/</span>
                            <input
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

                        <label>
                          Prompt template
                          <textarea
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
              <section className="dashboard-section" aria-label="Settings">
                <DashboardSubsectionHeader icon="⌨" title="Keyboard Shortcuts" />
                <div className="dashboard-settings-grid">
                  <label className="dashboard-shortcut-row">
                    <div className="dashboard-setting-copy">
                      <strong>Open Input Panel</strong>
                      <p className="dashboard-muted">Toggle the floating input panel. Default: Command + K.</p>
                    </div>
                    <input
                      value={settingsDraft.openPanelShortcut}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, openPanelShortcut: event.target.value }))
                      }
                    />
                    <div className="dashboard-keycap-list" aria-hidden="true">
                      {tokenizeShortcut(settingsDraft.openPanelShortcut).map((token, index) => (
                        <span key={`${token}-${index}`} className="dashboard-keycap">
                          {token}
                        </span>
                      ))}
                    </div>
                  </label>

                  <label className="dashboard-shortcut-row">
                    <div className="dashboard-setting-copy">
                      <strong>Replace Action</strong>
                      <p className="dashboard-muted">Apply output by replacing the current selection.</p>
                    </div>
                    <input
                      value={settingsDraft.replaceShortcut}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, replaceShortcut: event.target.value }))
                      }
                    />
                    <div className="dashboard-keycap-list" aria-hidden="true">
                      {tokenizeShortcut(settingsDraft.replaceShortcut).map((token, index) => (
                        <span key={`${token}-${index}`} className="dashboard-keycap">
                          {token}
                        </span>
                      ))}
                    </div>
                  </label>

                  <label className="dashboard-shortcut-row">
                    <div className="dashboard-setting-copy">
                      <strong>Insert Action</strong>
                      <p className="dashboard-muted">Apply output by inserting next to the current selection.</p>
                    </div>
                    <input
                      value={settingsDraft.insertShortcut}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, insertShortcut: event.target.value }))
                      }
                    />
                    <div className="dashboard-keycap-list" aria-hidden="true">
                      {tokenizeShortcut(settingsDraft.insertShortcut).map((token, index) => (
                        <span key={`${token}-${index}`} className="dashboard-keycap">
                          {token}
                        </span>
                      ))}
                    </div>
                  </label>
                </div>

                <DashboardSubsectionHeader icon="◉" title="Model" />
                <div className="dashboard-settings-grid">
                  <label className="dashboard-setting-field">
                    Model
                    <select
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

                  <label className="dashboard-setting-field">
                    Reasoning Effort
                    <select
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

                <div className="dashboard-inline-row dashboard-inline-row--end">
                  <button
                    type="button"
                    className="dashboard-secondary-button"
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
                    className="dashboard-primary-button"
                    onClick={() => {
                      setSettingsFeedback(null)
                      void echo.settings.reset().then(() => setSettingsFeedback('Reset to defaults.'))
                    }}
                  >
                    Reset to Defaults
                  </button>
                </div>

                {settingsFeedback ? <p className="feedback-label">{settingsFeedback}</p> : null}
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function DashboardSubsectionHeader(props: { icon: string; title: string }) {
  return (
    <header className="dashboard-subsection-header">
      <div className="dashboard-subsection-title-row">
        <span className="dashboard-subsection-icon" aria-hidden="true">
          {props.icon}
        </span>
        <h3>{props.title}</h3>
      </div>
      <div className="dashboard-subsection-divider" />
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
    return 'dashboard-status-dot--success'
  }
  if (status === 'cancelled') {
    return 'dashboard-status-dot--warning'
  }
  return 'dashboard-status-dot--error'
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
