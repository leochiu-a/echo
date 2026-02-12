import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, CopilotAction } from '@shared/domain/types'
import { availableSlashCommands } from '@shared/domain/settings'
import { slashAutocompleteContext } from '@shared/domain/slash'
import { getEchoApi, preloadUnavailableMessage } from '@renderer/shared/echo-api'

interface OverlayContext {
  selectedText: string | null
  hasEditableSelection: boolean
  accessibilityTrusted: boolean
}

interface HistorySnapshot {
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

interface SlashSuggestion {
  id: string
  command: string
  prompt: string
}

export function OverlayApp() {
  const echo = getEchoApi()
  const isPreloadAvailable = echo !== null
  const shellRef = useRef<HTMLElement | null>(null)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [history, setHistory] = useState<HistorySnapshot | null>(null)
  const [context, setContext] = useState<OverlayContext>({
    selectedText: null,
    hasEditableSelection: false,
    accessibilityTrusted: true
  })

  const [commandText, setCommandText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedAction, setSelectedAction] = useState<CopilotAction>('edit')
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [isComposingInput, setIsComposingInput] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0)
  const [presentationRevision, setPresentationRevision] = useState(0)

  const slashSuggestions = useMemo(() => {
    const autocomplete = slashAutocompleteContext(commandText)
    if (!autocomplete || !settings) {
      return []
    }

    const query = autocomplete.query.toLowerCase()
    return availableSlashCommands(settings.slashCommands)
      .filter((item) => !query || item.command.startsWith(query))
      .sort((left, right) => left.command.localeCompare(right.command))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        command: item.command,
        prompt: item.prompt
      }))
  }, [commandText, settings])

  useEffect(() => {
    if (highlightedSuggestionIndex < slashSuggestions.length) {
      return
    }
    setHighlightedSuggestionIndex(Math.max(0, slashSuggestions.length - 1))
  }, [highlightedSuggestionIndex, slashSuggestions.length])

  useEffect(() => {
    if (!echo) {
      setErrorText(preloadUnavailableMessage)
      return
    }

    const offRuntime = echo.runtime.onEvent((event) => {
      if (event.type === 'started') {
        setIsRunning(true)
        setErrorText(null)
        return
      }

      if (event.type === 'delta') {
        setOutputText((current) => `${current}${event.delta}`)
        return
      }

      if (event.type === 'completed') {
        setIsRunning(false)
        if (event.result.exitCode === 0) {
          setErrorText(null)
          if (event.result.stdout) {
            setOutputText(event.result.stdout)
          }
        } else {
          setErrorText(event.result.stderr || `Execution exited with code ${event.result.exitCode}.`)
        }
        return
      }

      if (event.type === 'failed') {
        setIsRunning(false)
        setErrorText(event.message)
        return
      }

      setIsRunning(false)
      setErrorText('Stopped.')
    })

    const offContextReady = echo.overlay.onContextReady((nextContext) => {
      prepareForPresentation(nextContext)
    })

    const offSettingsChanged = echo.settings.onChanged((nextSettings) => {
      setSettings(nextSettings)
    })

    const offHistoryChanged = echo.history.onChanged((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })

    void echo.settings.get().then(setSettings)
    void echo.history.get().then((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot)
    })
    void echo.overlay.captureContext().then((nextContext) => {
      prepareForPresentation(nextContext)
    })

    return () => {
      offRuntime()
      offContextReady()
      offSettingsChanged()
      offHistoryChanged()
    }
  }, [echo])

  async function executePrompt() {
    if (!echo) {
      setErrorText(preloadUnavailableMessage)
      return
    }

    const trimmed = commandText.trim()
    if (!trimmed || isRunning) {
      return
    }

    setOutputText('')
    setErrorText(null)
    setHistoryIndex(null)

    try {
      await echo.runtime.start({
        command: trimmed,
        action: selectedAction,
        selectedText: context.selectedText
      })
    } catch (error) {
      setIsRunning(false)
      setErrorText(error instanceof Error ? error.message : 'Failed to start execution.')
    }
  }

  function prepareForPresentation(nextContext: OverlayContext) {
    setContext(nextContext)
    setSelectedAction('edit')
    setOutputText('')
    setErrorText(null)
    setCopyFeedback(null)
    setHistoryIndex(null)
    setIsComposingInput(false)
    // Force a window height re-measure every time overlay context is refreshed.
    setPresentationRevision((current) => current + 1)
  }

  function historyUp() {
    if (!history || history.commands.length === 0) {
      return
    }

    if (historyIndex === null) {
      const index = history.commands.length - 1
      setHistoryIndex(index)
      setCommandText(history.commands[index] ?? '')
      return
    }

    const nextIndex = Math.max(0, historyIndex - 1)
    setHistoryIndex(nextIndex)
    setCommandText(history.commands[nextIndex] ?? '')
  }

  function historyDown() {
    if (!history || history.commands.length === 0 || historyIndex === null) {
      return
    }

    const nextIndex = historyIndex + 1
    if (nextIndex >= history.commands.length) {
      setHistoryIndex(null)
      setCommandText('')
      return
    }

    setHistoryIndex(nextIndex)
    setCommandText(history.commands[nextIndex] ?? '')
  }

  function applyHighlightedSuggestion(): boolean {
    const suggestion = slashSuggestions[highlightedSuggestionIndex]
    const autocomplete = slashAutocompleteContext(commandText)

    if (!suggestion || !autocomplete) {
      return false
    }

    setCommandText(`${autocomplete.leadingWhitespace}/${suggestion.command} `)
    return true
  }

  async function onCopyOutput() {
    if (!outputText.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(outputText)
      setCopyFeedback('Copied!')
      setTimeout(() => setCopyFeedback(null), 1100)
    } catch {
      setCopyFeedback('Copy failed')
      setTimeout(() => setCopyFeedback(null), 1100)
    }
  }

  async function onApplyOutput(mode: 'replace' | 'insert') {
    if (!echo) {
      setErrorText(preloadUnavailableMessage)
      return
    }

    if (!context.hasEditableSelection || !outputText.trim()) {
      return
    }

    await echo.overlay.applyOutput({ text: outputText, mode })
    await echo.overlay.close()
  }

  async function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isComposingInput) {
      return
    }

    if (event.key === 'Escape') {
      if (!echo) {
        setErrorText(preloadUnavailableMessage)
        return
      }

      event.preventDefault()
      if (isRunning) {
        await echo.runtime.cancel()
      } else {
        await echo.overlay.close()
      }
      return
    }

    if (event.key === 'ArrowUp') {
      if (slashSuggestions.length > 0) {
        event.preventDefault()
        setHighlightedSuggestionIndex((current) =>
          (current - 1 + slashSuggestions.length) % slashSuggestions.length
        )
        return
      }

      event.preventDefault()
      historyUp()
      return
    }

    if (event.key === 'ArrowDown') {
      if (slashSuggestions.length > 0) {
        event.preventDefault()
        setHighlightedSuggestionIndex((current) => (current + 1) % slashSuggestions.length)
        return
      }

      event.preventDefault()
      historyDown()
      return
    }

    if (event.key === 'Tab' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (applyHighlightedSuggestion()) {
        event.preventDefault()
      }
      return
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      if (applyHighlightedSuggestion()) {
        return
      }
      await executePrompt()
    }
  }

  const actionLabel = selectedAction === 'edit'
    ? context.selectedText
      ? 'Edit Selection'
      : 'Edit Text'
    : 'Ask Question'

  const modeSelectLabel = selectedAction === 'edit' ? 'Edit Selection' : 'Ask Question'
  const hasSelectedText = Boolean(context.selectedText)

  useEffect(() => {
    if (!echo || !shellRef.current) {
      return
    }

    const animationFrameID = window.requestAnimationFrame(() => {
      const measuredHeight = Math.ceil(shellRef.current?.getBoundingClientRect().height ?? 0)
      if (measuredHeight > 0) {
        void echo.overlay.resize(measuredHeight + 2)
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrameID)
    }
  }, [echo, outputText, copyFeedback, errorText, slashSuggestions.length, context.accessibilityTrusted, presentationRevision])

  return (
    <main ref={shellRef} className="overlay-shell overlay-shell--reference">
      <section className="composer-card">
        <header className="composer-top-row">
          <button
            type="button"
            className={`selected-chip ${hasSelectedText ? 'active' : ''}`}
            onClick={() => {
              if (hasSelectedText) {
                setContext((current) => ({ ...current, selectedText: null, hasEditableSelection: false }))
              }
            }}
          >
            <span className="chip-mark">❝</span>
            <span>{hasSelectedText ? 'Selected text' : 'No selection'}</span>
            {hasSelectedText ? <span className="chip-close">×</span> : null}
          </button>

          <button
            type="button"
            className="ghost-link"
            onClick={() => {
              if (!echo) {
                setErrorText(preloadUnavailableMessage)
                return
              }
              void echo.overlay.openDashboard()
            }}
            disabled={!isPreloadAvailable}
          >
            Dashboard
          </button>
        </header>

        <div className="composer-input-row">
          <div className="composer-input-shell">
            <textarea
              id="prompt-input"
              className="composer-textarea"
              value={commandText}
              placeholder={actionLabel}
              onChange={(event) => setCommandText(event.target.value)}
              onKeyDown={(event) => void onKeyDown(event)}
              onCompositionStart={() => setIsComposingInput(true)}
              onCompositionEnd={() => setIsComposingInput(false)}
              autoFocus
              rows={1}
            />
          </div>
          <button
            type="button"
            className="input-close-btn"
            onClick={() => {
              if (!echo) {
                setErrorText(preloadUnavailableMessage)
                return
              }
              void echo.overlay.close()
            }}
            disabled={!isPreloadAvailable}
            aria-label="Close overlay"
          >
            ×
          </button>
        </div>

        {slashSuggestions.length > 0 ? (
          <ul className="slash-list slash-list--floating">
            {slashSuggestions.map((item, index) => (
              <li
                key={item.id}
                className={index === highlightedSuggestionIndex ? 'active' : ''}
                onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  setHighlightedSuggestionIndex(index)
                  applyHighlightedSuggestion()
                }}
              >
                <strong>/{item.command}</strong>
                <span>{previewPrompt(item.prompt)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="composer-footer">
          <select
            className="mode-select"
            value={selectedAction}
            onChange={(event) => setSelectedAction(event.target.value as CopilotAction)}
          >
            <option value="edit">{context.selectedText ? 'Edit Selection' : 'Edit Text'}</option>
            <option value="askQuestion">Ask Question</option>
          </select>

          <div className="composer-action-row">
            {isRunning ? (
              <button
                type="button"
                className="run-or-stop-btn stop"
                onClick={() => {
                  if (!echo) {
                    setErrorText(preloadUnavailableMessage)
                    return
                  }
                  void echo.runtime.cancel()
                }}
                disabled={!isPreloadAvailable}
                aria-label="Stop execution"
              >
                ■
              </button>
            ) : (
              <button
                type="button"
                className="run-or-stop-btn run"
                onClick={() => void executePrompt()}
                disabled={!isPreloadAvailable || !commandText.trim()}
                aria-label={`Run ${modeSelectLabel}`}
              >
                ↑
              </button>
            )}

          </div>
        </footer>

        {!context.accessibilityTrusted ? (
          <p className="warning-inline">Accessibility permission required for selected text.</p>
        ) : null}
        {errorText ? <p className="error-label">{errorText}</p> : null}
      </section>

      {(outputText || copyFeedback) ? (
        <section
          className={`overlay-output-block overlay-output-block--compact ${isRunning ? 'is-streaming' : ''}`}
        >
          <header>
            <h2>Output</h2>
          </header>

          {copyFeedback ? <p className="feedback-label">{copyFeedback}</p> : null}
          <pre>{outputText || 'No output yet.'}</pre>

          <div className="output-actions-row">
            <div className="output-actions-left">
              <button
                type="button"
                className="output-action-btn"
                onClick={() => void onCopyOutput()}
                disabled={!outputText.trim()}
                title="Copy output (Command + C)"
              >
                Copy
              </button>
              <span className="output-copy-hint">⌘C to copy output</span>
            </div>

            <div className="output-actions-right">
              <button
                type="button"
                className="output-action-btn"
                onClick={() => void onApplyOutput('replace')}
                disabled={!context.hasEditableSelection || !outputText.trim()}
              >
                Replace
              </button>
              <button
                type="button"
                className="output-action-btn"
                onClick={() => void onApplyOutput('insert')}
                disabled={!context.hasEditableSelection || !outputText.trim()}
              >
                Insert
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}

function previewPrompt(prompt: string): string {
  const singleLine = prompt.replace(/\n+/g, ' ').trim()
  if (singleLine.length <= 96) {
    return singleLine
  }
  return `${singleLine.slice(0, 93)}...`
}
