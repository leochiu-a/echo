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

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
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
  const selectedChipClass = cn(
    'inline-flex h-6 items-center gap-2 rounded-full border px-1.5 text-[10px] font-semibold text-white/85 [-webkit-app-region:no-drag]',
    hasSelectedText ? 'border-[#aebfd6]/35 bg-[#1c1e23]/90' : 'border-white/10 bg-[#17191d]/80'
  )
  const actionControlClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-white/30 p-0 text-[12px] font-semibold leading-none text-[#16181a]/90 [-webkit-app-region:no-drag] disabled:cursor-not-allowed disabled:opacity-45'

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
    <main
      ref={shellRef}
      className="grid h-auto w-full content-start gap-2.5 bg-[radial-gradient(90%_140%_at_100%_0%,rgba(72,89,110,0.22)_0%,rgba(0,0,0,0)_62%),linear-gradient(180deg,#121416_0%,#15181b_100%)] p-1 [-webkit-app-region:drag] sm:p-2"
    >
      <section className="grid gap-1.5 rounded-2xl border border-white/20 bg-[radial-gradient(120%_160%_at_100%_0%,rgba(75,91,112,0.22)_0%,rgba(0,0,0,0)_56%),linear-gradient(180deg,rgba(22,25,28,0.95)_0%,rgba(18,21,24,0.95)_100%)] p-1.5 text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] [-webkit-app-region:drag]">
        <header className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            className={selectedChipClass}
            onClick={() => {
              if (hasSelectedText) {
                setContext((current) => ({ ...current, selectedText: null, hasEditableSelection: false }))
              }
            }}
          >
            <span className="text-sm opacity-80">❝</span>
            <span>{hasSelectedText ? 'Selected text' : 'No selection'}</span>
            {hasSelectedText ? <span className="text-sm leading-none opacity-70">×</span> : null}
          </button>

          <button
            type="button"
            className="border-0 bg-transparent px-2 py-1 text-[10px] font-medium text-white/75 [-webkit-app-region:no-drag] disabled:cursor-not-allowed disabled:opacity-45"
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

        <div className="mt-1 flex items-center gap-1.5">
          <div className="relative flex-1 rounded-[10px] border border-white/5 bg-[#16181c]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] [-webkit-app-region:no-drag]">
            <textarea
              id="prompt-input"
              className="h-10 max-h-10 min-h-10 w-full resize-none overflow-y-hidden border-0 bg-transparent px-2 py-[9px] text-[14px] leading-[22px] tracking-[-0.01em] text-white/90 placeholder:text-white/35 focus:outline-none sm:text-[15px]"
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
            className="h-5 w-5 shrink-0 border-0 bg-transparent p-0 text-[18px] leading-none text-white/60 [-webkit-app-region:no-drag] disabled:cursor-not-allowed disabled:opacity-45"
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
          <ul className="mt-1.5 grid list-none gap-1 p-0 [-webkit-app-region:no-drag]">
            {slashSuggestions.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  'grid cursor-pointer gap-0.5 rounded-[9px] border border-white/15 bg-[#111316]/80 p-1.5',
                  index === highlightedSuggestionIndex && 'border-[#adc4e3]/50 bg-[#2c3848]/70'
                )}
                onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  setHighlightedSuggestionIndex(index)
                  applyHighlightedSuggestion()
                }}
              >
                <strong className="text-[12px] text-[#f7f9fb]">/{item.command}</strong>
                <span className="text-[10px] text-slate-200/70">{previewPrompt(item.prompt)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="mt-1 flex items-center justify-end gap-1.5">
          <div className="relative inline-flex items-center [-webkit-app-region:no-drag]">
            <select
              className="h-7 w-[106px] appearance-none border-0 bg-transparent px-1 py-0 pr-4 text-[12px] font-semibold tracking-[-0.01em] text-white/90 focus:outline-none"
              value={selectedAction}
              onChange={(event) => setSelectedAction(event.target.value as CopilotAction)}
            >
              <option value="edit">{context.selectedText ? 'Edit Selection' : 'Edit Text'}</option>
              <option value="askQuestion">Ask Question</option>
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0.5 top-1/2 inline-flex h-3 w-3 -translate-y-1/2 items-center justify-center text-white/50"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M3 4.75L6 7.5L9 4.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            {isRunning ? (
              <button
                type="button"
                className={actionControlClass}
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
                className={actionControlClass}
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
          <p className="m-0 text-[11px] text-[#f5cd80]">Accessibility permission required for selected text.</p>
        ) : null}
        {errorText ? <p className="m-0 text-xs text-[#8d0801]">{errorText}</p> : null}
      </section>

      {(outputText || copyFeedback) ? (
        <section
          className="mt-0.5 grid gap-1.5 rounded-2xl border border-white/20 bg-[#0f1114]/75 p-2.5 [-webkit-app-region:no-drag]"
        >
          <header className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-[13px] text-white/90">Output</h2>
          </header>

          {copyFeedback ? <p className="m-0 text-xs text-[#0b6e4f]">{copyFeedback}</p> : null}
          <pre
            className={cn(
              'm-0 max-h-[200px] overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/20 bg-[#1a1c20]/90 p-3 text-[13px] text-[#f5f7fa]/90 [scrollbar-gutter:stable]',
              isRunning && 'overflow-hidden [&::-webkit-scrollbar]:hidden'
            )}
          >
            {outputText || 'No output yet.'}
          </pre>

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-[7px] border border-white/20 bg-[#1c1f24]/85 px-2 py-1 text-[11px] leading-[1.2] text-[#f4f7fb]/95 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void onCopyOutput()}
                disabled={!outputText.trim()}
                title="Copy output (Command + C)"
              >
                Copy
              </button>
              <span className="whitespace-nowrap text-[10px] text-slate-200/65">⌘C to copy output</span>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-[7px] border border-white/20 bg-[#1c1f24]/85 px-2 py-1 text-[11px] leading-[1.2] text-[#f4f7fb]/95 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void onApplyOutput('replace')}
                disabled={!context.hasEditableSelection || !outputText.trim()}
              >
                Replace
              </button>
              <button
                type="button"
                className="rounded-[7px] border border-white/20 bg-[#1c1f24]/85 px-2 py-1 text-[11px] leading-[1.2] text-[#f4f7fb]/95 disabled:cursor-not-allowed disabled:opacity-40"
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
