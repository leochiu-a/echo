import { cn } from "../overlay-shared";

interface OverlayOutputSectionProps {
  outputText: string;
  copyFeedback: string | null;
  isRunning: boolean;
  hasEditableSelection: boolean;
  onCopyOutput: () => void;
  onApplyOutput: (mode: "replace" | "insert") => void;
}

export function OverlayOutputSection({
  outputText,
  copyFeedback,
  isRunning,
  hasEditableSelection,
  onCopyOutput,
  onApplyOutput,
}: OverlayOutputSectionProps) {
  return (
    <section className="mt-0.5 grid gap-1.5 rounded-2xl border border-white/20 bg-[#0f1114]/75 p-2.5 [-webkit-app-region:no-drag]">
      <header className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[13px] text-white/90">Output</h2>
      </header>

      {copyFeedback ? <p className="m-0 text-xs text-[#0b6e4f]">{copyFeedback}</p> : null}
      <pre
        className={cn(
          "m-0 max-h-[200px] overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/20 bg-[#1a1c20]/90 p-3 text-[13px] text-[#f5f7fa]/90 [scrollbar-gutter:stable]",
          isRunning && "overflow-hidden [&::-webkit-scrollbar]:hidden",
        )}
      >
        {outputText || "No output yet."}
      </pre>

      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            className="cursor-pointer rounded-[7px] border border-white/20 bg-[#1c1f24]/85 px-2 py-1 text-[11px] leading-[1.2] text-[#f4f7fb]/95 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onCopyOutput}
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
            className="cursor-pointer rounded-[7px] border border-white/20 bg-[#1c1f24]/85 px-2 py-1 text-[11px] leading-[1.2] text-[#f4f7fb]/95 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onApplyOutput("replace")}
            disabled={!hasEditableSelection || !outputText.trim()}
          >
            Replace
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-[7px] border border-white/20 bg-[#1c1f24]/85 px-2 py-1 text-[11px] leading-[1.2] text-[#f4f7fb]/95 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onApplyOutput("insert")}
            disabled={!hasEditableSelection || !outputText.trim()}
          >
            Insert
          </button>
        </div>
      </div>
    </section>
  );
}
