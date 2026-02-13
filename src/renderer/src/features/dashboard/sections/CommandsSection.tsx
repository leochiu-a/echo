import type { AppSettings } from "@shared/domain/types";
import {
  cn,
  dashboardInputClass,
  dashboardPrimaryButtonClass,
  dashboardSecondaryButtonClass,
} from "../dashboard-shared";

interface CommandsSectionProps {
  commandDrafts: AppSettings["slashCommands"];
  commandFeedback: string | null;
  onAddCommand: () => void;
  onSaveCommands: () => void;
  onRemoveCommand: (id: string) => void;
  onUpdateCommand: (id: string, command: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
}

export function CommandsSection({
  commandDrafts,
  commandFeedback,
  onAddCommand,
  onSaveCommands,
  onRemoveCommand,
  onUpdateCommand,
  onUpdatePrompt,
}: CommandsSectionProps) {
  return (
    <section className="grid gap-5" aria-label="Command dashboard view">
      <article className="grid min-w-0 gap-2.5 rounded-2xl border border-white/50 bg-white/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(0,0,0,0.04)]">
        <h3 className="m-0 text-base font-bold text-[#21333d]">Slash command mapping</h3>
        <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
          Type <code>/</code> in the inline input to trigger autocomplete. Use{" "}
          <code>{"{{input}}"}</code> in prompt templates to inject remaining text after the command.
        </p>
        <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
          Example: <code>/reply Thanks for the update</code> {"->"} prompt template receives{" "}
          <code>Thanks for the update</code>.
        </p>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-xs font-semibold text-[#4f616e]">
          {commandDrafts.length} {commandDrafts.length === 1 ? "command" : "commands"}
        </strong>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={dashboardPrimaryButtonClass} onClick={onAddCommand}>
            Add Command
          </button>
          <button type="button" className={dashboardSecondaryButtonClass} onClick={onSaveCommands}>
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
                  onClick={() => onRemoveCommand(item.id)}
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
                    onChange={(event) => onUpdateCommand(item.id, event.target.value)}
                  />
                </div>
              </label>

              <label className="grid gap-1.5 text-[13px] text-[#4f616e]">
                Prompt template
                <textarea
                  className={cn(dashboardInputClass, "min-h-20 resize-y")}
                  value={item.prompt}
                  rows={4}
                  onChange={(event) => onUpdatePrompt(item.id, event.target.value)}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
