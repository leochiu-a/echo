import { useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  PromptHistoryEntry,
  PromptHistoryRetentionPolicy
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

export function DashboardApp() {
  const echo = getEchoApi()

  const [tab, setTab] = useState<TabKey>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [history, setHistory] = useState<HistorySnapshot | null>(null)
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null)

  const [commandDrafts, setCommandDrafts] = useState<AppSettings['slashCommands']>([])
  const [shortcutDraft, setShortcutDraft] = useState({
    openPanelShortcut: 'Command+K',
    replaceShortcut: 'Command+Enter',
    insertShortcut: 'Command+Shift+Enter'
  })

  useEffect(() => {
    if (!echo) {
      setSettingsFeedback(preloadUnavailableMessage)
      return
    }

    const offSettings = echo.settings.onChanged((nextSettings) => {
      setSettings(nextSettings)
      setCommandDrafts(nextSettings.slashCommands)
      setShortcutDraft({
        openPanelShortcut: nextSettings.openPanelShortcut,
        replaceShortcut: nextSettings.replaceShortcut,
        insertShortcut: nextSettings.insertShortcut
      })
    })

    const offHistory = echo.history.onChanged((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })

    void echo.settings.get().then((nextSettings) => {
      setSettings(nextSettings)
      setCommandDrafts(nextSettings.slashCommands)
      setShortcutDraft({
        openPanelShortcut: nextSettings.openPanelShortcut,
        replaceShortcut: nextSettings.replaceShortcut,
        insertShortcut: nextSettings.insertShortcut
      })
    })

    void echo.history.get().then((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })

    return () => {
      offSettings()
      offHistory()
    }
  }, [echo])

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

  if (!echo) {
    return <main className="dashboard-shell">{preloadUnavailableMessage}</main>
  }

  if (!settings || !history) {
    return <main className="dashboard-shell">Loading...</main>
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Echo Dashboard</h1>
        <button type="button" onClick={() => void echo.overlay.close()}>
          Close Overlay
        </button>
      </header>

      <nav className="dashboard-tabs" aria-label="Dashboard sections">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Home</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
        <button className={tab === 'commands' ? 'active' : ''} onClick={() => setTab('commands')}>Commands</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
      </nav>

      {tab === 'home' ? (
        <section className="dashboard-panel">
          <h2>Token Summary</h2>
          <div className="metric-grid">
            <article>
              <h3>Total Tokens</h3>
              <p>{history.tokenSummary.totalTokens.toLocaleString()}</p>
            </article>
            <article>
              <h3>Total Input</h3>
              <p>{history.tokenSummary.totalInputTokens.toLocaleString()}</p>
            </article>
            <article>
              <h3>Total Output</h3>
              <p>{history.tokenSummary.totalOutputTokens.toLocaleString()}</p>
            </article>
            <article>
              <h3>Tokenized Runs</h3>
              <p>{history.tokenSummary.tokenizedRunCount.toLocaleString()}</p>
            </article>
          </div>

          <h2>Current Month Usage</h2>
          <div className="metric-grid">
            <article>
              <h3>Runs</h3>
              <p>{monthlyUsage.runCount.toLocaleString()}</p>
            </article>
            <article>
              <h3>Input Tokens</h3>
              <p>{monthlyUsage.totalInputTokens.toLocaleString()}</p>
            </article>
            <article>
              <h3>Output Tokens</h3>
              <p>{monthlyUsage.totalOutputTokens.toLocaleString()}</p>
            </article>
            <article>
              <h3>Total Tokens</h3>
              <p>{monthlyUsage.totalTokens.toLocaleString()}</p>
            </article>
          </div>
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="dashboard-panel">
          <div className="dashboard-row">
            <label>
              Retention
              <select
                value={history.retentionPolicy}
                onChange={(event) => {
                  void echo.history.setRetentionPolicy(
                    event.target.value as PromptHistoryRetentionPolicy
                  )
                }}
              >
                <option value="forever">Forever</option>
                <option value="sevenDays">7 days</option>
                <option value="thirtyDays">30 days</option>
                <option value="ninetyDays">90 days</option>
              </select>
            </label>
            <button type="button" onClick={() => void echo.history.clear()}>
              Clear History
            </button>
          </div>

          <ul className="history-list">
            {history.entries.map((entry) => (
              <li key={entry.id}>
                <header>
                  <strong>{entry.command}</strong>
                  <span>{entry.status}</span>
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
                </header>
                <p>{entry.detail}</p>
                {entry.responseText ? <pre>{entry.responseText}</pre> : null}
                <button type="button" onClick={() => void echo.history.deleteEntry(entry.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'commands' ? (
        <section className="dashboard-panel">
          <div className="dashboard-row">
            <button
              type="button"
              onClick={() => {
                setCommandDrafts((current) => [
                  ...current,
                  { id: crypto.randomUUID(), command: 'new-command', prompt: 'Describe task here: {{input}}' }
                ])
              }}
            >
              Add Command
            </button>
            <button
              type="button"
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

          {commandFeedback ? <p className="feedback-label">{commandFeedback}</p> : null}

          <ul className="command-list">
            {commandDrafts.map((item, index) => (
              <li key={item.id}>
                <label>
                  Slash
                  <input
                    value={item.command}
                    onChange={(event) => {
                      const next = [...commandDrafts]
                      next[index] = { ...item, command: event.target.value }
                      setCommandDrafts(next)
                    }}
                  />
                </label>

                <label>
                  Prompt Template
                  <textarea
                    value={item.prompt}
                    onChange={(event) => {
                      const next = [...commandDrafts]
                      next[index] = { ...item, prompt: event.target.value }
                      setCommandDrafts(next)
                    }}
                    rows={4}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setCommandDrafts((current) => current.filter((command) => command.id !== item.id))
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p>Use <code>{'{{input}}'}</code> to interpolate command input.</p>
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="dashboard-panel">
          <div className="settings-grid">
            <label>
              Model
              <select
                value={settings.codexModel}
                onChange={(event) => {
                  void echo
                    .settings
                    .update({ codexModel: event.target.value })
                    .then(() => setSettingsFeedback('Model updated.'))
                    .catch((error) =>
                      setSettingsFeedback(error instanceof Error ? error.message : 'Failed to update model.')
                    )
                }}
              >
                {MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Reasoning Effort
              <select
                value={settings.codexReasoningEffort}
                onChange={(event) => {
                  void echo
                    .settings
                    .update({ codexReasoningEffort: event.target.value })
                    .then(() => setSettingsFeedback('Reasoning effort updated.'))
                    .catch((error) =>
                      setSettingsFeedback(error instanceof Error ? error.message : 'Failed to update effort.')
                    )
                }}
              >
                {EFFORTS.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Open Overlay Shortcut
              <input
                value={shortcutDraft.openPanelShortcut}
                onChange={(event) =>
                  setShortcutDraft((current) => ({ ...current, openPanelShortcut: event.target.value }))
                }
              />
            </label>

            <label>
              Replace Shortcut
              <input
                value={shortcutDraft.replaceShortcut}
                onChange={(event) =>
                  setShortcutDraft((current) => ({ ...current, replaceShortcut: event.target.value }))
                }
              />
            </label>

            <label>
              Insert Shortcut
              <input
                value={shortcutDraft.insertShortcut}
                onChange={(event) =>
                  setShortcutDraft((current) => ({ ...current, insertShortcut: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="dashboard-row">
            <button
              type="button"
              onClick={() => {
                void echo
                  .settings
                  .update(shortcutDraft)
                  .then(() => setSettingsFeedback('Shortcut settings saved.'))
                  .catch((error) =>
                    setSettingsFeedback(error instanceof Error ? error.message : 'Failed to save shortcut settings.')
                  )
              }}
            >
              Save Shortcuts
            </button>
            <button
              type="button"
              onClick={() => {
                void echo.settings.reset().then(() => setSettingsFeedback('Reset to defaults.'))
              }}
            >
              Reset to Defaults
            </button>
          </div>

          {settingsFeedback ? <p className="feedback-label">{settingsFeedback}</p> : null}
        </section>
      ) : null}
    </main>
  )
}
