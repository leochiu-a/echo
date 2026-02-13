import type React from 'react'
import type { CopilotAction } from '@shared/domain/types'
import { cn, previewPrompt, type OverlayContext, type SlashSuggestion } from '../overlay-shared'

interface OverlayPromptSectionProps {
  context: OverlayContext
  commandText: string
  actionLabel: string
  modeSelectLabel: string
  selectedAction: CopilotAction
  slashSuggestions: SlashSuggestion[]
  highlightedSuggestionIndex: number
  isPreloadAvailable: boolean
  isRunning: boolean
  errorText: string | null
  promptInputRef: React.RefObject<HTMLTextAreaElement | null>
  onClearSelection: () => void
  onOpenDashboard: () => void
  onCommandChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void | Promise<void>
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onCloseOverlay: () => void
  onSuggestionHover: (index: number) => void
  onSuggestionApply: (index: number) => void
  onActionChange: (action: CopilotAction) => void
  onCancelRun: () => void
  onExecutePrompt: () => void
}

export function OverlayPromptSection({
  context,
  commandText,
  actionLabel,
  modeSelectLabel,
  selectedAction,
  slashSuggestions,
  highlightedSuggestionIndex,
  isPreloadAvailable,
  isRunning,
  errorText,
  promptInputRef,
  onClearSelection,
  onOpenDashboard,
  onCommandChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onCloseOverlay,
  onSuggestionHover,
  onSuggestionApply,
  onActionChange,
  onCancelRun,
  onExecutePrompt
}: OverlayPromptSectionProps) {
  const hasSelectedText = Boolean(context.selectedText)

  const selectedChipClass = cn(
    'inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border px-1.5 text-[10px] font-semibold text-white/85 [-webkit-app-region:no-drag]',
    hasSelectedText ? 'border-[#aebfd6]/35 bg-[#1c1e23]/90' : 'border-white/10 bg-[#17191d]/80'
  )

  const actionControlClass =
    'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-white/30 p-0 text-[12px] font-semibold leading-none text-[#16181a]/90 [-webkit-app-region:no-drag] disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <section className="grid gap-1.5 rounded-2xl border border-white/20 bg-[radial-gradient(120%_160%_at_100%_0%,rgba(75,91,112,0.22)_0%,rgba(0,0,0,0)_56%),linear-gradient(180deg,rgba(22,25,28,0.95)_0%,rgba(18,21,24,0.95)_100%)] p-1.5 text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] [-webkit-app-region:drag]">
      <header className="flex items-center justify-between gap-2.5">
        <button
          type="button"
          className={selectedChipClass}
          onClick={() => {
            if (hasSelectedText) {
              onClearSelection()
            }
          }}
        >
          <span className="text-sm opacity-80">❝</span>
          <span>{hasSelectedText ? 'Selected text' : 'No selection'}</span>
          {hasSelectedText ? <span className="text-sm leading-none opacity-70">×</span> : null}
        </button>

        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent px-2 py-1 text-[10px] font-medium text-white/75 [-webkit-app-region:no-drag] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={onOpenDashboard}
          disabled={!isPreloadAvailable}
        >
          Dashboard
        </button>
      </header>

      <div className="mt-1 flex items-center gap-1.5">
        <div className="relative flex-1 rounded-[10px] border border-white/5 bg-[#16181c]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] [-webkit-app-region:no-drag]">
          <textarea
            ref={promptInputRef}
            id="prompt-input"
            className="min-h-10 w-full resize-none overflow-y-hidden border-0 bg-transparent px-2 py-[9px] text-[14px] leading-[22px] tracking-[-0.01em] text-white/90 placeholder:text-white/35 focus:outline-none sm:text-[15px]"
            value={commandText}
            placeholder={actionLabel}
            onChange={(event) => onCommandChange(event.target.value)}
            onKeyDown={onKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            autoFocus
            rows={1}
          />
        </div>
        <button
          type="button"
          className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[18px] leading-none text-white/60 [-webkit-app-region:no-drag] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={onCloseOverlay}
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
              onMouseEnter={() => onSuggestionHover(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                onSuggestionHover(index)
                onSuggestionApply(index)
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
            className="h-7 w-[106px] cursor-pointer appearance-none border-0 bg-transparent px-1 py-0 pr-4 text-[12px] font-semibold tracking-[-0.01em] text-white/90 focus:outline-none"
            value={selectedAction}
            onChange={(event) => onActionChange(event.target.value as CopilotAction)}
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
              onClick={onCancelRun}
              disabled={!isPreloadAvailable}
              aria-label="Stop execution"
            >
              ■
            </button>
          ) : (
            <button
              type="button"
              className={actionControlClass}
              onClick={onExecutePrompt}
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
  )
}
